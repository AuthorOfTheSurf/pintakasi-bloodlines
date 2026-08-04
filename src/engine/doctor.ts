import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import {
  battleLog,
  birds,
  claims,
  events,
  farms,
  gameState,
  lobbies,
  lobbyEntries,
  snapshots,
  tournamentEntries,
  tournaments,
} from "@/db/schema";
import { CADENCE, ELEMENTS, weatherOfDay } from "./config";
import { GameClock } from "./game-clock";
import { ageOf } from "./lifecycle";
import {
  computeTopline,
  gpFromFaucetsCents,
  gpInWorldCents,
  stakingBook,
  type Topline,
} from "./snapshots";

/**
 * THE DOCTOR (round 24) — one command that answers "is this world healthy?"
 *
 * Built because verification was a browser and ad-hoc SQL: `simulate` printed
 * four numbers a day and asserted NOTHING, so every round ended with ten
 * hand-written sqlite queries, and the two facts that mattered most were the
 * two nobody checked. Both GP burns in this game's history (the gacha's
 * silent spend in round 14, `buyLand` deleting its payment in round 22) would
 * have been caught the first time a sim ran, by the very first invariant here.
 *
 * The split is deliberate:
 *   - INVARIANTS are things that must be true of any world. They fail loudly
 *     and the process exits non-zero, because a world that breaks one is not
 *     "unbalanced", it's broken.
 *   - HEALTH is judgement. It prints, it warns, it never fails a build —
 *     because "46% of entries went home unmatched" is a design conversation,
 *     not a bug. (That number is from round 23, and a human only noticed it
 *     in passing. That's the gap this half exists to close.)
 *
 * Everything reads whole tables and aggregates in JS. There is no raw SQL
 * anywhere in this repo and a 35-day world is a few thousand rows.
 */

/** Tooling thresholds — NOT game balance, which is why they aren't in config. */
const DOCTOR = {
  // Past this, matchmaking is failing rather than merely being unlucky.
  UNMATCHED_WARN: 0.15,
  // A lobby key needs this many entries before its rate means anything — a
  // key with one entry is always either 0% or 100%.
  KEY_MIN_SAMPLE: 8,
  // Half a division's crowns cancelling means the field isn't there.
  CANCELLED_CROWNS_WARN: 0.5,
  OFFENDER_SAMPLE: 5,
  // How far above pure chance the weather-timing rate has to sit before we
  // believe anyone is actually timing entries. 1.15 is loose on purpose: the
  // appetite in bot-config is a deliberate nudge, so the honest expected
  // reading is high-20s against a 20% floor, and a threshold tight enough to
  // catch a 1.05× would fire on ordinary noise in a short world.
  WEATHER_TIMING_WARN_RATIO: 1.15,
  // Below this many entries the ratio is noise — a 30-entry world lands two
  // percentage points either side of chance for no reason at all.
  WEATHER_MIN_SAMPLE: 50,
} as const;

export interface Invariant {
  name: string;
  passed: boolean;
  /** Always populated — a PASS states the number it proved, not just "ok". */
  detail: string;
  offenders?: string[];
}

export interface HealthSection {
  title: string;
  lines: string[];
  warn?: string;
}

export interface DoctorReport {
  dbPath: string;
  topline: Topline;
  /** Per-snapshot GP drift (held minus owed) — only populated on a failure. */
  driftSeries?: { day: number; drift: number }[];
  clock: { day: number; date: string; week: number };
  invariants: Invariant[];
  health: HealthSection[];
  ok: boolean;
}

