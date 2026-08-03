import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { gameState } from "@/db/schema";
import { seedGame, seedStarterFlock } from "@/db/seed-data";
import { ECONOMY, LAND } from "./config";
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
  test("80 GP buys 100 LT; the daily cap holds; land never sells back", () => {
    const { db, dev, farmsApi } = fresh();
    const buy = farmsApi.buyLand(dev.farmId, 100);
    expect(buy.gpPaid).toBe(LAND.GP_PER_100_TOKENS);
    expect(buy.farm.landTokens).toBe(100);
    expect(buy.capLeftToday).toBe(LAND.DAILY_BUY_CAP - 100);
    // The cap is per game-day.
    expect(() => farmsApi.buyLand(dev.farmId, LAND.DAILY_BUY_CAP)).toThrow(/Daily land cap/);
    farmsApi.buyLand(dev.farmId, LAND.DAILY_BUY_CAP - 100); // exactly to the cap
    expect(() => farmsApi.buyLand(dev.farmId, 1)).toThrow(/Daily land cap/);
    db.update(gameState).set({ dayIndex: 1 }).where(eq(gameState.id, 1)).run();
    expect(() => farmsApi.buyLand(dev.farmId, 1)).not.toThrow();
    // Odd amounts round the GP cost up — never fractional GP.
    const odd = farmsApi.buyLand(dev.farmId, 7);
    expect(odd.gpPaid).toBe(Math.ceil((7 * LAND.GP_PER_100_TOKENS) / 100));
  });
});
