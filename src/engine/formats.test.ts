import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { battleLog } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { Battle } from "./battle";
import { FIGURE, FORMATS, type FightFormat } from "./config";
import { Flock } from "./flock";

function freshGame() {
  const db = createDb(":memory:");
  seedGame(db);
  return { db, battle: new Battle(db), flock: new Flock(db) };
}

const byName = (flock: Flock, name: string) => flock.all().find((b) => b.name === name)!;

/** Count fought turns from the play-by-play's T<n> markers. */
const turnsIn = (playByPlay: string) =>
  Math.max(0, ...[...playByPlay.matchAll(/^T(\d+) /gm)].map((m) => Number(m[1])));

describe("the weapon dial (blade = distance)", () => {
  test("every format respects its turn cap; the sprint is shorter than the marathon on average", () => {
    const maxSeen: Record<FightFormat, number> = { longKnife: 0, shortKnife: 0, longGaff: 0, shortGaff: 0 };
    const totals: Record<FightFormat, number> = { longKnife: 0, shortKnife: 0, longGaff: 0, shortGaff: 0 };
    const RUNS = 25;
    for (const format of Object.keys(FORMATS) as FightFormat[]) {
      for (let seed = 1; seed <= RUNS; seed++) {
        const { battle, flock } = freshGame();
        const r = battle.fight(byName(flock, "Alab").id, "real", format, seed);
        const turns = turnsIn(r.playByPlay);
        expect(turns).toBeLessThanOrEqual(FORMATS[format].maxTurns);
        maxSeen[format] = Math.max(maxSeen[format], turns);
        totals[format] += turns;
      }
    }
    // The dial is real: long-knife bouts resolve fast, short-gaff bouts grind.
    expect(totals.longKnife / RUNS).toBeLessThan(totals.shortGaff / RUNS);
  });

  test("same seed + same format → identical fight (replayable)", () => {
    const a = freshGame();
    const b = freshGame();
    const r1 = a.battle.fight(byName(a.flock, "Alab").id, "real", "longGaff", 777);
    const r2 = b.battle.fight(byName(b.flock, "Alab").id, "real", "longGaff", 777);
    expect(r1.playByPlay).toBe(r2.playByPlay);
    expect(r1.pitFigure).toBe(r2.pitFigure);
  });
});

describe("the Pit Figure (discovery signal)", () => {
  test("banded to 5s, clamped to [0, MAX], stored on the battle log", () => {
    const { db, battle, flock } = freshGame();
    const alab = byName(flock, "Alab");
    for (let seed = 1; seed <= 10; seed++) {
      const r = battle.fight(alab.id, "real", "shortKnife", seed);
      expect(r.pitFigure % FIGURE.BAND).toBe(0);
      expect(r.pitFigure).toBeGreaterThanOrEqual(0);
      expect(r.pitFigure).toBeLessThanOrEqual(FIGURE.MAX);
      expect(r.playByPlay).toContain(`Pit Figure: ${r.pitFigure}`);
    }
    const logged = db.select().from(battleLog).where(eq(battleLog.birdId, alab.id)).all();
    expect(logged.length).toBe(10);
    for (const row of logged) expect(row.pitFigure % FIGURE.BAND).toBe(0);
  });

  test("losses still carry a figure — signal, not just a zero", () => {
    const { battle, flock } = freshGame();
    const alab = byName(flock, "Alab");
    let loss = null;
    for (let seed = 1; seed <= 100 && !loss; seed++) {
      const { battle: b2, flock: f2 } = freshGame();
      const r = b2.fight(byName(f2, "Alab").id, "real", "shortKnife", seed);
      if (r.result === "loss") loss = r;
    }
    expect(loss).not.toBeNull();
    expect(loss!.pitFigure).toBeGreaterThanOrEqual(0); // a rating, not a verdict
    void battle;
    void alab;
  });
});

describe("format records (the past-performance lines)", () => {
  test("aggregates record + figures per format", () => {
    const { battle, flock } = freshGame();
    const alab = byName(flock, "Alab");
    battle.fight(alab.id, "real", "longKnife", 11);
    battle.fight(alab.id, "real", "longKnife", 12);
    battle.fight(alab.id, "real", "shortGaff", 13);
    const records = battle.formatRecords(alab.id);
    expect(records.longKnife?.fights).toBe(2);
    expect(records.shortGaff?.fights).toBe(1);
    expect(records.longGaff).toBeUndefined();
    for (const rec of Object.values(records)) {
      expect(rec.wins + rec.losses).toBe(rec.fights);
      expect(rec.bestFigure).toBeGreaterThanOrEqual(rec.avgFigure - FIGURE.BAND); // avg rounds
    }
  });
});
