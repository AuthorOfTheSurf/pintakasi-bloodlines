import { count, desc, eq, isNotNull, lt, sql, type SQL } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { DB } from "@/db/client";
import {
  battleLog,
  birds,
  claims,
  events,
  farms,
  gachaTokens,
  gameState,
  lobbyEntries,
  snapshots,
  tournamentEntries,
} from "@/db/schema";
import type { EventType } from "./events";

/**
 * The office's top-line metrics (round 16), computed in one place so the
 * admin page and the tick snapshots can never disagree. A snapshot is
 * written at the end of every tick (plus a baseline before the first one);
 * the admin diffs live values against the last snapshot BEFORE today, so
 * the deltas span exactly what the last tick covered — one day, or one
 * +1-Week jump.
 */
export interface Topline {
  day: number;
  gpCents: number; // in circulation = wallets + escrow + both pools
  walletCents: number;
  escrowCents: number;
  // Broken out of escrowCents (round 24) because it was MISSING from it:
  // escrow counted lobby entries and claims but never pending championship
  // entries. It read correctly only because PINTAKASI.ENTRY_FEE is 0 today —
  // the whole GP figure would have gone wrong the day a paid season returned.
  tournamentEscrowCents: number;
  juiceCents: number;
  stakerCents: number;
  landMinted: number;
  landStaked: number;
  landLiquid: number;
  fights: number; // fights fought, all time
  // Card entries that found NO opponent at all and were refunded in full.
  //
  // ⚠ ROUND 34 changed how this is counted, because the old way stopped being
  // honest. It counted every `refund` EVENT — but a scratched championship
  // emits one too, so the figure was always "unmatched birds plus tournament
  // scratches" wearing a label that named only the first. That was tolerable
  // while unmatched ran in the hundreds and drowned the scratches out. The
  // group stage takes unmatched to near zero, which would have left a counter
  // labelled "drew nobody" reporting mostly championship scratches — a number
  // that gets MORE wrong exactly as the thing it names gets better.
  //
  // Counting the entries themselves is both exact and simpler: `unmatched` is
  // a terminal status written once at settle-up, and it means precisely this.
  cancelled: number;
  covers: number;
  rolls: number;
  birds: number;
  eggs: number;
  active: number;
  retired: number;
  farms: number;
  /**
   * How GP is spread across barns, house stables and player farms apart. In
   * the snapshot so the doctor can show a wallet median WEEK BY WEEK: the
   * ledger cannot rebuild a wallet (fight pots settle as world events), so a
   * past day's spread exists only if it was written down that day. Snapshots
   * from before this field have none, and readers must allow for that.
   */
  wallets: { house: WalletSpread; players: WalletSpread };
}

/** Wallet GP across a set of farms, in cents (nearest-rank percentiles). */
export interface WalletSpread {
  farms: number;
  medianCents: number;
  p90Cents: number;
  maxCents: number;
}

export function walletSpread(walletCents: number[]): WalletSpread {
  const sorted = [...walletCents].sort((a, b) => a - b);
  const rank = (p: number) => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)] ?? 0;
  return {
    farms: sorted.length,
    medianCents: rank(0.5),
    p90Cents: rank(0.9),
    maxCents: sorted[sorted.length - 1] ?? 0,
  };
}

/**
 * `SELECT count(*)` — one number out of SQLite instead of a whole table into
 * JS. Typed loosely on purpose: it takes any table and any optional filter,
 * and every caller here only ever wants the count.
 */
function countRows(db: DB, table: SQLiteTable, where?: SQL): number {
  const q = db.select({ n: count() }).from(table);
  const row = (where ? q.where(where) : q).get();
  // An aggregate with no GROUP BY always yields exactly one row, even over an empty table.
  if (!row) throw new Error("count(*) returned no row");
  return row.n;
}

