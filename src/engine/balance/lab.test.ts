import { describe, expect, test } from "bun:test";
import {
  BATTLE,
  FIGURE,
  FORMAT_NAMES,
  FORMATS,
  STARS,
  STAT_NAMES,
  STATS,
  WEATHER,
} from "@/engine/config";
import { simulatePair, type Combatant } from "@/engine/fight-sim";
import { mulberry32 } from "@/engine/rng";
import {
  clawbackOf,
  converge,
  duel,
  flat,
  LAB,
  mirrored,
  shaped,
  statTotal,
  sweep,
  sweepableKnobs,
  underdogOf,
  withKnob,
} from "./lab";

/**
 * THE POINT OF THIS FILE, borrowed wholesale from doctor.test.ts: "a health
 * check nobody has watched FAIL is a green light with no bulb in it."
 *
 * The lab is a RULER. Its job is to say what a knob is worth, and the numbers
 * it says will change every time someone tunes one — so nothing here asserts
 * what the engine's win rates OUGHT to be. That belongs in the lab's own
 * report, where a human reads it as balance. Here we only prove the ruler is
 * straight, and we prove it the doctor's way: every measurement is rigged so
 * the true answer is known BEFORE the fight runs, and every mechanism is
 * pushed until it would read wrong if it were broken.
 *
 * The three properties that carry the rest:
 *   1. determinism    — a window of seeds means the same thing twice
 *   2. window-freedom — the answer is the engine's, not seed 1..200's
 *   3. restoration    — withKnob leaves config exactly as it found it
 * Break any one and every number the lab has ever printed is suspect. (3) is
 * the dangerous one: it mutates real config objects that the whole test suite
 * shares, so a leak here corrupts files that never imported the lab.
 */

// Small enough to be free, large enough that a rigged 99%-vs-1% matchup is
// unambiguous. Mechanical assertions use this; only the genuinely statistical
// tests reach for LAB.HEADLINE_RUNS.
const QUICK = 300;

/**
 * config's blocks are `as const`, so TypeScript believes BATTLE.ELEMENT_EDGE
 * is the literal 0.5 forever — which is exactly the fiction withKnob exists to
 * break at runtime. Reading a knob through this says "a number, whatever it is
 * right now", which is the truth while a sweep is in flight.
 */
const knobValue = (value: number): number => value;

/** Two birds that differ only in name — the control matchup, truth = 50%. */
const twins = () => [flat(350, { name: "A" }), flat(350, { name: "B" })] as const;

/**
 * A matchup whose winner is not in doubt: 1800 across the board against a
 * 300 maiden. Rigged deliberately far past the underdog gate — the maiden
 * gets its station bonus and still loses ~all of them, which is what makes
 * this pair usable as a known answer.
 */
const monster = () => flat(1800, { name: "Monster" });
const maiden = () => flat(300, { name: "Maiden" });

/**
 * What the ENGINE decided about the station slope, read off the narration it
 * writes at the scale. Since the 2026-08-04 rework the "outmatched on paper"
 * line prints when a side's clawback reaches 0.05/roll — so this is the
 * ground truth `clawbackOf` is checked against at that threshold, without
 * reimplementing fight-sim's arithmetic here (two copies agreeing proves
 * nothing).
 */
function engineNarratesOutmatched(a: Combatant, b: Combatant): { A: boolean; B: boolean } {
  const pbp = simulatePair(a, b, "b2", mulberry32(1), "TEST").playByPlay;
  const aFlag = pbp.includes(`${a.name} is outmatched on paper`);
  const bFlag = pbp.includes(`${b.name} is outmatched on paper`);
  // Both sides can't be outmatched at once: the clawback keys on a one-sided
  // deficit of totals.
  expect(aFlag && bFlag).toBe(false);
  return { A: aFlag, B: bFlag };
}

