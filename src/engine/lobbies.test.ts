import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { birds, farms, gameState } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { Battle } from "./battle";
import { CLAIMER, ECONOMY } from "./config";
import { Flock } from "./flock";

function freshGame() {
  const db = createDb(":memory:");
  const { farmId } = seedGame(db);
  return { db, farmId, battle: new Battle(db, farmId), flock: new Flock(db, farmId) };
}

const byName = (flock: Flock, name: string) => flock.all().find((b) => b.name === name)!;

describe("the fight cap", () => {
  test("one fight per bird per game-day — resets on the day tick, no cooldown", () => {
    const { db, battle, flock } = freshGame();
    const alab = byName(flock, "Alab");
    battle.fight(alab.id, "real", "shortKnife", 1);
    expect(() => battle.fight(alab.id, "real", "shortKnife", 2)).toThrow(/already fought today/);
    // Another bird can still fight today.
    expect(() => battle.fight(byName(flock, "Kidlat").id, "practice", "shortKnife", 3)).not.toThrow();
    // The day ticks — Alab fights again immediately (a count, not a cooldown).
    db.update(gameState).set({ dayIndex: 1 }).where(eq(gameState.id, 1)).run();
    expect(() => battle.fight(alab.id, "real", "shortKnife", 4)).not.toThrow();
  });
});

describe("lobby eligibility (entry restrictions self-sort)", () => {
  test("maidens take never-winners only; win-caps count career wins", () => {
    const { battle, flock } = freshGame();
    const alab = byName(flock, "Alab"); // 1W-1L career
    const sinag = byName(flock, "Sinag"); // 4W-1L career
    const kidlat = byName(flock, "Kidlat"); // age 1, 0 amateur wins
    expect(() => battle.fight(alab.id, "real", "shortKnife", 1, "maiden")).toThrow(/never-winners/);
    expect(() => battle.fight(sinag.id, "real", "shortKnife", 1, "nw2")).toThrow(/fewer than 2/);
    expect(() => battle.fight(sinag.id, "real", "shortKnife", 1, "nw3")).toThrow(/fewer than 3/);
    expect(() => battle.fight(alab.id, "real", "shortKnife", 1, "nw2")).not.toThrow(); // 1 win < 2
    // Amateur maidens run on the amateur record.
    expect(() => battle.fight(kidlat.id, "practice", "shortKnife", 2, "maiden")).not.toThrow();
  });

  test("hardcore runs open only; claimers need a tag from the price list", () => {
    const { battle, flock } = freshGame();
    const sinag = byName(flock, "Sinag"); // age 3 — hardcore eligible
    const alab = byName(flock, "Alab");
    expect(() => battle.fight(sinag.id, "hardcore", "shortKnife", 1, "maiden")).toThrow(/open only/);
    expect(() => battle.fight(alab.id, "real", "shortKnife", 1, "claimer")).toThrow(/claiming tag/);
    expect(() => battle.fight(alab.id, "real", "shortKnife", 1, "claimer", 123)).toThrow(/claiming tag/);
    expect(() => battle.fight(alab.id, "practice", "shortKnife", 1, "nw2")).toThrow(/open or maiden/);
  });

  test("maiden house birds are softer than open ones (same bird, same seed)", () => {
    const a = freshGame();
    const b = freshGame();
    const kidlat = (g: ReturnType<typeof freshGame>) => byName(g.flock, "Kidlat");
    const open = a.battle.fight(kidlat(a).id, "practice", "shortKnife", 55, "open");
    const maiden = b.battle.fight(kidlat(b).id, "practice", "shortKnife", 55, "maiden");
    const avg = (s: Record<string, number>) =>
      Object.values(s).reduce((x, y) => x + y, 0) / 6;
    expect(avg(maiden.opponent.stats)).toBeLessThan(avg(open.opponent.stats));
  });
});

describe("claimers (marketplace v0)", () => {
  function findResult(want: "win" | "loss", price: number) {
    for (let seed = 1; seed < 300; seed++) {
      const g = freshGame();
      const alab = byName(g.flock, "Alab");
      const r = g.battle.fight(alab.id, "real", "shortKnife", seed, "claimer", price);
      if (r.result === want) return { ...g, r, alabId: alab.id };
    }
    throw new Error(`no ${want} seed found`);
  }

  test("LOSE a claimer: the house claims your bird at the tag — GP in, bird gone", () => {
    const price = CLAIMER.PRICES[0];
    const { db, farmId, r, alabId, flock } = findResult("loss", price);
    expect(r.claimedAway).toBe(true);
    expect(r.gpDelta).toBe(-ECONOMY.REAL_ENTRY_FEE + price); // entry lost, tag collected
    const farm = db.select().from(farms).where(eq(farms.id, farmId)).get()!;
    expect(farm.gp).toBe(ECONOMY.STARTING_GP - ECONOMY.REAL_ENTRY_FEE + price);
    // The bird now belongs to the house.
    expect(() => flock.byId(alabId)).toThrow(/in your barn/);
    expect(db.select().from(birds).where(eq(birds.id, alabId)).get()!.farmId).toBe("house");
  });

  test("WIN a claimer: the house bird is claimable at the tag, same game-day, once", () => {
    const price = CLAIMER.PRICES[1];
    const { db, r, battle, flock } = findResult("win", price);
    expect(r.claimOffer).not.toBeNull();
    expect(r.claimOffer!.price).toBe(price);
    const before = flock.barnCount();
    const claimed = battle.claimHouseBird(r.claimOffer!.battleLogId);
    expect(claimed.pricePaid).toBe(price);
    expect(claimed.bird.name).toBe(r.opponent.name);
    expect(claimed.bird.status).toBe("active");
    expect(["male", "female"]).toContain(claimed.bird.sex);
    expect(flock.barnCount()).toBe(before + 1);
    // One claim only.
    expect(() => battle.claimHouseBird(r.claimOffer!.battleLogId)).toThrow(/already claimed/);
    // And the window is the game-day.
    const again = findResult("win", price);
    again.db.update(gameState).set({ dayIndex: 5 }).where(eq(gameState.id, 1)).run();
    expect(() => again.battle.claimHouseBird(again.r.claimOffer!.battleLogId)).toThrow(/window closed/);
  });

  test("claimer house birds key to the tag price, not to your bird", () => {
    const cheap = freshGame();
    const dear = freshGame();
    const r1 = cheap.battle.fight(byName(cheap.flock, "Alab").id, "real", "shortKnife", 77, "claimer", CLAIMER.PRICES[0]);
    const r2 = dear.battle.fight(byName(dear.flock, "Alab").id, "real", "shortKnife", 77, "claimer", CLAIMER.PRICES[2]);
    const avg = (s: Record<string, number>) => Object.values(s).reduce((x, y) => x + y, 0) / 6;
    expect(avg(r2.opponent.stats)).toBeGreaterThan(avg(r1.opponent.stats));
  });
});