export function computeTopline(db: DB): Topline {
  const state = db.select().from(gameState).where(eq(gameState.id, 1)).get();
  if (!state) throw new Error("game_state row 1 missing — the world was never seeded");
  const allFarms = db.select().from(farms).all();
  // ⚠ `allBirds` IS GONE (round 43) — this used to read the WHOLE birds table to
  // produce four numbers, and round 35's lesson below applies to it word for
  // word. It was the last full-table read left in a function that runs twice a
  // tick, so it grew with the world every single day: 1,295 rows by day 91, and
  // the round that doubled the default run length is exactly the wrong time to
  // leave it. The status counts are one grouped query, `covers` and the total are
  // COUNT(*)s — see below.
  // ⚠ FILTER IN SQLITE, NOT IN JS (round 35). These three read `.all()` and
  // filtered afterwards, which materialized every row the table had ever held
  // in order to keep the handful still pending. `recordSnapshot` runs TWICE
  // per tick, so the cost grew with the world's whole history on every single
  // day — a quadratic hiding inside a function that looks like bookkeeping.
  // Pending rows are a tiny slice of these tables by day 91.
  const pendingEntries = db
    .select()
    .from(lobbyEntries)
    .where(eq(lobbyEntries.status, "pending"))
    .all();
  const pendingClaims = db.select().from(claims).where(eq(claims.status, "pending")).all();
  const pendingCrowns = db
    .select()
    .from(tournamentEntries)
    .where(eq(tournamentEntries.status, "pending"))
    .all();

  const walletCents = allFarms.reduce((s, f) => s + f.gp * 100 + f.gpCents, 0);
  const tournamentEscrowCents = pendingCrowns.reduce((s, e) => s + e.fee * 100, 0);
  const escrowCents =
    pendingEntries.reduce((s, e) => s + e.fee * 100, 0) +
    pendingClaims.reduce((s, c) => s + c.price * 100, 0) +
    tournamentEscrowCents;
  const landStaked = allFarms.reduce((s, f) => s + f.stakedLandCents, 0);
  const landLiquid = allFarms.reduce((s, f) => s + f.landTokensCents, 0);
  // One grouped pass instead of materialising every bird to tally three buckets.
  // `ix_birds_status` covers it. Zero-filled first: SQLite omits a group with no
  // rows, and a world with no eggs must report 0 rather than undefined.
  const byStatus: Record<"egg" | "active" | "retired", number> = { egg: 0, active: 0, retired: 0 };
  for (const row of db
    .select({ status: birds.status, n: count() })
    .from(birds)
    .groupBy(birds.status)
    .all())
    byStatus[row.status] = row.n;

  return {
    day: state.dayIndex,
    gpCents: walletCents + escrowCents + state.stakerPoolCents + state.juicePoolCents,
    walletCents,
    escrowCents,
    tournamentEscrowCents,
    juiceCents: state.juicePoolCents,
    stakerCents: state.stakerPoolCents,
    landMinted: landStaked + landLiquid,
    landStaked,
    landLiquid,
    // EVERY FIGHT IS TWO MIRRORED ROWS (round 48), which the doctor's Pit
    // Figure invariant proves independently. Counting only `result = win`
    // forced SQLite to test every wide battle row because result has no index;
    // plain COUNT(*) walks its narrowest covering index and is ~13× faster on
    // the 182-day world without adding another write-amplifying index.
    fights: countRows(db, battleLog) / 2,
    cancelled: countRows(db, lobbyEntries, eq(lobbyEntries.status, "unmatched")),
    // A bred bird is one with a dam — `ix_birds_mother` covers the predicate.
    covers: countRows(db, birds, isNotNull(birds.motherId)),
    rolls: countRows(db, gachaTokens),
    birds: countRows(db, birds),
    eggs: byStatus.egg,
    active: byStatus.active,
    retired: byStatus.retired,
    farms: allFarms.length,
    // `isBot` marks the house-run stables (bot-config.ts); everyone else is a player.
    wallets: {
      house: walletSpread(allFarms.filter((f) => f.isBot).map((f) => f.gp * 100 + f.gpCents)),
      players: walletSpread(allFarms.filter((f) => !f.isBot).map((f) => f.gp * 100 + f.gpCents)),
    },
  };
}

