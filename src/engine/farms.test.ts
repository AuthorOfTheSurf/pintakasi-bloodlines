import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { events, farms, gameState } from "@/db/schema";
import { seedGame, seedStarterFlock } from "@/db/seed-data";
import { BARN, ECONOMY, LAND, LT_CENTS, barnCapacity } from "./config";
import { Farms } from "./farms";
import { Flock } from "./flock";

function fresh() {
  const db = createDb(":memory:");
  const dev = seedGame(db, { flock: "legacy" });
  return { db, dev, farmsApi: new Farms(db) };
}

describe("registration", () => {
  test("a farm registers with identity, gets a key and the starting stake", () => {
    const { db, farmsApi } = fresh();
    const { farm, apiKey } = farmsApi.register({
      name: "Talpakan Kings",
      country: "🇵🇭",
      primaryColor: "blue",
      secondaryColor: "white",
    });
    expect(apiKey.startsWith("fk_")).toBe(true);
    expect(farm.gp).toBe(ECONOMY.STARTING_GP);
    expect(farm.country).toBe("🇵🇭");
    seedStarterFlock(db, farm.id, { seed: 7, shape: "legacy" });
    expect(new Flock(db, farm.id).all().length).toBe(8);
    // Key resolves back to the farm.
    expect(farmsApi.byKey(apiKey).id).toBe(farm.id);
  });

  test("names must be unique; colors must come from the palette", () => {
    const { farmsApi } = fresh();
    expect(() =>
      farmsApi.register({ name: "bukidnon farms", primaryColor: "red", secondaryColor: "gold" })
    ).toThrow(/already exists/);
    expect(() =>
      farmsApi.register({ name: "Neon Barn", primaryColor: "chartreuse" as never, secondaryColor: "red" })
    ).toThrow(/must be one of/);
  });

  test("farms are isolated: your flock is not my flock", () => {
    const { db, dev, farmsApi } = fresh();
    const { farm } = farmsApi.register({ name: "Rival", primaryColor: "black", secondaryColor: "red" });
    seedStarterFlock(db, farm.id, { seed: 9, shape: "legacy" });
    const mine = new Flock(db, dev.farmId);
    const theirs = new Flock(db, farm.id);
    expect(mine.all().length).toBe(8);
    expect(theirs.all().length).toBe(8);
    // Same starter names, different ids — and no cross-barn access.
    const theirBird = theirs.all()[0];
    expect(() => mine.byId(theirBird.id)).toThrow(/in your barn/);
  });
});

describe("check-in (the daily ritual)", () => {
  test("pays the drip and free pulls once per game-day", () => {
    const { db, dev, farmsApi } = fresh();
    const r = farmsApi.checkIn(dev.farmId);
    expect(r.gpDripped).toBe(ECONOMY.DAILY_DRIP);
    expect(r.freePullsGranted).toBe(ECONOMY.FREE_PULLS_PER_CHECK_IN);
    expect(r.farm.gp).toBe(ECONOMY.STARTING_GP + ECONOMY.DAILY_DRIP);
    expect(r.farm.checkedInToday).toBe(true);
    expect(() => farmsApi.checkIn(dev.farmId)).toThrow(/already checked in/);
    // Next day it opens again.
    db.update(gameState).set({ dayIndex: 1 }).where(eq(gameState.id, 1)).run();
    expect(() => farmsApi.checkIn(dev.farmId)).not.toThrow();
  });
});