describe("determinism — the property everything else rests on", () => {
  test("the same birds over the same seed window give a bit-identical result", () => {
    const [a, b] = twins();
    const opts = { format: "b2" as const, runs: QUICK, seedFrom: 4242 };
    // toEqual on the whole struct, not just winRate: a mean that drifted while
    // the win rate held still would still make the lab's tables unreadable.
    expect(duel(a, b, opts)).toEqual(duel(a, b, opts));
  });

  test("…and so does mirrored, which runs the fight twice more", () => {
    const opts = { format: "b3" as const, runs: QUICK, seedFrom: 77 };
    expect(mirrored(monster(), maiden(), opts)).toEqual(mirrored(monster(), maiden(), opts));
  });

  test("a duel is a pure function of its inputs — running others first changes nothing", () => {
    const [a, b] = twins();
    const opts = { format: "b2" as const, runs: QUICK, seedFrom: 9 };
    const first = duel(a, b, opts);
    // Deliberately churn the module in between. If `duel` ever grew shared
    // state — a memo, a reused rng, a cached fighter — this is where it shows.
    duel(monster(), maiden(), { format: "b4", runs: QUICK });
    mirrored(a, b, { format: "b1", runs: 50 });
    expect(duel(a, b, opts)).toEqual(first);
  });

  test("fresh stream per seed: a window is the same fights however you slice it", () => {
    // The reason lab.ts seeds one mulberry32 PER FIGHT instead of sharing a
    // stream. If runs shared a stream, fight i would depend on fight i-1 and
    // the halves of a window would not reassemble into the whole.
    const [a, b] = twins();
    const fmt = { format: "b2" as const };
    const whole = duel(a, b, { ...fmt, runs: 200, seedFrom: 1 });
    const lower = duel(a, b, { ...fmt, runs: 100, seedFrom: 1 });
    const upper = duel(a, b, { ...fmt, runs: 100, seedFrom: 101 });
    expect(whole.winRate).toBeCloseTo((lower.winRate + upper.winRate) / 2, 10);
    expect(whole.meanTurns).toBeCloseTo((lower.meanTurns + upper.meanTurns) / 2, 10);
  });
});

describe("seed window independence", () => {
  test("a different window is a different sample but the same answer", () => {
    // The test this file exists to never repeat: a 200-seed window once
    // asserted a ceiling that sat BELOW the truth and passed. Both windows
    // here are HEADLINE_RUNS wide, and the tolerance is the measurement's own
    // stated precision rather than a number picked to make the test green.
    const [a, b] = twins();
    const fmt = { format: "b2" as const, runs: LAB.HEADLINE_RUNS };
    const w1 = duel(a, b, { ...fmt, seedFrom: LAB.SEED_FROM });
    const w2 = duel(a, b, { ...fmt, seedFrom: LAB.SEED_FROM + LAB.WINDOW_STRIDE });

    // Genuinely different fights — if the seed window were being ignored the
    // two would be identical and the "agreement" below would be vacuous.
    expect(w1.meanTurns).not.toBe(w2.meanTurns);
    // …and the same underlying quantity, inside the two intervals combined.
    expect(Math.abs(w1.winRate - w2.winRate)).toBeLessThan(w1.ci95 + w2.ci95);
  });

  test("ci95 narrows with the sample, as sqrt(n)", () => {
    // Not decoration: the lab's tables are read as "a difference smaller than
    // this is not a result", so the interval has to actually track n.
    const [a, b] = twins();
    const small = duel(a, b, { format: "b2", runs: 1000 });
    const big = duel(a, b, { format: "b2", runs: 4000 });
    expect(small.ci95 / big.ci95).toBeCloseTo(2, 1);
  });
});

