import { eq, sql, type SQL } from "drizzle-orm";
import type { DB } from "@/db/client";
import {
  battleLog,
  birdForm,
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
  breakEvenPurse,
  JUVENILE_MAJOR,
  PINTAKASI,
  purseShareOf,
  CADENCE,
  CALENDAR,
  barnCapacity,
  ECONOMY,
  ELEMENTS,
  FIGHTS_PER_GROUP_BIRD,
  FORMAT_NAMES,
  FORMATS,
  LAND,
  LT_CENTS,
  SCOUT,
  STUD_PRICE,
  landForFight,
  stakePerFight,
  weatherOfDay,
  type FightFormat,
} from "./config";
import { BOT_FARMS } from "./bot-config";
import { GameClock } from "./game-clock";
import { replayFidelity } from "./replay";
import { gradeOf, type Grade } from "./grades";
import { ageOf } from "./lifecycle";
import { normalizedScoutFigure } from "./scout";
import {
  computeTopline,
  GP_FAUCETS,
  GP_SINKS,
  gpFlowsByDay,
  gpOwedCents,
  gpInWorldCents,
  stakingBook,
  type GpFlowDay,
  type Topline,
  type WalletSpread,
} from "./snapshots";

/**
 * game_state row 1 is written by seedGame and never deleted, so a world
 * without it is not one the doctor can examine — say so instead of crashing
 * on a property read.
 */
function stateRow(db: DB) {
  const state = db.select().from(gameState).where(eq(gameState.id, 1)).get();
  if (!state) throw new Error("doctor: game_state row 1 missing — not a seeded world");
  return state;
}

/** Discovery-audit age bucket: 0 = age 0–1, 1 = age 2–3, 2 = age 4+. */
function ageBucket(age: number): number {
  if (age <= 1) return 0;
  if (age <= 3) return 1;
  return 2;
}

/** A lookup the surrounding code has already guaranteed; `why` names the guarantee. */
function must<T>(value: T | undefined, why: string): T {
  if (value === undefined) throw new Error(`doctor: ${why}`);
  return value;
}

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

/**
 * Tooling thresholds — NOT game balance, which is why they aren't in config.
 *
 * ⚠ NOTHING HERE IS DENOMINATED IN LAND, and that is worth stating rather than
 * leaving to be rediscovered. Round 36 moved Land Tokens to hundredths, which
 * would have silently multiplied any land-unit threshold in this block by 100 —
 * a warning that stops firing is invisible in a way a wrong printed number is
 * not. Every knob below is a RATIO or a COUNT, so the move was a no-op here.
 * If a land threshold is ever added, write it as `n * LT_CENTS`.
 */
const DOCTOR = {
  // Past this, matchmaking is failing rather than merely being unlucky.
  //
  // Tightened 0.15 -> 0.05 by the round-34 group stage. Under PAIRS an entry
  // went home for three different reasons — it was alone in its lobby, its
  // only company was a barn-mate, or it was the odd bird out of an odd field —
  // and round 31 measured those at roughly a third each of a 4.5% rate (5.7%
  // in round 32). Groups delete the third one outright: a field is dealt into
  // groups of up to four, so there is no such thing as an odd bird any more.
  // The two structural causes remain, so the honest expectation is ~2%, not 0.
  // 0.05 sits under what used to be NORMAL while still leaving 2.5× headroom —
  // a thin early world full of one-bird lobbies should be caught by FILL_WARN,
  // which names the actual cause, rather than tripping this one first.
  UNMATCHED_WARN: 0.05,
  // Below this share of settled entries getting the FULL card, the deal is
  // failing (round 34). Deliberately well under 100%, because the levelling
  // rule in dealGroups CAPS what is reachable: nine entries become 3+3+3 on
  // purpose, so that lobby scores zero full cards while being dealt perfectly.
  // Walking the achievable share for a lobby of n = 4…16 (the birds sitting in
  // a group of exactly GROUP.SIZE, over n) gives 1, 0, 0, .57, 1, 0, .40, .73,
  // 1, .31, .57, .80, 1 — an average near 0.49, and higher once weighted by
  // entries since the big lobbies are the ones full of fours. Barn-mate
  // collisions shave a little more off. So a healthy world reads around a
  // half; 0.35 is comfortably below that and still far above a deal that has
  // genuinely stopped grouping.
  FULL_CARD_WARN: 0.35,
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
  // ── ECONOMY (the economy rounds, 2026-10) ─────────────────────────────────
  // How many of the latest COMPLETE weeks the weekly money table prints. Six
  // shows a trend without burying the block; the whole-run totals sit above it.
  ECONOMY_WEEKS: 6,
  // Below this share of the SETTLED retired hens having ever carried, the
  // breeding loop is leaving capacity on the floor (round 32). Deliberately
  // well under 100%: the plan is SUPPOSED to reject hens, so a band where
  // every mare carries would mean nobody is selecting. 0.7 was tight enough
  // to have caught round 31, which measured 47%.
  BRED_BAND_WARN: 0.7,
  // How long a hen gets to come up in her barn's ranked list before her being
  // barren counts against the world. A hen who retired on the last Hatch
  // Friday has not been passed over — she has not had her turn — and the
  // round-32 sim retired 32 in its final week, enough to read a real 76% as
  // 64% and warn about nothing. One week would be the honest floor since
  // covers are bought daily; two leaves room for a deep band to work through
  // a backlog after a heavy Friday.
  BRED_BAND_GRACE_WEEKS: 2,
  // The stud market's price-vs-outcome table reads only covers bought at least
  // this many days before the world's last day (round 70, second pass). The
  // egg takes up to two weeks to lay and hatch, and a chick needs most of a
  // career behind it before its earnings mean anything; a cover bought last
  // month would read every dear stud as a loss. The owner set 82.
  STUD_OUTCOME_CAREER_DAYS: 82,
  // ── COHORTS (simulate --latecomers) ───────────────────────────────────────
  // The farm ages, in whole weeks since joining, the same-age table compares
  // at. Doubling early, where the gap opens fastest, then every four weeks.
  COHORT_AGES: [1, 2, 4, 8, 12, 16, 20, 24],
  // Joining-week bands. A month of lag, a season of lag, and later: the
  // owner's question is whether how late you join decides how far you get.
  COHORT_BANDS: [
    { label: "joined wk 1-4", lo: 1, hi: 4 },
    { label: "joined wk 5-12", lo: 5, hi: 12 },
    { label: "joined wk 13+", lo: 13, hi: Infinity },
  ],
  OFFENDER_SAMPLE: 5,
  // How many archived fights the replay check rebuilds (round 38).
  //
  // Sampled because replaying every fight would cost more than the entire
  // rest of the report, and cheap because the failure it watches for is not
  // subtle: a change to simulatePair, FORMATS, BATTLE, FIGURE or the rng
  // orphans EVERY fight fought before it, so 200 either comes back clean or
  // comes back obviously broken. A reading strictly between the two means
  // something weirder than a retune and deserves the dig. (200 is a smaller
  // share of a 182-day world's ~60k fights than of the 91-day world it was
  // sized on — still fit for purpose, for exactly the all-or-nothing reason
  // above.)
  REPLAY_SAMPLE: 200,
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
  // ── FIGHT VOLUME trough detection (round 43) ──────────────────────────────
  // Every fresh world has a fight-volume crash in weeks 4–6 and it is NOT a
  // collapse: the seeded age-3 founder flock is culled by the hardcore Majors
  // before the first bred generation reaches fighting age, so volume falls ~4×
  // and comes back. It cost a round-42 subagent a full investigation to
  // rediscover that, which is exactly the kind of tuition this report exists
  // to stop paying twice. These three knobs let the doctor tell the expected
  // dip from the real thing — all RATIOS and COUNTS, never absolutes, because
  // absolute volume scales with farm count and this must survive a bigger world.
  //
  // Fewer complete weeks than this and the section renders no verdict at all:
  // the trough bottoms in week 5, so a shorter world simply hasn't seen it.
  TROUGH_WINDOW: 4,
  // A week under this fraction of the best earlier week counts as a trough.
  // The historical dip is 145/1092 ≈ 0.13 (fights/week, round-42 baseline), so
  // 0.5 has ~4× headroom while still ignoring ordinary week-to-week wobble.
  TROUGH_DEPTH: 0.5,
  // A later week at or above this fraction of the pre-trough peak counts as
  // recovered. Historical recovery is 871/1092 ≈ 0.80 within two weeks of the
  // bottom, and the following week clears the old peak entirely.
  TROUGH_RECOVERY: 0.75,
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
  /**
   * Fights fought per day, diffed from the daily snapshots. ALWAYS populated,
   * unlike driftSeries — volume is health, not forensics, and the FIGHT VOLUME
   * section is built from exactly this array so a JSON consumer sees the same
   * data the terminal reader does.
   */
  fightSeries: { day: number; fights: number }[];
  clock: { day: number; date: string; week: number };
  invariants: Invariant[];
  health: HealthSection[];
  /** Omniscient audit of discovery coverage and scout accuracy by fight age. */
  discovery: BladeDiscovery;
  /** The money: faucets, sinks, supply, wallets, purses (the ECONOMY section). */
  economy: EconomyReport;
  /** The open stud market: prices, premiums and who earns (STUD MARKET). */
  studs: StudMarketReport;
  /** Null unless a player farm joined after day 0. */
  cohorts: CohortReport | null;
  ok: boolean;
}

