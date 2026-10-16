import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/db/client";
import { birds, events, farms, gameState } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { playAllHonestDays } from "./auto-play";
import { Bots } from "./bots";
import { BARN, ECONOMY } from "./config";
import { diagnose, formatReport } from "./doctor";
import { Game } from "./game";
import { admitLatecomer, latecomerId } from "./latecomers";
import { seedWorld } from "./rng";

const FAST_ROSTER = ["scripted-1", "scripted-3", "scripted-7", "scripted-8"];

function world() {
  const db = createDb(":memory:");
  const dev = seedGame(db, { flock: "legacy" });
  Bots.seed(db, { flock: "legacy", only: FAST_ROSTER });
  return { db, game: new Game(db, dev.farmId) };
}

const setDay = (db: DB, dayIndex: number) =>
  db.update(gameState).set({ dayIndex }).where(eq(gameState.id, 1)).run();

/** The simulator's day with --latecomers on: admit, honest play, tick. */
function playDays(db: DB, game: Game, days: number) {
  for (let i = 0; i < days; i++) {
    admitLatecomer(db);
    playAllHonestDays(db);
    game.tickDay();
  }
}

describe("admitting a latecomer", () => {
  test("nobody joins on the genesis hatch or on a day that is not a Hatch Friday", () => {
    const { db } = world();
    const before = db.select().from(farms).all().length;
    expect(admitLatecomer(db)).toBeNull();
    setDay(db, 9);
    expect(admitLatecomer(db)).toBeNull();
    expect(db.select().from(farms).all().length).toBe(before);
  });

  test("on a later Hatch Friday one stable joins with the stake and unhatched eggs", () => {
    const { db } = world();
    setDay(db, 14);
    const id = admitLatecomer(db);
    expect(id).toBe(latecomerId(2));
    const farm = db
      .select()
      .from(farms)
      .where(eq(farms.id, latecomerId(2)))
      .get();
    expect(farm).toMatchObject({ gp: ECONOMY.STARTING_GP, createdDay: 14, isBot: 0 });
    const flock = db
      .select()
      .from(birds)
      .where(eq(birds.farmId, latecomerId(2)))
      .all();
    expect(flock.length).toBe(BARN.STARTER_EGGS);
    expect(flock.every((b) => b.status === "egg")).toBe(true);
  });

  test("a second call on the same Friday admits nobody", () => {
    const { db } = world();
    setDay(db, 7);
    admitLatecomer(db);
    expect(admitLatecomer(db)).toBeNull();
    expect(db.select().from(farms).where(eq(farms.createdDay, 7)).all().length).toBe(1);
  });
});

describe("a world that takes latecomers", () => {
  // Through the second Friday, so two stables join and the first one's eggs hatch.
  const DAYS = 16;

  test("replays whole under a seed", () => {
    const ledger = () => {
      seedWorld(3);
      try {
        const { db, game } = world();
        playDays(db, game, DAYS);
        return db
          .select()
          .from(events)
          .all()
          .map(
            (e) =>
              `${e.dayIndex}|${e.type}|${e.farmId ?? ""}|${e.gpCents ?? ""}|${e.lt ?? ""}|${e.message}`
          );
      } finally {
        seedWorld(null);
      }
    };
    const first = ledger();
    expect(first.some((row) => row.includes(latecomerId(1)))).toBe(true);
    expect(ledger()).toEqual(first);
  });

  test("keeps every invariant, and the doctor reads its cohorts from rebuilt wallets", () => {
    const { db, game } = world();
    playDays(db, game, DAYS);
    const report = diagnose(db, ":memory:");
    expect(report.invariants.filter((i) => !i.passed)).toEqual([]);
    const cohorts = report.cohorts;
    if (!cohorts) throw new Error("a world with latecomers has a COHORTS report");
    // The rebuilt history is only worth reading if it lands on today's wallets.
    expect(cohorts.unreconciled).toEqual([]);
    const late = cohorts.farms.filter((f) => f.kind === "latecomer").map((f) => f.joinWeek);
    expect(late.sort()).toEqual([1, 2]);
    // Day 16: weeks 0 and 1 are complete. The week-1 stable has one complete
    // week behind it, the week-2 stable none.
    expect(cohorts.latecomers.map((l) => l.ratios.length)).toEqual([1, 0]);
    expect(formatReport(report)).toContain("COHORTS");
  });

  test("a world without latecomers prints no COHORTS block", () => {
    const { db, game } = world();
    game.tickDay();
    const report = diagnose(db, ":memory:");
    expect(report.cohorts).toBeNull();
    expect(report.health.some((h) => h.title === "COHORTS")).toBe(false);
  });
});