describe("duel, under conditions where the answer is known in advance", () => {
  test("a monster beats a maiden essentially always", () => {
    const d = duel(monster(), maiden(), { format: "b2", runs: QUICK });
    expect(d.winRate).toBeGreaterThan(95);
    // …and the lab notices the gate it tripped on the way. A star or stat
    // measurement that ignores this reports the WEAKER bird's station bonus
    // as part of the effect it thought it was measuring.
    expect(d.underdog).toBe("B");
  });

  test("…and the same monster on the other side loses essentially always", () => {
    const d = duel(maiden(), monster(), { format: "b2", runs: QUICK });
    expect(d.winRate).toBeLessThan(5);
    expect(d.underdog).toBe("A");
  });

  test("two identical birds sit on a coin flip", () => {
    const [a, b] = twins();
    const d = duel(a, b, { format: "b2", runs: LAB.HEADLINE_RUNS });
    // The tolerance is the measurement's own interval, doubled — this is the
    // one place a "near 50%" claim is allowed, because symmetry guarantees it.
    expect(Math.abs(d.winRate - 50)).toBeLessThan(2 * d.ci95);
    expect(d.underdog).toBe("neither");
  });

  test("the element edge lands on the side that has it, in every blade", () => {
    // Fire overcomes Metal. Which bird wins is the engine's business; that the
    // lab attributes the wins to the right SIDE is the lab's. Full stars,
    // because stars are the element's volume knob — at 0★ there is no edge
    // to attribute (that muteness has its own test in the stars case).
    for (const format of FORMAT_NAMES) {
      const fire = flat(350, { name: "Fire", element: "Fire", halfStars: STARS.MAX_HALF_STARS });
      const metal = flat(350, { name: "Metal", element: "Metal", halfStars: STARS.MAX_HALF_STARS });
      expect(duel(fire, metal, { format, runs: QUICK }).winRate).toBeGreaterThan(50);
      expect(duel(metal, fire, { format, runs: QUICK }).winRate).toBeLessThan(50);
    }
  });

  test("the weather option reaches the engine", () => {
    // Cheap, but the failure mode is invisible: a dropped `opts.weather` would
    // make every weather table in the report a table about nothing. Full
    // stars so the day has a nonzero value to deliver.
    const fire = flat(350, { name: "Fire", element: "Fire", halfStars: STARS.MAX_HALF_STARS });
    const water = flat(350, { name: "Water", element: "Water", halfStars: STARS.MAX_HALF_STARS });
    const opts = { format: "b2" as const, runs: LAB.HEADLINE_RUNS };
    // Water overcomes Fire, so the neutral day belongs to Water; a Fire day
    // hands Fire the weather edge back and must move the number toward Fire.
    const neutral = duel(fire, water, opts);
    const fireDay = duel(fire, water, { ...opts, weather: "Fire" });
    expect(fireDay.winRate).toBeGreaterThan(neutral.winRate + neutral.ci95);
  });
});

describe("duel's bookkeeping is self-consistent", () => {
  test("in every format: endings account for 100% of fights, and ran is the sum of both sides", () => {
    for (const format of FORMAT_NAMES) {
      const d = duel(monster(), maiden(), { format, runs: QUICK });
      const { ran, windOut, bell } = d.endings;
      expect(ran + windOut + bell).toBeCloseTo(100, 10);
      for (const v of [ran, windOut, bell]) expect(v).toBeGreaterThanOrEqual(0);
      // Only the bird that just took a hit gets the morale check, and the
      // fight stops the moment it breaks — so at most one side can run, and
      // the two per-side rates must add up to the ending exactly. This is the
      // assertion that catches a narration string drifting out from under the
      // parser: a missed `breaks and RUNS` would show up here as a shortfall.
      expect(d.ranRateA + d.ranRateB).toBeCloseTo(ran, 10);
    }
  });

  test("figures come out banded and inside the figure's own range", () => {
    // At runs=1 the reported mean IS the single fight's figure, so the raw
    // engine output is visible through the lab's averaging.
    for (let seed = 1; seed <= 40; seed++) {
      const d = duel(flat(350, { name: "A" }), flat(480, { name: "B" }), {
        format: "b2",
        runs: 1,
        seedFrom: seed,
      });
      for (const fig of [d.meanFigureA, d.meanFigureB]) {
        expect(fig % FIGURE.BAND).toBe(0);
        expect(fig).toBeGreaterThanOrEqual(0);
        expect(fig).toBeLessThanOrEqual(FIGURE.MAX);
      }
    }
  });

  test("the mean figure follows the better bird", () => {
    const d = duel(monster(), maiden(), { format: "b2", runs: QUICK });
    // Not a balance claim — the loser is scored DOWN from the winner by
    // construction (fight-sim's beaten lengths), so a lab that mixed the two
    // indexes up would invert this in a matchup this lopsided.
    expect(d.meanFigureA).toBeGreaterThan(d.meanFigureB);
    expect(d.meanTurns).toBeGreaterThan(0);
    expect(d.runs).toBe(QUICK);
  });

  test("meanTurns tracks the blade's length", () => {
    // b1 caps at 5 turns, b4 at 30. A meanTurns that ignored the
    // T<n> markers (or read the last line instead of the max) would flatten
    // these into each other.
    const [a, b] = twins();
    const sprint = duel(a, b, { format: "b1", runs: QUICK }).meanTurns;
    const marathon = duel(a, b, { format: "b4", runs: QUICK }).meanTurns;
    expect(sprint).toBeLessThan(marathon);
  });

  test("two birds with the same name are refused, not silently misattributed", () => {
    // The endings and run rates are parsed out of name-keyed narration, so
    // identical names would credit both birds' runs to one side and the lab
    // would report a fabricated gameness asymmetry with no error anywhere.
    const same = { format: "b2" as const, runs: 10 };
    expect(() => duel(flat(350, { name: "Dup" }), flat(400, { name: "Dup" }), same)).toThrow(
      /both birds are named "Dup"/
    );
    // The likeliest way to hit it by accident: `flat` defaults every bird to
    // "A", so the naive two-liner is caught rather than quietly measured.
    expect(() => duel(flat(350), flat(400), same)).toThrow(/distinct names/);
    // …and through mirrored, which builds its own combatants on the way.
    expect(() => mirrored(flat(350), flat(400), same)).toThrow(/distinct names/);
  });
});