const gp = (cents: number) => (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
/** Whole GP with a sign, for per-chick averages where the cents are noise. */
const signedGp = (cents: number) => {
  const whole = Math.round(cents / 100);
  return `${whole > 0 ? "+" : ""}${whole.toLocaleString("en-US")}`;
};
/**
 * Land Tokens for the terminal. Land is minted in HUNDREDTHS since round 36
 * (see LT_CENTS), so every raw land figure reaching this file is 100× what a
 * player calls it — printing one unscaled is precisely the class of bug that
 * round existed to kill. Always two decimals: a column where 673 renders "6.73"
 * and 500 renders "5" invites the reader to mistake a scale change for a value.
 */
const lt = (cents: number) =>
  (cents / LT_CENTS).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
function checkConservation(db: DB): {
  invariant: Invariant;
  series?: { day: number; drift: number }[];
} {
  const actual = gpInWorldCents(db);
  const expected = gpOwedCents(db);
  if (actual === expected)
    return {
      invariant: {
        name: "GP conservation",
        passed: true,
        detail: `${gp(actual)} GP in world = ${gp(expected)} expected`,
      },
    };

  // Queried once and cut per snapshot, rather than gpOwedCents per day.
  const created = gpFlowsByDay(db, GP_FAUCETS);
  const destroyed = gpFlowsByDay(db, GP_SINKS, -1);
  const through = (rows: typeof created, day: number) =>
    rows.filter((f) => f.day <= day).reduce((s, f) => s + f.cents, 0);
  const faucetsThrough = (day: number) => through(created, day) - through(destroyed, day);

  // WHERE it went. Deliberately NOT a guess at a single culprit day: a tick
  // emits some events before the clock advances and some after, so the daily
  // drift legitimately swings by thousands on a crown day when purses settle
  // across the boundary. A bisect that confidently names the wrong day is
  // worse than none — so this hands over the series and lets a human read it.
  const rows = db
    .select()
    .from(snapshots)
    .all()
    .sort((a, b) => a.dayIndex - b.dayIndex);
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
    if (stuck) offenders.push(`the books settle at this discrepancy from day ${stuck.day} onward`);
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
  const state = stateRow(db);
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
  // Still true after the group stage (round 34): a bird now has up to three
  // opponents in one lobby, but each is a DISTINCT bird met once, because a
  // group is a round-robin over a set. Only a repeat PAIRING would collide,
  // and nothing deals one.
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
  const done = db
    .select()
    .from(tournaments)
    .all()
    .filter((t) => t.status === "completed");
  const entries = db.select().from(tournamentEntries).all();
  // Grouped once (round 43): this used to re-filter every tournament entry in the
  // world per completed crown, which is O(crowns × entries) for a sum SQLite-shaped
  // data already knows how to bucket. Same arithmetic, one pass.
  const paidBy = new Map<number, number>();
  for (const e of entries)
    paidBy.set(e.tournamentId, (paidBy.get(e.tournamentId) ?? 0) + e.gpWonCents);
  const offenders: string[] = [];
  for (const t of done) {
    const paid = paidBy.get(t.id) ?? 0;
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
 * NO ENTRY OUTLIVES ITS CHAMPIONSHIP — the eighth invariant (round 41).
 *
 * A `pending` tournament entry is GP the world is HOLDING: `computeTopline`
 * counts its fee as escrow, which is what makes the conservation proof balance
 * while a fee sits between a wallet and a purse. So an entry still pending on
 * a crown that has already resolved is money nobody can ever reach again —
 * permanent phantom escrow, and the conservation check will keep passing,
 * because the phantom is on BOTH sides of it.
 *
 * It could not have been seen before now. Entry was free from round 22 to 40,
 * so a stranded row held 0 GP and cost nothing to leave lying around; round 41
 * put 80 GP behind each one. Every entry is supposed to leave `pending` exactly
 * once — as `champion`, `eliminated`, `bumped` or `refunded` — and single
 * elimination guarantees it: everyone but the winner loses exactly one fight.
 * That is an argument, not a check, and this is the check.
 */
function checkNoStrandedEscrow(db: DB): Invariant {
  const resolved = new Map(
    db
      .select()
      .from(tournaments)
      .all()
      .filter((t) => t.status === "completed" || t.status === "cancelled")
      .map((t) => [t.id, t])
  );
  const stranded = db
    .select()
    .from(tournamentEntries)
    .all()
    .filter((e) => e.status === "pending" && resolved.has(e.tournamentId));
  const held = stranded.reduce((s, e) => s + e.fee * 100, 0);
  return {
    name: "no stranded entries",
    passed: stranded.length === 0,
    detail:
      stranded.length === 0
        ? `${resolved.size} resolved championship(s), every entry settled`
        : `${stranded.length} entr(ies) still pending on a resolved crown — ${gp(held)} GP unreachable`,
    offenders: stranded
      .slice(0, DOCTOR.OFFENDER_SAMPLE)
      .map(
        (e) =>
          `entry #${e.id} on crown #${e.tournamentId} (${e.status}) holds ${gp(e.fee * 100)} GP`
      ),
  };
}

/**
 * One card a day per bird. Tournament rows are excluded deliberately — a
 * bracket legitimately runs one bird six times in an afternoon, which is the
 * ruled back-to-back marathon, not a cap violation.
 *
 * ⚠ THE MEASUREMENT SURVIVED THE GROUP STAGE; THE NAME DID NOT (round 34).
 * This used to read `CADENCE.FIGHTS_PER_BIRD_PER_DAY`, and that knob was
 * renamed to ENTRIES_PER_BIRD_PER_DAY because one entry stopped meaning one
 * fight — a bird dealt into a group of four fights three times in a night.
 * What this function counts, though, has always been LOBBY ENTRIES bucketed by
 * (bird, day), never battle-log rows, so it was measuring the card and not the
 * fight all along and needed no change beyond the two names.
 *
 * It also matters more than it did. Battle-log rows now legitimately arrive in
 * threes, so no other check can tell a double-card from a full group: this is
 * the ONLY thing standing between a bird entered twice and a silent second
 * night's worth of stake.
 */
function checkCardCap(db: DB): Invariant {
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
    .filter(([, n]) => n > CADENCE.ENTRIES_PER_BIRD_PER_DAY)
    .map(([k, n]) => `${k.split("|")[0]} has ${n} entries on day ${k.split("|")[1]}`);
  return {
    name: "one card per bird per day",
    passed: offenders.length === 0,
    detail: `${entries.length} entries across ${buckets.size} bird-days · ${offenders.length} over cap`,
    offenders: offenders.slice(0, DOCTOR.OFFENDER_SAMPLE),
  };
}

/**
 * THE FIGHT COUNT IS THE MONEY (round 34's sixth invariant).
 *
 * Under the group stage `lobbyEntries.fights` stopped being a description and
 * became arithmetic: the refund is `fee - stakePerFight(fee) * fights`, so a
 * miscount hands the wrong number of GP back to a real wallet. And the failure
 * is INVISIBLE to everything else here — GP conservation would still pass,
 * because a bad refund does not print or burn money, it merely pays it to the
 * wrong party out of an escrow that balances either way. Round 22's silent
 * `buyLand` burn is the cautionary tale; this is the same class of bug with
 * the conservation proof unable to see it.
 *
 * Before round 34 this could not go wrong: `battle_log_id` was a POINTER, and
 * a pointer is either right or null. A counter can be quietly off by one.
 *
 * Two claims, both cheap to check against the battle log, which is the
 * independent record of what actually happened:
 *   1. a settled entry's `fights` equals its battle-log rows for that lobby;
 *   2. no entry exceeds FIGHTS_PER_GROUP_BIRD — a group cannot be bigger than
 *      it is, so this catches a broken deal as well as a broken count.
 */
function checkFightCounts(db: DB): Invariant {
  const settled = db
    .select()
    .from(lobbyEntries)
    .all()
    .filter((e) => e.status !== "pending");
  // One pass over the log, keyed the way the entries are — a per-entry query
  // would be O(entries) round-trips on a 91-day world.
  const logged = new Map<string, number>();
  for (const row of db.select().from(battleLog).all()) {
    if (row.lobbyId === null) continue; // bracket fights belong to no entry
    const k = `${row.lobbyId}|${row.birdId}`;
    logged.set(k, (logged.get(k) ?? 0) + 1);
  }
  const offenders: string[] = [];
  for (const e of settled) {
    const actual = logged.get(`${e.lobbyId}|${e.birdId}`) ?? 0;
    if (e.fights !== actual)
      offenders.push(`entry #${e.id} (${e.birdId}) claims ${e.fights} fights, log has ${actual}`);
    else if (e.fights > FIGHTS_PER_GROUP_BIRD)
      offenders.push(`entry #${e.id} (${e.birdId}) took ${e.fights} fights, over the group cap`);
  }
  const totalFights = settled.reduce((s, e) => s + e.fights, 0);
  return {
    name: "fight counts match the log",
    passed: offenders.length === 0,
    detail: `${settled.length} settled entries · ${totalFights} fights claimed · ${offenders.length} mismatched`,
    offenders: offenders.slice(0, DOCTOR.OFFENDER_SAMPLE),
  };
}

/**
 * THE SCOUT'S BOOK MATCHES THE LOG (round 44's ninth invariant).
 *
 * bird_form is a pure cache: per-(bird, blade) sums of battle_log, advanced by
 * recordFight in the same transaction as every log insert, because the scout
 * reading raw careers per decision was the sim's superlinear cost. A cache
 * that drifts is worse than the scan it replaced — every carding decision in
 * the game reads it, and a stale book would misprice birds silently, forever.
 * The failure this exists to catch is a NEW battle_log insert site that
 * bypasses recordFight: nothing else would notice, exactly like the silent GP
 * burns of rounds 14 and 22.
 *
 * Recomputed from scratch in one pass and compared field by field. norm_sum
 * gets a 1e-6 tolerance — recomputing sums the same float64 values in the
 * same rowid order, so it should be bit-exact, but the invariant's job is
 * catching missed rows (whole figures), not litigating the last ulp.
 */
function checkScoutBook(db: DB): Invariant {
  type Sums = {
    fights: number;
    wins: number;
    losses: number;
    figureSum: number;
    bestFigure: number;
    normSum: number;
    earnCents: number;
  };
  const derived = new Map<string, Sums>();
  for (const row of db.select().from(battleLog).all()) {
    const k = `${row.birdId}|${row.format}`;
    const s = derived.get(k) ?? {
      fights: 0,
      wins: 0,
      losses: 0,
      figureSum: 0,
      bestFigure: 0,
      normSum: 0,
      earnCents: 0,
    };
    s.fights += 1;
    if (row.result === "win") s.wins += 1;
    else s.losses += 1;
    s.figureSum += row.pitFigure;
    s.bestFigure = Math.max(s.bestFigure, row.pitFigure);
    s.normSum += normalizedScoutFigure(
      row.pitFigure,
      row.selfGrade as Grade,
      row.opponentGrade as Grade
    );
    s.earnCents += Math.max(0, row.gpDeltaCents);
    derived.set(k, s);
  }
  const offenders: string[] = [];
  const bookRows = db.select().from(birdForm).all();
  for (const b of bookRows) {
    const k = `${b.birdId}|${b.format}`;
    const s = derived.get(k);
    if (!s) {
      offenders.push(`${k} is in the book with no log rows`);
      continue;
    }
    derived.delete(k);
    if (
      b.fights !== s.fights ||
      b.wins !== s.wins ||
      b.losses !== s.losses ||
      b.figureSum !== s.figureSum ||
      b.bestFigure !== s.bestFigure ||
      b.earnCents !== s.earnCents ||
      Math.abs(b.normSum - s.normSum) > 1e-6
    )
      offenders.push(
        `${k}: book says ${b.fights}f ${b.wins}-${b.losses} Σ${b.figureSum}, log says ${s.fights}f ${s.wins}-${s.losses} Σ${s.figureSum}`
      );
  }
  // Whatever is left in `derived` is a log row the book never saw — the
  // bypassed-insert case this invariant exists for.
  for (const k of derived.keys()) offenders.push(`${k} fought but is missing from the book`);
  return {
    name: "scout book matches the log",
    passed: offenders.length === 0,
    detail: `${bookRows.length} book lines audited · ${offenders.length} out of step`,
    offenders: offenders.slice(0, DOCTOR.OFFENDER_SAMPLE),
  };
}

/**
 * LT CONSERVATION (round 37) — the land twin of the GP proof.
 *
 * GP has had a conservation proof since round 11 and it has caught two silent
 * burns (gacha in round 14, buyLand in round 22). Land had none, for one
 * structural reason: the Majors minted per fight but recorded the award as
 * `data.landEach` on a world-level `fight` event — unsigned, and belonging to
 * no farm — so there was nothing to sum. Round 37 gives that mint its own
 * signed per-farm `crown_land` row, which makes this checkable at all.
 *
 * The claim: every Land Token in the world got there through a ledger row.
 *
 *   sum(events.lt)  ==  sum(farms.landTokensCents + farms.stakedLandCents)
 *
 * Land is a strictly simpler thing to prove than GP: there are no escrows and
 * no pools, so there is no timing window where the books are legitimately out.
 * A mismatch is a bug, always. Staking is deliberately silent here — it moves
 * a farm's land between its own two piles and writes NO `lt`, which is why the
 * right-hand side sums both piles rather than just the liquid one.
 *
 * Two things this refuses that nothing else could: a path that mints land
 * without a ledger row (the gacha bundle did exactly that until round 37 —
 * one token per bundle, forever), and a path that writes a row without moving
 * the land.
 */
function checkLandConservation(db: DB): Invariant {
  const allFarms = db.select().from(farms).all();
  const held = allFarms.reduce((s, f) => s + f.landTokensCents + f.stakedLandCents, 0);
  const ledgered = db
    .select()
    .from(events)
    .all()
    .reduce((s, e) => s + (e.lt ?? 0), 0);
  const delta = held - ledgered;
  const offenders: string[] = [];
  if (delta !== 0) {
    // Name the barns, not the days. Land moves in small awards spread over
    // every farm, so "which farm is out" is the question a human can act on —
    // and a per-farm sum is exact, unlike the GP series which has to hedge
    // around escrow crossing a tick boundary.
    const byFarm = new Map<string, number>();
    for (const e of db.select().from(events).all()) {
      if (e.lt === null || e.farmId === null) continue;
      byFarm.set(e.farmId, (byFarm.get(e.farmId) ?? 0) + e.lt);
    }
    // An `lt` delta with no farmId can never reconcile — flag it first.
    const orphaned = db
      .select()
      .from(events)
      .all()
      .filter((e) => e.lt !== null && e.lt !== 0 && e.farmId === null);
    if (orphaned.length > 0)
      offenders.push(
        `${orphaned.length} lt delta(s) belong to no farm (types: ${[
          ...new Set(orphaned.map((e) => e.type)),
        ].join(", ")})`
      );
    for (const f of allFarms) {
      const d = f.landTokensCents + f.stakedLandCents - (byFarm.get(f.id) ?? 0);
      if (d !== 0) offenders.push(`${f.name} holds ${lt(d)} LT more than its ledger rows`);
    }
  }
  return {
    name: "LT conservation",
    passed: delta === 0,
    detail:
      delta === 0
        ? `${lt(held)} LT held = ${lt(ledgered)} LT ledgered`
        : `${lt(held)} held vs ${lt(ledgered)} ledgered — ${lt(Math.abs(delta))} LT ${
            delta > 0 ? "UNRECORDED" : "PHANTOM"
          }`,
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
 * DID THE GROUP STAGE ACTUALLY DEAL? (round 34)
 *
 * The number this round exists to move, and nothing reported it. `cardHealth`
 * answers "did the bird fight at all", which was the whole question while an
 * entry bought a single pairing; now an entry buys a NIGHT of up to
 * FIGHTS_PER_GROUP_BIRD fights and the interesting failure is no longer a bird
 * going home — it is a bird going home early with two thirds of its stake
 * refunded, which every other section in this report scores as a clean fought
 * entry.
 *
 * Three readings, in the order they diagnose:
 *   · FULL CARDS — the headline. The promise of the round.
 *   · SHORT CARDS — fought, but fewer than a full card. This is the
 *     interesting middle, and its dominant cause is a BARN-MATE landing in the
 *     same group, since matchmaking still refuses to pair two birds of one
 *     farm. (The other cause is honest: a lobby of 5 levels to 3+2 and nobody
 *     in it can have three fights.) If this share climbs while lobby fill
 *     holds, `dealGroups`'s barn-spreading is what needs work — it deals the
 *     biggest barn first precisely so this stays small.
 *   · GROUP SIZES — mean size, and the count of groups of ONE. A group of one
 *     should be EXACTLY the lobbies that drew a single entry; the levelling
 *     rule forbids any other (nine entries are 3+3+3, never 4+4+1), so a
 *     group of one inside a lobby that had company is a levelling bug and is
 *     called out as one.
 *
 * Read off `lobbyEntries.fights`, which resolution counts rather than assumes
 * — deriving it from the battle log would double-count nothing but would also
 * quietly lose the unmatched entries, which are the zero the mean needs.
 */
export function groupStage(db: DB): HealthSection {
  const entries = db.select().from(lobbyEntries).all();
  const settled = entries.filter((e) => e.status !== "pending");
  if (settled.length === 0) return { title: "GROUP STAGE", lines: ["no cards have gone off yet"] };

  const full = settled.filter((e) => e.fights === FIGHTS_PER_GROUP_BIRD).length;
  const short = settled.filter((e) => e.fights > 0 && e.fights < FIGHTS_PER_GROUP_BIRD).length;
  const none = settled.filter((e) => e.fights === 0).length;
  const meanFights = settled.reduce((s, e) => s + e.fights, 0) / settled.length;

  // Groups are reconstructed from (lobby, groupNo) — the deal is stored on the
  // entries, not in a table of its own. Undealt entries (a lobby still open)
  // carry a null and are skipped: they have not been dealt yet, so counting
  // them as a group of one would report every open lobby as a bug.
  const groupSize = new Map<string, number>();
  const lobbySize = new Map<number, number>();
  for (const e of entries) {
    if (e.groupNo === null) continue;
    groupSize.set(
      `${e.lobbyId}|${e.groupNo}`,
      (groupSize.get(`${e.lobbyId}|${e.groupNo}`) ?? 0) + 1
    );
    lobbySize.set(e.lobbyId, (lobbySize.get(e.lobbyId) ?? 0) + 1);
  }
  const sizes = [...groupSize.entries()];
  const meanGroup = sizes.length ? sizes.reduce((s, [, n]) => s + n, 0) / sizes.length : 0;
  const ones = sizes.filter(([, n]) => n === 1);
  const loneEntries = ones.filter(([k]) => lobbySize.get(Number(k.split("|")[0])) === 1).length;
  const bugs = ones.length - loneEntries;

  const fullShare = full / settled.length;
  // A levelling bug outranks a thin card: it means dealGroups itself is wrong.
  const groupWarning = (): string | undefined => {
    if (bugs > 0)
      return `${bugs} group(s) of one were dealt out of a lobby that had company — dealGroups is not levelling`;
    if (fullShare < DOCTOR.FULL_CARD_WARN)
      return (
        `only ${pct(full, settled.length)} of settled entries got a full ${FIGHTS_PER_GROUP_BIRD}-fight card ` +
        `(mean ${meanFights.toFixed(2)}) — either the lobbies are too thin to fill a group, ` +
        `or barn-mates are colliding inside them`
      );
    return undefined;
  };
  return {
    title: "GROUP STAGE",
    lines: [
      `fights per settled entry  mean ${meanFights.toFixed(2)} of ${FIGHTS_PER_GROUP_BIRD} · ` +
        `${settled.length} settled entries`,
      `full cards  ${full} (${pct(full, settled.length)}) took all ${FIGHTS_PER_GROUP_BIRD} · ` +
        `short ${short} (${pct(short, settled.length)}) fought 1–${FIGHTS_PER_GROUP_BIRD - 1} · ` +
        `${none} (${pct(none, settled.length)}) never fought`,
      `groups  ${sizes.length} dealt · mean ${meanGroup.toFixed(2)} birds · ` +
        `${ones.length} of one (${loneEntries} were the lobby's only entry` +
        (bugs > 0 ? `, ⚠ ${bugs} LEVELLING BUG${bugs === 1 ? "" : "S"}` : "") +
        ")",
    ],
    warn: groupWarning(),
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
    db
      .select()
      .from(birds)
      .all()
      .map((b) => [b.id, b.halfStars > 0 ? b.element : null])
  );
  const dayOf = new Map(
    db
      .select()
      .from(lobbies)
      .all()
      .map((l) => [l.id, l.dayOpened])
  );
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
  const sameBarn = [...byLobby.entries()].filter(
    ([id, f]) => f.size === 1 && (size.get(id) ?? 0) > 1
  );
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
  // ⚠ ONE PASS, NOT A FILTER PER LOBBY (round 43). This was
  // `for (lobbies) { for (entries.filter(e => e.lobbyId === l.id)) }` — a full
  // walk of every entry in the world for every lobby in it, which on a 91-day
  // world is 768 × 10,483 ≈ 8 million comparisons to bucket ten thousand rows.
  // Both factors grow with run length, so it was the report's only true
  // quadratic; keying the lobbies once and walking the entries once makes it
  // linear in both.
  const keyOf = new Map<number, string>(
    all.map((l) => [l.id, `${l.mode}/${l.classType}/${l.format}${l.price ? `@${l.price}` : ""}`])
  );
  const byKey = new Map<string, { entries: number; unmatched: number }>();
  // Seeded from the lobbies rather than the entries so a posted key that drew
  // NOTHING still appears with zero — the old shape reported those too, and a
  // dead key is exactly what this section exists to surface.
  for (const k of keyOf.values()) if (!byKey.has(k)) byKey.set(k, { entries: 0, unmatched: 0 });
  for (const e of entries) {
    const k = keyOf.get(e.lobbyId);
    if (k === undefined) continue;
    const acc = must(byKey.get(k), "every lobby key was seeded into byKey above");
    acc.entries++;
    if (e.status === "unmatched") acc.unmatched++;
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

/**
 * ── ONE READ OF `events`, PASSED DOWN (round 43) ────────────────────────────
 *
 * Five health sections each did their own `select().from(events).all()`, so a
 * single `diagnose` walked the whole ledger five times — 57,478 rows at 91 days,
 * and it grows with both population and run length. `diagnose` reads it once now
 * and hands the array around.
 *
 * The two INVARIANT checks that also read it (`checkConservation`,
 * `checkLandConservation`) deliberately keep their own reads: both are inside a
 * failure branch and cost nothing on a healthy world, and an invariant that
 * borrows state from the caller is harder to trust than one that fetches its own.
 */
type EventRow = typeof events.$inferSelect;

/** Where birds come from and where they go — the supply question. */
function population(db: DB, topline: Topline, ev: EventRow[]): HealthSection {
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
  for (const e of ev) {
    if (e.type !== "retire" || !e.data) continue;
    const by = (JSON.parse(e.data) as { by?: string }).by ?? "manual";
    retiredBy.set(by, (retiredBy.get(by) ?? 0) + 1);
  }
  const supply = count("hatch") + gachaEggs;
  const loss = [...retiredBy.values()].reduce((s, n) => s + n, 0);

  // Barn ceilings (round 43). Before expansions existed, a full barn was an
  // ABSORBING STATE — `breed` threw, the bots' `quietly` swallowed it, and the
  // stable silently stopped breeding forever while every other number here
  // still read healthy (7 of 20 barns by day 91). Bots now buy expansions at
  // ~10 slots of headroom, so a barn sitting AT its ceiling means the sink
  // failed it — it could not afford the next expansion — and that is worth a
  // warn, not just a line.
  const flockSizes = new Map<string, number>();
  for (const b of db.select({ farmId: birds.farmId }).from(birds).all())
    flockSizes.set(b.farmId, (flockSizes.get(b.farmId) ?? 0) + 1);
  const farmRows = db.select().from(farms).all();
  const atCapacity = farmRows.filter(
    (f) => (flockSizes.get(f.id) ?? 0) >= barnCapacity(f.barnExpansions)
  ).length;
  const expansions = farmRows.reduce((s, f) => s + f.barnExpansions, 0);

  const warns = [
    // The round-23 collapse in one line: births stopped outrunning deaths and
    // the card went quiet three weeks later.
    loss > supply ? `attrition (${loss}) is outrunning supply (${supply})` : undefined,
    atCapacity > 0
      ? `${atCapacity} barn(s) at capacity, refusing covers — the expansion sink is not reaching them`
      : undefined,
  ].filter((w): w is string => !!w);

  return {
    title: "POPULATION",
    lines: [
      `eggs ${topline.eggs} · active ${topline.active} · retired ${topline.retired} · ${topline.farms} farms`,
      "by age  " +
        [...ages.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([a, n]) => `${a}:${n}`)
          .join("  "),
      `supply  hatches ${count("hatch")} · gacha eggs ${gachaEggs} · covers ${count("breed")}`,
      "loss    " +
        ([...retiredBy.entries()].map(([by, n]) => `${by} ${n}`).join(" · ") || "none yet"),
      `barns   ${atCapacity} of ${farmRows.length} at capacity · ${expansions} expansion(s) bought`,
    ],
    warn: warns.length ? warns.join(" · ") : undefined,
  };
}

/**
 * ── FIGHT VOLUME AND THE FOUNDER-CULL TROUGH (round 43) ─────────────────────
 *
 * POPULATION counts birds; this counts FIGHTING — and the interaction between
 * the two is where a fresh world's scariest-looking chart lives. Every seeded
 * world crashes ~4× in weeks 4–6: the founder flock arrives at age 3, the
 * hardcore Majors cull it, and the first bred generation hasn't reached
 * fighting age yet. Volume then recovers on its own. The reference shape,
 * measured near-identical in the round-41 and round-42 baselines:
 *
 *   wk3/4/5/6/7 = 1092/397/145/498/871 fights   (20 farms, 91 days)
 *
 * ⚠ UNITS. The round-42 investigation quoted this trough as 2170/570/236/
 * 1044/1962 — those are battle_log ROWS, which count each SIDE of a fight.
 * This section counts FIGHTS (the snapshot series), so the reference above is
 * the same five weeks re-measured in the section's own unit. Both series are
 * real; quoting one against the other makes the world look 2× sicker or
 * healthier than it is.
 *
 * A subagent verifying round 42 rediscovered this from scratch and reported a
 * "population collapse after week 4". This section exists so that never costs
 * an investigation again — and so the day the dip *doesn't* recover, which is
 * the collapse everyone feared, the report says so out loud instead of relying
 * on somebody remembering what week 7 is supposed to look like.
 *
 * Detection is RATIO-based (DOCTOR.TROUGH_*), never absolute, because absolute
 * volume scales with farm count. Three outcomes:
 *   - trough present, later week recovers past TROUGH_RECOVERY × peak →
 *     labelled EXPECTED, no warn;
 *   - trough present, never recovers → warn;
 *   - no trough → the chart prints and the section says nothing else.
 *
 * Exported with the series as a parameter so the tests can feed it synthetic
 * shapes without simulating five weeks of world.
 */
export function fightVolume(series: { day: number; fights: number }[]): HealthSection {
  // Weekly totals. Only COMPLETE weeks are judged — a partial week always
  // looks like a crash — but a trailing partial still prints, labelled.
  const byWeek = new Map<number, { fights: number; days: number }>();
  for (const s of series) {
    const w = GameClock.weekOf(s.day);
    const acc = byWeek.get(w) ?? { fights: 0, days: 0 };
    acc.fights += s.fights;
    acc.days += 1;
    byWeek.set(w, acc);
  }
  const weeks = [...byWeek.entries()].sort((a, b) => a[0] - b[0]);
  const complete = weeks.filter(([, v]) => v.days === CALENDAR.DAYS_PER_WEEK);

  const max = Math.max(1, ...weeks.map(([, v]) => v.fights));
  const lines = weeks.map(([w, v]) => {
    const bar = "█".repeat(Math.max(v.fights > 0 ? 1 : 0, Math.round((v.fights / max) * 24)));
    const partial =
      v.days < CALENDAR.DAYS_PER_WEEK ? `  (${v.days} day${v.days === 1 ? "" : "s"})` : "";
    return `wk ${String(w).padStart(2)}  ${String(v.fights).padStart(6)}  ${bar}${partial}`;
  });

  if (complete.length < DOCTOR.TROUGH_WINDOW)
    return {
      title: "FIGHT VOLUME",
      lines: [...lines, `too young to judge shape (needs ${DOCTOR.TROUGH_WINDOW} complete weeks)`],
    };

  // A trough is judged by DEPTH AGAINST ITS OWN PAST: for each candidate week,
  // compare it to the best week BEFORE it, and take the candidate with the
  // worst ratio. Doing it this way (rather than a global argmin) matters twice
  // over — week 0 is all zeroes on a fresh world, and a min with nothing before
  // it is a start, not a dip; and the global max is usually AFTER the recovery,
  // which would hide the very shape this section exists to name.
  const vols = complete.map(([, v]) => v.fights);
  let minIdx = -1;
  let worstRatio = 1;
  let peak = 0;
  for (let t = 1, best = vols[0]; t < vols.length; best = Math.max(best, vols[t]), t++) {
    if (best <= 0) continue; // nothing to fall FROM yet
    const r = vols[t] / best;
    if (r < worstRatio) [minIdx, worstRatio, peak] = [t, r, best];
  }
  const isTrough = minIdx >= 1 && worstRatio < DOCTOR.TROUGH_DEPTH;
  if (!isTrough) return { title: "FIGHT VOLUME", lines };

  const troughWeek = complete[minIdx][0];
  const peakWeek = complete[vols.indexOf(peak)][0];
  const recovered = Math.max(0, ...vols.slice(minIdx + 1)) >= DOCTOR.TROUGH_RECOVERY * peak;
  const shape = `trough wk${troughWeek} (${vols[minIdx]}) = ${pct(vols[minIdx], peak)} of the wk${peakWeek} peak (${peak})`;
  if (recovered)
    return {
      title: "FIGHT VOLUME",
      lines: [
        ...lines,
        `${shape} — EXPECTED: the age-3 founder flock is culled by the hardcore`,
        `Majors before the first bred generation reaches fighting age, then volume`,
        `recovers. Reference: wk3/4/5/6/7 = 1092/397/145/498/871 fights (20 farms, 91 days).`,
      ],
    };
  return {
    title: "FIGHT VOLUME",
    lines: [...lines, shape],
    warn:
      `fight volume fell below ${Math.round(DOCTOR.TROUGH_DEPTH * 100)}% of peak and never came back ` +
      `past ${Math.round(DOCTOR.TROUGH_RECOVERY * 100)}% — this is NOT the founder cull, which recovers within ~2 weeks`,
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
    bucket.stat.push((b.agility + b.sight + b.stamina + b.gameness + b.station + b.condition) / 6);
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

/**
 * IS THE LADDER ACTUALLY BEING CLIMBED? (round 42)
 *
 * The number this round exists to move, and nothing reported it. Round 42 priced
 * every rung of the class ladder separately — a juvenile claimer at 24 GP up to a
 * grown open at 300 — on the ruling that "we want the more competitive fights to
 * cost more, more risk, more reward… We want players to ladder up." Before it,
 * every fight in a division cost the same and this table would have been one row
 * per division with nothing to compare.
 *
 * ⚠ READ THE ENTRIES COLUMN FIRST, AND READ IT AS AN ADOPTION CHECK. A priced
 * ladder nobody climbs is worse than a flat fee: it is a flat fee with extra
 * machinery, and the dear rungs sit empty while the cheap ones carry the world.
 * That failure has a specific cause here — `pickOffering` takes the most
 * PROTECTIVE class a bird is eligible for, so without an explicit appetite to
 * decline that protection (BotProfile.ladderCourage) the open would only ever
 * hold birds with no cheaper option, and this table would show it as a near-empty
 * top rung. If the dearest rungs read single digits over a 91-day world, the knob
 * is too low and the round did not land.
 *
 * ⚠ AND READ THE LAST COLUMN AS THE INCENTIVE. `LT / 100 GP` is what actually
 * pays a stable for climbing: the land curve is superlinear (FIGHT_EXPONENT
 * 1.15), so land per GP RISKED must RISE as you go down this table. If it is flat
 * the ladder costs more for nothing and no rational barn should ever climb; if it
 * falls, the cheapest company in the game is paying the best land in it, which is
 * the exact inversion round 34 spent a whole round chasing out of the juvenile
 * card. This column is the standing guard against it coming back.
 *
 * GP RISKED is `stakePerFight(fee) × fights`, not the fee: an entry buys a night
 * of up to three fights and refunds whatever it never got to risk, so billing a
 * short card at the full fee would overstate the dear rungs (which are the ones
 * most likely to run short, being the thinnest lobbies).
 *
 * HEALTH, never an invariant — there is no correct distribution across the
 * ladder, only one a human should look at after moving a fee.
 */
function fightEconomy(db: DB): HealthSection {
  const byLobby = new Map(
    db
      .select()
      .from(lobbies)
      .all()
      .map((l) => [l.id, l])
  );
  type Rung = { entries: number; risked: number; land: number; fights: number };
  const rungs = new Map<string, Rung>();
  const feeOfKey = new Map<string, number>();
  for (const e of db.select().from(lobbyEntries).all()) {
    const l = byLobby.get(e.lobbyId);
    if (!l) continue;
    const key = `${l.mode}/${l.classType}${l.price ? `@${l.price}` : ""}`;
    feeOfKey.set(key, e.fee);
    const r = rungs.get(key) ?? { entries: 0, risked: 0, land: 0, fights: 0 };
    r.entries++;
    r.fights += e.fights;
    // Recomputed from the stored fee rather than read off a ledger, because the
    // card's land is emitted as one `card_settled` row per entry and this table
    // needs it split by RUNG — which the event does not carry.
    const risked = stakePerFight(e.fee) * e.fights;
    r.risked += risked;
    if (risked > 0) r.land += landForFight(risked);
    rungs.set(key, r);
  }
  // Cheapest rung first, so the table reads as the ladder it describes and the
  // LT/100 GP column can be scanned for monotonicity in one pass.
  const ordered = [...rungs.entries()].sort(
    (a, b) => (feeOfKey.get(a[0]) ?? 0) - (feeOfKey.get(b[0]) ?? 0)
  );
  const totalEntries = ordered.reduce((n, [, r]) => n + r.entries, 0);
  return {
    title: "FIGHT ECONOMY BY RUNG",
    lines: [
      `  ${"rung".padEnd(24)}${"fee".padStart(5)}${"entries".padStart(9)}` +
        `${"share".padStart(7)}${"GP risked".padStart(12)}${"LT minted".padStart(12)}${"LT/100GP".padStart(10)}`,
      ...ordered.map(([key, r]) => {
        const perHundred = r.risked > 0 ? (r.land / LT_CENTS / r.risked) * 100 : 0;
        return (
          `  ${key.padEnd(24)}${String(feeOfKey.get(key) ?? 0).padStart(5)}` +
          `${r.entries.toLocaleString("en-US").padStart(9)}${pct(r.entries, totalEntries).padStart(7)}` +
          `${r.risked.toLocaleString("en-US").padStart(12)}${lt(r.land).padStart(12)}` +
          `${perHundred.toFixed(2).padStart(10)}`
        );
      }),
    ],
    warn: ordered.some(([, r]) => r.entries === 0)
      ? "a rung on the card drew ZERO entries — nothing has an appetite for it"
      : undefined,
  };
}

/**
 * HOW MUCH LAND HAS THE WORLD MINTED? (round 36)
 *
 * Nothing reported this before, and round 36 is why it now has to. Land is a
 * faucet with almost no drain — fights, crown grants and gacha rolls all mint
 * it, and the only exit is a stud seat — so the world's land is a running
 * total of everything ever awarded, and the RATE is the entire balance
 * question. That rate has already moved twice with nobody able to watch it:
 * round 34 took ~13% off every award as a side effect of chasing a rounding
 * bug, and round 36 handed it back. Both were argued from the config file,
 * because there was no measurement to argue from.
 *
 * The arithmetic is exact rather than estimated: circulating land is the sum
 * of every farm's two piles, and the single sink is the only negative `lt`
 * delta any engine path writes, so `minted = circulating + burned` holds.
 *
 * ROUND 37 ADDS THE BY-SOURCE TABLE. It could not be written before: the
 * Majors minted per fight inside a `fight` event's `data` rather than as an
 * `lt` delta, so any table built off the ledger silently under-counted the
 * crowns, and a table wrong in a way only its author knows about is worse
 * than no table. Now that every mint writes a signed row — and the LT
 * conservation invariant refuses any that doesn't — the split is exact, and
 * it is the number to argue from when somebody asks whether to rebalance
 * issuance or to tune the fees that issuance is priced off.
 *
 * HEALTH, never an invariant: there is no correct amount of land, only a rate
 * somebody should read after changing the curve.
 */
function landSupply(db: DB, topline: Topline, ev: EventRow[], created: GpFlowDay[]): HealthSection {
  const circulating = topline.landStaked + topline.landLiquid;
  let burned = 0;
  const minting = new Map<string, number>();
  // Burns by door, because "the only way land leaves the world" stopped being
  // one sentence in round 43: stud seats were the only sink for twenty rounds,
  // then barn expansions joined them, and a lumped total would hide whichever
  // one quietly stopped firing.
  const burning = new Map<string, number>();
  for (const e of ev) {
    if (e.lt === null || e.lt === 0) continue;
    if (e.lt < 0) {
      burned -= e.lt;
      burning.set(e.type, (burning.get(e.type) ?? 0) - e.lt);
    } else minting.set(e.type, (minting.get(e.type) ?? 0) + e.lt);
  }
  const minted = circulating + burned;
  const days = topline.day + 1; // day 0 was a day of fighting too
  // Biggest faucet first — the question this answers is always "what is
  // actually making the land", and the tail is rarely the answer.
  const sources = [...minting.entries()].sort((a, b) => b[1] - a[1]);
  const sinks = [...burning.entries()].sort((a, b) => b[1] - a[1]);
  return {
    title: "LAND SUPPLY",
    lines: [
      `circulating ${lt(circulating)} LT · ${lt(topline.landStaked)} staked ` +
        `(${pct(topline.landStaked, circulating)}) · ${lt(topline.landLiquid)} idle`,
      `minted      ${lt(minted)} LT over ${days} day(s) · ${lt(Math.round(minted / days))} LT per day`,
      ...sources.map(
        ([type, amount]) =>
          `  ${type.padEnd(14)}${lt(amount).padStart(12)} LT  ${pct(amount, minted).padStart(6)}`
      ),
      `burned      ${lt(burned)} LT (${pct(burned, minted)} of issuance) — the sinks`,
      ...sinks.map(
        ([type, amount]) =>
          `  ${type.padEnd(14)}${lt(amount).padStart(12)} LT  ${pct(amount, burned).padStart(6)}`
      ),
      ...faucetRatio(
        created.reduce((s, f) => s + f.cents, 0),
        minted,
        days
      ),
    ],
  };
}

/**
 * ISSUANCE IN DOLLARS — the two lines that make the land faucet arguable.
 *
 * Every figure above this is in tokens, and a token count is a number nobody can
 * judge: is 2,876 LT a day generous or stingy? Against what? The only stated
 * theory of what land is worth is Zane's pencil mark (see LAND.PENCILLED_USD_PER_TOKEN
 * — $0.01 a token, 100 billion of them, a billion dollars), and the only thing
 * GP is worth is its peg ($1 = 80 GP). Put together they give a RATIO: for every
 * dollar of GP the faucet prints, how many dollars of land does the world hand
 * out?
 *
 * That ratio is the company's gross margin in miniature, on Zane's own framing —
 * "we are more or less selling GP in exchange for fun and LT". Above 1.0 the
 * world is giving away more land value than it sells in GP, which is not
 * automatically wrong (an early world should be generous, and none of it is
 * redeemable) but is certainly something a human should have decided on purpose.
 *
 * ⚠ THE DENOMINATOR IS THE FAUCET, NOT THE SPEND. The only GP entering the
 * world is what GP_FAUCETS lists (snapshots.ts): the starting stake, both halves
 * of the check-in drip and the one-time genesis juice. Everything else is
 * players moving the same coins between each other, and counting that would
 * inflate the denominator with churn until any issuance looked cheap.
 *
 * HEALTH, never an invariant — there is no correct ratio, only one worth reading
 * after moving a land knob. The supply-exhaustion line is the same idea on a
 * longer clock: at today's rate, how long until the 100-billion mark, and is
 * that a decade or a fortnight?
 */
function faucetRatio(gpFaucetCents: number, mintedCents: number, days: number): string[] {
  const landUsd = (mintedCents / LT_CENTS) * LAND.PENCILLED_USD_PER_TOKEN;
  const gpUsd = gpFaucetCents / 100 / ECONOMY.GP_PER_DOLLAR;
  // Years to the target at today's rate. Reported in years because the answer is
  // meant to be read as "is this a business or a fortnight" — a day count at
  // these magnitudes is unreadable.
  const perDay = mintedCents / LT_CENTS / days;
  const years = perDay > 0 ? LAND.TARGET_SUPPLY / perDay / 365 : Infinity;
  return [
    `valuation   at $${LAND.PENCILLED_USD_PER_TOKEN.toFixed(2)}/LT (pencilled) the world has issued ` +
      `$${landUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })} of land ` +
      `against $${gpUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })} of GP faucet ` +
      `— $${(gpUsd > 0 ? landUsd / gpUsd : 0).toFixed(2)} of LT per $1 of GP`,
    `runway      ${(LAND.TARGET_SUPPLY / 1e9).toFixed(0)}B-token target reached in ` +
      `${years > 1e4 ? "10,000+" : years.toLocaleString("en-US", { maximumFractionDigits: 0 })} year(s) ` +
      `at this population's rate — scales with farms, not with time`,
  ];
}

/**
 * CAN THE ARCHIVE STILL BE READ? (round 38)
 *
 * Round 38 stopped storing `play_by_play` and regenerates it from the stored
 * seed instead — 51 MB of a 90 MB database, written every fight and read by
 * nothing. That trade is only honest while the engine still reproduces what
 * it once produced, and NOTHING ELSE IN THE PROJECT WOULD NOTICE IF IT
 * STOPPED: a retuned fight engine breaks no test and moves no invariant, it
 * just quietly makes every historical transcript fiction.
 *
 * So this replays a sample and checks each one against what the archive
 * already knows — both Pit Figures and who won are stored per row. HEALTH
 * rather than an invariant, deliberately: drift is not a bug, it is the
 * expected consequence of tuning a fight engine, and the right response is a
 * human deciding whether the old fights still matter. An invariant here would
 * fail the build every time somebody touched a blade.
 */
function replayHealth(db: DB): HealthSection {
  const r = replayFidelity(db, DOCTOR.REPLAY_SAMPLE);
  if (r.checked === 0) return { title: "REPLAY", lines: ["no fights in the archive yet"] };
  const clean = r.checked - r.drifted;
  return {
    title: "REPLAY",
    lines: [
      // ROWS, not fights: one fight is two rows, and a broken fight fails
      // both of them. A count that said "fights" would read 2 when 1 fight
      // is wrong.
      `${clean}/${r.checked} sampled fight rows rebuild exactly from their seed` +
        (r.unavailable > 0 ? ` · ${r.unavailable} could not be reconstructed` : ""),
      ...r.examples.map((e) => `  ${e}`),
    ],
    warn:
      r.drifted > 0
        ? `${r.drifted} of ${r.checked} sampled fight rows no longer replay — the fight engine has ` +
          `changed since they were fought, so their transcripts contradict their stored results`
        : undefined,
  };
}

/** What has actually fed the staker pool, by source. */
function stakerInflows(db: DB, ev: EventRow[]): HealthSection {
  const bySource = new Map<string, number>();
  for (const e of ev) {
    if (e.type !== "pool_accrual" || !e.data) continue;
    const d = JSON.parse(e.data) as { stakerPoolCents?: number; source?: string };
    if (!d.stakerPoolCents) continue;
    const src = d.source ?? "breed"; // pre-round-24 worlds left breed unnamed
    bySource.set(src, (bySource.get(src) ?? 0) + d.stakerPoolCents);
  }
  const book = stakingBook(db);
  const state = stateRow(db);
  return {
    title: "STAKER POOL",
    lines: [
      `paid out ${gp(book.totalPaidCents)} GP over ${book.payoutDays} day(s) · ` +
        `${gp(state.stakerPoolCents)} waiting · ${lt(book.totalStakedLand)} LT staked`,
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
    // Bucketed once rather than a filter per crown (round 43) — the same
    // O(crowns × entries) shape as checkPursesSettle had. `stood` is the field
    // that actually took the post: a bumped or refunded entry never stood.
    const stoodBy = new Map<number, number>();
    for (const e of entries)
      if (e.status !== "bumped" && e.status !== "refunded")
        stoodBy.set(e.tournamentId, (stoodBy.get(e.tournamentId) ?? 0) + 1);
    const fields = run.map((t) => stoodBy.get(t.id) ?? 0);
    const avg = fields.length ? fields.reduce((s, n) => s + n, 0) / fields.length : 0;
    lines.push(
      `${division.padEnd(9)} ${run.length} run / ${cancelled.length} cancelled · ` +
        `field ${avg.toFixed(1)} · purse ${gp(run.reduce((s, t) => s + (t.purseCents ?? 0), 0))}`
    );
    // ── WHO ACTUALLY GOT PAID (round 40) ──────────────────────────────────
    // The purse used to be a table of shares by finishing stage, and in a
    // 32-bird bracket it paid 8 birds out of 31 — a bird could WIN a hardcore
    // championship fight and take home nothing. Nothing in this report said
    // so: the line above prints the purse, never its spread, so "the money is
    // there" and "the money reaches the winners" looked like the same
    // sentence. Round 40 pays on fights won; this is the line that shows it
    // landed, and that would show it drifting back.
    // A Set, not an array (round 43): `settled.includes(...)` inside a filter over
    // every entry made this O(crowns × entries) as well.
    const settled = new Set(run.map((t) => t.id));
    const paidField = entries.filter(
      (e) => settled.has(e.tournamentId) && e.status !== "bumped" && e.status !== "refunded"
    );
    if (paidField.length > 0) {
      const paid = paidField.filter((e) => e.gpWonCents > 0);
      const takes = paid.map((e) => e.gpWonCents).sort((a, b) => b - a);
      const share = (n: number) => `${((n / takes.reduce((s, c) => s + c, 0)) * 100).toFixed(1)}%`;
      lines.push(
        `${" ".repeat(10)}paid ${paid.length}/${paidField.length} entrants ` +
          `(${((paid.length / paidField.length) * 100).toFixed(0)}%) · ` +
          `biggest take ${share(takes[0] ?? 0)} of all purse GP · ` +
          `smallest ${gp(takes[takes.length - 1] ?? 0)} GP`
      );
      // ── WHO FUNDS THE PURSE (round 41) ──────────────────────────────────
      // The crowns cost 80 GP to enter now, reversing round 22, because the
      // purse was funded 57% by gacha spend and 42% by breed fees and 0% by
      // the people standing in the bracket — a barn that never entered a Major
      // still paid for it with every cover it bought. This line is how we find
      // out whether that actually moved, and it is the ONLY place the split is
      // visible: the purse total above says nothing about where it came from,
      // which is exactly how the old arrangement survived twenty rounds.
      //
      // Fees are also the one place a bird can go home with LESS than it
      // arrived with, so `net to the field` is worth printing beside it: a
      // negative number is not a bug (most entrants lose, that is a contest),
      // but a LARGE one means the crowns are draining the barns rather than
      // circulating between them.
      const feesCents = paidField.reduce((s, e) => s + e.fee * 100, 0);
      const purseCents = run.reduce((s, t) => s + (t.purseCents ?? 0), 0);
      if (feesCents > 0)
        lines.push(
          `${" ".repeat(10)}entry fees ${gp(feesCents)} GP fund ` +
            `${((feesCents / purseCents) * 100).toFixed(0)}% of the purse · ` +
            `the rest is juice (check-ins + gacha + breed fees) · ` +
            `net to the field ${gp(purseCents - feesCents)} GP`
        );
      // ── UNDER THE DOOR (round 43) ───────────────────────────────────────
      // Round 41's ruling is "every win clears the door", and until now the
      // number that tests it lived nowhere — round 42 computed it ad hoc with
      // sqlite (22% of paid Major winners under 160 GP) and the figure
      // evaporated with the terminal session. A WINNER below its own entry
      // fee is not a bug (a thin purse divides honestly), but the SHARE of
      // winners below it is the metric the juice-funding stages are trying to
      // move, and an undefined success criterion cannot be met.
      if (feesCents > 0 && paid.length > 0) {
        const under = paid.filter((e) => e.gpWonCents < e.fee * 100).length;
        lines.push(
          `${" ".repeat(10)}under the door ${under}/${paid.length} winners ` +
            `(${((under / paid.length) * 100).toFixed(0)}%) took less purse than their entry fee`
        );
      }
    }
    const decided = run.length + cancelled.length;
    if (decided > 0 && cancelled.length / decided > DOCTOR.CANCELLED_CROWNS_WARN)
      warn = `${division}: ${cancelled.length} of ${decided} crowns cancelled — the field isn't there`;
  }
  return { title: "CHAMPIONSHIPS", lines: lines.length ? lines : ["none run yet"], warn };
}

// ── ECONOMY ─────────────────────────────────────────────────────────────────

/** One faucet or sink: its whole-run total and its last complete week. */
export interface EconomyFlow {
  label: string;
  totalCents: number;
  lastWeekCents: number;
}

/** One complete week of money, for the trend table. */
export interface EconomyWeek {
  week: number;
  /** GP the juice pool took in that week, by `pool_accrual` source. */
  juiceInCents: Record<string, number>;
  /** Every crown purse settled that week, both divisions. */
  pursePaidCents: number;
  /** GP in the world at the week's last day. Null when no snapshot exists. */
  supplyCents: number | null;
  /** Null for a snapshot written before wallet spreads were recorded. */
  walletMedianCents: { house: number; players: number } | null;
}

/** One crown type (division × blade), audited against its own door. */
export interface EconomyCrown {
  division: "major" | "juvenile";
  format: string;
  run: number;
  cancelled: number;
  avgField: number;
  avgPurseCents: number;
  /**
   * The purse at which ONE win repays the entry fee, averaged over the crowns
   * run, each at its own bracket size. breakEvenPurse × purseShareOf, the same
   * math the MCP tool descriptions quote to players.
   */
  avgBreakEvenCents: number;
  /** Crowns whose purse reached that crown's own one-win break-even. */
  cleared: number;
  paidWinners: number;
  /** Paid winners who took less than their entry fee. */
  underTheDoor: number;
}

/**
 * THE MONEY, judged the same way every round (the economy rounds, 2026-10).
 * Zane's question is "how big should the house be", and three rounds in a
 * row (the drip share, feed costs, stud pricing) answer it by moving GP. This
 * is the fixed measuring stick: what was printed and by whom, what was
 * destroyed, how the supply and the wallets grew, what reached the purses,
 * and whether a purse is big enough that winning a fight repays the door.
 *
 * Structured first and printed second, so `--json` carries the numbers a
 * before/after comparison wants rather than strings to re-parse.
 *
 * COST: every read is a grouped SQL query or a small table (snapshots,
 * tournaments). Nothing here walks `events` in JS.
 */
export interface EconomyReport {
  created: EconomyFlow[];
  destroyed: EconomyFlow[];
  supply: { startDay: number; startCents: number; nowCents: number };
  wallets: { house: WalletSpread; players: WalletSpread };
  weeks: EconomyWeek[];
  crowns: EconomyCrown[];
}

const PURSE_RULES = { major: PINTAKASI.PURSE, juvenile: JUVENILE_MAJOR.PURSE } as const;

/** A snapshot as stored: one written before wallet spreads existed has none. */
type StoredTopline = Omit<Topline, "wallets"> & { wallets?: Topline["wallets"] };

export function economy(db: DB, topline: Topline, created: GpFlowDay[]): EconomyReport {
  const perWeek = CALENDAR.DAYS_PER_WEEK;
  // A week is complete once its last day has been played. Day N is the
  // CURRENT day, so the world has finished day N − 1 at least; a snapshot
  // exists for day N itself because the tick writes one at its end.
  const lastFullWeek = Math.floor((topline.day + 1) / perWeek) - 1;
  const weekOf = (day: number) => Math.floor(day / perWeek);

  const rollUp = (rows: GpFlowDay[], flows: readonly { label: string }[]): EconomyFlow[] =>
    flows.map(({ label }) => {
      const mine = rows.filter((r) => r.label === label);
      return {
        label,
        totalCents: mine.reduce((s, r) => s + r.cents, 0),
        lastWeekCents: mine
          .filter((r) => weekOf(r.day) === lastFullWeek)
          .reduce((s, r) => s + r.cents, 0),
      };
    });

  const shown = Math.min(DOCTOR.ECONOMY_WEEKS, lastFullWeek + 1);
  const weeks = Array.from({ length: shown }, (_, i) => lastFullWeek - shown + 1 + i);

  const juiceIn = db.all<{ source: string | null; week: number; cents: number }>(
    sql`SELECT json_extract(data, '$.source') AS source, day_index / ${perWeek} AS week,
               SUM(json_extract(data, '$.juicePoolCents')) AS cents
        FROM events WHERE type = 'pool_accrual' AND day_index / ${perWeek} >= ${weeks[0] ?? 0}
        GROUP BY source, week`
  );
  const pursePaid = db.all<{ week: number; cents: number }>(
    sql`SELECT day_resolved / ${perWeek} AS week, SUM(purse_cents) AS cents
        FROM tournaments WHERE status = 'completed' GROUP BY week`
  );
  // Only the rows the report reads: the first snapshot, and each week's last day.
  const snapRows = db
    .all<{ day: number; data: string }>(
      sql`SELECT day_index AS day, data FROM snapshots
          WHERE day_index = (SELECT MIN(day_index) FROM snapshots)
             OR day_index % ${perWeek} = ${perWeek - 1}
          ORDER BY day_index`
    )
    .map((r) => ({ day: r.day, top: JSON.parse(r.data) as StoredTopline }));
  const snapOf = new Map(snapRows.map((r) => [r.day, r.top]));
  const first = snapRows[0];

  const crownRows = db.all<{
    division: "major" | "juvenile";
    format: string;
    status: string;
    fee: number;
    bracket: number | null;
    purse: number | null;
    stood: number;
    paid: number;
    under: number;
  }>(
    sql`SELECT t.division, t.format, t.status, t.entry_fee AS fee, t.bracket_size AS bracket,
               t.purse_cents AS purse,
               SUM(CASE WHEN e.status NOT IN ('bumped', 'refunded') THEN 1 ELSE 0 END) AS stood,
               SUM(CASE WHEN e.gp_won_cents > 0 THEN 1 ELSE 0 END) AS paid,
               SUM(CASE WHEN e.gp_won_cents > 0 AND e.gp_won_cents < e.fee * 100
                        THEN 1 ELSE 0 END) AS under
        FROM tournaments t LEFT JOIN tournament_entries e ON e.tournament_id = t.id
        WHERE t.status IN ('completed', 'cancelled')
        GROUP BY t.id`
  );
  const crownKeys = [...new Set(crownRows.map((r) => `${r.division}/${r.format}`))].sort();
  const crowns = crownKeys.map((key): EconomyCrown => {
    const mine = crownRows.filter((r) => `${r.division}/${r.format}` === key);
    const run = mine.filter((r) => r.status === "completed");
    const { division, format } = mine[0];
    const breakEvens = run.map(
      (r) =>
        breakEvenPurse(r.fee, purseShareOf(r.bracket ?? 2, PURSE_RULES[division], 1, "none")) * 100
    );
    const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
    return {
      division,
      format,
      run: run.length,
      cancelled: mine.length - run.length,
      avgField: mean(run.map((r) => r.stood)),
      avgPurseCents: Math.round(mean(run.map((r) => r.purse ?? 0))),
      avgBreakEvenCents: Math.round(mean(breakEvens)),
      cleared: run.filter((r, i) => (r.purse ?? 0) >= breakEvens[i]).length,
      paidWinners: run.reduce((s, r) => s + r.paid, 0),
      underTheDoor: run.reduce((s, r) => s + r.under, 0),
    };
  });

  return {
    created: rollUp(created, GP_FAUCETS),
    destroyed: rollUp(gpFlowsByDay(db, GP_SINKS, -1), GP_SINKS),
    supply: {
      startDay: first?.day ?? 0,
      startCents: first?.top.gpCents ?? 0,
      nowCents: topline.gpCents,
    },
    wallets: topline.wallets,
    weeks: weeks.map((week) => {
      const snap = snapOf.get(week * perWeek + perWeek - 1);
      const juiceInCents: Record<string, number> = {};
      for (const r of juiceIn)
        if (r.week === week && r.cents > 0)
          // Pre-round-24 worlds left the breed cut unnamed (see stakerInflows).
          juiceInCents[r.source ?? "breed"] = (juiceInCents[r.source ?? "breed"] ?? 0) + r.cents;
      return {
        week,
        juiceInCents,
        pursePaidCents: pursePaid.find((p) => p.week === week)?.cents ?? 0,
        supplyCents: snap?.gpCents ?? null,
        walletMedianCents: snap?.wallets
          ? { house: snap.wallets.house.medianCents, players: snap.wallets.players.medianCents }
          : null,
      };
    }),
    crowns,
  };
}

function economySection(e: EconomyReport): HealthSection {
  const flowLines = (flows: EconomyFlow[]) =>
    flows.map(
      (f) =>
        `  ${f.label.padEnd(26)} ${gp(f.totalCents).padStart(15)}   ` +
        `${gp(f.lastWeekCents).padStart(12)} last week`
    );
  const total = (flows: EconomyFlow[]) => flows.reduce((s, f) => s + f.totalCents, 0);
  const spread = (name: string, w: WalletSpread) =>
    w.farms === 0
      ? `${name.padEnd(13)} none`
      : `${`${name} (${w.farms})`.padEnd(13)} median ${gp(w.medianCents)} · ` +
        `p90 ${gp(w.p90Cents)} · max ${gp(w.maxCents)}`;
  const sources = [...new Set(e.weeks.flatMap((w) => Object.keys(w.juiceInCents)))].sort();
  const growth = e.supply.startCents > 0 ? e.supply.nowCents / e.supply.startCents : 0;
  const lines = [
    `created     ${gp(total(e.created))} GP over the run`,
    ...flowLines(e.created),
    e.destroyed.length
      ? `destroyed   ${gp(total(e.destroyed))} GP over the run`
      : "destroyed   0.00 GP · no sink in the ledger yet",
    ...flowLines(e.destroyed),
    `supply      ${gp(e.supply.startCents)} GP on day ${e.supply.startDay} → ` +
      `${gp(e.supply.nowCents)} now (${growth.toFixed(1)}×)`,
    `wallets     ${spread("house", e.wallets.house)}`,
    `            ${spread("players", e.wallets.players)}`,
    ...(e.weeks.length
      ? [
          `week  juice in (${sources.join(" · ") || "none"})  →  ` +
            "purses paid · supply · wallet median house/players",
        ]
      : ["no complete week yet"]),
    ...e.weeks.map(
      (w) =>
        `wk ${String(w.week).padStart(2)}  ` +
        `${sources.map((s) => gp(w.juiceInCents[s] ?? 0)).join(" · ")}  →  ` +
        `${gp(w.pursePaidCents)} · ${w.supplyCents === null ? "—" : gp(w.supplyCents)} · ` +
        (w.walletMedianCents
          ? `${gp(w.walletMedianCents.house)}/${gp(w.walletMedianCents.players)}`
          : "— (snapshot predates wallet spreads)")
    ),
    e.crowns.length
      ? "crown            run  cxl  field   avg purse   1-win break-even  cleared  under the door"
      : "no crown decided yet",
    ...e.crowns.map(
      (c) =>
        `${`${c.division}/${c.format}`.padEnd(15)} ${String(c.run).padStart(4)} ` +
        `${String(c.cancelled).padStart(4)} ${c.avgField.toFixed(1).padStart(6)} ` +
        `${gp(c.avgPurseCents).padStart(11)} ${gp(c.avgBreakEvenCents).padStart(18)} ` +
        `${`${c.cleared}/${c.run}`.padStart(8)}  ${pct(c.underTheDoor, c.paidWinners)} of ${c.paidWinners}`
    ),
  ];
  return { title: "ECONOMY", lines };
}

/**
 * THE OPEN STUD MARKET (economy round 3). Owners set cover prices from the
 * floor to the cap, and the owner's question is circulation: does the market
 * move GP from rich barns to good breeders? So this reads three things: did
 * anyone price above the floor (adoption), what the prices look like, and
 * who earns the stud income (the top 3 farms against everyone else), beside
 * how concentrated the wallets are.
 *
 * A SALE is a cover on another farm's stud. An own-stud cover pays the
 * owner's share back to himself (at the floor before round 70's second pass,
 * at his posted price since), so it is counted apart: it is breeding, not
 * trade. Worlds from before the round carry no `ownStud`
 * flag on the breed row; the message's "(own stud)" marks those.
 *
 * Stud income is attributed through the egg to its sire's CURRENT farm. Studs
 * cannot change hands yet, so that is the farm that was paid; when the
 * marketplace lands this should read the stud_income rows instead.
 *
 * PRICE AGAINST OUTCOME (round 70, second pass): do dearer covers buy
 * better chicks? Covers are banded by price (own-stud covers at the floor
 * apart), and each chick is read for its sheet, its record and what it has
 * earned (card fights from battle_log plus purse shares), against the fee
 * its barn paid. Only covers old enough for the chick to have a career count
 * (DOCTOR.STUD_OUTCOME_CAREER_DAYS). The fee is the gross price: an own-stud
 * cover gets its owner share back, so its true cost is lower than shown.
 *
 * COST: three grouped queries over `events`, one over `farms`, and an
 * indexed battle_log lookup per counted chick.
 */
export interface StudMarketReport {
  covers: number;
  sold: number;
  soldAboveFloor: number;
  /** Over sales, in whole GP. Zero when nothing has sold. */
  price: { median: number; p90: number; max: number };
  premiumOwnerCents: number;
  premiumJuiceCents: number;
  /** The stud owner's share of every SALE, all farms. */
  saleIncomeCents: number;
  /** The three farms that earned the most from sales, best first. */
  top3: { farm: string; cents: number }[];
  /** Share of all wallet GP held by the three richest farms. */
  walletTop3Share: number;
  /** Price against outcome, one row per band in STUD_OUTCOME_BANDS order. */
  outcome: StudOutcomeRow[];
  /** Covers bought on or before this day are the ones `outcome` reads. */
  outcomeCutoffDay: number;
}

export interface StudOutcomeRow {
  band: string;
  chicks: number;
  /** How many of them came from the barn's own stud. */
  own: number;
  avgStats: number;
  wins: number;
  losses: number;
  /** Per chick, centi-GP: card fights net plus purse shares. */
  avgEarnedCents: number;
  /** Per chick, centi-GP: earned less the cover fee. */
  avgNetCents: number;
  /** Chicks whose earnings reached their cover fee. */
  paidBack: number;
}

/** Price bands for the outcome table. The floor is split own / outside,
 *  because an own floor cover is a barn's routine breeding, not a purchase. */
const STUD_OUTCOME_BANDS: { band: string; own?: boolean; lo: number; hi: number }[] = [
  { band: `${STUD_PRICE.FLOOR} own`, own: true, lo: 0, hi: STUD_PRICE.FLOOR },
  { band: `${STUD_PRICE.FLOOR} outside`, own: false, lo: 0, hi: STUD_PRICE.FLOOR },
  { band: `${STUD_PRICE.FLOOR + 1}-250`, lo: STUD_PRICE.FLOOR + 1, hi: 250 },
  { band: "251-350", lo: 251, hi: 350 },
  { band: "351-500", lo: 351, hi: 500 },
  { band: "501+", lo: 501, hi: Infinity },
];

function studOutcome(db: DB, own: SQL, cutoffDay: number): StudOutcomeRow[] {
  // Grouped by exact price and own-ness, then folded into bands here, so the
  // band edges live in one table rather than in a SQL CASE.
  const rows = db.all<{
    price: number;
    own: number;
    n: number;
    stats: number;
    wins: number;
    losses: number;
    earned: number;
    net: number;
    paidBack: number;
  }>(
    sql`WITH purse AS (
          SELECT bird_id, SUM(gp_cents) AS cents FROM events
           WHERE type = 'purse_payout' AND gp_cents IS NOT NULL GROUP BY bird_id),
        chick AS (
          SELECT -e.gp_cents AS fee, ${own} AS own,
                 b.agility + b.sight + b.stamina + b.gameness + b.station + b.condition AS stats,
                 b.wins AS wins, b.losses AS losses,
                 COALESCE((SELECT SUM(l.gp_delta_cents) FROM battle_log l WHERE l.bird_id = b.id), 0)
                   + COALESCE(p.cents, 0) AS earned
            FROM events e
            JOIN birds b ON b.id = e.bird_id
            LEFT JOIN purse p ON p.bird_id = b.id
           WHERE e.type = 'breed' AND e.day_index <= ${cutoffDay})
        SELECT fee / 100 AS price, own, COUNT(*) AS n, SUM(stats) AS stats,
               SUM(wins) AS wins, SUM(losses) AS losses, SUM(earned) AS earned,
               SUM(earned - fee) AS net, SUM(earned >= fee) AS paidBack
          FROM chick GROUP BY price, own`
  );
  return STUD_OUTCOME_BANDS.map((b) => {
    const inBand = rows.filter(
      (r) => r.price >= b.lo && r.price <= b.hi && (b.own === undefined || !!r.own === b.own)
    );
    const sum = (k: "n" | "stats" | "wins" | "losses" | "earned" | "net" | "paidBack") =>
      inBand.reduce((s, r) => s + r[k], 0);
    const chicks = sum("n");
    const per = (total: number) => (chicks === 0 ? 0 : total / chicks);
    return {
      band: b.band,
      chicks,
      own: inBand.filter((r) => r.own).reduce((s, r) => s + r.n, 0),
      avgStats: per(sum("stats")),
      wins: sum("wins"),
      losses: sum("losses"),
      avgEarnedCents: per(sum("earned")),
      avgNetCents: per(sum("net")),
      paidBack: sum("paidBack"),
    };
  });
}

export function studMarket(db: DB): StudMarketReport {
  const own = sql.raw("COALESCE(json_extract(e.data, '$.ownStud'), e.message LIKE '%(own stud)%')");
  const rows = db.all<{ price: number; own: number; n: number; po: number; pj: number }>(
    sql`SELECT -e.gp_cents / 100 AS price, ${own} AS own, COUNT(*) AS n,
               COALESCE(SUM(json_extract(e.data, '$.premiumOwnerCents')), 0) AS po,
               COALESCE(SUM(json_extract(e.data, '$.premiumJuiceCents')), 0) AS pj
        FROM events e WHERE e.type = 'breed' GROUP BY price, own ORDER BY price`
  );
  const sales = rows.filter((r) => !r.own);
  const sold = sales.reduce((s, r) => s + r.n, 0);
  // The histogram is sorted by price, so a percentile is a walk up it.
  const at = (p: number) => {
    const target = Math.max(1, Math.ceil(p * sold));
    let seen = 0;
    for (const r of sales) if ((seen += r.n) >= target) return r.price;
    return 0;
  };
  const earners = db.all<{ farm: string; cents: number }>(
    sql`SELECT f.name AS farm, SUM(json_extract(e.data, '$.studOwnerCents')) AS cents
        FROM events e
        JOIN birds egg ON egg.id = e.bird_id
        JOIN birds sire ON sire.id = egg.father_id
        JOIN farms f ON f.id = sire.farm_id
        WHERE e.type = 'breed' AND NOT ${own}
        GROUP BY sire.farm_id ORDER BY cents DESC`
  );
  const wallets = db
    .all<{ cents: number }>(sql`SELECT gp * 100 + gp_cents AS cents FROM farms ORDER BY cents DESC`)
    .map((r) => r.cents);
  const walletTotal = wallets.reduce((s, c) => s + c, 0);
  const outcomeCutoffDay = stateRow(db).dayIndex - DOCTOR.STUD_OUTCOME_CAREER_DAYS;
  return {
    covers: rows.reduce((s, r) => s + r.n, 0),
    sold,
    soldAboveFloor: sales.filter((r) => r.price > STUD_PRICE.FLOOR).reduce((s, r) => s + r.n, 0),
    price: { median: at(0.5), p90: at(0.9), max: sales.at(-1)?.price ?? 0 },
    premiumOwnerCents: sales.reduce((s, r) => s + r.po, 0),
    premiumJuiceCents: sales.reduce((s, r) => s + r.pj, 0),
    saleIncomeCents: earners.reduce((s, r) => s + r.cents, 0),
    top3: earners.slice(0, 3),
    walletTop3Share:
      walletTotal > 0 ? wallets.slice(0, 3).reduce((s, c) => s + c, 0) / walletTotal : 0,
    outcome: studOutcome(db, own, outcomeCutoffDay),
    outcomeCutoffDay,
  };
}

function studMarketSection(m: StudMarketReport): HealthSection {
  const top3Cents = m.top3.reduce((s, r) => s + r.cents, 0);
  return {
    title: "STUD MARKET",
    lines: [
      `${m.covers} covers · ${m.sold} sold to other farms · ` +
        `${pct(m.soldAboveFloor, m.sold)} of sales above the ${STUD_PRICE.FLOOR} GP floor`,
      `sale price  median ${m.price.median} · p90 ${m.price.p90} · max ${m.price.max} GP ` +
        `(cap ${STUD_PRICE.CAP})`,
      `premiums    ${gp(m.premiumOwnerCents)} GP to owners · ${gp(m.premiumJuiceCents)} GP to the juice pool`,
      `sale income ${gp(m.saleIncomeCents)} GP · top 3 farms ${pct(top3Cents, m.saleIncomeCents)} ` +
        `(${m.top3.map((r) => `${r.farm} ${gp(r.cents)}`).join(" · ") || "none"}) · ` +
        `the rest ${pct(m.saleIncomeCents - top3Cents, m.saleIncomeCents)}`,
      `wallets     the 3 richest farms hold ${(m.walletTop3Share * 100).toFixed(1)}% of all wallet GP`,
      `price vs outcome, covers bought by day ${m.outcomeCutoffDay}:`,
      `  ${"band".padEnd(12)}${"chicks".padStart(7)}${"own".padStart(6)}${"stats".padStart(7)}` +
        `${"win%".padStart(7)}${"earned".padStart(9)}${"net".padStart(9)}${"paid back".padStart(11)}`,
      ...m.outcome.map(
        (r) =>
          `  ${r.band.padEnd(12)}${String(r.chicks).padStart(7)}${String(r.own).padStart(6)}` +
          `${Math.round(r.avgStats).toLocaleString("en-US").padStart(7)}` +
          `${pct(r.wins, r.wins + r.losses).padStart(7)}` +
          `${signedGp(r.avgEarnedCents).padStart(9)}${signedGp(r.avgNetCents).padStart(9)}` +
          `${pct(r.paidBack, r.chicks).padStart(11)}`
      ),
    ],
    // The door this round opened. Sales with none above the floor means no
    // owner priced, or no buyer would pay: either way the round measured zero.
    warn:
      m.sold > 0 && m.soldAboveFloor === 0
        ? "no cover sold above the floor: nobody is pricing studs"
        : undefined,
  };
}

/**
 * COHORTS (simulate --latecomers): can a stable that joins late catch up?
 * Printed only when a player farm joined after day 0, which on a sim means
 * the flag was on and on the live world means somebody signed up late.
 *
 * Three kinds of farm, by when and how they joined: the HOUSE stables (bots,
 * day 0), the GENESIS PLAYERS (player farms from day 0; on a sim that is the
 * dev farm, which auto-play runs exactly as it runs a latecomer, so it is the
 * control), and the LATECOMERS.
 *
 * Wealth is GP plus land at the price the game sells it for
 * (LAND.GP_PER_100_TOKENS), staked or not. The core answer is the SAME-AGE
 * comparison: a latecomer N weeks after joining against the genesis players
 * N weeks after day 0, and against the median house stable at week N. Both
 * started from the same stake, so a ratio under 1 is what joining late cost.
 * Comparing at the same CALENDAR day instead would only say that older farms
 * are older.
 *
 * Wealth at an age is rebuilt from the ledgers, since no table keeps a
 * per-farm history: a wallet is the sum of its events' gp_cents, plus the pot
 * of every card fight it won. A card win pays both stakes into the winner's
 * wallet with no event of its own (the entry event already took the fee),
 * and battle_log books it as one stake net of the rake, so the pot is twice
 * that while the rake is zero. Land is the sum of the events' lt. The block
 * checks the rebuilt wallets against farms.gp and names any farm it misses.
 *
 * COST: two grouped queries over events and battle_log for the history, and
 * two small grouped queries for the standings.
 */
export interface CohortFarm {
  id: string;
  name: string;
  kind: "house" | "genesis player" | "latecomer";
  joinWeek: number;
  walletCents: number;
  ltCents: number;
  wealthCents: number;
  /** 1 = the wealthiest farm in the world. */
  rank: number;
  purseCents: number;
  crowns: number;
  activeBirds: number;
  /** The best career, card fights plus purses, among the birds it holds now. */
  bestBirdCents: number;
  /** [n - 1] is the farm's wealth at the end of its n-th complete week. */
  wealthByAge: number[];
}

/** One farm's wealth at one age, over the genesis player and house medians at that age. */
export interface CohortRatio {
  age: number;
  vsPlayer: number | null;
  vsHouse: number | null;
}

export interface CohortBand {
  label: string;
  members: number;
  /** Medians across the band's members old enough to have reached each age. */
  ratios: (CohortRatio & { n: number })[];
  /** The band's median wealth today over the house median today. */
  nowVsHouse: number | null;
}

export interface CohortReport {
  farms: CohortFarm[];
  /** The control curves the ratios divide by, at each age any farm has reached. */
  control: { age: number; playerCents: number | null; houseCents: number | null }[];
  latecomers: { id: string; ratios: CohortRatio[] }[];
  bands: CohortBand[];
  /** Farms whose rebuilt wallet disagrees with farms.gp: their history is not trustworthy. */
  unreconciled: string[];
}

type WeekMove = { gp: number; lt: number };

export function cohorts(db: DB): CohortReport | null {
  const perWeek = CALENDAR.DAYS_PER_WEEK;
  const allFarms = db.select().from(farms).all();
  const kindOf = (f: (typeof allFarms)[number]): CohortFarm["kind"] => {
    if (f.isBot) return "house";
    return f.createdDay === 0 ? "genesis player" : "latecomer";
  };
  if (!allFarms.some((f) => kindOf(f) === "latecomer")) return null;

  const ltGp = LAND.GP_PER_100_TOKENS / LT_CENTS;
  const lastFullWeek = Math.floor((stateRow(db).dayIndex + 1) / perWeek) - 1;

  const ledger = db.all<{ farm: string; week: number; gp: number; lt: number }>(
    sql`SELECT farm_id AS farm, day_index / ${perWeek} AS week,
               COALESCE(SUM(gp_cents), 0) AS gp, COALESCE(SUM(lt), 0) AS lt
        FROM events WHERE farm_id IS NOT NULL GROUP BY farm, week`
  );
  const pots = db.all<{ farm: string; week: number; gp: number }>(
    sql`SELECT farm_id AS farm, day_index / ${perWeek} AS week, SUM(2 * gp_delta_cents) AS gp
        FROM battle_log WHERE result = 'win' AND lobby_id IS NOT NULL GROUP BY farm, week`
  );
  const moved = new Map<string, Map<number, WeekMove>>();
  const cellOf = (farm: string, week: number): WeekMove => {
    const weeks = moved.get(farm) ?? new Map<number, WeekMove>();
    moved.set(farm, weeks);
    const cell = weeks.get(week) ?? { gp: 0, lt: 0 };
    weeks.set(week, cell);
    return cell;
  };
  for (const r of ledger) {
    const cell = cellOf(r.farm, r.week);
    cell.gp += r.gp;
    cell.lt += r.lt;
  }
  for (const r of pots) cellOf(r.farm, r.week).gp += r.gp;

  const purses = new Map(
    db
      .all<{ farm: string; cents: number; crowns: number }>(
        sql`SELECT farm_id AS farm, SUM(gp_won_cents) AS cents,
                   SUM(status = 'champion') AS crowns
            FROM tournament_entries GROUP BY farm_id`
      )
      .map((r) => [r.farm, r])
  );
  const flocks = new Map(
    db
      .all<{ farm: string; active: number; best: number }>(
        sql`WITH purse AS (
              SELECT bird_id, SUM(gp_cents) AS cents FROM events
               WHERE type = 'purse_payout' AND gp_cents IS NOT NULL GROUP BY bird_id),
            card AS (SELECT bird_id, SUM(gp_delta_cents) AS cents FROM battle_log GROUP BY bird_id)
            SELECT b.farm_id AS farm, SUM(b.status = 'active') AS active,
                   MAX(COALESCE(c.cents, 0) + COALESCE(p.cents, 0)) AS best
            FROM birds b
            LEFT JOIN card c ON c.bird_id = b.id
            LEFT JOIN purse p ON p.bird_id = b.id
            GROUP BY b.farm_id`
      )
      .map((r) => [r.farm, r])
  );

  const unreconciled: string[] = [];
  const rows: CohortFarm[] = allFarms.map((f) => {
    const weeks = moved.get(f.id) ?? new Map<number, WeekMove>();
    const joinWeek = Math.floor(f.createdDay / perWeek);
    let gpSoFar = 0;
    let ltSoFar = 0;
    const wealthByAge: number[] = [];
    // Weeks before joining hold nothing, so the walk can start at the join.
    for (let week = joinWeek; week <= lastFullWeek; week++) {
      const cell = weeks.get(week);
      gpSoFar += cell?.gp ?? 0;
      ltSoFar += cell?.lt ?? 0;
      wealthByAge.push(gpSoFar + ltSoFar * ltGp);
    }
    const walletCents = f.gp * 100 + f.gpCents;
    const rebuilt = [...weeks.values()].reduce((s, c) => s + c.gp, 0);
    if (rebuilt !== walletCents) unreconciled.push(f.name);
    const ltCents = f.landTokensCents + f.stakedLandCents;
    return {
      id: f.id,
      name: f.name,
      kind: kindOf(f),
      joinWeek,
      walletCents,
      ltCents,
      wealthCents: walletCents + ltCents * ltGp,
      rank: 0,
      purseCents: purses.get(f.id)?.cents ?? 0,
      crowns: purses.get(f.id)?.crowns ?? 0,
      activeBirds: flocks.get(f.id)?.active ?? 0,
      bestBirdCents: flocks.get(f.id)?.best ?? 0,
      wealthByAge,
    };
  });
  const ranked = [...rows].sort((a, b) => b.wealthCents - a.wealthCents);
  ranked.forEach((r, i) => (r.rank = i + 1));

  const ofKind = (kind: CohortFarm["kind"]) => rows.filter((r) => r.kind === kind);
  const medianOrNull = (xs: number[]) => (xs.length ? median(xs) : null);
  const wealthAt = (members: CohortFarm[], age: number) =>
    medianOrNull(
      members.filter((m) => m.wealthByAge.length >= age).map((m) => m.wealthByAge[age - 1])
    );
  const oldest = Math.max(...rows.map((r) => r.wealthByAge.length));
  const control = Array.from({ length: oldest }, (_, i) => ({
    age: i + 1,
    playerCents: wealthAt(ofKind("genesis player"), i + 1),
    houseCents: wealthAt(ofKind("house"), i + 1),
  }));
  const over = (x: number | null, by: number | null) => (x !== null && by ? x / by : null);
  const ratiosOf = (f: CohortFarm): CohortRatio[] =>
    f.wealthByAge.map((w, i) => ({
      age: i + 1,
      vsPlayer: over(w, control[i].playerCents),
      vsHouse: over(w, control[i].houseCents),
    }));

  const late = ofKind("latecomer").sort((a, b) => a.joinWeek - b.joinWeek);
  const houseNow = medianOrNull(ofKind("house").map((f) => f.wealthCents));
  const bands = DOCTOR.COHORT_BANDS.map((b): CohortBand => {
    const members = late.filter((f) => f.joinWeek >= b.lo && f.joinWeek <= b.hi);
    const ratios = members.map(ratiosOf);
    const bandMedian = (i: number, key: "vsPlayer" | "vsHouse") =>
      medianOrNull(
        ratios.flatMap((rs) => {
          const v = rs[i]?.[key];
          return v === undefined || v === null ? [] : [v];
        })
      );
    const reached = Math.max(0, ...members.map((m) => m.wealthByAge.length));
    return {
      label: b.label,
      members: members.length,
      ratios: Array.from({ length: reached }, (_, i) => ({
        age: i + 1,
        n: members.filter((m) => m.wealthByAge.length > i).length,
        vsPlayer: bandMedian(i, "vsPlayer"),
        vsHouse: bandMedian(i, "vsHouse"),
      })),
      nowVsHouse: over(medianOrNull(members.map((m) => m.wealthCents)), houseNow),
    };
  });

  return {
    farms: ranked,
    control,
    latecomers: late.map((f) => ({ id: f.id, ratios: ratiosOf(f) })),
    bands,
    unreconciled,
  };
}

const KIND_LABEL: Record<CohortFarm["kind"], string> = {
  house: "house",
  "genesis player": "genesis",
  latecomer: "late",
};

/**
 * VALUE CALIBRATION (claim-par round) — is the game value worth believing?
 *
 * Every fight records the bird's estimated value that morning (battle_log.
 * value_before). If the estimate means anything, a dearer bird should win more
 * often and make more GP per fight, decile on decile; and a claimed bird
 * should usually have been worth more than the tag paid for it, or claimers
 * are buying blind. Read the win rates knowing the classes sort: a bird runs
 * where it figures to be even money, so across the middle deciles the win rate
 * sits near half by design, and it is the GP a fight and the top decile that
 * say whether the dear birds really are the good ones. Daily-card fights only: a championship's GP is a purse,
 * settled outside the fight row.
 */
function valueCalibration(db: DB): HealthSection | null {
  const deciles = db.all<{
    decile: number;
    lo: number;
    hi: number;
    n: number;
    wins: number;
    cents: number;
  }>(
    sql`SELECT decile, MIN(value_before) AS lo, MAX(value_before) AS hi, COUNT(*) AS n,
               SUM(result = 'win') AS wins, SUM(gp_delta_cents) AS cents
        FROM (SELECT value_before, result, gp_delta_cents,
                     NTILE(10) OVER (ORDER BY value_before) AS decile
              FROM battle_log WHERE tournament_id IS NULL AND value_before IS NOT NULL)
        GROUP BY decile ORDER BY decile`
  );
  if (deciles.length === 0) return null;
  // A claim settles at the tick after its fights, so the event carries the
  // next day's index; the claimed bird's claimer row is the day before it.
  const [claimed] = db.all<{ n: number; value: number | null; tag: number | null; over: number }>(
    sql`SELECT COUNT(*) AS n, AVG(l.value_before) AS value, AVG(l.claim_price) AS tag,
               SUM(l.value_before > l.claim_price) AS over
        FROM (SELECT DISTINCT bird_id, day_index FROM events WHERE type = 'claim_won') e
        JOIN (SELECT DISTINCT bird_id, day_index, value_before, claim_price FROM battle_log
              WHERE lobby = 'claimer' AND value_before IS NOT NULL) l
          ON l.bird_id = e.bird_id AND l.day_index = e.day_index - 1`
  );
  const lines = [
    `daily-card fights by the bird's value that morning, in deciles: GP range · win rate · net GP a fight`,
    ...deciles.map(
      (d) =>
        `  d${String(d.decile).padEnd(3)}${`${d.lo}–${d.hi} GP`.padEnd(16)}` +
        `${((100 * d.wins) / d.n).toFixed(1).padStart(5)}% won · ` +
        `${(d.cents / 100 / d.n).toFixed(2).padStart(7)} GP a fight · ${d.n} fights`
    ),
  ];
  if (claimed && claimed.n > 0)
    lines.push(
      `claimed birds: ${claimed.n} · mean value before ${Math.round(claimed.value ?? 0)} GP against a mean tag of ` +
        `${Math.round(claimed.tag ?? 0)} GP · ${((100 * claimed.over) / claimed.n).toFixed(0)}% were worth more than the tag`
    );
  const first = deciles[0];
  const last = deciles[deciles.length - 1];
  const flat = last.wins / last.n <= first.wins / first.n;
  return {
    title: "VALUE CALIBRATION",
    lines,
    warn: flat
      ? "the dearest decile wins no more often than the cheapest — the value is not reading strength"
      : undefined,
  };
}

function cohortsSection(c: CohortReport): HealthSection {
  const kGp = (cents: number | null) => (cents === null ? "—" : `${(cents / 100_000).toFixed(1)}k`);
  const ratio = (x: number | null) => (x === null ? "—" : x.toFixed(2));
  const pair = (r: CohortRatio | undefined) =>
    (r ? `${ratio(r.vsPlayer)}·${ratio(r.vsHouse)}` : "").padStart(11);
  const ages = DOCTOR.COHORT_AGES.filter((a) => a <= c.control.length);
  const players = c.farms.filter((f) => f.kind === "genesis player");
  const controlName = players.length === 1 ? players[0].name : "genesis player median";
  const byId = new Map(c.farms.map((f) => [f.id, f]));
  const count = (kind: CohortFarm["kind"]) => c.farms.filter((f) => f.kind === kind).length;
  return {
    title: "COHORTS",
    lines: [
      `${count("house")} house · ${count("genesis player")} genesis player · ` +
        `${count("latecomer")} latecomer farms · wealth = GP + ` +
        `${LAND.GP_PER_100_TOKENS / LT_CENTS} GP per LT · GP and LT in thousands`,
      `${"rank farm".padEnd(36)}${"kind".padEnd(9)}${"wk".padStart(3)}${"wallet".padStart(8)}` +
        `${"LT".padStart(8)}${"wealth".padStart(8)}${"purses".padStart(8)}${"crowns".padStart(7)}` +
        `${"birds".padStart(6)}${"best bird".padStart(10)}`,
      ...c.farms.map(
        (f) =>
          `${String(f.rank).padStart(4)} ${f.name.slice(0, 30).padEnd(31)}` +
          `${KIND_LABEL[f.kind].padEnd(9)}${String(f.joinWeek).padStart(3)}` +
          `${kGp(f.walletCents).padStart(8)}${kGp(f.ltCents).padStart(8)}` +
          `${kGp(f.wealthCents).padStart(8)}${kGp(f.purseCents).padStart(8)}` +
          `${String(f.crowns).padStart(7)}${String(f.activeBirds).padStart(6)}` +
          `${kGp(f.bestBirdCents).padStart(10)}`
      ),
      `SAME AGE: wealth N weeks after joining. Control rows in thousands of GP; ` +
        `each latecomer as a ratio to them (${controlName} · house median)`,
      `${"".padEnd(36)}${ages.map((a) => `wk${a}`.padStart(11)).join("")}`,
      `${controlName.slice(0, 34).padEnd(36)}` +
        ages.map((a) => kGp(c.control[a - 1].playerCents).padStart(11)).join(""),
      `${"house median".padEnd(36)}` +
        ages.map((a) => kGp(c.control[a - 1].houseCents).padStart(11)).join(""),
      // The floor every farm reaches by checking in and nothing else. Early
      // ratios sit near 1 because both sides are mostly this; a ratio says
      // something about play only once the controls pull clear of it.
      `${"stake + drip only".padEnd(36)}` +
        ages
          .map((a) =>
            kGp(
              (ECONOMY.STARTING_GP + a * CALENDAR.DAYS_PER_WEEK * ECONOMY.DAILY_DRIP) * 100
            ).padStart(11)
          )
          .join(""),
      ...c.latecomers.map((l) => {
        const f = byId.get(l.id);
        const label = `wk ${String(f?.joinWeek ?? "?").padStart(2)} ${(f?.name ?? l.id).slice(0, 28)}`;
        return `${label.padEnd(36)}${ages.map((a) => pair(l.ratios[a - 1])).join("")}`;
      }),
      `BY JOINING WEEK: median ratio (${controlName} · house median) · now = median wealth ` +
        "today over the house median today",
      ...c.bands.map(
        (b) =>
          `${`${b.label} (${b.members})`.padEnd(36)}${ages.map((a) => pair(b.ratios[a - 1])).join("")}` +
          `   now ${ratio(b.nowVsHouse)}`
      ),
    ],
    warn: c.unreconciled.length
      ? `rebuilt wallets miss farms.gp for ${c.unreconciled.slice(0, DOCTOR.OFFENDER_SAMPLE).join(", ")}: ` +
        "the same-age history is not trustworthy"
      : undefined,
  };
}

/**
 * Did anyone walk through each door? This is the tripwire AGENTS.md asks for:
 * twice a shipped feature measured exactly ZERO because no bot had an
 * appetite for it (claiming in round 19, paid gacha in round 22), and both
 * times it took a whole round to notice.
 */
function adoption(db: DB, ev: EventRow[]): HealthSection {
  const allFarms = db.select().from(farms).all();
  const tEntries = db.select().from(tournamentEntries).all();
  const tById = new Map(
    db
      .select()
      .from(tournaments)
      .all()
      .map((t) => [t.id, t])
  );
  // ⚠ ONE PASS OVER `events`, NOT ONE PER DOOR (round 43). `farmsWhere` walked the
  // whole table each time it was called, so three event-backed doors meant three
  // full traversals — plus a JSON.parse of every gacha row on the bundle door.
  // Collected in a single sweep instead; the doors below just read the sets.
  const studFarms = new Set<string>();
  const landFarms = new Set<string>();
  const bundleFarms = new Set<string>();
  const expandFarms = new Set<string>();
  // Paid rolls, not bundles: stage 4 of round 43 gave every barn a routine
  // gacha habit precisely because juice funding was two whales deep — this bar
  // is how anyone notices if the habit quietly stops firing. A paid roll is
  // any gacha row that moved GP; free pulls carry no gpCents.
  const paidRollFarms = new Set<string>();
  for (const e of ev) {
    if (!e.farmId) continue;
    if (e.type === "stud_listed") studFarms.add(e.farmId);
    else if (e.type === "buy_land") landFarms.add(e.farmId);
    else if (e.type === "barn_expanded") expandFarms.add(e.farmId);
    else if (e.type === "gacha" && (e.gpCents ?? 0) < 0) {
      paidRollFarms.add(e.farmId);
      if (e.data && (JSON.parse(e.data) as { bundle?: boolean }).bundle === true)
        bundleFarms.add(e.farmId);
      continue;
    } else if (e.type === "gacha" && e.data) {
      // A bundle's payload is shaped differently from a single roll's — parse it
      // rather than matching on the message text. Only gacha rows pay the parse.
      if ((JSON.parse(e.data) as { bundle?: boolean }).bundle === true) bundleFarms.add(e.farmId);
    }
  }
  const crownFarms = (division: string) =>
    new Set(
      tEntries
        .filter((e) => (tById.get(e.tournamentId)?.division ?? "major") === division)
        .map((e) => e.farmId)
    );

  const doors: [string, Set<string>][] = [
    [
      "claims placed",
      new Set(
        db
          .select()
          .from(claims)
          .all()
          .map((c) => c.farmId)
      ),
    ],
    ["studs listed", studFarms],
    ["land purchased", landFarms],
    ["paid gacha rolls", paidRollFarms],
    ["gacha bundles bought", bundleFarms],
    ["barn expanded", expandFarms],
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
  /**
   * THE BROODMARE BAND — every retired hen in the world, and how many of them
   * have ever carried (round 32).
   *
   * Added because the selection numbers below cannot see this. They grade the
   * covers that HAPPENED and were healthy all along, while the round-31 sim
   * was quietly leaving 73 of 154 retired hens barren for their whole lives —
   * the bots broke after one cover a day and only ever reached the top four
   * hens they had priced. A band that good with half of it idle is capacity
   * the world is throwing away, and nothing reported it.
   *
   * ⚠ THE DENOMINATOR SKIPS THE NEWLY RETIRED — see BRED_BAND_GRACE_WEEKS. A
   * hen who retired on the last Hatch Friday has not been passed over, she has
   * not had her turn, and counting her reads a healthy band as a broken one.
   * The round-32 sim retired 32 hens in its final week; leaving them in dragged
   * a real 76% down to 64% and tripped a warning about nothing.
   */
  hens: number;
  hensBred: number;
  /** Foals carried by the single busiest hen — the concentration `hensBred` hides. */
  busiestHen: number;
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
    entries: 0,
    hits: 0,
    randomHits: 0,
    nearHits: 0,
    randomNearHits: 0,
    covered: 0,
    scoutHits: 0,
    scoutNearHits: 0,
    scoutRandomHits: 0,
    clearCovered: 0,
    clearScoutHits: 0,
    clearScoutNearHits: 0,
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
  const rows = db
    .select()
    .from(battleLog)
    .all()
    .sort((a, b) => a.dayIndex - b.dayIndex || a.id - b.id);
  for (const r of rows) {
    const bird = birdById.get(r.birdId);
    if (!bird) continue; // a bird deleted out from under its history
    // Age AT THE FIGHT, not today — a retiree's whole career would land in
    // the 4+ bucket otherwise. Same derivation as ageOf (week - birthWeek),
    // but pinned to the fight's own day instead of the current clock.
    const age = Math.max(0, GameClock.weekOf(r.dayIndex) - bird.birthWeek);
    const bucket = buckets[ageBucket(age)];
    const best = must(bestOf.get(bird.id), "bestOf covers every bird in birdById");
    const withinOne = (format: FightFormat) =>
      [...best].some(
        (home) => Math.abs(FORMAT_NAMES.indexOf(format) - FORMAT_NAMES.indexOf(home)) <= 1
      );

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

    const records =
      history.get(bird.id) ??
      (Object.fromEntries(FORMAT_NAMES.map((f) => [f, { fights: 0, figureTotal: 0 }])) as Record<
        FightFormat,
        { fights: number; figureTotal: number }
      >);
    const covered = [...best].some((f) => records[f].fights >= SCOUT.MIN_READS);
    if (isDecision && covered) {
      bucket.covered++;
      bucket.scoutRandomHits += best.size / FORMAT_NAMES.length;
      const score = (f: FightFormat) => {
        const rec = records[f];
        const average = rec.fights === 0 ? 0 : rec.figureTotal / rec.fights;
        return (
          Math.round(
            ((average * rec.fights + SCOUT.PRIOR_FIGURE * SCOUT.PRIOR_WEIGHT) /
              (rec.fights + SCOUT.PRIOR_WEIGHT)) *
              10
          ) / 10
        );
      };
      const scoutBest = FORMAT_NAMES.reduce((bestFormat, f) =>
        score(f) > score(bestFormat) ? f : bestFormat
      );
      const hit = best.has(scoutBest);
      const near = withinOne(scoutBest);
      if (hit) bucket.scoutHits++;
      if (near) bucket.scoutNearHits++;
      if (
        must(marginOf.get(bird.id), "marginOf covers every bird in birdById") >=
        DOCTOR.DISCOVERY_HOME_MARGIN
      ) {
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
  // Counted over EVERY retired hen, bot-owned or not, and over every foal
  // regardless of whose barn bought the cover — this is a question about the
  // world's capacity, not about whether the plan is selecting well.
  const foalsPerDam = new Map<string, number>();
  for (const b of rows) {
    if (b.motherId) foalsPerDam.set(b.motherId, (foalsPerDam.get(b.motherId) ?? 0) + 1);
  }
  const week = GameClock.weekOf(stateRow(db).dayIndex);
  const band = rows.filter(
    (b) =>
      b.status === "retired" &&
      b.sex === "female" &&
      (b.retiredWeek ?? 0) <= week - DOCTOR.BRED_BAND_GRACE_WEEKS
  );
  return {
    covers: foals.length,
    hens: band.length,
    hensBred: band.filter((h) => foalsPerDam.has(h.id)).length,
    busiestHen: Math.max(0, ...[...foalsPerDam.values()]),
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
        ` · SCOUT ${
          b.covered === 0
            ? "n/a"
            : `${b.scoutHits}/${b.covered} right (${pct(b.scoutHits, b.covered)} vs random ${pct(b.scoutRandomHits, b.covered)})` +
              `, ${pct(b.scoutNearHits, b.covered)} on or adjacent` +
              `${b.clearCovered === 0 ? "" : ` · clear home ${b.clearScoutHits}/${b.clearCovered} (${pct(b.clearScoutHits, b.clearCovered)}, ${pct(b.clearScoutNearHits, b.clearCovered)} adjacent)`}`
        }`
  );
  const blades = FORMAT_NAMES.length;
  lines.push(
    `explored  ${d.explored.length}/${blades} blades saw an age-1 entry in the discovery year`
  );
  // The answer key's own difficulty. A flock bred flat has nothing to find.
  lines.push(
    `flock shape  median home blade beats its runner-up by ${d.medianHomeMargin.toFixed(1)} pts · ` +
      `${(d.clearHomeShare * 100).toFixed(1)}% of birds clear the ${DOCTOR.DISCOVERY_HOME_MARGIN}-pt bar`
  );
  // The plan's adoption check — see BreedingSelection for why the line above
  // cannot answer this on its own.
  const sel = d.selection;
  if (sel) {
    lines.push(
      `breeding  ${sel.covers} bot covers · hens carry ${signed(sel.dams)} of their own shape (any bird: ${signed(sel.flock)}) · ` +
        `the sires chosen reinforce it by ${signed(sel.sires)} (an unchosen sire: ${signed(sel.sireBaseline)}) · ` +
        `foals land at ${signed(sel.foals)}`
    );
    lines.push(
      `broodmare band  ${pct(sel.hensBred, sel.hens)} of ${sel.hens} settled retired hens have ever carried · ` +
        `busiest hen ${sel.busiestHen} foals`
    );
  }

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
    // Also not a scout failure: idle hens are foals never born, which shows up
    // downstream as a thin population and a shallow generation ladder.
    sel && sel.hens > 0 && sel.hensBred / sel.hens < DOCTOR.BRED_BAND_WARN
      ? `only ${pct(sel.hensBred, sel.hens)} of the ${sel.hens} settled retired hens have ever carried — ` +
        `the breeding loop is leaving broodmare capacity idle`
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
  // Read ONCE, handed to every section that needs it (round 43) — see EventRow.
  // Five sections used to fetch this table for themselves.
  const allEvents = db.select().from(events).all();

  const conservation = checkConservation(db);
  const invariants = [
    conservation.invariant,
    checkLandConservation(db), // beside its GP twin, deliberately — round 37
    checkNoNegatives(db),
    checkNoInversions(db),
    checkPursesSettle(db),
    checkNoStrandedEscrow(db), // round 41 — escrow only means something now a fee exists
    checkCardCap(db),
    checkFightCounts(db),
    checkScoutBook(db), // round 44 — the scout's cache may never drift from the log
  ];

  // Per-day fight volume, diffed from the cumulative `fights` each daily
  // snapshot already stores — no new bookkeeping, just reading what's there.
  const snapRows = db
    .select()
    .from(snapshots)
    .all()
    .sort((a, b) => a.dayIndex - b.dayIndex);
  let prevFights = 0;
  const fightSeries = snapRows.map((s) => {
    const total = (JSON.parse(s.data) as Topline).fights;
    const row = { day: s.dayIndex, fights: total - prevFights };
    prevFights = total;
    return row;
  });

  const weather = weatherLine(db);
  const discoveryAudit = bladeDiscovery(db);
  // Read once: the land valuation and the ECONOMY block both price the faucet.
  const created = gpFlowsByDay(db, GP_FAUCETS);
  const money = economy(db, topline, created);
  const studs = studMarket(db);
  const cohortReport = cohorts(db);
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
    // Directly under CARD HEALTH: that section counts entries that fought at
    // all, this one counts how much of a night each of them actually got. The
    // two are the same question asked before and after the group stage.
    groupStage(db),
    lobbyFill(db),
    fragmentation(db),
    population(db, topline, allEvents),
    // Right after POPULATION on purpose: that section counts birds, this one
    // counts fighting, and the founder-cull trough is a statement about the
    // interaction between the two.
    fightVolume(fightSeries),
    // That section counts the flock, this one asks whether the birds coming
    // out of it are any better than the ones going in.
    generations(db),
    // The priced ladder before the land it mints: LAND SUPPLY reports the total,
    // this one reports which rungs made it and whether climbing paid.
    fightEconomy(db),
    // Land before the pool it feeds: STAKER POOL reports what a stake EARNS,
    // which is unreadable without knowing how much land the world made.
    landSupply(db, topline, allEvents, created),
    replayHealth(db),
    stakerInflows(db, allEvents),
    championships(db),
    // After the crowns it audits: CHAMPIONSHIPS says who stood and who got
    // paid, ECONOMY says where that money was printed and whether it cleared
    // the door.
    economySection(money),
    // Right after ECONOMY: that block says where GP was made and where it
    // went in bulk, this one says whether breeders are earning from the rich.
    studMarketSection(studs),
    // After the money blocks: those say how the economy moves GP in bulk,
    // this one says who ends up with it, by when they joined.
    ...(cohortReport ? [cohortsSection(cohortReport)] : []),
    // After who got rich: whether the price tag on a bird meant anything.
    ...[valueCalibration(db)].filter((x): x is HealthSection => x !== null),
    adoption(db, allEvents),
    discovery(discoveryAudit),
  ];

  return {
    dbPath,
    topline,
    driftSeries: conservation.series,
    fightSeries,
    clock: { day: topline.day, date: clockState.date, week: clockState.weekIndex },
    invariants,
    health,
    discovery: discoveryAudit,
    economy: money,
    studs,
    cohorts: cohortReport,
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

  const warnings = r.health.flatMap((h) => (h.warn ? [h.warn] : []));
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