/**
 * ── THE CONSERVATION PROOF, in two halves ──────────────────────────────────
 *
 * The house rule (AGENTS.md) is that GP is printed only by a listed faucet and
 * destroyed only by a listed sink: every centavo the world holds must trace
 * back to the ledger. Stating it as an
 * EQUALITY between these two functions is what makes it provable — and what
 * would have caught both burns that have shipped (the gacha's silent spend in
 * round 14, `buyLand` deleting its payment in round 22).
 *
 * They are deliberately computed from opposite directions: one counts what
 * IS, the other counts what was ALLOWED. A bug that fooled both would have to
 * corrupt the ledger and the wallets in exactly matching amounts.
 */

/** Every GP the world can currently account for, in cents. */
export function gpInWorldCents(db: DB): number {
  return computeTopline(db).gpCents;
}

/**
 * ONE WAY GP ENTERS OR LEAVES THE WORLD, and where the ledger records it:
 * either a farm event's signed wallet delta (`gpCents` on that event type), or
 * a `pool_accrual` whose juice was printed rather than moved. An accrual
 * carries no `gpCents`, so its amount is the payload's `juicePoolCents`,
 * picked out by its `source`.
 */
export interface GpFlow {
  /** What the doctor prints beside the amount. */
  label: string;
  ledger: { event: EventType } | { poolSource: string };
}

/**
 * EVERY FAUCET THE WORLD HAS. The conservation proof and the doctor's ECONOMY
 * block both read this list, so a new faucet is one line here and every audit
 * picks it up. Everything not listed only MOVES money.
 *
 * Read from the EVENTS, never from `farms.length × STARTING_GP` — `seedGame`
 * accepts a custom opening purse and farms register on arbitrary days, so the
 * ledger is the only honest record of what was actually minted.
 */
export const GP_FAUCETS: readonly GpFlow[] = [
  { label: "starting stakes", ledger: { event: "farm_registered" } },
  { label: "check-in drip to wallets", ledger: { event: "check_in" } },
  // Printed once, at genesis: seed money for the first crowns.
  { label: "genesis juice", ledger: { poolSource: "genesis" } },
  // The house's share of every check-in, straight into the crown purses
  // (ECONOMY.DRIP_TO_PURSES). Worlds older than the rule have no such rows.
  { label: "check-in drip to purses", ledger: { poolSource: "drip" } },
];

/**
 * EVERY SINK: GP that leaves the world for good. Empty today, because nothing
 * in the game burns GP yet. A sink is a farm event with a NEGATIVE wallet
 * delta that nobody else receives. List its event type here and the
 * conservation proof subtracts it and the doctor prints it by name.
 */
export const GP_SINKS: readonly GpFlow[] = [];

/** One flow's GP on one day, in cents. Positive for a faucet AND for a sink. */
export interface GpFlowDay {
  label: string;
  day: number;
  cents: number;
}

/**
 * What each flow moved, per day, in two grouped queries: wallet events by
 * type, printed juice by source. Grouped by DAY so one call serves the
 * whole-run totals, the weekly table and the per-snapshot drift series. Pass
 * `sign = -1` for sinks, whose ledger deltas are negative, to get the amount
 * destroyed as a positive number.
 *
 * SQL rather than a JS pass over `events`: on a 182-day world that table is
 * ~470k rows, and the old version of this function materialized all of it.
 */