describe("mirrored cancels side bias", () => {
  const opts = { format: "b2" as const, runs: 1000, seedFrom: 31 };

  test("a symmetric matchup lands on 50%", () => {
    const [a, b] = twins();
    const m = mirrored(a, b, { format: "b2", runs: LAB.HEADLINE_RUNS });
    expect(Math.abs(m.winRate - 50)).toBeLessThan(2 * m.ci95);
  });

  test("the swap is a complement, not an average — a rigged blowout stays a blowout", () => {
    // THE test in this file. Both plausible wrong implementations land exactly
    // on 50% here, which is also the right answer for the symmetric case
    // above — so only a matchup with a known, extreme, ASYMMETRIC answer can
    // tell a working `mirrored` from a broken one:
    //   averaging the two win rates naively -> (99.9 + 0.1)/2 = 50%
    //   forgetting to swap the sides back   -> the same 50%
    // The monster wins ~all of them from either corner; anything near 50 here
    // means the reverse run is being counted for the wrong bird.
    const m = mirrored(monster(), maiden(), opts);
    expect(m.winRate).toBeGreaterThan(95);
  });

  test("it is exactly the complement of the two directions", () => {
    // Pins the arithmetic itself, on the asymmetric pair so the identity has
    // something to say. Checked against duel's own output rather than against
    // a constant, so it survives any retune of the engine.
    const forward = duel(monster(), maiden(), opts);
    const reverse = duel(maiden(), monster(), opts);
    const m = mirrored(monster(), maiden(), opts);
    expect(m.winRate).toBeCloseTo((forward.winRate + (100 - reverse.winRate)) / 2, 10);
    expect(m.meanTurns).toBeCloseTo((forward.meanTurns + reverse.meanTurns) / 2, 10);
  });

  test("mirroring the arguments mirrors the answer", () => {
    const ab = mirrored(monster(), maiden(), opts);
    const ba = mirrored(maiden(), monster(), opts);
    expect(ab.winRate + ba.winRate).toBeCloseTo(100, 10);
    // Every per-side field has to mirror too, not just the headline.
    expect(ab.meanFigureA).toBeCloseTo(ba.meanFigureB, 10);
    expect(ab.ranRateA).toBeCloseTo(ba.ranRateB, 10);
  });

  test("both directions are actually run: twice the fights, a tighter interval", () => {
    // What catches a `mirrored` that just returns the forward result. In a
    // symmetric matchup the two win rates are indistinguishable, so the
    // evidence that the reverse run HAPPENED is the sample size and the
    // interval it implies — sqrt(2) tighter for the same `runs`.
    const [a, b] = twins();
    const forward = duel(a, b, opts);
    const m = mirrored(a, b, opts);
    expect(m.runs).toBe(2 * forward.runs);
    expect(forward.ci95 / m.ci95).toBeCloseTo(Math.SQRT2, 1);
  });

  test("per-side fields follow the bird, not the corner it stood in", () => {
    // In the reverse run the monster is argument B, so its figure arrives at
    // index 1. Averaging index-for-index instead of bird-for-bird would blend
    // the monster's figure with the maiden's and land both sides on the same
    // middling number — the gap below would collapse to ~0.
    const m = mirrored(monster(), maiden(), opts);
    const forward = duel(monster(), maiden(), opts);
    expect(m.meanFigureA - m.meanFigureB).toBeGreaterThan(20);
    expect(m.meanFigureA).toBeGreaterThan(forward.meanFigureB);
    // The maiden is the one that breaks and runs, from either corner.
    expect(m.ranRateB).toBeGreaterThan(m.ranRateA);
  });

  test("the engine is measured unbiased by position — which is why this costs nothing", () => {
    // If this ever fails, mirrored is not wrong; the ENGINE has grown a
    // first-mover advantage, and every un-mirrored number in the repo is
    // suspect. Worth knowing either way, which is why it is measured rather
    // than assumed.
    const [a, b] = twins();
    const fmt = { format: "b2" as const, runs: LAB.HEADLINE_RUNS };
    const forward = duel(a, b, fmt);
    const reverse = duel(b, a, fmt);
    expect(Math.abs(forward.winRate - (100 - reverse.winRate))).toBeLessThan(
      forward.ci95 + reverse.ci95
    );
  });
});

