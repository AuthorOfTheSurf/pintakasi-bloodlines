import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { gameState } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { Battle } from "./battle";
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

  test("hardcore runs open only; claimers don't run through fight at all", () => {
    const { battle, flock } = freshGame();
    const sinag = byName(flock, "Sinag"); // age 3 — hardcore eligible
    const alab = byName(flock, "Alab");
    expect(() => battle.fight(sinag.id, "hardcore", "shortKnife", 1, "maiden")).toThrow(/open only/);
    expect(() => battle.fight(alab.id, "real", "shortKnife", 1, "claimer")).toThrow(/enter_claimer/);
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

// Claimers moved to their own two-phase flow — see claimers.test.ts.
