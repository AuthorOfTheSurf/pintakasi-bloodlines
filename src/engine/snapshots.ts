import { eq } from "drizzle-orm";
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
}

export function computeTopline(db: DB): Topline {
  const state = db.select().from(gameState).where(eq(gameState.id, 1)).get()!;
  const allFarms = db.select().from(farms).all();
  const allBirds = db.select().from(birds).all();
  const pendingEntries = db.select().from(lobbyEntries).all().filter((e) => e.status === "pending");
  const pendingClaims = db.select().from(claims).all().filter((c) => c.status === "pending");
  const pendingCrowns = db
    .select()
    .from(tournamentEntries)
    .all()
    .filter((e) => e.status === "pending");

  const walletCents = allFarms.reduce((s, f) => s + f.gp * 100 + f.gpCents, 0);
  const tournamentEscrowCents = pendingCrowns.reduce((s, e) => s + e.fee * 100, 0);
  const escrowCents =
    pendingEntries.reduce((s, e) => s + e.fee * 100, 0) +
    pendingClaims.reduce((s, c) => s + c.price * 100, 0) +
    tournamentEscrowCents;
  const landStaked = allFarms.reduce((s, f) => s + f.stakedLand, 0);
  const landLiquid = allFarms.reduce((s, f) => s + f.landTokens, 0);
  const byStatus = { egg: 0, active: 0, retired: 0 };
  for (const b of allBirds) byStatus[b.status]++;

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
    fights: db.select().from(battleLog).all().filter((r) => r.result === "win").length,
    cancelled: db.select().from(lobbyEntries).all().filter((e) => e.status === "unmatched").length,
    covers: allBirds.filter((b) => b.motherId !== null).length,
    rolls: db.select().from(gachaTokens).all().length,
    birds: allBirds.length,
    eggs: byStatus.egg,
    active: byStatus.active,
    retired: byStatus.retired,
    farms: allFarms.length,
  };
}

/**
 * ── THE CONSERVATION PROOF, in two halves ──────────────────────────────────
 *
 * The house rule (AGENTS.md) is that GP is never printed and never burned:
 * every centavo the world holds must trace back to a faucet. Stating it as an
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
 * Every GP the world was ever allowed to create, in cents, read off the
 * ledger. Three faucets and no others: the starting purse each farm booked,
 * the daily drip each check-in paid, and the one-time genesis juice.
 * Everything else in the game only MOVES money.
 *
 * Read from the EVENTS, never from `farms.length × STARTING_GP` — `seedGame`
 * accepts a custom opening purse and farms register on arbitrary days, so the
 * ledger is the only honest record of what was actually minted.
 */
export function gpFromFaucetsCents(db: DB): number {
  const ev = db.select().from(events).all();
  const sumOf = (type: string) =>
    ev.filter((e) => e.type === type).reduce((s, e) => s + (e.gpCents ?? 0), 0);
  // The genesis juice is a pool_accrual rather than a wallet credit, so it
  // carries no gpCents — its amount lives in the event's data payload.
  const genesis = ev
    .filter((e) => e.type === "pool_accrual" && e.data)
    .map((e) => JSON.parse(e.data!) as { juicePoolCents?: number; source?: string })
    .filter((d) => d.source === "genesis")
    .reduce((s, d) => s + (d.juicePoolCents ?? 0), 0);
  return sumOf("farm_registered") + sumOf("check_in") + genesis;
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
  for (const e of db.select().from(events).all()) {
    if (e.type !== "staking_payout" || !e.farmId) continue;
    days.add(e.dayIndex);
    const acc = byFarm.get(e.farmId) ?? { cents: 0, days: 0, lastDay: e.dayIndex };
    byFarm.set(e.farmId, {
      cents: acc.cents + (e.gpCents ?? 0),
      days: acc.days + 1,
      lastDay: Math.max(acc.lastDay, e.dayIndex),
    });
  }
  return {
    totalStakedLand: db.select().from(farms).all().reduce((s, f) => s + f.stakedLand, 0),
    totalPaidCents: [...byFarm.values()].reduce((s, p) => s + p.cents, 0),
    payoutDays: days.size,
    byFarm,
  };
}

/** Write (or overwrite) today's snapshot. */
export function recordSnapshot(db: DB): Topline {
  const topline = computeTopline(db);
  db.delete(snapshots).where(eq(snapshots.dayIndex, topline.day)).run();
  db.insert(snapshots).values({ dayIndex: topline.day, data: JSON.stringify(topline) }).run();
  return topline;
}

/** The last snapshot strictly BEFORE `today` — the diff baseline. */
export function baselineBefore(db: DB, today: number): Topline | null {
  const rows = db.select().from(snapshots).all().filter((s) => s.dayIndex < today);
  if (rows.length === 0) return null;
  rows.sort((a, b) => b.dayIndex - a.dayIndex);
  return JSON.parse(rows[0].data) as Topline;
}
