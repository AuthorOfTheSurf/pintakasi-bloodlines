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
import {
  BREEDING_SHAPES,
  CADENCE,
  ELEMENTS,
  FORMAT_NAMES,
  FORMATS,
  SCOUT,
  weatherOfDay,
  type FightFormat,
} from "./config";
import { BOT_FARMS } from "./bot-config";
import { GameClock } from "./game-clock";
import { gradeOf } from "./grades";
import { ageOf } from "./lifecycle";
import { normalizedScoutFigure } from "./scout";
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
  // Below this many birds per lobby the card is spread too thin to pair
  // reliably. Sized off the round-31 measurement: conjure-on-demand lobbies
  // averaged 2.9 and leaked 16.3% unmatched; the daily card took the same
  // traffic to 7.27 and 5.7%. 5 sits between the two, so a regression toward
  // the old fragmentation warns before the unmatched rate has to.
  FILL_WARN: 5,
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
  // Below this a discovery age bucket is a coin flip's worth of evidence —
  // ten entries swing past any threshold on one lucky card, so the honest
  // report for a thin bucket is "too few to read", not a verdict.
  DISCOVERY_MIN_SAMPLE: 20,
  // How much better a bird's home blade must be than its second-best before
  // the audit is willing to grade the scout on it. In weighted stat points.
  //
  // Round 29 measured the distribution and it is the reason this audit read
  // so badly: the median bird's home blade beats its runner-up by 11.1
  // points, p10 by 1.9, p90 by only 28.3. HALF THE FLOCK HAS NO HOME BLADE
  // WORTH FINDING — those birds are unlearnable by construction, and scoring
  // the scout on them reports noise as failure. On the same logs, restricting
  // to a real home moved scout accuracy 31.2% -> 35.6% (>=10) -> 47.6%
  // (>=25) against an unmoved 20% random baseline. The scout was never as
  // blind as the number said; the DENOMINATOR was full of coin flips.
  //
  // 10 is deliberately the loose cut — it keeps a bit over half the
  // decisions, so the clear-home line is still a big sample rather than a
  // hand-picked one. Both denominators print: the gap between them is the
  // population-shape story, and it belongs in the report, not hidden by it.
  DISCOVERY_HOME_MARGIN: 10,
  // A generation's row prints from the first bird, but the gen-0-vs-deepest
  // VERDICT needs a real sample: the deepest nest in a young world is often
  // one lucky chick, and a single bird's stat roll would swing the whole
  // ladder's story either way.
  GENERATION_MIN_SAMPLE: 10,
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
  /** Omniscient audit of discovery coverage and scout accuracy by fight age. */
  discovery: BladeDiscovery;
  ok: boolean;
}

const gp = (cents: number) => (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
const pct = (n: number, d: number) => (d === 0 ? "0.0%" : `${((n / d) * 100).toFixed(1)}%`);
/** Signed so a baseline of ~0 and a selected +68 read as different things at a glance. */
const signed = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(1)}`;

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
 * Strict `>`: the scorer caps a loser one public band below its winner, even
 * when both independent ghost scores hit the floor.
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
    if (mirror.pitFigure >= w.pitFigure) {
      inversions++;
      if (offenders.length < DOCTOR.OFFENDER_SAMPLE)
        offenders.push(`log #${w.id}: winner ${w.pitFigure} <= loser ${mirror.pitFigure}`);
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
/**
 * HOW DEEP DO LOBBIES ACTUALLY FILL? — the number round 31 was built to move.
 *
 * Fill is the whole mechanism behind the unmatched rate, and nothing reported
 * it. Before the daily card, 74 keys took ~70 entries a day and the average
 * lobby held 2.9 birds against a capacity of 8: a third of unmatched entries
 * were SOLE entrants in a lobby nobody else ever joined, and another third were
 * two barn-mates alone (matchmaking never pairs same-barn birds). Neither is
 * fixable by a better matchmaker — only by making entries collide.
 *
 * So three numbers, and the last two are the diagnosis rather than the symptom:
 *   · mean fill — the headline
 *   · SINGLETONS — a lobby of one is a bird that paid, waited and fought
 *     nobody, and is pure key-space damage
 *   · SAME-BARN-ONLY — every bird in it came from one farm, so all of them
 *     strand. This is also the round-31 watch item: dropping the capacity
 *     removed the round-17 rule capping a farm at half a lobby, and that rule
 *     had no denominator once lobbies became unbounded. If this climbs, the
 *     cap needs replacing with something that works without a capacity.
 */