describe("land purchases (one-way, capped)", () => {
  // ⚠ THE WHOLE-TOKEN BOUNDARY (round 36). Land is MINTED in hundredths now,
  // but buying is still a whole-token player action: you ask for 100 LT and
  // the column moves by 100 * LT_CENTS. This test is the pin on that
  // conversion — the one place the two units meet — so a future edit that
  // "simplifies" buyLand into hundredths end-to-end fails here instead of
  // quietly turning a 1,000 LT daily cap into a 10 LT one.
  const CAP_LT = LAND.DAILY_BUY_CAP / LT_CENTS; // the cap in the API's own unit

  test("80 GP buys 100 LT; the daily cap holds; land never sells back", () => {
    const { db, dev, farmsApi } = fresh();
    const buy = farmsApi.buyLand(dev.farmId, 100);
    expect(buy.gpPaid).toBe(LAND.GP_PER_100_TOKENS);
    expect(buy.farm.landTokensCents).toBe(100 * LT_CENTS); // whole tokens in, hundredths stored
    expect(buy.capLeftToday).toBe(CAP_LT - 100); // …and back out in whole tokens
    // The cap is per game-day, and it is a cap on WHOLE TOKENS: the 1,001st
    // token of the day is refused even though the column counts to 100,000.
    expect(() => farmsApi.buyLand(dev.farmId, CAP_LT)).toThrow(/Daily land cap/);
    farmsApi.buyLand(dev.farmId, CAP_LT - 100); // exactly to the cap
    expect(() => farmsApi.buyLand(dev.farmId, 1)).toThrow(/Daily land cap/);
    db.update(gameState).set({ dayIndex: 1 }).where(eq(gameState.id, 1)).run();
    expect(() => farmsApi.buyLand(dev.farmId, 1)).not.toThrow();
    // Odd amounts round the GP cost up — never fractional GP.
    const odd = farmsApi.buyLand(dev.farmId, 7);
    expect(odd.gpPaid).toBe(Math.ceil((7 * LAND.GP_PER_100_TOKENS) / 100));
  });

  test("the API refuses fractional tokens — hundredths are minted, not bought", () => {
    const { dev, farmsApi } = fresh();
    expect(() => farmsApi.buyLand(dev.farmId, 6.73)).toThrow(/whole/);
    expect(() => farmsApi.buyLand(dev.farmId, 0)).toThrow(/whole/);
  });
});

/**
 * BARN EXPANSION (round 43) — the game's second land sink, and the way out of
 * the absorbing state the flat 100-cap used to be. The price ESCALATES (the
 * nth expansion costs n × base) and the land is burned outright, so the two
 * things worth pinning are the arithmetic and the ledger row — an unlogged
 * burn breaks land conservation the first time anyone expands.
 */
describe("barn expansion (the second land sink)", () => {
  test("the nth expansion costs n × base, burns the land, and raises the ceiling", () => {
    const { db, dev, farmsApi } = fresh();
    db.update(farms)
      .set({ landTokensCents: 3_500 * LT_CENTS })
      .where(eq(farms.id, dev.farmId))
      .run();

    const first = farmsApi.expandBarn(dev.farmId);
    expect(first.landSpent).toBe(BARN.EXPANSION_BASE_LT);
    expect(first.capacity).toBe(BARN.CAPACITY + BARN.EXPANSION_SLOTS);
    // Every gate reads the same derived ceiling — Flock.capacity() is what
    // breeding, the gacha and claims all consult.
    expect(new Flock(db, dev.farmId).capacity()).toBe(barnCapacity(1));

    const second = farmsApi.expandBarn(dev.farmId);
    expect(second.landSpent).toBe(2 * BARN.EXPANSION_BASE_LT);
    expect(farmsApi.rowById(dev.farmId).landTokensCents).toBe(500 * LT_CENTS);

    // The third costs 3 × base — unaffordable at 500 LT, and the refusal
    // names the price so a player knows what to unstake.
    expect(() => farmsApi.expandBarn(dev.farmId)).toThrow(/3000 LT/);
  });

  test("the burn lands on the ledger with a signed negative lt", () => {
    const { db, dev, farmsApi } = fresh();
    db.update(farms)
      .set({ landTokensCents: 1_000 * LT_CENTS })
      .where(eq(farms.id, dev.farmId))
      .run();
    farmsApi.expandBarn(dev.farmId);
    const rows = db.select().from(events).where(eq(events.type, "barn_expanded")).all();
    expect(rows.length).toBe(1);
    expect(rows[0].lt).toBe(-BARN.EXPANSION_BASE_LT);
    expect(rows[0].farmId).toBe(dev.farmId);
  });
});
