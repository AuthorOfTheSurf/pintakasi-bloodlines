import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { gameState } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { ECONOMY, GACHA_TOKENS } from "./config";
import { Gacha } from "./gacha";
import { mulberry32 } from "./rng";

describe("gacha stub", () => {
  test("a roll costs GP and yields a rarity token", () => {
    const db = createDb(":memory:");
    seedGame(db);
    const gacha = new Gacha(db, mulberry32(1));
    const { token, pricePaid, collection } = gacha.roll();
    expect(GACHA_TOKENS).toContain(token);
    expect(pricePaid).toBe(ECONOMY.GACHA_ROLL_PRICE);
    expect(collection[token]).toBe(1);
    const state = db.select().from(gameState).where(eq(gameState.id, 1)).get()!;
    expect(state.gp).toBe(ECONOMY.STARTING_GP - ECONOMY.GACHA_ROLL_PRICE);
  });

  test("rarity distribution roughly follows the weights (Gold is rare)", () => {
    const db = createDb(":memory:");
    seedGame(db);
    db.update(gameState).set({ gp: 100_000 }).where(eq(gameState.id, 1)).run();
    const gacha = new Gacha(db, mulberry32(2));
    for (let i = 0; i < 500; i++) gacha.roll();
    const c = gacha.collection();
    expect(c.White).toBeGreaterThan(c.Gold);
    expect(c.Green).toBeGreaterThan(c.Purple);
    expect(c.White + c.Green + c.Blue + c.Purple + c.Gold).toBe(500);
  });

  test("an empty wallet cannot roll", () => {
    const db = createDb(":memory:");
    seedGame(db, { startingGp: 50 });
    expect(() => new Gacha(db, mulberry32(3)).roll()).toThrow(/costs 100 GP/);
  });
});