describe("withKnob puts the config back", () => {
  test("the knob is set inside and restored outside", () => {
    const before = BATTLE.ELEMENT_EDGE;
    const seen = withKnob("BATTLE.ELEMENT_EDGE", before + 3, () => knobValue(BATTLE.ELEMENT_EDGE));
    expect(seen).toBe(before + 3);
    expect(BATTLE.ELEMENT_EDGE).toBe(before);
  });

  test("…and restores when fn THROWS — the leak that would poison the whole suite", () => {
    // The single most important assertion in this file. `config.ts` is a
    // module-level singleton shared by every test in the repo: a knob left
    // mutated here does not fail this file, it fails a file that has never
    // heard of the lab, hours later, in a way nobody can localise. That is
    // why lab.ts's mutation is a `try/finally` and why this test exists.
    const before = WEATHER.EDGE;
    expect(() =>
      withKnob("WEATHER.EDGE", before + 1, () => {
        throw new Error("boom");
      })
    ).toThrow("boom");
    expect(WEATHER.EDGE).toBe(before);
  });

  test("nested knobs unwind in order", () => {
    const edge = BATTLE.ELEMENT_EDGE;
    const wx = WEATHER.EDGE;
    withKnob("BATTLE.ELEMENT_EDGE", 9, () =>
      withKnob("WEATHER.EDGE", 8, () => {
        expect(knobValue(BATTLE.ELEMENT_EDGE)).toBe(9);
        expect(knobValue(WEATHER.EDGE)).toBe(8);
      })
    );
    expect(BATTLE.ELEMENT_EDGE).toBe(edge);
    expect(WEATHER.EDGE).toBe(wx);
  });

  test("the knob is live while fn runs — the fight engine sees the new value", () => {
    // Restoring correctly is worthless if the mutation never reached the
    // engine. Zeroing the element edge must collapse a Fire-vs-Metal matchup
    // onto the same coin flip two identical birds get. Full stars, so the
    // live edge is the full knob rather than zero-by-muteness.
    const fire = flat(350, { name: "Fire", element: "Fire", halfStars: STARS.MAX_HALF_STARS });
    const metal = flat(350, { name: "Metal", element: "Metal", halfStars: STARS.MAX_HALF_STARS });
    const opts = { format: "b2" as const, runs: LAB.HEADLINE_RUNS };
    const live = duel(fire, metal, opts);
    const off = withKnob("BATTLE.ELEMENT_EDGE", 0, () => duel(fire, metal, opts));
    expect(live.winRate).toBeGreaterThan(50 + live.ci95);
    expect(Math.abs(off.winRate - 50)).toBeLessThan(2 * off.ci95);
  });

  test("an unknown knob is refused before fn runs, and says what IS available", () => {
    let ran = false;
    // A silent no-op here is the worst outcome the sweep CLI can produce: the
    // table renders, every row is identical, and it reads as "this knob does
    // nothing" instead of "you typed the knob wrong".
    for (const bad of ["TYPO.FOO", "BATTLE.NOPE", "ELEMENT_EDGE"]) {
      expect(() => withKnob(bad, 1, () => (ran = true))).toThrow(/Unknown knob/);
    }
    expect(ran).toBe(false);
    // The error carries the menu, not just the complaint.
    expect(() => withKnob("TYPO.FOO", 1, () => 0)).toThrow(/BATTLE\.ELEMENT_EDGE/);
  });

  test("a DEEP knob (three segments) is set inside and restored outside", () => {
    // Added with the crit case: per-blade knobs live INSIDE FORMATS entries,
    // so the resolver has to walk, not just index a root once.
    const before = FORMATS.b1.critMult;
    const seen = withKnob("FORMATS.b1.critMult", 1, () =>
      knobValue(FORMATS.b1.critMult)
    );
    expect(seen).toBe(1);
    expect(FORMATS.b1.critMult).toBe(before);
    // Sibling blades must be untouched — the walk lands on ONE entry.
    expect(FORMATS.b4.critMult).not.toBe(1);
  });

  test("a deep path that dead-ends is refused at any depth", () => {
    let ran = false;
    for (const bad of ["FORMATS.b1.NOPE", "FORMATS.NOPE.critMult", "FORMATS.b1"]) {
      expect(() => withKnob(bad, 1, () => (ran = true))).toThrow(/Unknown knob/);
    }
    expect(ran).toBe(false);
  });

  test("sweepableKnobs lists the numbers and only the numbers", () => {
    const knobs = sweepableKnobs();
    expect(knobs).toContain("BATTLE.ELEMENT_EDGE");
    expect(knobs).toContain("WEATHER.EDGE");
    expect(knobs).toContain("BATTLE.UNDERDOG_CLAWBACK");
    // Nested numbers are advertised by their FULL path…
    expect(knobs).toContain("FORMATS.b1.critMult");
    // …and an intermediate object is never advertised as if it were a knob.
    expect(knobs).not.toContain("FORMATS.b1");
    // FIGURE.GHOST_PACE is a per-format object; a sweep can't set it to a
    // single number, so it must not be advertised as though it could.
    expect(knobs).not.toContain("FIGURE.GHOST_PACE");
    expect(knobs).toEqual([...knobs].sort());
    // Everything listed must actually be settable — the list and the setter
    // agree, so `--list` never offers something `--sweep` will reject.
    for (const knob of knobs) expect(() => withKnob(knob, 1, () => 0)).not.toThrow();
  });
});