const gp = (cents: number) => (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
const pct = (n: number, d: number) => (d === 0 ? "0.0%" : `${((n / d) * 100).toFixed(1)}%`);

// ── invariants ──────────────────────────────────────────────────────────────

/**
 * The conservation proof — the invariant this whole tool exists for. Knowing
 * GP went missing is worth little on its own, so a failure also hands over
 * the per-day drift series to read (see the note at the series itself for why
 * it does NOT try to name a single guilty day).
 */
function checkConservation(db: DB): { invariant: Invariant; series?: { day: number; drift: number }[] } {
  const actual = gpInWorldCents(db);
  const expected = gpFromFaucetsCents(db);
  if (actual === expected)
    return {
      invariant: {
        name: "GP conservation",
        passed: true,
        detail: `${gp(actual)} GP in world = ${gp(expected)} expected`,
      },
    };

  const ev = db.select().from(events).all();
  const faucetsThrough = (day: number) => {
    const upTo = ev.filter((e) => e.dayIndex <= day);
    const sumOf = (type: string) =>
      upTo.filter((e) => e.type === type).reduce((s, e) => s + (e.gpCents ?? 0), 0);
    const genesis = upTo
      .filter((e) => e.type === "pool_accrual" && e.data)
      .map((e) => JSON.parse(e.data!) as { juicePoolCents?: number; source?: string })
      .filter((d) => d.source === "genesis")
      .reduce((s, d) => s + (d.juicePoolCents ?? 0), 0);
    return sumOf("farm_registered") + sumOf("check_in") + genesis;
  };

  // WHERE it went. Deliberately NOT a guess at a single culprit day: a tick
  // emits some events before the clock advances and some after, so the daily
  // drift legitimately swings by thousands on a crown day when purses settle
  // across the boundary. A bisect that confidently names the wrong day is
  // worse than none — so this hands over the series and lets a human read it.
  const rows = db.select().from(snapshots).all().sort((a, b) => a.dayIndex - b.dayIndex);
  const series = rows.map((r) => ({
    day: r.dayIndex,
    drift: (JSON.parse(r.data) as Topline).gpCents - faucetsThrough(r.dayIndex),
  }));
  const offenders: string[] = [];
  if (series.length > 1) {
    const settled = series[series.length - 1].drift;
    // The first day the books reach the final discrepancy and never come
    // back is the strongest signal available without over-claiming.
    const stuck = series.find(
      (s, i) => s.drift === settled && series.slice(i).every((t) => t.drift === settled)
    );
    if (stuck)
      offenders.push(`the books settle at this discrepancy from day ${stuck.day} onward`);
    offenders.push(`daily drift series available with --json (${series.length} snapshots)`);
  }

  const delta = actual - expected;
  return {
    invariant: {
      name: "GP conservation",
      passed: false,
      detail:
        `${gp(actual)} in world vs ${gp(expected)} expected — ` +
        `${gp(Math.abs(delta))} GP ${delta < 0 ? "MISSING" : "PRINTED"}`,
      offenders,
    },
    series,
  };
}

/** Nothing may go negative, and cents must stay inside a whole GP. */
function checkNoNegatives(db: DB): Invariant {
  const state = db.select().from(gameState).where(eq(gameState.id, 1)).get()!;
  const allFarms = db.select().from(farms).all();
  const offenders: string[] = [];
  if (state.stakerPoolCents < 0) offenders.push(`staker pool ${gp(state.stakerPoolCents)}`);
  if (state.juicePoolCents < 0) offenders.push(`juice pool ${gp(state.juicePoolCents)}`);
  for (const f of allFarms) {
    if (f.gp < 0) offenders.push(`${f.name} wallet ${f.gp} GP`);
    // Out of range means somebody wrote the wallet without going through
    // creditCents, which is the only doorway fractional money has.
    if (f.gpCents < 0 || f.gpCents > 99) offenders.push(`${f.name} holds ${f.gpCents} cents`);
  }
  return {
    name: "no negative balances",
    passed: offenders.length === 0,
    detail:
      offenders.length === 0
        ? `staker ${gp(state.stakerPoolCents)} · juice ${gp(state.juicePoolCents)} · ${allFarms.length} wallets clean`
        : `${offenders.length} bad balance(s)`,
    offenders: offenders.slice(0, DOCTOR.OFFENDER_SAMPLE),
  };
}

/**
 * The winner of a fight can never figure below the bird it beat (round 20's
 * ruling, and the property `fight-sim` enforces by construction). This is a
 * regression guard on that construction — and it also catches an unmirrored
 * win row, since every fight is contracted to write two.
 *
 * `>=` not `>`: the band clamps at 0, so two dreadful performances can tie.
 */
function checkNoInversions(db: DB): Invariant {
  const log = db.select().from(battleLog).all();
  // One bird meets one opponent at most once inside a lobby or a bracket, so
  // this key is unique — which is what makes finding the mirror row exact.
  const key = (r: (typeof log)[number], self: string, other: string) =>
    `${r.lobbyId ?? `t${r.tournamentId}`}|${self}|${other}`;
  const byKey = new Map(log.map((r) => [key(r, r.birdId, r.opponentBirdId), r]));

  const wins = log.filter((r) => r.result === "win");
  const offenders: string[] = [];
  let inversions = 0;
  let orphans = 0;
  for (const w of wins) {
    const mirror = byKey.get(key(w, w.opponentBirdId, w.birdId));
    if (!mirror) {
      orphans++;
      if (offenders.length < DOCTOR.OFFENDER_SAMPLE)
        offenders.push(`log #${w.id}: win row with no mirrored loss`);
      continue;
    }
    if (mirror.pitFigure > w.pitFigure) {
      inversions++;
      if (offenders.length < DOCTOR.OFFENDER_SAMPLE)
        offenders.push(`log #${w.id}: winner ${w.pitFigure} < loser ${mirror.pitFigure}`);
    }
  }
  return {
    name: "pit figures",
    passed: inversions === 0 && orphans === 0,
    detail: `${wins.length} fights · ${wins.length - orphans} mirrored · ${inversions} inversions`,
    offenders,
  };
}

/** A resolved championship pays out its purse exactly — dust and all. */
function checkPursesSettle(db: DB): Invariant {
  // Only completed crowns: a cancelled one never sets purseCents at all.
  const done = db.select().from(tournaments).all().filter((t) => t.status === "completed");
  const entries = db.select().from(tournamentEntries).all();
  const offenders: string[] = [];
  for (const t of done) {
    const paid = entries
      .filter((e) => e.tournamentId === t.id)
      .reduce((s, e) => s + e.gpWonCents, 0);
    if (paid !== (t.purseCents ?? 0))
      offenders.push(
        `crown #${t.id} wk${t.weekIndex} ${t.format}: paid ${gp(paid)} of ${gp(t.purseCents ?? 0)}`
      );
  }
  return {
    name: "purses settle",
    passed: offenders.length === 0,
    detail:
      done.length === 0
        ? "no completed championships yet"
        : `${done.length} completed crown(s), exact to the cent`,
    offenders: offenders.slice(0, DOCTOR.OFFENDER_SAMPLE),
  };
}

/**
 * One card a day per bird. Tournament rows are excluded deliberately — a
 * bracket legitimately runs one bird six times in an afternoon, which is the
 * ruled back-to-back marathon, not a cap violation.
 */
function checkFightCap(db: DB): Invariant {
  // Every entry, whatever became of it — a bird that went home unmatched
  // still spent its slot that day, so counting only the pending ones would
  // let a historical double-card vanish the moment the card resolved.
  const entries = db.select().from(lobbyEntries).all();
  const buckets = new Map<string, number>();
  for (const e of entries) {
    const k = `${e.birdId}|${e.dayEntered}`;
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  const offenders = [...buckets.entries()]
    .filter(([, n]) => n > CADENCE.FIGHTS_PER_BIRD_PER_DAY)
    .map(([k, n]) => `${k.split("|")[0]} has ${n} entries on day ${k.split("|")[1]}`);
  return {
    name: "one card per bird per day",
    passed: offenders.length === 0,
    detail: `${entries.length} entries across ${buckets.size} bird-days · ${offenders.length} over cap`,
    offenders: offenders.slice(0, DOCTOR.OFFENDER_SAMPLE),
  };
}

// ── health ──────────────────────────────────────────────────────────────────

/**
 * How the daily card is actually doing. Shared with the admin office so the
 * CLI and the browser can't disagree about the same three numbers.
 */
export function cardHealth(db: DB): {
  entries: number;
  fought: number;
  unmatched: number;
  pending: number;
  lobbies: number;
  unmatchedRate: number;
} {
  const entries = db.select().from(lobbyEntries).all();
  const byStatus = { pending: 0, fought: 0, unmatched: 0 };
  for (const e of entries) byStatus[e.status]++;
  const settled = byStatus.fought + byStatus.unmatched;
  return {
    entries: entries.length,
    fought: byStatus.fought,
    unmatched: byStatus.unmatched,
    pending: byStatus.pending,
    lobbies: db.select().from(lobbies).all().length,
    unmatchedRate: settled === 0 ? 0 : byStatus.unmatched / settled,
  };
}

/**
 * IS ANYONE READING THE GOING? (round 25)
 *
 * The daily element weather is a MODIFIER, not a door, so it does not belong
 * in the adoption block below — a farm-count bar would read 15 of 15 the
 * moment a single bird happened to be carded on its own element's day, which
 * proves nothing. What matters is whether entries are being TIMED, and that
 * question has a known null hypothesis: with five elements, a stable that
 * ignores the weather entirely still lands 1-in-5 of its entries on the right
 * day. So the honest measurement is the rate against that floor.
 *
 * Read off the lobby entries, not the battle log, for two reasons: an entry
 * that went home unmatched was still a timing DECISION and should count, and
 * tournament fights are excluded by construction — a crown runs on the day the
 * calendar says, so no barn is choosing anything when it enters one.
 *
 * The day is the lobby's `dayOpened`, which is exactly the day the fight
 * resolves under (see lobbies.ts) — not the entry's, in case those ever part.
 *
 * STARRED entries only (2026-08-04, the stars rework): the weather edge is
 * WEATHER.EDGE × halfStars/10, so a 0★ bird has NO going to play — carding
 * it on "its" day is not a timing decision, it is a coincidence. Counting
 * those entries diluted the ratio toward chance exactly when the bots
 * started (correctly) ignoring the sky for star-less birds.
 */
export function weatherTiming(db: DB): {
  entries: number;
  matched: number;
  rate: number;
  chance: number;
  ratio: number;
} {
  const starred = new Map(
    db.select().from(birds).all().map((b) => [b.id, b.halfStars > 0 ? b.element : null])
  );
  const dayOf = new Map(db.select().from(lobbies).all().map((l) => [l.id, l.dayOpened]));
  let entries = 0;
  let matched = 0;
  for (const e of db.select().from(lobbyEntries).all()) {
    const day = dayOf.get(e.lobbyId);
    const el = starred.get(e.birdId);
    // Skips both a bird deleted out from under its entry and a 0★ bird.
    if (day === undefined || el === undefined || el === null) continue;
    entries++;
    if (el === weatherOfDay(day)) matched++;
  }
  const chance = 1 / ELEMENTS.length;
  const rate = entries === 0 ? 0 : matched / entries;
  return { entries, matched, rate, chance, ratio: rate / chance };
}

function weatherLine(db: DB): { line: string; warn?: string } {
  const w = weatherTiming(db);
  if (w.entries < DOCTOR.WEATHER_MIN_SAMPLE)
    return { line: `weather timing  ${w.entries} entries — too few to read` };
  const verdict =
    w.ratio >= DOCTOR.WEATHER_TIMING_WARN_RATIO
      ? "✓ entries are being timed"
      : "⚠ no better than chance";
  return {
    line:
      `weather timing  ${w.matched}/${w.entries} starred entries ran on the bird's own element day ` +
      `(${pct(w.matched, w.entries)} vs ${(w.chance * 100).toFixed(1)}% by chance, ` +
      `${w.ratio.toFixed(2)}×) ${verdict}`,
    warn:
      w.ratio >= DOCTOR.WEATHER_TIMING_WARN_RATIO
        ? undefined
        : `weather timing is ${w.ratio.toFixed(2)}× chance — nobody is playing the going`,
  };
}

/**
 * Which lobby KEYS strand their birds. The key space is (mode × class ×
 * blade × tag) and it multiplies fast — round 23's claimer keys sent 30 of 42
 * entries home. When the population is thin, this is the number that explains
 * a quiet card, and it's the one to watch as blades are added.
 */
function fragmentation(db: DB): HealthSection {
  const all = db.select().from(lobbies).all();
  const entries = db.select().from(lobbyEntries).all();
  const byKey = new Map<string, { entries: number; unmatched: number }>();
  for (const l of all) {
    const k = `${l.mode}/${l.classType}/${l.format}${l.price ? `@${l.price}` : ""}`;
    const acc = byKey.get(k) ?? { entries: 0, unmatched: 0 };
    for (const e of entries.filter((e) => e.lobbyId === l.id)) {
      acc.entries++;
      if (e.status === "unmatched") acc.unmatched++;
    }
    byKey.set(k, acc);
  }
  const ranked = [...byKey.entries()]
    .filter(([, v]) => v.entries >= DOCTOR.KEY_MIN_SAMPLE)
    .sort((a, b) => b[1].unmatched / b[1].entries - a[1].unmatched / a[1].entries)
    .slice(0, 3);
  return {
    title: "WORST LOBBY KEYS",
    lines:
      ranked.length === 0
        ? [`no key has reached ${DOCTOR.KEY_MIN_SAMPLE} entries yet`]
        : ranked.map(
            ([k, v]) =>
              `${k.padEnd(34)} ${String(v.entries).padStart(4)} entries, ${pct(v.unmatched, v.entries)} unmatched`
          ),
  };
}

/** Where birds come from and where they go — the supply question. */
function population(db: DB, topline: Topline): HealthSection {
  const ev = db.select().from(events).all();
  const week = GameClock.weekOf(topline.day);
  const ages = new Map<number, number>();
  for (const b of db.select().from(birds).all()) {
    if (b.status !== "active") continue;
    const a = Math.max(0, ageOf(b, week));
    ages.set(a, (ages.get(a) ?? 0) + 1);
  }
  const count = (type: string) => ev.filter((e) => e.type === type).length;
  const gachaEggs = ev.filter(
    (e) => e.type === "gacha" && e.data && (JSON.parse(e.data) as { egg?: string | null }).egg
  ).length;
  const retiredBy = new Map<string, number>();
  for (const e of ev.filter((e) => e.type === "retire" && e.data)) {
    const by = (JSON.parse(e.data!) as { by?: string }).by ?? "manual";
    retiredBy.set(by, (retiredBy.get(by) ?? 0) + 1);
  }
  const supply = count("hatch") + gachaEggs;
  const loss = [...retiredBy.values()].reduce((s, n) => s + n, 0);
  return {
    title: "POPULATION",
    lines: [
      `eggs ${topline.eggs} · active ${topline.active} · retired ${topline.retired} · ${topline.farms} farms`,
      "by age  " +
        [...ages.entries()].sort((a, b) => a[0] - b[0]).map(([a, n]) => `${a}:${n}`).join("  "),
      `supply  hatches ${count("hatch")} · gacha eggs ${gachaEggs} · covers ${count("breed")}`,
      "loss    " +
        ([...retiredBy.entries()].map(([by, n]) => `${by} ${n}`).join(" · ") || "none yet"),
    ],
    // The round-23 collapse in one line: births stopped outrunning deaths and
    // the card went quiet three weeks later.
    warn: loss > supply ? `attrition (${loss}) is outrunning supply (${supply})` : undefined,
  };
}

/** What has actually fed the staker pool, by source. */
function stakerInflows(db: DB): HealthSection {
  const bySource = new Map<string, number>();
  for (const e of db.select().from(events).all()) {
    if (e.type !== "pool_accrual" || !e.data) continue;
    const d = JSON.parse(e.data) as { stakerPoolCents?: number; source?: string };
    if (!d.stakerPoolCents) continue;
    const src = d.source ?? "breed"; // pre-round-24 worlds left breed unnamed
    bySource.set(src, (bySource.get(src) ?? 0) + d.stakerPoolCents);
  }
  const book = stakingBook(db);
  const state = db.select().from(gameState).where(eq(gameState.id, 1)).get()!;
  return {
    title: "STAKER POOL",
    lines: [
      `paid out ${gp(book.totalPaidCents)} GP over ${book.payoutDays} day(s) · ` +
        `${gp(state.stakerPoolCents)} waiting · ${book.totalStakedLand.toLocaleString()} LT staked`,
      [...bySource.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([s, c]) => `${s} ${gp(c)}`)
        .join(" · ") || "no inflows yet",
    ],
  };
}

/** Championship fields and purses, split by division. */
function championships(db: DB): HealthSection {
  const all = db.select().from(tournaments).all();
  const entries = db.select().from(tournamentEntries).all();
  const lines: string[] = [];
  let warn: string | undefined;
  for (const division of ["major", "juvenile"] as const) {
    const mine = all.filter((t) => (t.division ?? "major") === division);
    if (mine.length === 0) continue;
    const run = mine.filter((t) => t.status === "completed");
    const cancelled = mine.filter((t) => t.status === "cancelled");
    const fields = run.map(
      (t) =>
        entries.filter(
          (e) => e.tournamentId === t.id && e.status !== "bumped" && e.status !== "refunded"
        ).length
    );
    const avg = fields.length ? fields.reduce((s, n) => s + n, 0) / fields.length : 0;
    lines.push(
      `${division.padEnd(9)} ${run.length} run / ${cancelled.length} cancelled · ` +
        `field ${avg.toFixed(1)} · purse ${gp(run.reduce((s, t) => s + (t.purseCents ?? 0), 0))}`
    );
    const decided = run.length + cancelled.length;
    if (decided > 0 && cancelled.length / decided > DOCTOR.CANCELLED_CROWNS_WARN)
      warn = `${division}: ${cancelled.length} of ${decided} crowns cancelled — the field isn't there`;
  }
  return { title: "CHAMPIONSHIPS", lines: lines.length ? lines : ["none run yet"], warn };
}

/**
 * Did anyone walk through each door? This is the tripwire AGENTS.md asks for:
 * twice a shipped feature measured exactly ZERO because no bot had an
 * appetite for it (claiming in round 19, paid gacha in round 22), and both
 * times it took a whole round to notice.
 */
function adoption(db: DB): HealthSection {
  const ev = db.select().from(events).all();
  const allFarms = db.select().from(farms).all();
  const tEntries = db.select().from(tournamentEntries).all();
  const tById = new Map(db.select().from(tournaments).all().map((t) => [t.id, t]));
  const farmsWhere = (pred: (e: (typeof ev)[number]) => boolean) =>
    new Set(ev.filter((e) => pred(e) && e.farmId).map((e) => e.farmId!));
  const crownFarms = (division: string) =>
    new Set(
      tEntries
        .filter((e) => (tById.get(e.tournamentId)?.division ?? "major") === division)
        .map((e) => e.farmId)
    );

  const doors: [string, Set<string>][] = [
    ["claims placed", new Set(db.select().from(claims).all().map((c) => c.farmId))],
    ["studs listed", farmsWhere((e) => e.type === "stud_listed")],
    ["land purchased", farmsWhere((e) => e.type === "buy_land")],
    [
      "gacha bundles bought",
      // A bundle's payload is shaped differently from a single roll's — parse
      // it rather than matching on the message text.
      farmsWhere(
        (e) =>
          e.type === "gacha" &&
          !!e.data &&
          (JSON.parse(e.data) as { bundle?: boolean }).bundle === true
      ),
    ],
    ["Major entries", crownFarms("major")],
    ["juvenile championship", crownFarms("juvenile")],
  ];

  const total = allFarms.length;
  const dead = doors.filter(([, s]) => s.size === 0).map(([label]) => label);
  return {
    title: `MECHANIC ADOPTION${" ".repeat(12)}farms of ${total}`,
    lines: doors.map(([label, s]) => {
      const bar = "█".repeat(s.size) + "░".repeat(Math.max(0, total - s.size));
      return (
        `${label.padEnd(24)} ${String(s.size).padStart(3)}  ${bar}` +
        (s.size === 0 ? "  ⚠ NOBODY WALKED THROUGH" : "")
      );
    }),
    warn: dead.length ? `${dead.length} door(s) unused: ${dead.join(", ")}` : undefined,
  };
}

// ── the report ──────────────────────────────────────────────────────────────

export function diagnose(db: DB, dbPath: string): DoctorReport {
  const topline = computeTopline(db);
  const clockState = GameClock.stateOf(topline.day);
  const card = cardHealth(db);

  const conservation = checkConservation(db);
  const invariants = [
    conservation.invariant,
    checkNoNegatives(db),
    checkNoInversions(db),
    checkPursesSettle(db),
    checkFightCap(db),
  ];

  const weather = weatherLine(db);
  // Two things can be wrong with the card at once — too few opponents and
  // nobody playing the going — and a section carries one warn, so they share
  // it. Reading "A · B" beats losing one of them to the other.
  const cardWarns = [
    card.unmatchedRate > DOCTOR.UNMATCHED_WARN
      ? `${pct(card.unmatched, card.fought + card.unmatched)} of entries never found an opponent`
      : undefined,
    weather.warn,
  ].filter((w): w is string => !!w);

  const health: HealthSection[] = [
    {
      title: "CARD HEALTH",
      lines: [
        `${card.entries} entries · ${card.fought} fought · ${card.unmatched} unmatched ` +
          `(${pct(card.unmatched, card.fought + card.unmatched)}) · ${card.lobbies} lobbies`,
        weather.line,
      ],
      warn: cardWarns.length ? cardWarns.join(" · ") : undefined,
    },
    fragmentation(db),
    population(db, topline),
    stakerInflows(db),
    championships(db),
    adoption(db),
  ];

  return {
    dbPath,
    topline,
    driftSeries: conservation.series,
    clock: { day: topline.day, date: clockState.date, week: clockState.weekIndex },
    invariants,
    health,
    ok: invariants.every((i) => i.passed),
  };
}

/**
 * Render for a terminal. Returns a string rather than printing, so `simulate`
 * can append it and the tests can assert on it.
 */
export function formatReport(r: DoctorReport, opts: { quiet?: boolean } = {}): string {
  const out: string[] = [];
  out.push(`PINTAKASI DOCTOR · ${r.dbPath}`);
  out.push(
    `day ${r.clock.day} · ${r.clock.date} · week ${r.clock.week} · ` +
      `${r.topline.farms} farms · ${r.topline.birds} birds`
  );
  out.push("");
  out.push("INVARIANTS");
  for (const i of r.invariants) {
    out.push(`  ${i.passed ? "PASS" : "FAIL"}  ${i.name.padEnd(26)} ${i.detail}`);
    for (const o of i.offenders ?? []) out.push(`        ${o}`);
  }

  const warnings = r.health.filter((h) => h.warn).map((h) => h.warn!);
  if (!opts.quiet) {
    for (const section of r.health) {
      out.push("");
      out.push(section.title);
      for (const line of section.lines) out.push(`  ${line}`);
      if (section.warn) out.push(`  ⚠ ${section.warn}`);
    }
  }

  out.push("");
  const failed = r.invariants.filter((i) => !i.passed).length;
  out.push(
    `${warnings.length} warning${warnings.length === 1 ? "" : "s"} · ` +
      `${failed} invariant failure${failed === 1 ? "" : "s"}`
  );
  return out.join("\n");
}
