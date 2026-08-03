import { describe, expect, test } from "bun:test";
import { createDb } from "@/db/client";
import { seedGame, seedStarterFlock } from "@/db/seed-data";
import { FIGURE, FORMATS, type Element, type FightFormat } from "./config";
import { simulatePair, type Combatant } from "./fight-sim";
import { Flock } from "./flock";
import { Game } from "./game";
import { Lobbies } from "./lobbies";
import { mulberry32 } from "./rng";

function bird(name: string, level: number, element: Element = "Fire", halfStars = 3): Combatant {
  return {
    name,
    stats: { agility: level, sight: level, stamina: level, gameness: level, station: level, condition: level },
    element,
    halfStars,
  };
}

/** Count fought turns from the play-by-play's T<n> markers. */
const turnsIn = (playByPlay: string) =>
  Math.max(0, ...[...playByPlay.matchAll(/^T(\d+) /gm)].map((m) => Number(m[1])));

describe("the weapon dial (blade = distance)", () => {
  test("every format respects its turn cap; the sprint is shorter than the marathon on average", () => {
    const totals: Record<FightFormat, number> = { longKnife: 0, shortKnife: 0, longGaff: 0, shortGaff: 0 };
    const RUNS = 40;
    for (const format of Object.keys(FORMATS) as FightFormat[]) {
      for (let seed = 1; seed <= RUNS; seed++) {
        const sim = simulatePair(bird("A", 350), bird("B", 350, "Water"), format, mulberry32(seed), "TEST");
        const turns = turnsIn(sim.playByPlay);
        expect(turns).toBeLessThanOrEqual(FORMATS[format].maxTurns);
        totals[format] += turns;
      }
    }
    // The dial is real: long-knife bouts resolve fast, short-gaff bouts grind.
    expect(totals.longKnife / RUNS).toBeLessThan(totals.shortGaff / RUNS);
  });

  test("same seed + same format → identical fight (replayable)", () => {
    const r1 = simulatePair(bird("A", 350), bird("B", 400, "Water"), "longGaff", mulberry32(777), "TEST");
    const r2 = simulatePair(bird("A", 350), bird("B", 400, "Water"), "longGaff", mulberry32(777), "TEST");
    expect(r1.playByPlay).toBe(r2.playByPlay);
    expect(r1.winner).toBe(r2.winner);
    expect(r1.figures).toEqual(r2.figures);
  });
});

describe("the Pit Figures (discovery signal)", () => {
  test("banded to 5s, clamped, per side — and losses still carry one", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const sim = simulatePair(bird("A", 300), bird("B", 450, "Water"), "shortKnife", mulberry32(seed), "TEST");
      for (const f of sim.figures) {
        expect(f % FIGURE.BAND).toBe(0);
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThanOrEqual(FIGURE.MAX);
      }
      // Both sides get a rating — the loser's figure is signal, not a zero.
      expect(sim.playByPlay).toContain("Pit Figures:");
    }
  });

  test("the opponent adjustment leans the underdog's figure up", () => {
    // Same fight sampled many times: the weaker bird's figure gets the
    // (stronger opponent) bonus, so ON AVERAGE it shouldn't trail by much
    // more than the outcome margin alone would suggest.
    let weakSum = 0;
    let strongSum = 0;
    const RUNS = 60;
    for (let seed = 1; seed <= RUNS; seed++) {
      const sim = simulatePair(bird("Weak", 280), bird("Strong", 420, "Water"), "shortKnife", mulberry32(seed), "T");
      weakSum += sim.figures[0];
      strongSum += sim.figures[1];
    }
    // The adjustment exists: the gap in average figures is far smaller than
    // the 140-point book gap would produce raw (a sanity band, not a law).
    expect(strongSum / RUNS - weakSum / RUNS).toBeLessThan(40);
  });
});

describe("format records (the past-performance lines)", () => {
  test("aggregates record + figures per format across carded fights", () => {
    const db = createDb(":memory:");
    const dev = seedGame(db, { flock: "legacy" });
    const game = new Game(db, dev.farmId);
    const { farm: rivalFarm } = game.farms.register({
      name: "Rival Gamefarm",
      primaryColor: "black",
      secondaryColor: "red",
    });
    seedStarterFlock(db, rivalFarm.id, { seed: 42, idPrefix: "rival", shape: "legacy" });
    const rival = new Lobbies(db, rivalFarm.id);
    const rivalFlock = new Flock(db, rivalFarm.id);
    const alab = game.flock.all().find((b) => b.name === "Alab")!;
    const rivalAlab = rivalFlock.byId("rival-6"); // the Alab slot — names are world-unique now

    const nights: FightFormat[] = ["longKnife", "longKnife", "shortGaff"];
    for (const [i, format] of nights.entries()) {
      game.lobbies.enter(alab.id, { mode: "real", classType: "open", format }, 100 + i);
      rival.enter(rivalAlab.id, { mode: "real", classType: "open", format });
      game.tickDay();
    }
    const records = game.lobbies.formatRecords(alab.id);
    expect(records.longKnife?.fights).toBe(2);
    expect(records.shortGaff?.fights).toBe(1);
    expect(records.longGaff).toBeUndefined();
    for (const rec of Object.values(records)) {
      expect(rec.wins + rec.losses).toBe(rec.fights);
      expect(rec.bestFigure).toBeGreaterThanOrEqual(rec.avgFigure - FIGURE.BAND); // avg rounds
    }
  });
});