function lobbyFill(db: DB): HealthSection {
  const entries = db.select().from(lobbyEntries).all();
  const byLobby = new Map<number, Set<string>>();
  const size = new Map<number, number>();
  for (const e of entries) {
    size.set(e.lobbyId, (size.get(e.lobbyId) ?? 0) + 1);
    const farms = byLobby.get(e.lobbyId) ?? new Set<string>();
    farms.add(e.farmId);
    byLobby.set(e.lobbyId, farms);
  }
  const sizes = [...size.values()];
  if (sizes.length === 0) return { title: "LOBBY FILL", lines: ["no lobbies yet"] };
  const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const singletons = sizes.filter((n) => n === 1).length;
  const sameBarn = [...byLobby.entries()].filter(([id, f]) => f.size === 1 && (size.get(id) ?? 0) > 1);
  const stranded = sameBarn.reduce((n, [id]) => n + (size.get(id) ?? 0), 0);
  // A histogram in buckets — the shape matters as much as the mean, because a
  // healthy card is a stack of deep lobbies and not a long tail of thin ones.
  const buckets: [string, (n: number) => boolean][] = [
    ["1", (n) => n === 1],
    ["2-3", (n) => n >= 2 && n <= 3],
    ["4-7", (n) => n >= 4 && n <= 7],
    ["8-15", (n) => n >= 8 && n <= 15],
    ["16+", (n) => n >= 16],
  ];
  const bars = buckets.map(([label, test]) => {
    const n = sizes.filter(test).length;
    return `${label.padStart(5)} ${"█".repeat(Math.round((n / sizes.length) * 24)).padEnd(24)} ${pct(n, sizes.length)}`;
  });
  return {
    title: "LOBBY FILL",
    lines: [
      `mean ${mean.toFixed(2)} birds per lobby · ${sizes.length} lobbies · ` +
        `${singletons} held a single bird (${pct(singletons, sizes.length)})`,
      ...bars,
      `same-barn-only lobbies ${sameBarn.length} · ${stranded} birds stranded with no cross-barn opponent`,
    ],
    warn:
      mean < DOCTOR.FILL_WARN
        ? `lobbies are averaging ${mean.toFixed(1)} birds — the card is spread too thin to pair reliably`
        : undefined,
  };
}

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

/**
 * ── IS THE FLOCK ACTUALLY GETTING BETTER? (round 30) ────────────────────────
 *
 * Every bird now carries a GENERATION (Zane's ruling): starters and gacha
 * pulls are 0, a chick is its dam's generation + 1. The whole game loop —
 * fight, retire, breed, repeat — is a promise that nest N beats nest N−1, and
 * until this section existed there was NO WAY TO SEE WHETHER IT DOES. A world
 * could have been breeding sideways for thirteen simulated weeks and every
 * other number in this report would have looked fine.
 *
 * Two halves of "better", because they are different failures:
 *   - STRONGER — the mean six-stat average, printed as the letter grade a
 *     player would see plus the raw number, since a whole band is a lot of
 *     progress to hide inside one letter. Stars ride along: they are the other
 *     thing breeding is supposed to compound.
 *   - MORE TUNED — the median home-blade margin, the same measurement the
 *     discovery audit grades the scout on. A line that is merely bigger is
 *     easy; a line bred toward a SHAPE is the thing round 29's breeding plan
 *     was for, and it shows up here as a widening margin.
 *
 * The doctor is omniscient and reads raw rows, so the round-28 stat fog does
 * not apply — this is precisely the read no player can run for themselves.
 *
 * HEALTH, never an invariant. A flat ladder is a balance conversation (the
 * breed floor is too low, selection is too weak, gacha 0s are diluting the
 * average); it is not a broken world, and it must never fail a build.
 */
