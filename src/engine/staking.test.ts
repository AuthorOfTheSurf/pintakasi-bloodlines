import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import type { createDb } from "@/db/client";
import { farms, gameState } from "@/db/schema";
import { Breeding } from "./breeding";
import { splitBreedFee } from "./breeding";
import { ECONOMY, ENTRY_FEES, LAND, LT_CENTS, STAKER_FLOWS, landForFight } from "./config";
import { Farms } from "./farms";
import { mulberry32 } from "./rng";
import { expectConserved, world } from "./testkit";

const row = (db: ReturnType<typeof createDb>, id: string) =>
  db.select().from(farms).where(eq(farms.id, id)).get()!;

// The cover this file leans on throughout: the dev barn's own stud, so the
// stud-owner share comes straight back and the barn is only out the rest.
const COVER = splitBreedFee(ECONOMY.BREED_FEE);
const OWN_STUD_NET_GP = ECONOMY.BREED_FEE - COVER.studOwnerCents / 100;

describe("the single staking pool", () => {
  // ⚠ THE COLUMNS ARE HUNDREDTHS, THE API IS WHOLE TOKENS (round 36). Every
  // figure below is written as `n * LT_CENTS` for that reason: the argument
  // passed to stake()/unstake() and the number the column moves by are in
  // DIFFERENT UNITS, and the only thing keeping them honest is the single
  // conversion inside farms.ts.
  test("stake and unstake move land between liquid and the pool", () => {
    const w = world({ rivalFlock: false });
    w.db.update(farms).set({ landTokensCents: 100 * LT_CENTS }).where(eq(farms.id, w.devId)).run();
    w.farms.stake(w.devId, 60);
    expect(row(w.db, w.devId).landTokensCents).toBe(40 * LT_CENTS);
    expect(row(w.db, w.devId).stakedLandCents).toBe(60 * LT_CENTS);
    expect(() => w.farms.stake(w.devId, 41)).toThrow(/liquid/);
    w.farms.unstake(w.devId, 10);
    expect(row(w.db, w.devId).landTokensCents).toBe(50 * LT_CENTS);
    expect(row(w.db, w.devId).stakedLandCents).toBe(50 * LT_CENTS);
    expect(() => w.farms.unstake(w.devId, 51)).toThrow(/staked/);
  });

  // The case that only exists because land is minted fractionally now: a barn
  // that FOUGHT its way to 6.73 LT has more than 6 and less than 7, and the
  // whole-token API has to round DOWN — staking a whole token more than the pile
  // holds must fail, not silently overdraw the column into the negative.
  //
  // ⚠ THE FIXTURE IS NOW A 300 GP OPEN NIGHT (round 42 priced the class ladder
  // and deleted the flat REAL_ENTRY_FEE): 64.59 LT, so the fractional part is
  // 0.59 of a token. The test never quotes either figure — what it needs is a
  // holding that ISN'T a whole number of tokens, which the assertion below
  // checks for itself before proving anything.
  test("a fractional holding stakes down, never up — the change stays liquid", () => {
    const w = world({ rivalFlock: false });
    const held = landForFight(ENTRY_FEES.real.open); // hundredths, not whole tokens
    expect(held % LT_CENTS).not.toBe(0); // the test is worthless if it lands whole
    w.db.update(farms).set({ landTokensCents: held }).where(eq(farms.id, w.devId)).run();
    expect(() => w.farms.stake(w.devId, Math.ceil(held / LT_CENTS))).toThrow(/liquid/);
    w.farms.stake(w.devId, Math.floor(held / LT_CENTS)); // 6 is fine…
    // …and the change stays put: the hundredths that didn't make a whole token
    // are still liquid, not rounded away.
    expect(row(w.db, w.devId).landTokensCents).toBe(held % LT_CENTS);
    expect(row(w.db, w.devId).stakedLandCents).toBe(Math.floor(held / LT_CENTS) * LT_CENTS);
    expect(() => w.farms.stake(w.devId, 1)).toThrow(/liquid/); // 0.73 is not 1
  });

  test("breed fees fill the pool; the tick pays stakers pro-rata, dust carries", () => {
    const w = world({ rivalFlock: false });
    // Stakes 3:1 — dev 75, rival 25. Chosen so the pool divides exactly and
    // the dust case gets its own test below.
    w.db.update(farms).set({ stakedLandCents: 75 }).where(eq(farms.id, w.devId)).run();
    w.db.update(farms).set({ stakedLandCents: 25 }).where(eq(farms.id, w.rivalId)).run();
    new Breeding(w.db, w.devId, mulberry32(5)).breed("starter-2", "starter-1");
    // Every figure below is DERIVED from the split (round 24). It used to be
    // a wall of literals — 800, 8, 7922 — and 7922 alone encoded five knobs:
    // the starting purse, the breed fee, the staker share, the juice share,
    // and this test's own 75/25 stake. Changing any one of them meant
    // recomputing an integer by hand to find out whether the code broke.
    expect(w.db.select().from(gameState).get()!.stakerPoolCents).toBe(COVER.stakerPoolCents);

    const paid = Farms.distributeStaking(w.db);
    expect(paid.stakers).toBe(2);
    expect(paid.paidGp).toBe(COVER.stakerPoolCents / 100);
    const devShare = (COVER.stakerPoolCents * 75) / 100;
    const rivalShare = (COVER.stakerPoolCents * 25) / 100;
    expect(row(w.db, w.devId).gpCents).toBe(devShare % 100); // whole cents roll…
    expect(row(w.db, w.devId).gp).toBe(
      ECONOMY.STARTING_GP - OWN_STUD_NET_GP + Math.floor(devShare / 100)
    );
    expect(row(w.db, w.rivalId).gp).toBe(ECONOMY.STARTING_GP + Math.floor(rivalShare / 100));
    expect(w.db.select().from(gameState).get()!.stakerPoolCents).toBe(0);
    expectConserved(w.db);
  });

  test("uneven weights leave dust in the pool — nothing is lost", () => {
    const w = world({ rivalFlock: false });
    w.db.update(farms).set({ stakedLandCents: 1 }).where(eq(farms.id, w.devId)).run();
    w.db.update(farms).set({ stakedLandCents: 2 }).where(eq(farms.id, w.rivalId)).run();
    w.db.update(gameState).set({ stakerPoolCents: 100 }).where(eq(gameState.id, 1)).run();
    Farms.distributeStaking(w.db);
    // 33 + 66 paid, 1 cent carries for tomorrow.
    expect(row(w.db, w.devId).gpCents).toBe(33);
    expect(row(w.db, w.rivalId).gpCents).toBe(66);
    expect(w.db.select().from(gameState).get()!.stakerPoolCents).toBe(1);
  });

  test("no stakers → the whole pool carries; cents roll into whole GP", () => {
    const w = world({ rivalFlock: false });
    w.db.update(gameState).set({ stakerPoolCents: 500 }).where(eq(gameState.id, 1)).run();
    expect(Farms.distributeStaking(w.db)).toEqual({ paidGp: 0, stakers: 0 });
    expect(w.db.select().from(gameState).get()!.stakerPoolCents).toBe(500);
    // Roll-over check: 250 cents onto 90 cents = +3 GP, 40 cents left.
    w.db.update(farms).set({ gpCents: 90 }).where(eq(farms.id, w.devId)).run();
    w.db.update(farms).set({ stakedLandCents: 1 }).where(eq(farms.id, w.devId)).run();
    w.db.update(gameState).set({ stakerPoolCents: 250 }).where(eq(gameState.id, 1)).run();
    Farms.distributeStaking(w.db);
    expect(row(w.db, w.devId).gp).toBe(ECONOMY.STARTING_GP + 3);
    expect(row(w.db, w.devId).gpCents).toBe(40);
  });

  test("the tick runs the payout — and FarmView.gp goes decimal", () => {
    const w = world({ rivalFlock: false });
    w.db.update(farms).set({ stakedLandCents: 1 }).where(eq(farms.id, w.devId)).run();
    w.db.update(farms).set({ stakedLandCents: 2 }).where(eq(farms.id, w.rivalId)).run();
    w.db.update(gameState).set({ stakerPoolCents: 100 }).where(eq(gameState.id, 1)).run();
    const tick = w.game.tickDay();
    expect(tick.staking.stakers).toBe(2);
    expect(tick.staking.paidGp).toBeCloseTo(0.99, 5);
    expect(w.farms.view(row(w.db, w.devId)).gp).toBeCloseTo(ECONOMY.STARTING_GP + 0.33, 5);
  });

  // ── Round 22: every way GP changes hands now pays the landholders ────────
  test("buying Land Tokens pays the STAKERS — the GP is never burned", () => {
    const w = world({ rivalFlock: false });
    w.farms.buyLand(w.devId, 500);
    const cost = (500 * LAND.GP_PER_100_TOKENS) / 100; // 400 GP
    // Before round 22 this GP was deducted and routed NOWHERE — a silent
    // burn no sim ever caught, because bots only stake land they earn.
    expect(w.db.select().from(gameState).get()!.stakerPoolCents).toBe(cost * 100);
    expect(row(w.db, w.devId).gp).toBe(ECONOMY.STARTING_GP - cost);
    expectConserved(w.db); // conserved to the cent, absolutely — not as a delta
    expect(row(w.db, w.devId).landTokensCents).toBe(500 * LT_CENTS);
  });

  test("the daily land cap still holds, and the pool only takes what was paid", () => {
    const w = world({ rivalFlock: false });
    const capLt = LAND.DAILY_BUY_CAP / LT_CENTS; // the cap in whole tokens — buyLand's unit
    expect(() => w.farms.buyLand(w.devId, capLt + 1)).toThrow(/Daily land cap/);
    w.farms.buyLand(w.devId, capLt);
    expect(() => w.farms.buyLand(w.devId, 1)).toThrow(/left today/);
    const paidCents = ((capLt * LAND.GP_PER_100_TOKENS) / 100) * 100;
    expect(w.db.select().from(gameState).get()!.stakerPoolCents).toBe(
      Math.round(paidCents * STAKER_FLOWS.LAND_PURCHASE_SHARE)
    );
  });
});
