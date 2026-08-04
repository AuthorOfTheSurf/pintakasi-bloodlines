import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { farms, gameState } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { Breeding } from "./breeding";
import { splitBreedFee } from "./breeding";
import { ECONOMY, LAND, STAKER_FLOWS } from "./config";
import { Farms } from "./farms";
import { Game } from "./game";
import { mulberry32 } from "./rng";

function world() {
  const db = createDb(":memory:");
  const dev = seedGame(db, { flock: "legacy" });
  const game = new Game(db, dev.farmId);
  const { farm: rival } = game.farms.register({
    name: "Rival Gamefarm",
    primaryColor: "black",
    secondaryColor: "red",
  });
  return { db, game, devId: dev.farmId, rivalId: rival.id, farms: game.farms };
}

const row = (db: ReturnType<typeof createDb>, id: string) =>
  db.select().from(farms).where(eq(farms.id, id)).get()!;

/** Every GP in the world, in cents: wallets + both pools. */
const totalCents = (db: ReturnType<typeof createDb>) => {
  const state = db.select().from(gameState).where(eq(gameState.id, 1)).get()!;
  return (
    db
      .select()
      .from(farms)
      .all()
      .reduce((s, f) => s + f.gp * 100 + f.gpCents, 0) +
    state.stakerPoolCents +
    state.juicePoolCents
  );
};

describe("the single staking pool", () => {
  test("stake and unstake move land between liquid and the pool", () => {
    const w = world();
    w.db.update(farms).set({ landTokens: 100 }).where(eq(farms.id, w.devId)).run();
    w.farms.stake(w.devId, 60);
    expect(row(w.db, w.devId).landTokens).toBe(40);
    expect(row(w.db, w.devId).stakedLand).toBe(60);
    expect(() => w.farms.stake(w.devId, 41)).toThrow(/liquid/);
    w.farms.unstake(w.devId, 10);
    expect(row(w.db, w.devId).landTokens).toBe(50);
    expect(row(w.db, w.devId).stakedLand).toBe(50);
    expect(() => w.farms.unstake(w.devId, 51)).toThrow(/staked/);
  });

  test("breed fees fill the pool; the tick pays stakers pro-rata, dust carries", () => {
    const w = world();
    // Stakes 3:1 — dev 75, rival 25.
    w.db.update(farms).set({ stakedLand: 75 }).where(eq(farms.id, w.devId)).run();
    w.db.update(farms).set({ stakedLand: 25 }).where(eq(farms.id, w.rivalId)).run();
    // One cover: 800 centi-GP to the pool (the staker cut doubled to 5% in
    // round 22 — it was 2.5%, i.e. 400).
    new Breeding(w.db, w.devId, mulberry32(5)).breed("starter-2", "starter-1");
    expect(w.db.select().from(gameState).get()!.stakerPoolCents).toBe(800);

    const paid = Farms.distributeStaking(w.db);
    expect(paid.stakers).toBe(2);
    expect(paid.paidGp).toBe(8); // 600 + 200 cents — divides exactly here
    expect(row(w.db, w.devId).gpCents).toBe(0); // 6.00 GP → whole cents roll…
    // dev: 8000 − 84 (net own-stud cover: 160 out, 76 back) + 6 staking = 7922
    expect(row(w.db, w.devId).gp).toBe(7922);
    expect(row(w.db, w.rivalId).gp).toBe(ECONOMY.STARTING_GP + 2);
    expect(w.db.select().from(gameState).get()!.stakerPoolCents).toBe(0);
  });

  test("uneven weights leave dust in the pool — nothing is lost", () => {
    const w = world();
    w.db.update(farms).set({ stakedLand: 1 }).where(eq(farms.id, w.devId)).run();
    w.db.update(farms).set({ stakedLand: 2 }).where(eq(farms.id, w.rivalId)).run();
    w.db.update(gameState).set({ stakerPoolCents: 100 }).where(eq(gameState.id, 1)).run();
    Farms.distributeStaking(w.db);
    // 33 + 66 paid, 1 cent carries for tomorrow.
    expect(row(w.db, w.devId).gpCents).toBe(33);
    expect(row(w.db, w.rivalId).gpCents).toBe(66);
    expect(w.db.select().from(gameState).get()!.stakerPoolCents).toBe(1);
  });

  test("no stakers → the whole pool carries; cents roll into whole GP", () => {
    const w = world();
    w.db.update(gameState).set({ stakerPoolCents: 500 }).where(eq(gameState.id, 1)).run();
    expect(Farms.distributeStaking(w.db)).toEqual({ paidGp: 0, stakers: 0 });
    expect(w.db.select().from(gameState).get()!.stakerPoolCents).toBe(500);
    // Roll-over check: 250 cents onto 90 cents = +3 GP, 40 cents left.
    w.db.update(farms).set({ gpCents: 90 }).where(eq(farms.id, w.devId)).run();
    w.db.update(farms).set({ stakedLand: 1 }).where(eq(farms.id, w.devId)).run();
    w.db.update(gameState).set({ stakerPoolCents: 250 }).where(eq(gameState.id, 1)).run();
    Farms.distributeStaking(w.db);
    expect(row(w.db, w.devId).gp).toBe(ECONOMY.STARTING_GP + 3);
    expect(row(w.db, w.devId).gpCents).toBe(40);
  });

  test("the tick runs the payout — and FarmView.gp goes decimal", () => {
    const w = world();
    w.db.update(farms).set({ stakedLand: 1 }).where(eq(farms.id, w.devId)).run();
    w.db.update(farms).set({ stakedLand: 2 }).where(eq(farms.id, w.rivalId)).run();
    w.db.update(gameState).set({ stakerPoolCents: 100 }).where(eq(gameState.id, 1)).run();
    const tick = w.game.tickDay();
    expect(tick.staking.stakers).toBe(2);
    expect(tick.staking.paidGp).toBeCloseTo(0.99, 5);
    expect(w.farms.view(row(w.db, w.devId)).gp).toBeCloseTo(ECONOMY.STARTING_GP + 0.33, 5);
  });

  // ── Round 22: every way GP changes hands now pays the landholders ────────
  test("buying Land Tokens pays the STAKERS — the GP is never burned", () => {
    const w = world();
    const before = totalCents(w.db);
    w.farms.buyLand(w.devId, 500);
    const cost = (500 * LAND.GP_PER_100_TOKENS) / 100; // 400 GP
    // Before round 22 this GP was deducted and routed NOWHERE — a silent
    // burn no sim ever caught, because bots only stake land they earn.
    expect(w.db.select().from(gameState).get()!.stakerPoolCents).toBe(cost * 100);
    expect(row(w.db, w.devId).gp).toBe(ECONOMY.STARTING_GP - cost);
    expect(totalCents(w.db)).toBe(before); // conserved to the cent
    expect(row(w.db, w.devId).landTokens).toBe(500);
  });

  test("the daily land cap still holds, and the pool only takes what was paid", () => {
    const w = world();
    expect(() => w.farms.buyLand(w.devId, LAND.DAILY_BUY_CAP + 1)).toThrow(/Daily land cap/);
    w.farms.buyLand(w.devId, LAND.DAILY_BUY_CAP);
    expect(() => w.farms.buyLand(w.devId, 1)).toThrow(/left today/);
    const paidCents = ((LAND.DAILY_BUY_CAP * LAND.GP_PER_100_TOKENS) / 100) * 100;
    expect(w.db.select().from(gameState).get()!.stakerPoolCents).toBe(
      Math.round(paidCents * STAKER_FLOWS.LAND_PURCHASE_SHARE)
    );
  });
});