export interface GenerationRow {
  generation: number;
  birds: number;
  /** Mean of the six-stat average — the same scale overallGradeOf bands. */
  meanStat: number;
  meanHalfStars: number;
  /** Median home-blade margin, in weighted stat points. @see homeBlade */
  medianHomeMargin: number;
}

export function generationLadder(db: DB): GenerationRow[] {
  const byGen = new Map<number, { stat: number[]; stars: number[]; margins: number[] }>();
  for (const b of db.select().from(birds).all()) {
    const gen = b.generation;
    let bucket = byGen.get(gen);
    if (!bucket) byGen.set(gen, (bucket = { stat: [], stars: [], margins: [] }));
    bucket.stat.push(
      (b.agility + b.sight + b.stamina + b.gameness + b.station + b.condition) / 6
    );
    bucket.stars.push(b.halfStars);
    bucket.margins.push(homeBlade(b).margin);
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  return [...byGen.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([generation, b]) => ({
      generation,
      birds: b.stat.length,
      meanStat: mean(b.stat),
      meanHalfStars: mean(b.stars),
      medianHomeMargin: median(b.margins),
    }));
}

function generations(db: DB): HealthSection {
  const rows = generationLadder(db);
  // Eggs and the retired count too: this is the BLOODLINE's arithmetic, not
  // the fight card's. A chick that never raced still tells you what the cover
  // that made it was worth.
  const lines = ["gen   birds   mean grade     stars   home margin"];
  for (const r of rows)
    lines.push(
      `${String(r.generation).padEnd(4)}  ${String(r.birds).padStart(5)}   ` +
        `${gradeOf(r.meanStat).padEnd(2)} (${r.meanStat.toFixed(1).padStart(6)})   ` +
        `${(r.meanHalfStars / 2).toFixed(2).padStart(5)}★   ${r.medianHomeMargin.toFixed(1).padStart(6)}`
    );

  // The verdict, in the only comparison that matters: founders against the
  // deepest nest that has enough birds in it to mean anything.
  const founders = rows.find((r) => r.generation === 0);
  const bred = rows.filter((r) => r.generation > 0 && r.birds >= DOCTOR.GENERATION_MIN_SAMPLE);
  const deepest = bred[bred.length - 1];
  let warn: string | undefined;
  if (!founders || !deepest) {
    lines.push(
      rows.length <= 1
        ? "· nothing has been bred yet — every bird in the world is a founder"
        : `· no bred generation has ${DOCTOR.GENERATION_MIN_SAMPLE}+ birds yet — too early to grade the ladder`
    );
  } else {
    const dStat = deepest.meanStat - founders.meanStat;
    const dMargin = deepest.medianHomeMargin - founders.medianHomeMargin;
    lines.push(
      `gen ${deepest.generation} vs gen 0  ${signed(dStat)} mean stat · ` +
        `${signed(deepest.meanHalfStars / 2 - founders.meanHalfStars / 2)}★ · ` +
        `${signed(dMargin)} pts of home margin`
    );
    if (dStat <= 0)
      warn =
        `generation ${deepest.generation} is no stronger than the founders ` +
        `(${signed(dStat)} mean stat) — the breeding loop is running sideways`;
  }
  return { title: "BLOODLINES", lines, warn };
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

/**
 * IS THE FOG ACTUALLY BEING LIFTED? (round 28)
 *
 * Round 28 hid the sheet: a bird's six stats are invisible until it retires,
 * and every stable — player, bot and auto-play alike — now picks blades off
 * the figure-based scout report (Lobbies.scoutReport), buying its evidence
 * with SCOUT.EXPLORE entries at unread blades. The doctor is OMNISCIENT on
 * purpose, so this is the one place allowed to grade that loop against the
 * answer key: for each fight, was the bird carded at its TRUE best blade —
 * the argmax over FORMATS[].weights that the bots lost the day the fog
 * dropped? The players can never run this check; that's exactly why the
 * doctor must.
 *
 * The story a healthy world tells: age-1 entries sit near the 1-in-5 chance
 * floor (the discovery year is SPENT on unread blades, deliberately), and
 * the hit rate climbs as the figures pile up. The report also separates
 * answer coverage (has the true home been tested twice yet?) from scout
 * accuracy once it has. That distinction is what lets a future extreme-first,
 * inward discovery policy prove it is narrowing the search rather than merely
 * checking every blade on a fixed grid.
 */
export interface DiscoveryBucket {
  label: string;
  entries: number;
  /** Actual cards at a true-best blade, whether the scout had evidence or not. */
  hits: number;
  /** Expected exact hits from a random blade choice, accounting for tied homes. */
  randomHits: number;
  /** Actual cards at a true-best blade or its immediate neighbour. */
  nearHits: number;
  /** Expected local hits from a random blade choice, accounting for end blades and tied homes. */
  randomNearHits: number;
  /** Decisions where the bird already had MIN_READS at a true-best blade. */
  covered: number;
  /** Scout's top-ranked blade was truly best, among covered decisions. */
  scoutHits: number;
  /** Scout's top-ranked blade was at a true-best blade or its neighbour. */
  scoutNearHits: number;
  /** Expected exact scout hits from a random ranking, over the same decisions. */
  scoutRandomHits: number;
  /** Covered decisions on birds whose home beats its runner-up by DISCOVERY_HOME_MARGIN. */
  clearCovered: number;
  /** Scout's top-ranked blade was truly best, among clear-home covered decisions. */
  clearScoutHits: number;
  /** Scout's top-ranked blade was on or adjacent to home, among those. */
  clearScoutNearHits: number;
}

export interface BladeDiscovery {
  buckets: DiscoveryBucket[];
  explored: FightFormat[];
  chance: number;
  /** Median home-blade margin across the living answer key — the shape of the flock. */
  medianHomeMargin: number;
  /** Share of birds carrying a home worth finding at all. */
  clearHomeShare: number;
  /** Is the breeding plan actually selecting? @see breedingSelection */
  selection: BreedingSelection | null;
}

/**
 * THE BREEDING PLAN'S ADOPTION CHECK (round 29).
 *
 * This exists because of the house rule that has caught this repo out three
 * times now: adding a door doesn't mean anyone walks through it (claiming in
 * round 19, paid gacha in round 22, and the stud sheet in round 28 — revealed
 * so shoppers could read it, then read by nobody). Round 29 gave the bots a
 * BREEDING_PLAN, and the obvious place to look for it — the flock's median
 * home-blade margin — turned out to be nearly blind to it: `STAT_VARIANCE`
 * hands every foal ~69 points of random separation, so every bird already has
 * a home by accident and the median barely twitches under real selection.
 *
 * So measure the CHOICE instead of its downstream echo. Each bot barn breeds
 * toward a house shape; for every cover it bought, how far along THAT axis did
 * the parents it picked actually sit, against the flock it picked them from?
 * Sires well above the flock baseline means the plan is choosing. Sires AT the
 * baseline means it is shuffling, whatever the config says.
 *
 * Bot barns only — a player farm has no declared house shape to score against,
 * and guessing one from its flock would grade the plan on its own output.
 */
export interface BreedingSelection {
  covers: number;
  /** Median own-best separation over EVERY bird — how shaped a bird is by accident. */
  flock: number;
  /** …over the dams actually covered. The raw material a barn had to work with. */
  dams: number;
  /**
   * The one that grades round 30's ruling. For each cover, how far the chosen
   * SIRE sits along the DAM's own shape — "a b1/b2 hen should breed with a
   * b1/b2 rooster." Its floor is `sireBaseline`, not `flock`: a sire picked
   * blind sits near zero along someone else's axis, because a separation
   * measured on an axis you did not choose is a signed quantity that cancels.
   */
  sires: number;
  /** What an unchosen sire scores on the same axes — the honest floor for `sires`. */
  sireBaseline: number;
  /** …and where the foals landed, along the shape their cover was aimed at. */
  foals: number;
}

/**
 * THE ANSWER KEY, for one bird — read straight off the hidden sheet.
 *
 * `best` is a SET, not a single winner: every blade's weights sum to 1, so a
 * flat-statted bird genuinely is equally good everywhere, and scoring its every
 * entry a miss would report noise as failure. (Epsilon because those weight
 * sums only agree to floating point.)
 *
 * `margin` is how far the home blade beats the runner-up. A bird whose top two
 * blades are a point apart has no home to find, and grading a scout on it is
 * grading a coin flip — see DOCTOR.DISCOVERY_HOME_MARGIN. Round 30 pulled this
 * out of bladeDiscovery so the generation ladder can ask the same question of
 * the same arithmetic: "is nest N better TUNED than nest N−1" is only
 * meaningful if it is the identical measurement the scout audit is graded on.
 */
function homeBlade(b: { agility: number; sight: number; stamina: number; gameness: number }): {
  best: Set<FightFormat>;
  margin: number;
} {
  const score = (f: FightFormat) => {
    const w = FORMATS[f].weights;
    return (
      b.agility * w.agility + b.sight * w.sight + b.stamina * w.stamina + b.gameness * w.gameness
    );
  };
  const scores = FORMAT_NAMES.map(score);
  const top = Math.max(...scores);
  const runnerUp = Math.max(...scores.filter((s) => s < top - 1e-9));
  return {
    best: new Set(FORMAT_NAMES.filter((f) => score(f) >= top - 1e-6)),
    // A tie at the top IS a zero margin — the flat bird, every blade its home.
    margin: Number.isFinite(runnerUp) ? top - runnerUp : 0,
  };
}

export function bladeDiscovery(db: DB): BladeDiscovery {
  const allBirds = db.select().from(birds).all();
  const birdById = new Map(allBirds.map((b) => [b.id, b]));
  const bestOf = new Map<string, Set<FightFormat>>();
  const marginOf = new Map<string, number>();
  for (const b of allBirds) {
    const { best, margin } = homeBlade(b);
    bestOf.set(b.id, best);
    marginOf.set(b.id, margin);
  }

  const emptyBucket = () => ({
    entries: 0, hits: 0, randomHits: 0, nearHits: 0, randomNearHits: 0,
    covered: 0, scoutHits: 0, scoutNearHits: 0, scoutRandomHits: 0,
    clearCovered: 0, clearScoutHits: 0, clearScoutNearHits: 0,
  });
  const buckets = [
    { label: "age 1  ", ...emptyBucket() },
    { label: "age 2–3", ...emptyBucket() },
    { label: "age 4+ ", ...emptyBucket() },
  ];
  const explored = new Set<FightFormat>();
  // Rebuild every bird's report one result at a time. A final report would
  // leak future figures into an earlier decision, exactly the hindsight this
  // audit exists to prevent.
  const history = new Map<string, Record<FightFormat, { fights: number; figureTotal: number }>>();
  const rows = db.select().from(battleLog).all().sort((a, b) => a.dayIndex - b.dayIndex || a.id - b.id);
  for (const r of rows) {
    const bird = birdById.get(r.birdId);
    if (!bird) continue; // a bird deleted out from under its history
    // Age AT THE FIGHT, not today — a retiree's whole career would land in
    // the 4+ bucket otherwise. Same derivation as ageOf (week - birthWeek),
    // but pinned to the fight's own day instead of the current clock.
    const age = Math.max(0, GameClock.weekOf(r.dayIndex) - bird.birthWeek);
    const bucket = buckets[age <= 1 ? 0 : age <= 3 ? 1 : 2];
    const best = bestOf.get(bird.id)!;
    const withinOne = (format: FightFormat) =>
      [...best].some((home) => Math.abs(FORMAT_NAMES.indexOf(format) - FORMAT_NAMES.indexOf(home)) <= 1);

    // Only a DAILY CARD is a blade decision. A tournament bout's format is
    // fixed by the bracket the barn already entered — round two of a Major is
    // nobody choosing anything, and counting it scored the committee's
    // schedule as if it were the stable's judgement. The row still feeds the
    // history below: a bracket fight is real evidence even when it wasn't a
    // choice.
    const isDecision = r.tournamentId === null;
    if (isDecision) {
      bucket.entries++;
      if (best.has(r.format)) bucket.hits++;
      if (withinOne(r.format)) bucket.nearHits++;
      bucket.randomHits += best.size / FORMAT_NAMES.length;
      bucket.randomNearHits += FORMAT_NAMES.filter(withinOne).length / FORMAT_NAMES.length;
      if (age <= 1) explored.add(r.format);
    }

    const records = history.get(bird.id) ?? Object.fromEntries(
      FORMAT_NAMES.map((f) => [f, { fights: 0, figureTotal: 0 }])
    ) as Record<FightFormat, { fights: number; figureTotal: number }>;
    const covered = [...best].some((f) => records[f].fights >= SCOUT.MIN_READS);
    if (isDecision && covered) {
      bucket.covered++;
      bucket.scoutRandomHits += best.size / FORMAT_NAMES.length;
      const score = (f: FightFormat) => {
        const rec = records[f];
        const average = rec.fights === 0 ? 0 : rec.figureTotal / rec.fights;
        return Math.round(
          ((average * rec.fights + SCOUT.PRIOR_FIGURE * SCOUT.PRIOR_WEIGHT) /
            (rec.fights + SCOUT.PRIOR_WEIGHT)) * 10
        ) / 10;
      };
      const scoutBest = FORMAT_NAMES.reduce((bestFormat, f) =>
        score(f) > score(bestFormat) ? f : bestFormat
      );
      const hit = best.has(scoutBest);
      const near = withinOne(scoutBest);
      if (hit) bucket.scoutHits++;
      if (near) bucket.scoutNearHits++;
      if (marginOf.get(bird.id)! >= DOCTOR.DISCOVERY_HOME_MARGIN) {
        bucket.clearCovered++;
        if (hit) bucket.clearScoutHits++;
        if (near) bucket.clearScoutNearHits++;
      }
    }
    records[r.format].fights++;
    records[r.format].figureTotal += normalizedScoutFigure(
      r.pitFigure,
      r.selfGrade as import("./grades").Grade,
      r.opponentGrade as import("./grades").Grade
    );
    history.set(bird.id, records);
  }
  // The shape of the flock itself. Reported beside the accuracy because it is
  // the CEILING on it: a world breeding flat birds cannot have a discovery
  // loop no matter how good the scout gets.
  const margins = [...marginOf.values()].sort((a, b) => a - b);
  return {
    buckets,
    explored: FORMAT_NAMES.filter((f) => explored.has(f)),
    chance: 1 / FORMAT_NAMES.length,
    medianHomeMargin: margins.length ? margins[Math.floor(margins.length / 2)] : 0,
    clearHomeShare: margins.length
      ? margins.filter((m) => m >= DOCTOR.DISCOVERY_HOME_MARGIN).length / margins.length
      : 0,
    selection: breedingSelection(db),
  };
}

const median = (xs: number[]) =>
  xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0;

export function breedingSelection(db: DB): BreedingSelection | null {
  const rows = db.select().from(birds).all();
  const byId = new Map(rows.map((b) => [b.id, b]));
  const houseOf = new Map(
    BOT_FARMS.map((b) => [b.id, BREEDING_SHAPES[b.housePair % BREEDING_SHAPES.length]])
  );
  type Shape = (typeof BREEDING_SHAPES)[number];
  const sep = (b: (typeof rows)[number], s: Shape) =>
    (b[s.pair[0]] + b[s.pair[1]]) / 2 - (b[s.off[0]] + b[s.off[1]]) / 2;

  // Each bird's OWN grain: the shape it leans toward hardest. Round 30 moved
  // the bots off a single house axis per barn and onto the hen's own shape
  // (Zane: "each hen is different, and ought to be bred strategically"), so
  // grading every cover against the barn's axis measured the policy the bots
  // had just stopped following — it read dams at −9.0 and called a working
  // plan broken. The ruler has to follow the ruling.
  const ownBest = (b: (typeof rows)[number]) =>
    BREEDING_SHAPES.reduce((best, s) => Math.max(best, sep(b, s)), -Infinity);
  const ownShape = (b: (typeof rows)[number]) =>
    BREEDING_SHAPES.reduce((best, s) => (sep(b, s) > sep(b, best) ? s : best), BREEDING_SHAPES[0]);

  const sires: number[] = [];
  const dams: number[] = [];
  const foals: number[] = [];
  const baseline: number[] = [];
  for (const foal of rows) {
    if (!foal.fatherId || !foal.motherId) continue;
    // The barn that OWNS the foal is the barn that bought the cover: a hen's
    // owner keeps her egg, and a bird can only change hands after it hatches.
    if (!houseOf.has(foal.farmId)) continue; // a player farm — not running the plan
    const sire = byId.get(foal.fatherId);
    const dam = byId.get(foal.motherId);
    if (!dam) continue;
    const aim = ownShape(dam); // the axis this cover was aimed down
    dams.push(ownBest(dam));
    if (sire) sires.push(sep(sire, aim));
    foals.push(sep(foal, aim));
    // What the barn WOULD have scored had it grabbed a bird at random for
    // this same hen. Pooled over every cover, so the floor is measured on the
    // very axes the plan chose rather than on one stand-in axis.
    baseline.push(median(rows.map((b) => sep(b, aim))));
  }
  if (foals.length === 0) return null;
  return {
    covers: foals.length,
    flock: median(rows.map(ownBest)),
    dams: median(dams),
    sires: median(sires),
    sireBaseline: median(baseline),
    foals: median(foals),
  };
}

function discovery(d: BladeDiscovery): HealthSection {
  const lines = d.buckets.map((b) =>
    b.entries < DOCTOR.DISCOVERY_MIN_SAMPLE
      ? `${b.label}  ${b.entries} card decisions — too few to read`
      : `${b.label}  carded ${b.hits}/${b.entries} at the true best blade (${pct(b.hits, b.entries)} vs random ${pct(b.randomHits, b.entries)})` +
        ` · ${pct(b.nearHits, b.entries)} on or adjacent (random ${pct(b.randomNearHits, b.entries)})` +
        ` · answer coverage ${pct(b.covered, b.entries)}` +
        ` · SCOUT ${b.covered === 0 ? "n/a" : `${b.scoutHits}/${b.covered} right (${pct(b.scoutHits, b.covered)} vs random ${pct(b.scoutRandomHits, b.covered)})` +
          `, ${pct(b.scoutNearHits, b.covered)} on or adjacent` +
          `${b.clearCovered === 0 ? "" : ` · clear home ${b.clearScoutHits}/${b.clearCovered} (${pct(b.clearScoutHits, b.clearCovered)}, ${pct(b.clearScoutNearHits, b.clearCovered)} adjacent)`}`}`
  );
  const blades = FORMAT_NAMES.length;
  lines.push(`explored  ${d.explored.length}/${blades} blades saw an age-1 entry in the discovery year`);
  // The answer key's own difficulty. A flock bred flat has nothing to find.
  lines.push(
    `flock shape  median home blade beats its runner-up by ${d.medianHomeMargin.toFixed(1)} pts · ` +
      `${(d.clearHomeShare * 100).toFixed(1)}% of birds clear the ${DOCTOR.DISCOVERY_HOME_MARGIN}-pt bar`
  );
  // The plan's adoption check — see BreedingSelection for why the line above
  // cannot answer this on its own.
  const sel = d.selection;
  if (sel)
    lines.push(
      `breeding  ${sel.covers} bot covers · hens carry ${signed(sel.dams)} of their own shape (any bird: ${signed(sel.flock)}) · ` +
        `the sires chosen reinforce it by ${signed(sel.sires)} (an unchosen sire: ${signed(sel.sireBaseline)}) · ` +
        `foals land at ${signed(sel.foals)}`
    );

  const [juv, , vet] = d.buckets;
  // The trend verdict needs BOTH ends of the career to be readable — a
  // young world with no 4+ fights yet has nothing to converge TO.
  const readable =
    juv.entries >= DOCTOR.DISCOVERY_MIN_SAMPLE && vet.entries >= DOCTOR.DISCOVERY_MIN_SAMPLE;
  // Round 29: judged on the SCOUT'S OWN ranking against its own random
  // baseline, not on raw selected-format hits. The old verdict graded the
  // wrong thing — a card lands where the scout said AND where EXPLORE sent
  // it AND where the lobby had room, so "hit rate climbed" could be true
  // while the report itself taught nobody anything. What we actually want to
  // know is whether the evidence, once a bird has it, ranks blades better
  // than chance. Measured on birds that have a home to find, because the
  // others are coin flips wearing a denominator (DISCOVERY_HOME_MARGIN).
  const gradable = vet.clearCovered >= DOCTOR.DISCOVERY_MIN_SAMPLE;
  const scoutRate = gradable ? vet.clearScoutHits / vet.clearCovered : 0;
  const teaching = gradable && scoutRate > d.chance;
  if (gradable)
    lines.push(
      teaching
        ? `✓ the scout beats chance on mature birds with a home — ${pct(vet.clearScoutHits, vet.clearCovered)} vs ${(d.chance * 100).toFixed(1)}%`
        : `⚠ the scout is at chance on mature birds with a home — ${pct(vet.clearScoutHits, vet.clearCovered)} vs ${(d.chance * 100).toFixed(1)}%`
    );
  else if (readable) lines.push("· too few mature clear-home reads to grade the scout");

  const warns = [
    gradable && !teaching
      ? `the figures are not teaching: scout ranks ${pct(vet.clearScoutHits, vet.clearCovered)} on ` +
        `age-4+ birds with a real home, against ${(d.chance * 100).toFixed(1)}% by chance`
      : undefined,
    // Not a scout failure — a BREEDING failure, and it caps everything above.
    d.clearHomeShare < 0.5
      ? `only ${(d.clearHomeShare * 100).toFixed(1)}% of birds have a home blade worth finding — ` +
        `the flock is being bred flat, so there is little for discovery to discover`
      : undefined,
  ].filter((w): w is string => !!w);
  return { title: "DISCOVERY", lines, warn: warns.length ? warns.join(" · ") : undefined };
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
  const discoveryAudit = bladeDiscovery(db);
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
    lobbyFill(db),
    fragmentation(db),
    population(db, topline),
    // Right after POPULATION: that section counts the flock, this one asks
    // whether the birds coming out of it are any better than the ones going in.
    generations(db),
    stakerInflows(db),
    championships(db),
    adoption(db),
    discovery(discoveryAudit),
  ];

  return {
    dbPath,
    topline,
    driftSeries: conservation.series,
    clock: { day: topline.day, date: clockState.date, week: clockState.weekIndex },
    invariants,
    health,
    discovery: discoveryAudit,
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