describe("sweep", () => {
  test("runs once per value, in order, with the knob live", () => {
    const seen: number[] = [];
    const values = [0, 0.5, 2];
    const out = sweep("BATTLE.ELEMENT_EDGE", values, (v) => {
      // Both halves matter: the callback is told the value AND the config
      // holds it. A sweep that passed the value but forgot to set it would
      // produce a perfectly plausible flat table.
      seen.push(BATTLE.ELEMENT_EDGE);
      return v * 10;
    });
    expect(seen).toEqual(values);
    expect(out.map((r) => r.value)).toEqual(values);
    expect(out.map((r) => r.result)).toEqual([0, 5, 20]);
  });

  test("the results actually differ across a knob that matters", () => {
    // A sweep whose rows are all the same number is indistinguishable from a
    // sweep that never set anything — so the rig uses the knob whose real
    // strength was misjudged twice (see BATTLE.ELEMENT_EDGE's comment).
    // Full stars: the sweep sets the ceiling and the birds must deliver it.
    const fire = flat(350, { name: "Fire", element: "Fire", halfStars: STARS.MAX_HALF_STARS });
    const metal = flat(350, { name: "Metal", element: "Metal", halfStars: STARS.MAX_HALF_STARS });
    const rows = sweep("BATTLE.ELEMENT_EDGE", [0, 2], () =>
      duel(fire, metal, { format: "b2", runs: LAB.HEADLINE_RUNS }).winRate
    );
    const [off, loud] = rows.map((r) => r.result);
    expect(loud - off).toBeGreaterThan(20);
  });

  test("the config is back to normal afterwards, and after a throw", () => {
    const before = BATTLE.ELEMENT_EDGE;
    sweep("BATTLE.ELEMENT_EDGE", [0, 1, 2], () => 0);
    expect(BATTLE.ELEMENT_EDGE).toBe(before);
    expect(() =>
      sweep("BATTLE.ELEMENT_EDGE", [0, 1], (v) => {
        if (v === 1) throw new Error("mid-sweep");
        return 0;
      })
    ).toThrow("mid-sweep");
    expect(BATTLE.ELEMENT_EDGE).toBe(before);
  });

  test("an unknown knob fails the whole sweep, not the first row quietly", () => {
    expect(() => sweep("BATTLE.NOPE", [1, 2], () => 0)).toThrow(/Unknown knob/);
  });
});

