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
  juiceCents: number;
  stakerCents: number;
  landMinted: number;
  landStaked: number;
  landLiquid: number;
  fights: number; // fights fought, all time
  cancelled: number; // entries that found no opponent (fee refunded)
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

  const walletCents = allFarms.reduce((s, f) => s + f.gp * 100 + f.gpCents, 0);
  const escrowCents =
    pendingEntries.reduce((s, e) => s + e.fee * 100, 0) +
    pendingClaims.reduce((s, c) => s + c.price * 100, 0);
  const landStaked = allFarms.reduce((s, f) => s + f.stakedLand, 0);
  const landLiquid = allFarms.reduce((s, f) => s + f.landTokens, 0);
  const byStatus = { egg: 0, active: 0, retired: 0 };
  for (const b of allBirds) byStatus[b.status]++;

  return {
    day: state.dayIndex,
    gpCents: walletCents + escrowCents + state.stakerPoolCents + state.juicePoolCents,
    walletCents,
    escrowCents,
    juiceCents: state.juicePoolCents,
    stakerCents: state.stakerPoolCents,
    landMinted: landStaked + landLiquid,
    landStaked,
    landLiquid,
    fights: db.select().from(battleLog).all().filter((r) => r.result === "win").length,
    cancelled: db.select().from(events).all().filter((e) => e.type === "refund").length,
    covers: allBirds.filter((b) => b.motherId !== null).length,
    rolls: db.select().from(gachaTokens).all().length,
    birds: allBirds.length,
    eggs: byStatus.egg,
    active: byStatus.active,
    retired: byStatus.retired,
    farms: allFarms.length,
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
