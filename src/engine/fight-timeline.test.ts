import { describe, expect, test } from "bun:test";
import { flat, shaped } from "./balance/lab";
import { FORMATS, type Element, type FightFormat } from "./config";
import { simulatePair, type Combatant } from "./fight-sim";
import { narrate, transcriptOf, winnerOf } from "./fight-timeline";
import { mulberry32 } from "./rng";

/**
 * ── THE TIMELINE IS THE RECORD (round 50) ──────────────────────────────────
 *
 * The play-by-play is no longer written by the fight; it is rendered from the
 * fight's timeline. Two things have to hold for that to be safe, and neither
 * is visible from the tests that already compare transcripts to each other:
 *
 *   1. The timeline is internally consistent — its ending agrees with its last
 *      turn, its winner with the result beside it — because a viewer draws
 *      straight from it and has no engine to check against.
 *   2. The lines only a rare fight produces still read as they did. The move
 *      to rendering was proven byte-identical once, over 26,880 fights, against
 *      the engine that wrote prose directly; that engine is gone, so the lines
 *      nothing else asserts on are pinned here.
 */
const FORMAT_IDS = Object.keys(FORMATS) as FightFormat[];

const fight = (a: Combatant, b: Combatant, format: FightFormat, seed: number, weather?: Element) =>
  simulatePair(a, b, format, mulberry32(seed), "TEST", weather);

/** Every fight a sweep can reach: all five blades, a spread of seeds. */
function* sweep(a: Combatant, b: Combatant, seeds = 40) {
  for (const format of FORMAT_IDS)
    for (let seed = 1; seed <= seeds; seed++) yield { format, sim: fight(a, b, format, seed) };
}

describe("the timeline agrees with itself", () => {
  // Quitters with small tanks, so one sweep reaches runs, emptied pools,
  // bells and blown tanks.
  const a = shaped({ gameness: 60, stamina: 20 }, { name: "Uno", base: 400 });
  const b = shaped({ gameness: 900, stamina: 20 }, { name: "Dos", base: 420 });

  test("the winner and the figures are the ones reported beside it", () => {
    for (const { sim } of sweep(a, b)) {
      expect(winnerOf(sim.timeline.ending)).toBe(sim.winner);
      expect(sim.timeline.figures).toEqual(sim.figures);
    }
  });

  test("a fight never runs past its blade, and every ending is reachable", () => {
    const seen = new Set<string>();
    for (const { format, sim } of sweep(a, b)) {
      const { turns, ending } = sim.timeline;
      expect(turns.length).toBeGreaterThan(0);
      expect(turns.length).toBeLessThanOrEqual(FORMATS[format].maxTurns);
      seen.add(ending.kind);
      // Only a fight that went the distance can be decided at the bell.
      if (ending.kind === "bell") expect(turns.length).toBe(FORMATS[format].maxTurns);
    }
    expect([...seen].sort()).toEqual(["bell", "healthOut", "ran"]);
  });

  test("the ending is what the last turn did", () => {
    for (const { sim } of sweep(a, b)) {
      const { turns, ending } = sim.timeline;
      const last = turns[turns.length - 1].exchange;
      if (ending.kind === "bell") continue;
      // A run and an emptied pool both happen TO the bird that was just hit.
      if (last.kind !== "hit") throw new Error(`a ${ending.kind} ending followed a tie`);
      expect(last.by).not.toBe(ending.side);
      if (ending.kind === "healthOut") expect(last.healthAfter).toBe(0);
      // A bird that ran did not stand, and still had health to run with.
      if (ending.kind === "ran") {
        expect(last.stood).toBe(false);
        expect(last.healthAfter).toBeGreaterThan(0);
      }
    }
  });

  test("health only falls, and only for the bird that was hit", () => {
    for (const { sim } of sweep(a, b, 10)) {
      const health = [sim.timeline.corners[0].health, sim.timeline.corners[1].health];
      for (const { exchange } of sim.timeline.turns) {
        if (exchange.kind === "tie") continue;
        const struck = exchange.by === 0 ? 1 : 0;
        expect(exchange.damage).toBeGreaterThan(0);
        expect(exchange.healthAfter).toBe(Math.max(0, health[struck] - exchange.damage));
        health[struck] = exchange.healthAfter;
      }
    }
  });

  test("a bird stands its ground at most once, and a tank blows on a fought turn", () => {
    for (const { sim } of sweep(a, b)) {
      const { corners, turns } = sim.timeline;
      for (const side of [0, 1] as const) {
        const stands = turns.filter(
          (t) => t.exchange.kind === "hit" && t.exchange.stood && t.exchange.by !== side
        );
        expect(stands.length).toBeLessThanOrEqual(1);
        const blownOn = corners[side].blownOn;
        if (blownOn !== null) {
          expect(blownOn).toBeGreaterThanOrEqual(1);
          expect(blownOn).toBeLessThanOrEqual(turns.length);
        }
      }
    }
  });
});

