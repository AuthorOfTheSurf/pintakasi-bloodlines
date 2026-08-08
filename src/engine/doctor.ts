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
  CALENDAR,
  ECONOMY,
  ELEMENTS,
  FIGHTS_PER_GROUP_BIRD,
  FORMAT_NAMES,
  FORMATS,
  LAND,
  LT_CENTS,
  SCOUT,
  landForFight,
  stakePerFight,
  weatherOfDay,
  type FightFormat,
} from "./config";
import { BOT_FARMS } from "./bot-config";
import { GameClock } from "./game-clock";
import { replayFidelity } from "./replay";
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
  OFFENDER_SAMPLE: 5,
  // How many archived fights the replay check rebuilds (round 38).
  //
  // Sampled because replaying all ~29,000 would cost more than the entire
  // rest of the report, and cheap because the failure it watches for is not
  // subtle: a change to simulatePair, FORMATS, BATTLE, FIGURE or the rng
  // orphans EVERY fight fought before it, so 200 either comes back clean or
  // comes back obviously broken. A reading strictly between the two means
  // something weirder than a retune and deserves the dig.
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
  ok: boolean;
}

const gp = (cents: number) => (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
/**
 * Land Tokens for the terminal. Land is minted in HUNDREDTHS since round 36
 * (see LT_CENTS), so every raw land figure reaching this file is 100× what a
 * player calls it — printing one unscaled is precisely the class of bug that
 * round existed to kill. Always two decimals: a column where 673 renders "6.73"
 * and 500 renders "5" invites the reader to mistake a scale change for a value.
 */
const lt = (cents: number) =>
  (cents / LT_CENTS).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const done = db.select().from(tournaments).all().filter((t) => t.status === "completed");
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
      .map((e) => `entry #${e.id} on crown #${e.tournamentId} (${e.status}) holds ${gp(e.fee * 100)} GP`),
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
  if (settled.length === 0)
    return { title: "GROUP STAGE", lines: ["no cards have gone off yet"] };

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
    groupSize.set(`${e.lobbyId}|${e.groupNo}`, (groupSize.get(`${e.lobbyId}|${e.groupNo}`) ?? 0) + 1);
    lobbySize.set(e.lobbyId, (lobbySize.get(e.lobbyId) ?? 0) + 1);
  }
  const sizes = [...groupSize.entries()];
  const meanGroup = sizes.length
    ? sizes.reduce((s, [, n]) => s + n, 0) / sizes.length
    : 0;
  const ones = sizes.filter(([, n]) => n === 1);
  const loneEntries = ones.filter(([k]) => lobbySize.get(Number(k.split("|")[0])) === 1).length;
  const bugs = ones.length - loneEntries;

  const fullShare = full / settled.length;
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
    warn:
      bugs > 0
        ? `${bugs} group(s) of one were dealt out of a lobby that had company — dealGroups is not levelling`
        : fullShare < DOCTOR.FULL_CARD_WARN
          ? `only ${pct(full, settled.length)} of settled entries got a full ${FIGHTS_PER_GROUP_BIRD}-fight card ` +
            `(mean ${meanFights.toFixed(2)}) — either the lobbies are too thin to fill a group, ` +
            `or barn-mates are colliding inside them`
          : undefined,
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
  // ⚠ ONE PASS, NOT A FILTER PER LOBBY (round 43). This was
  // `for (lobbies) { for (entries.filter(e => e.lobbyId === l.id)) }` — a full
  // walk of every entry in the world for every lobby in it, which on a 91-day
  // world is 768 × 10,483 ≈ 8 million comparisons to bucket ten thousand rows.
  // Both factors grow with run length, so it was the report's only true
  // quadratic; keying the lobbies once and walking the entries once makes it
  // linear in both.
  const keyOf = new Map<number, string>(
    all.map((l) => [
      l.id,
      `${l.mode}/${l.classType}/${l.format}${l.price ? `@${l.price}` : ""}`,
    ])
  );
  const byKey = new Map<string, { entries: number; unmatched: number }>();
  // Seeded from the lobbies rather than the entries so a posted key that drew
  // NOTHING still appears with zero — the old shape reported those too, and a
  // dead key is exactly what this section exists to surface.
  for (const k of keyOf.values()) if (!byKey.has(k)) byKey.set(k, { entries: 0, unmatched: 0 });
  for (const e of entries) {
    const k = keyOf.get(e.lobbyId);
    if (k === undefined) continue;
    const acc = byKey.get(k)!;
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
    const partial = v.days < CALENDAR.DAYS_PER_WEEK ? `  (${v.days} day${v.days === 1 ? "" : "s"})` : "";
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
  const shape =
    `trough wk${troughWeek} (${vols[minIdx]}) = ${pct(vols[minIdx], peak)} of the wk${peakWeek} peak (${peak})`;
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
  const byLobby = new Map(db.select().from(lobbies).all().map((l) => [l.id, l]));
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
function landSupply(db: DB, topline: Topline, ev: EventRow[]): HealthSection {
  const circulating = topline.landStaked + topline.landLiquid;
  let burned = 0;
  const minting = new Map<string, number>();
  for (const e of ev) {
    if (e.lt === null || e.lt === 0) continue;
    if (e.lt < 0) burned -= e.lt;
    else minting.set(e.type, (minting.get(e.type) ?? 0) + e.lt);
  }
  const minted = circulating + burned;
  const days = topline.day + 1; // day 0 was a day of fighting too
  // Biggest faucet first — the question this answers is always "what is
  // actually making the land", and the tail is rarely the answer.
  const sources = [...minting.entries()].sort((a, b) => b[1] - a[1]);
  return {
    title: "LAND SUPPLY",
    lines: [
      `circulating ${lt(circulating)} LT · ${lt(topline.landStaked)} staked ` +
        `(${pct(topline.landStaked, circulating)}) · ${lt(topline.landLiquid)} idle`,
      `minted      ${lt(minted)} LT over ${days} day(s) · ${lt(Math.round(minted / days))} LT per day`,
      `burned      ${lt(burned)} LT into stud seats — the only way land leaves the world`,
      ...sources.map(
        ([type, amount]) =>
          `  ${type.padEnd(14)}${lt(amount).padStart(12)} LT  ${pct(amount, minted).padStart(6)}`
      ),
      ...faucetRatio(ev, minted, days),
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
 * ⚠ THE DENOMINATOR IS THE FAUCET, NOT THE SPEND. GP is never printed or burned
 * here, so the only GP entering the world is the starting stake, the daily drip
 * and the one-time genesis juice. Everything else is players moving the same
 * coins between each other, and counting that would inflate the denominator with
 * churn until any issuance looked cheap.
 *
 * HEALTH, never an invariant — there is no correct ratio, only one worth reading
 * after moving a land knob. The supply-exhaustion line is the same idea on a
 * longer clock: at today's rate, how long until the 100-billion mark, and is
 * that a decade or a fortnight?
 */
function faucetRatio(ev: EventRow[], mintedCents: number, days: number): string[] {
  let gpFaucetCents = 0;
  for (const e of ev)
    if (e.gpCents && (e.type === "check_in" || e.type === "farm_registered"))
      gpFaucetCents += e.gpCents;
  gpFaucetCents += ECONOMY.SEED_JUICE * 100; // printed once, at genesis
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
  if (r.checked === 0)
    return { title: "REPLAY", lines: ["no fights in the archive yet"] };
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
  const state = db.select().from(gameState).where(eq(gameState.id, 1)).get()!;
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
      const share = (n: number) =>
        `${((n / takes.reduce((s, c) => s + c, 0)) * 100).toFixed(1)}%`;
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
            `the rest is juice (gacha + breed fees) · ` +
            `net to the field ${gp(purseCents - feesCents)} GP`
        );
    }
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
function adoption(db: DB, ev: EventRow[]): HealthSection {
  const allFarms = db.select().from(farms).all();
  const tEntries = db.select().from(tournamentEntries).all();
  const tById = new Map(db.select().from(tournaments).all().map((t) => [t.id, t]));
  // ⚠ ONE PASS OVER `events`, NOT ONE PER DOOR (round 43). `farmsWhere` walked the
  // whole table each time it was called, so three event-backed doors meant three
  // full traversals — plus a JSON.parse of every gacha row on the bundle door.
  // Collected in a single sweep instead; the doors below just read the sets.
  const studFarms = new Set<string>();
  const landFarms = new Set<string>();
  const bundleFarms = new Set<string>();
  const expandFarms = new Set<string>();
  for (const e of ev) {
    if (!e.farmId) continue;
    if (e.type === "stud_listed") studFarms.add(e.farmId);
    else if (e.type === "buy_land") landFarms.add(e.farmId);
    else if (e.type === "barn_expanded") expandFarms.add(e.farmId);
    else if (e.type === "gacha" && e.data) {
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
    ["claims placed", new Set(db.select().from(claims).all().map((c) => c.farmId))],
    ["studs listed", studFarms],
    ["land purchased", landFarms],
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
  // Counted over EVERY retired hen, bot-owned or not, and over every foal
  // regardless of whose barn bought the cover — this is a question about the
  // world's capacity, not about whether the plan is selecting well.
  const foalsPerDam = new Map<string, number>();
  for (const b of rows) {
    if (b.motherId) foalsPerDam.set(b.motherId, (foalsPerDam.get(b.motherId) ?? 0) + 1);
  }
  const week = GameClock.weekOf(
    db.select().from(gameState).where(eq(gameState.id, 1)).get()!.dayIndex
  );
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
    landSupply(db, topline, allEvents),
    replayHealth(db),
    stakerInflows(db, allEvents),
    championships(db),
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