describe("the station slope agrees with the engine and with its own ruling", () => {
  test("underdogOf: the smaller total collects, equal totals collect nothing", () => {
    expect(underdogOf(flat(350, { name: "A" }), flat(350, { name: "B" }))).toBe("neither");
    expect(underdogOf(maiden(), monster())).toBe("A");
    expect(underdogOf(monster(), maiden())).toBe("B");
    // Shape, not size: a specialist and a generalist on the same total owe
    // each other nothing. This is the confound `shaped` exists to avoid.
    expect(
      underdogOf(shaped({ gameness: 700, agility: 0 }, { name: "S" }), flat(350, { name: "G" }))
    ).toBe("neither");
  });

  test("stars no longer move the station picture at all", () => {
    // Under the old engine the star boost inflated totals into the underdog
    // comparison, which made a 5★ bird measure WORSE than its 0★ twin. The
    // rework removed stars from the stat block entirely; totals are base.
    const plain = flat(350, { name: "Plain" });
    const starred = flat(350, { name: "Starred", halfStars: STARS.MAX_HALF_STARS });
    expect(underdogOf(plain, starred)).toBe("neither");
    expect(clawbackOf(plain, starred)).toEqual({ A: 0, B: 0 });
    // …and the engine narrates no handicap in either direction.
    const flags = engineNarratesOutmatched(plain, starred);
    expect(flags).toEqual({ A: false, B: false });
  });

  test("clawbackOf matches the engine's narration threshold across a spread of matchups", () => {
    // Property-style: the narration prints at clawback ≥ 0.05/roll. Every
    // combination must agree with what `clawbackOf` predicts — this is the
    // lab's arithmetic checked against the engine's behavior, not against a
    // second copy of the formula.
    for (const level of [250, 350, 600, 1200]) {
      for (const other of [250, 350, 600, 1200]) {
        const a = flat(level, { name: "A" });
        const b = flat(other, { name: "B" });
        const claw = clawbackOf(a, b);
        const flags = engineNarratesOutmatched(a, b);
        expect(`${level} vs ${other}: ${flags.A}/${flags.B}`).toBe(
          `${level} vs ${other}: ${claw.A >= 0.05}/${claw.B >= 0.05}`
        );
      }
    }
  });

  test("the clawback is capped below the gap — and is monotone in station", () => {
    // The ruling that rebuilt the mechanic: an underdog's compensation must
    // never reach the full value of the lead it faces, so a superior bird of
    // the same shape is ALWAYS still favored. At max station the claw is
    // exactly UNDERDOG_CLAWBACK of the gap's per-roll value, never more.
    const big = flat(800, { name: "Big" });
    let last = -1;
    for (const s of [0, 159, 160, 500, 1000, STATS.MAX]) {
      const small = shaped({ station: s }, { base: 350, name: "Small" });
      const claw = clawbackOf(small, big).A;
      // Station is excluded from the scale on both sides — heart, not class —
      // so the gap here is constant across the ladder and monotonicity is
      // exact, not merely usual. (Counted in, station used to shrink its own
      // deficit and self-cancel; the lab measured a station-2000 build at 45%
      // at parity before the exclusion.)
      const fighting = (c: Combatant) => statTotal(c) - c.stats.station;
      const gapPerRoll = (fighting(big) - fighting(small)) / 6 / BATTLE.ROLL_DIVISOR;
      expect(claw).toBeLessThanOrEqual(BATTLE.UNDERDOG_CLAWBACK * gapPerRoll + 1e-12);
      expect(claw).toBeGreaterThan(last); // strictly more station, strictly more claw
      last = claw;
    }
  });

  test("BEHAVIORAL: a same-shape superior bird is favored at every grade step — the anti-inversion ruling", () => {
    // The old gate FAILED this exact check: flat(450) lost 59-67% of the time
    // to flat(350) because the gate paid the weaker bird ~3.5x the lead that
    // tripped it. This is the known-answer regression for the whole rework —
    // if it ever fails again, breeding points backwards again.
    for (const level of [450, 550, 750]) {
      const d = mirrored(flat(level, { name: "Up" }), flat(350, { name: "Base" }), {
        format: "b2",
        runs: 1000,
      });
      expect(d.winRate).toBeGreaterThan(50 + d.ci95);
    }
  });

  test("BEHAVIORAL: the old cliff is gone — station 159 and 160 are the same bird now", () => {
    // 159 → 160 used to cost 16 points of win rate by closing the bird's own
    // gate. Under the slope, adjacent station points must be statistically
    // indistinguishable.
    const opts = { format: "b4" as const, runs: 1000 };
    const even = flat(350, { name: "Even" });
    const at159 = mirrored(shaped({ station: 159 }, { name: "Stn" }), even, opts);
    const at160 = mirrored(shaped({ station: 160 }, { name: "Stn" }), even, opts);
    expect(Math.abs(at159.winRate - at160.winRate)).toBeLessThan(at159.ci95 + at160.ci95);
  });

  test("duel surfaces the same verdict it would compute standing alone", () => {
    const d = duel(monster(), maiden(), { format: "b2", runs: 10 });
    expect(d.underdog).toBe(underdogOf(monster(), maiden()));
  });
});