describe("the play-by-play is the timeline, rendered", () => {
  const a = shaped({ gameness: 60, stamina: 20 }, { name: "Uno", base: 400 });
  const b = shaped({ gameness: 900, stamina: 20 }, { name: "Dos", base: 420 });

  test("playByPlay is narrate(timeline), and the transcript is the same lines cut by turn", () => {
    for (const { sim } of sweep(a, b, 10)) {
      expect(sim.playByPlay).toBe(narrate(sim.timeline));
      const t = transcriptOf(sim.timeline);
      expect([...t.opening, ...t.turns.flat(), ...t.close].join("\n")).toBe(sim.playByPlay);
      expect(t.turns.length).toBe(sim.timeline.turns.length);
      // Every turn's own block carries its own T<n> line — the index IS the turn.
      t.turns.forEach((lines, i) =>
        expect(lines.some((l) => l.startsWith(`T${i + 1} [`))).toBe(true)
      );
    }
  });

  test("the result is told only in the close", () => {
    // What a no-spoilers reader relies on: hold `close` back and nothing
    // before it has said who won.
    for (const { sim } of sweep(a, b, 10)) {
      const t = transcriptOf(sim.timeline);
      const before = [...t.opening, ...t.turns.flat()].join("\n");
      expect(before).not.toContain("WINS");
      expect(before).not.toContain("Pit Figures");
      expect(before).not.toContain("RUNS");
      expect(t.close.at(-2)).toMatch(/^🏆 (Uno|Dos) WINS\.$/);
    }
  });

  // One fight per line that no other test reads. Each is found by sweeping
  // for the timeline fact, then the line is asserted whole.
  const find = (
    x: Combatant,
    y: Combatant,
    want: (sim: ReturnType<typeof fight>) => boolean,
    weather?: Element
  ) => {
    for (const format of FORMAT_IDS)
      for (let seed = 1; seed <= 200; seed++) {
        const sim = fight(x, y, format, seed, weather);
        if (want(sim)) return sim;
      }
    throw new Error("no fight in the sweep produced the case under test");
  };

  test("a blown tank, a bird that stands, and a bird that runs", () => {
    const blown = find(a, b, (s) => s.timeline.corners[0].blownOn !== null);
    expect(blown.playByPlay).toContain("Uno is blown — the tank is empty, running on heart now.");

    const stood = find(a, b, (s) =>
      s.timeline.turns.some((t) => t.exchange.kind === "hit" && t.exchange.stood)
    );
    expect(stood.playByPlay).toMatch(/\n(Uno|Dos) is badly hurt but stands its ground\.\n/);

    const ran = find(a, b, (s) => s.timeline.ending.kind === "ran" && s.timeline.ending.side === 0);
    // Nothing comes between the break and the result.
    expect(ran.playByPlay).toContain(
      "\nUno breaks and RUNS — no gameness left in it.\n🏆 Dos WINS.\n"
    );
  });

  test("an emptied pool and a bell", () => {
    const out = find(a, b, (s) => s.timeline.ending.kind === "healthOut");
    expect(out.playByPlay).toMatch(
      /: 0\n(Uno|Dos) is out of health — the sentensyador calls it\.\n🏆/
    );

    const bell = find(a, b, (s) => s.timeline.ending.kind === "bell");
    const winner = bell.timeline.corners[bell.winner].name;
    expect(bell.playByPlay).toContain(`\nTime is called — ${winner} kept more health.\n🏆`);
  });

  test("a tie, which only two birds with nothing to add can roll", () => {
    // Totals are dice plus what the bird brings; with no stats and no stars
    // both bring nothing, so equal pips are an exact tie.
    const x = flat(0, { name: "Uno" });
    const y = flat(0, { name: "Dos" });
    const tied = find(x, y, (s) => s.timeline.turns.some((t) => t.exchange.kind === "tie"));
    expect(tied.playByPlay).toMatch(/\nT\d+ \[\w+\] Both circle — \d\+\d vs \d\+\d\. No blood\.\n/);
  });

  test("the four moves, named off the winning dice", () => {
    const seen = new Set<string>();
    for (const { sim } of sweep(a, b)) {
      sim.timeline.turns.forEach((turn, i) => {
        if (turn.exchange.kind !== "hit") return;
        const [d0, d1] = turn.rolls[turn.exchange.by].dice;
        const line = transcriptOf(sim.timeline).turns[i].find((l) => l.startsWith("T"));
        const move = line?.match(/lands a (.+?) — /)?.[1] ?? "";
        seen.add(move.replace(/\d/, "N"));
        expect(turn.exchange.crit).toBe(d0 === d1);
        if (d0 === d1) expect(move).toBe(`TARI STRIKE (double ${d0}s!)`);
        else if (d0 + d1 >= 10) expect(move).toBe("high slash");
        else if (d0 + d1 <= 4) expect(move).toBe("quick feint");
        else expect(move).toBe("clean hit");
      });
    }
    expect([...seen].sort()).toEqual([
      "TARI STRIKE (double Ns!)",
      "clean hit",
      "high slash",
      "quick feint",
    ]);
  });

  test("a wheel edge with no stars behind it is said to count for nothing", () => {
    const fire = flat(400, { name: "Uno", element: "Fire", halfStars: 0 });
    const metal = flat(400, { name: "Dos", element: "Metal", halfStars: 0 });
    const sim = fight(fire, metal, "b2", 1);
    expect(sim.timeline.wheel).toBe(0);
    expect(sim.timeline.corners[0].elemEdge).toBeNull();
    expect(sim.playByPlay).toContain(
      "Fire overcomes Metal on the wheel — but Uno carries no stars, so it counts for nothing."
    );
    expect(sim.playByPlay).not.toContain("elem");
  });

  test("an outmatched bird is announced, and its rolls show the station it brings", () => {
    const small = shaped({ station: 2000 }, { name: "Uno", base: 300 });
    const big = flat(520, { name: "Dos" });
    const sim = fight(small, big, "b2", 1);
    expect(sim.timeline.corners[0].claw).toBeGreaterThan(0);
    expect(sim.timeline.corners[1].claw).toBe(0);
    expect(sim.playByPlay).toContain("\nUno is outmatched on paper — station will tell.\nT1 ");
    expect(sim.playByPlay).toContain("+station");
  });
});