export function gpFlowsByDay(db: DB, flows: readonly GpFlow[], sign: 1 | -1 = 1): GpFlowDay[] {
  const byEvent = new Map<string, string>();
  const bySource = new Map<string, string>();
  for (const f of flows)
    if ("event" in f.ledger) byEvent.set(f.ledger.event, f.label);
    else bySource.set(f.ledger.poolSource, f.label);
  const list = (keys: Iterable<string>) =>
    sql.join(
      [...keys].map((k) => sql`${k}`),
      sql`, `
    );
  const out: GpFlowDay[] = [];
  if (byEvent.size > 0)
    for (const r of db.all<{ key: string; day: number; cents: number }>(
      sql`SELECT type AS key, day_index AS day, SUM(gp_cents) AS cents FROM events
          WHERE type IN (${list(byEvent.keys())}) GROUP BY type, day_index`
    ))
      out.push({ label: labelOf(byEvent, r.key), day: r.day, cents: sign * r.cents });
  if (bySource.size > 0)
    for (const r of db.all<{ key: string; day: number; cents: number }>(
      sql`SELECT json_extract(data, '$.source') AS key, day_index AS day,
                 SUM(json_extract(data, '$.juicePoolCents')) AS cents
          FROM events
          WHERE type = 'pool_accrual' AND json_extract(data, '$.source') IN (${list(bySource.keys())})
          GROUP BY key, day_index`
    ))
      out.push({ label: labelOf(bySource, r.key), day: r.day, cents: sign * r.cents });
  return out;
}

function labelOf(labels: Map<string, string>, key: string): string {
  const label = labels.get(key);
  if (label === undefined) throw new Error(`gpFlowsByDay: SQL grouped on unrequested key ${key}`);
  return label;
}

/**
 * Every GP the world should hold, in cents: all faucets minus all sinks, read
 * off the ledger. `throughDay` stops the count at that day, which is what the
 * doctor's drift series compares each snapshot against.
 */
export function gpOwedCents(db: DB, throughDay = Infinity): number {
  const net = (rows: GpFlowDay[]) =>
    rows.filter((r) => r.day <= throughDay).reduce((s, r) => s + r.cents, 0);
  return net(gpFlowsByDay(db, GP_FAUCETS)) - net(gpFlowsByDay(db, GP_SINKS, -1));
}

/** What staking has paid, per farm and world-wide — the office's book. */
export interface StakingBook {
  totalStakedLand: number;
  totalPaidCents: number;
  payoutDays: number;
  byFarm: Map<string, { cents: number; days: number; lastDay: number }>;
}

/**
 * The staking ledger, rolled up. Lives here rather than in the admin page so
 * the CLI and the office read the same numbers — the stake is live farm
 * state, the earnings are the sum of every payout ever made, and those two
 * come from different places on purpose (see the round-21 Staking tab).
 */
export function stakingBook(db: DB): StakingBook {
  const byFarm = new Map<string, { cents: number; days: number; lastDay: number }>();
  const days = new Set<number>();
  // Filtered in SQLite: payouts are under 1% of a table that holds every fight.
  for (const e of db.select().from(events).where(eq(events.type, "staking_payout")).all()) {
    if (!e.farmId) continue;
    days.add(e.dayIndex);
    const acc = byFarm.get(e.farmId) ?? { cents: 0, days: 0, lastDay: e.dayIndex };
    byFarm.set(e.farmId, {
      cents: acc.cents + (e.gpCents ?? 0),
      days: acc.days + 1,
      lastDay: Math.max(acc.lastDay, e.dayIndex),
    });
  }
  return {
    totalStakedLand: db
      .select()
      .from(farms)
      .all()
      .reduce((s, f) => s + f.stakedLandCents, 0),
    totalPaidCents: [...byFarm.values()].reduce((s, p) => s + p.cents, 0),
    payoutDays: days.size,
    byFarm,
  };
}

/** Write (or overwrite) today's snapshot. */
export function recordSnapshot(db: DB): Topline {
  const topline = computeTopline(db);
  const data = JSON.stringify(topline);
  db.insert(snapshots)
    .values({ dayIndex: topline.day, data })
    .onConflictDoUpdate({ target: snapshots.dayIndex, set: { data } })
    .run();
  return topline;
}

/** The last snapshot strictly BEFORE `today` — the diff baseline. */
export function baselineBefore(db: DB, today: number): Topline | null {
  const row = db
    .select()
    .from(snapshots)
    .where(lt(snapshots.dayIndex, today))
    .orderBy(desc(snapshots.dayIndex))
    .get();
  return row ? (JSON.parse(row.data) as Topline) : null;
}