describe("converge", () => {
  test("the windows are disjoint by construction", () => {
    const seen: number[] = [];
    const out = converge((seedFrom) => {
      seen.push(seedFrom);
      return seedFrom;
    }, { windows: 4 });
    // Derived from the constants, never typed: the guarantee is "no seed is
    // shared", and it only holds while the stride outruns the sample.
    expect(seen).toEqual([0, 1, 2, 3].map((i) => LAB.SEED_FROM + i * LAB.WINDOW_STRIDE));
    expect(LAB.WINDOW_STRIDE).toBeGreaterThan(LAB.HEADLINE_RUNS);
    expect(out.values).toEqual(seen);
  });

  test("spread is max − min, and mean is the mean", () => {
    const values = [3, 11, 7];
    let i = 0;
    const out = converge(() => values[i++]);
    expect(out.values).toEqual(values);
    expect(out.spread).toBe(Math.max(...values) - Math.min(...values));
    expect(out.mean).toBeCloseTo((3 + 11 + 7) / 3, 10);
  });

  test("defaults to three windows", () => {
    expect(converge(() => 1).values).toHaveLength(3);
  });

  test("a stable measurement holds across windows", () => {
    // The rig is a blowout, whose true value sits at ~100% — so any spread it
    // shows is the lab's, not the matchup's.
    const out = converge((seedFrom) =>
      duel(monster(), maiden(), { format: "b2", runs: 1000, seedFrom }).winRate
    );
    expect(out.spread).toBeLessThan(2);
    expect(out.mean).toBeGreaterThan(95);
  });

  test("a noisy measurement shows its noise — the check has a bulb in it", () => {
    // Same measurement at n=25 instead of n=1000. If `converge` were handing
    // every window the same seeds, this would come back with spread 0 and the
    // whole convergence check would be theatre.
    const out = converge((seedFrom) =>
      duel(flat(350, { name: "A" }), flat(350, { name: "B" }), {
        format: "b2",
        runs: 25,
        seedFrom,
      }).winRate
    );
    expect(out.spread).toBeGreaterThan(0);
  });
});

describe("building combatants", () => {
  test("flat sets every stat the engine knows about", () => {
    const bird = flat(350);
    // Read off STAT_NAMES rather than a literal list: if a seventh stat is
    // ever added to the game, this fails until `flat` learns to set it —
    // otherwise the lab would quietly fight birds with an undefined stat.
    for (const stat of STAT_NAMES) expect(bird.stats[stat]).toBe(350);
    expect(Object.keys(bird.stats).sort()).toEqual([...STAT_NAMES].sort());
  });

  test("flat's defaults are a plain unstarred bird", () => {
    const bird = flat(350);
    expect(bird.halfStars).toBe(0);
    expect(bird.name).toBe("A");
    const named = flat(350, { name: "Rocky", element: "Water", halfStars: 4 });
    expect(named).toMatchObject({ name: "Rocky", element: "Water", halfStars: 4 });
  });

  test("shaped overrides only what it is given", () => {
    const bird = shaped({ gameness: 1500, agility: 100 });
    expect(bird.stats.gameness).toBe(1500);
    expect(bird.stats.agility).toBe(100);
    // Everything unnamed stays on the base — this is what lets a case vary
    // SHAPE while holding the total, and holding the total is what keeps the
    // underdog gate out of the measurement.
    for (const stat of STAT_NAMES) {
      if (stat === "gameness" || stat === "agility") continue;
      expect(bird.stats[stat]).toBe(350);
    }
    expect(shaped({}, { base: 500 }).stats.sight).toBe(500);
    expect(shaped({ sight: 10 }, { base: 500, name: "S" })).toMatchObject({ name: "S" });
  });

  test("shaped and flat agree when nothing is shaped", () => {
    expect(shaped({}, { base: 420, name: "X" })).toEqual(flat(420, { name: "X" }));
  });

  test("statTotal is the same sum the station slope is judged on", () => {
    expect(statTotal(flat(350))).toBe(350 * STAT_NAMES.length);
    // Matched against the engine's own summation shape (fight-sim's scale),
    // computed off config's stat list so a new stat can't be silently omitted.
    const bird = shaped({ gameness: 1500, station: 20 });
    expect(statTotal(bird)).toBe(STAT_NAMES.reduce((sum, s) => sum + bird.stats[s], 0));
  });
});
