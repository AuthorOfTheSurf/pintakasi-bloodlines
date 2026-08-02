import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { gameState } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { ECONOMY, GACHA_BIRDS, GACHA_TOKENS, LAND } from "./config";
import { Flock } from "./flock";
import { Gacha } from "./gacha";
import { Game } from "./game";
import { mulberry32 } from "./rng";

describe("gacha", () => {
  test("a roll costs GP and yields a rarity token plus a Land Token", () => {
    const db = createDb(":memory:");
    seedGame(db);
    const gacha = new Gacha(db, mulberry32(1));
    const { token, pricePaid, landTokens, collection } = gacha.roll();
    expect(GACHA_TOKENS).toContain(token);
    expect(pricePaid).toBe(ECONOMY.GACHA_ROLL_PRICE);
    expect(landTokens).toBe(LAND.PER_GACHA_ROLL);
    expect(collection[token]).toBe(1);
    const state = db.select().from(gameState).where(eq(gameState.id, 1)).get()!;
    expect(state.gp).toBe(ECONOMY.STARTING_GP - ECONOMY.GACHA_ROLL_PRICE);
    expect(state.landTokens).toBe(LAND.PER_GACHA_ROLL);
  });

  test("rarity distribution roughly follows the weights (Gold is rare)", () => {
    const db = createDb(":memory:");
    seedGame(db);
    db.update(gameState).set({ gp: 10_000_000 }).where(eq(gameState.id, 1)).run();
    const gacha = new Gacha(db, mulberry32(2));
    for (let i = 0; i < 500; i++) gacha.roll();
    const c = gacha.collection();
    expect(c.White).toBeGreaterThan(c.Gold);
    expect(c.Green).toBeGreaterThan(c.Purple);
    expect(c.White + c.Green + c.Blue + c.Purple + c.Gold).toBe(500);
    // 500 rolls = 500 land tokens, flat and unconditional.
    const state = db.select().from(gameState).where(eq(gameState.id, 1)).get()!;
    expect(state.landTokens).toBe(500);
  });

  test("Blue+ rolls drop a mystery egg — random element, hidden sex, hatches next Friday", () => {
    const db = createDb(":memory:");
    seedGame(db);
    db.update(gameState).set({ gp: 10_000_000 }).where(eq(gameState.id, 1)).run();
    const gacha = new Gacha(db, mulberry32(7));
    const flock = new Flock(db);
    const barnBefore = flock.barnCount();

    let dropped = null;
    let plainRolls = 0;
    for (let i = 0; i < 100 && !dropped; i++) {
      const r = gacha.roll();
      if (r.egg) dropped = r;
      else plainRolls++;
    }
    expect(dropped).not.toBeNull();
    expect(GACHA_BIRDS[dropped!.token]).toBeDefined(); // only qualifying tiers drop
    expect(plainRolls).toBeGreaterThan(0); // and most rolls don't
    const egg = dropped!.egg!;
    expect(egg.status).toBe("egg");
    expect(egg.age).toBe(0);
    expect(egg.sex).toBe("hidden"); // the 50-50 surprise still belongs to hatch day
    expect(egg.motherId).toBeNull(); // no parents — the machine is not kin
    expect(egg.name).toBe(`Mystery Egg (${dropped!.token})`);
    const tier = GACHA_BIRDS[dropped!.token]!;
    expect(egg.halfStars).toBeGreaterThanOrEqual(tier.halfStars[0]);
    expect(egg.halfStars).toBeLessThanOrEqual(tier.halfStars[1]);
    expect(flock.barnCount()).toBeGreaterThan(barnBefore);

    // It hatches like any egg — next Hatch Friday, sex revealed.
    const game = new Game(db);
    const tick = game.tickWeek();
    expect(tick.fridays[0].hatched.map((b) => b.id)).toContain(egg.id);
    expect(["male", "female"]).toContain(flock.byId(egg.id).sex);
  });

  test("an empty wallet cannot roll", () => {
    const db = createDb(":memory:");
    seedGame(db, { startingGp: 500 });
    expect(() => new Gacha(db, mulberry32(3)).roll()).toThrow(/A roll costs/);
  });
});
