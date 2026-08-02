import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { battleLog, gameState } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { Battle } from "./battle";
import { ECONOMY } from "./config";
import { Flock } from "./flock";

function freshGame() {
  const db = createDb(":memory:");
  seedGame(db);
  return { db, battle: new Battle(db), flock: new Flock(db) };
}

// Seed active roster: Kidlat (1), Alab (2), Sinag (3), Batong Buhay (5).
const byName = (flock: Flock, name: string) => flock.all().find((b) => b.name === name)!;

describe("gates", () => {
  test("the age-gate matrix holds at the battle door", () => {
    const { battle, flock } = freshGame();
    const kidlat = byName(flock, "Kidlat"); // 1 — discovery year
    const alab = byName(flock, "Alab"); // 2 — real stakes
    expect(() => battle.fight(kidlat.id, "real")).toThrow(/real stakes open at age 2/);
    expect(() => battle.fight(kidlat.id, "hardcore")).toThrow(/hardcore opens at age 3/);
    expect(() => battle.fight(alab.id, "hardcore")).toThrow(/hardcore opens at age 3/);
    expect(() => battle.fight(kidlat.id, "practice")).not.toThrow();
  });

  test("retired birds cannot fight", () => {
    const { battle } = freshGame();
    expect(() => battle.fight("starter-1", "real")).toThrow(/not an active fighter/);
  });
});

describe("the fight", () => {
  test("same seed → identical play-by-play (replayable)", () => {
    const g1 = freshGame();
    const g2 = freshGame();
    const a = g1.battle.fight(byName(g1.flock, "Alab").id, "real", 1234);
    const b = g2.battle.fight(byName(g2.flock, "Alab").id, "real", 1234);
    expect(a.playByPlay).toBe(b.playByPlay);
    expect(a.result).toBe(b.result);
    expect(a.opponent).toEqual(b.opponent);
  });

  test("GP settles by mode: entry fee always, prize on a win", () => {
    const { db, battle, flock } = freshGame();
    const alab = byName(flock, "Alab");
    const result = battle.fight(alab.id, "real", 99);
    const state = db.select().from(gameState).where(eq(gameState.id, 1)).get()!;
    const expected =
      result.result === "win"
        ? ECONOMY.STARTING_GP + ECONOMY.REAL_PRIZE - ECONOMY.REAL_ENTRY_FEE
        : ECONOMY.STARTING_GP - ECONOMY.REAL_ENTRY_FEE;
    expect(state.gp).toBe(expected);
    expect(result.gpDelta).toBe(expected - ECONOMY.STARTING_GP);
  });

  test("practice has small stakes and builds the AMATEUR record, not the career", () => {
    const { db, battle, flock } = freshGame();
    const kidlat = byName(flock, "Kidlat");
    const result = battle.fight(kidlat.id, "practice", 5);
    // Small but real stakes: win nets prize - entry, loss costs the entry.
    expect(result.gpDelta).toBe(
      result.result === "win"
        ? ECONOMY.PRACTICE_PRIZE - ECONOMY.PRACTICE_ENTRY_FEE
        : -ECONOMY.PRACTICE_ENTRY_FEE
    );
    // Career record untouched; amateur record moves.
    expect(result.bird.wins).toBe(0);
    expect(result.bird.losses).toBe(0);
    expect(result.bird.practiceWins + result.bird.practiceLosses).toBe(1);
    const log = db.select().from(battleLog).all();
    expect(log.length).toBe(1);
  });

  test("real fights update the record", () => {
    const { battle, flock } = freshGame();
    const alab = byName(flock, "Alab"); // 1W-1L
    const result = battle.fight(alab.id, "real", 42);
    expect(result.bird.wins + result.bird.losses).toBe(3);
  });

  test("insufficient GP blocks entry", () => {
    const { db, battle, flock } = freshGame();
    db.update(gameState).set({ gp: 10 }).where(eq(gameState.id, 1)).run();
    expect(() => battle.fight(byName(flock, "Alab").id, "real")).toThrow(/entry costs/);
  });
});

describe("hardcore — the key rule", () => {
  /** Find seeds where Sinag (age 3) wins and loses, then assert both arms. */
  function findSeeds() {
    let winSeed = -1;
    let lossSeed = -1;
    for (let seed = 1; seed < 200 && (winSeed < 0 || lossSeed < 0); seed++) {
      const { battle, flock } = freshGame();
      const sinag = byName(flock, "Sinag");
      const r = battle.fight(sinag.id, "hardcore", seed);
      if (r.result === "win" && winSeed < 0) winSeed = seed;
      if (r.result === "loss" && lossSeed < 0) lossSeed = seed;
    }
    return { winSeed, lossSeed };
  }

  const { winSeed, lossSeed } = findSeeds();

  test("both outcomes are reachable (it's a real gamble)", () => {
    expect(winSeed).toBeGreaterThan(0);
    expect(lossSeed).toBeGreaterThan(0);
  });

  test("a hardcore WIN pays big and the career continues", () => {
    const { battle, flock } = freshGame();
    const sinag = byName(flock, "Sinag");
    const r = battle.fight(sinag.id, "hardcore", winSeed);
    expect(r.gpDelta).toBe(ECONOMY.HARDCORE_PRIZE - ECONOMY.HARDCORE_ENTRY_FEE);
    expect(r.forcedRetirement).toBe(false);
    expect(r.bird.status).toBe("active");
  });

  test("a hardcore LOSS force-retires the bird — career over, barn open", () => {
    const { battle, flock } = freshGame();
    const sinag = byName(flock, "Sinag");
    const r = battle.fight(sinag.id, "hardcore", lossSeed);
    expect(r.forcedRetirement).toBe(true);
    expect(r.bird.status).toBe("retired");
    expect(r.bird.retiredBy).toBe("hardcore");
    expect(r.bird.studValue).not.toBeNull(); // the career converts, not evaporates
  });
});

describe("training (discovery year)", () => {
  test("only age-1 birds train; gains and daily cap apply", () => {
    const { db, flock } = freshGame();
    const kidlat = byName(flock, "Kidlat"); // age 1
    const alab = byName(flock, "Alab"); // age 2
    expect(() => flock.train(alab.id, "heart")).toThrow(/discovery year/);

    const before = kidlat.heart;
    const t1 = flock.train(kidlat.id, "heart");
    expect(t1.bird.heart).toBe(before + 1);
    expect(t1.sessionsLeftToday).toBe(2);
    flock.train(kidlat.id, "agility");
    flock.train(kidlat.id, "heart");
    expect(() => flock.train(kidlat.id, "sight")).toThrow(/spent/);

    // Next day the cap resets.
    db.update(gameState).set({ dayIndex: 1 }).where(eq(gameState.id, 1)).run();
    expect(() => flock.train(kidlat.id, "sight")).not.toThrow();
  });
});
