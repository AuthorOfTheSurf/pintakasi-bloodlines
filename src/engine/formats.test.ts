import { describe, expect, test } from "bun:test";
import { createDb } from "@/db/client";
import { seedGame, seedStarterFlock } from "@/db/seed-data";
import { converge, duel, flat, LAB, type Convergence } from "./balance/lab";
import {
  BATTLE,
  ELEMENTS,
  FIGURE,
  FORMAT_NAMES,
  FORMATS,
  WEATHER,
  weatherOfDay,
  type Element,
} from "./config";
import { simulatePair } from "./fight-sim";
import { Flock } from "./flock";
import { Game } from "./game";
import { Lobbies } from "./lobbies";
import { mulberry32 } from "./rng";

/**
 * The house combatant for this file: the lab's flat bird at the 1.5★ grade
 * these tests have always measured on.
 *
 * The stars are load-bearing, which is why this wrapper exists instead of
 * calling `flat()` inline everywhere. `flat()` defaults to 0★ (the lab's
 * control), and every figure band written down below — "a starter win sits
 * between 35 and 70" — was measured with the star boost in. Both sides always
 * carry the same stars, so win rates are unaffected either way; the absolute
 * Pit Figures are not.
 */
const bird = (name: string, level: number, element: Element = "Fire") =>
  flat(level, { name, element, halfStars: 3 });

/**
 * Count fought turns from the play-by-play's T<n> markers.
 *
 * Kept local even though the lab measures turns, because `DuelResult` reports
 * only `meanTurns` and a turn CAP is a per-fight invariant: an average under
 * the cap says nothing about the one fight that ran long.
 */
const turnsIn = (playByPlay: string) =>
  Math.max(0, ...[...playByPlay.matchAll(/^T(\d+) /gm)].map((m) => Number(m[1])));

/**
 * Assert a band holds in EVERY seed window `converge()` measured, not just the
 * first one somebody happened to run.
 *
 * This is the whole lesson of the false pass documented below the fold: the
 * band is not the interesting part, the *number of windows it survives* is.
 */
function inEveryWindow(c: Convergence, low: number, high: number) {
  for (const v of c.values) {
    expect(v).toBeGreaterThan(low);
    expect(v).toBeLessThan(high);
  }
}

describe("the weapon dial (blade = distance)", () => {
  test("every format respects its turn cap; the sprint is shorter than the marathon on average", () => {
    // The cap: per-fight, so it stays a loop over single sims.
    for (const format of FORMAT_NAMES) {
      for (let seed = 1; seed <= 40; seed++) {
        const sim = simulatePair(bird("A", 350), bird("B", 350, "Water"), format, mulberry32(seed), "TEST");
        expect(turnsIn(sim.playByPlay)).toBeLessThanOrEqual(FORMATS[format].maxTurns);
      }
    }

    // The dial is real: long-knife bouts resolve fast, short-gaff bouts grind.
    // Measured over disjoint windows rather than one, because "the average was
    // lower in the window I happened to run" is exactly the failure mode the
    // weather tests below were built to stop repeating.
    const meanTurns = (format: (typeof FORMAT_NAMES)[number]) => (seedFrom: number) =>
      duel(bird("A", 350), bird("B", 350, "Water"), { format, seedFrom }).meanTurns;
    const sprint = converge(meanTurns("longKnife")); // 3.35 / 3.29 / 3.35
    const marathon = converge(meanTurns("shortGaff")); // 16.80 / 16.87 / 16.68
    expect(Math.max(...sprint.values)).toBeLessThan(Math.min(...marathon.values));
  });

  test("same seed + same format → identical fight (replayable)", () => {
    // A single fight compared bit-for-bit — the lab reports aggregates, so
    // replayability is asserted against `simulatePair` directly.
    const r1 = simulatePair(bird("A", 350), bird("B", 400, "Water"), "longGaff", mulberry32(777), "TEST");
    const r2 = simulatePair(bird("A", 350), bird("B", 400, "Water"), "longGaff", mulberry32(777), "TEST");
    expect(r1.playByPlay).toBe(r2.playByPlay);
    expect(r1.winner).toBe(r2.winner);
    expect(r1.figures).toEqual(r2.figures);
  });
});

describe("the Pit Figures (discovery signal)", () => {
  // Everything in this block is a claim about a SINGLE fight's figures — a
  // band, an ordering, a threshold count — and `DuelResult` carries only the
  // means. These loops stay hand-rolled on purpose.
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

  // Round 20, Zane: "wondering how a lower fight figure (45) beat a higher
  // one (55)? In PFL this wouldn't be possible." It can't happen now — the
  // winner is timed against the ghost and the loser is scored DOWN from it.
  test("the winner ALWAYS out-figures the bird it beat — no inversions", () => {
    for (const format of FORMAT_NAMES) {
      for (let seed = 1; seed <= 60; seed++) {
        // Deliberately lopsided both ways, plus even matches.
        for (const [x, y] of [[280, 420], [420, 280], [350, 350]] as const) {
          const sim = simulatePair(bird("A", x), bird("B", y, "Water"), format, mulberry32(seed), "T");
          const [w, l] = sim.winner === 0 ? sim.figures : [sim.figures[1], sim.figures[0]];
          expect(w).toBeGreaterThan(l);
        }
      }
    }
  });

  test("figures rise with the class of the bird you beat — the ghost standard", () => {
    // Same blade, same seeds: beating better company figures higher, which
    // is what makes figures comparable across cards. This is the mean of the
    // WINNER's figure — whichever side won that night — so it can't come off
    // `meanFigureA`, which averages a fixed side's wins and losses together.
    const meanWinner = (level: number) => {
      let sum = 0;
      const RUNS = 60;
      for (let seed = 1; seed <= RUNS; seed++) {
        const sim = simulatePair(bird("A", level), bird("B", level, "Water"), "shortKnife", mulberry32(seed), "T");
        sum += Math.max(...sim.figures);
      }
      return sum / RUNS;
    };
    const starters = meanWinner(320);
    const elite = meanWinner(1200);
    expect(elite).toBeGreaterThan(starters + 20);
    // …and a starter-grade win sits near the middle of the scale, not at 0.
    expect(starters).toBeGreaterThan(35);
    expect(starters).toBeLessThan(70);
  });

  test("a narrow loss still carries a real figure — losing to a monster pays", () => {
    // The loser is the winner's figure minus beaten lengths, so being close
    // to a big performance out-figures winning a bad one. A COUNT of fights
    // over a threshold: a tail question, which no mean can answer.
    let closeLosses = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const sim = simulatePair(bird("A", 1200), bird("B", 1200, "Water"), "longGaff", mulberry32(seed), "T");
      const loser = Math.min(...sim.figures);
      if (loser > 55) closeLosses++;
    }
    expect(closeLosses).toBeGreaterThan(0);
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

    const nights = ["longKnife", "longKnife", "shortGaff"] as const;
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

describe("daily Element weather (round 24)", () => {
  // Round 24's review found the original magnitude test was a FALSE PASS: it
  // ran 200 seeds and asserted a 20-point band, and the true winrate at the
  // shipped EDGE=1 (76.7%) sat ABOVE its own ceiling. It passed only because
  // seeds 1..200 happen to read 73.0% — seeds 201..400 read 80.5%. A 200-seed
  // sample carries ~3 points of noise, so any bound placed within ~3 points of
  // the truth is decided by the seed window, not by the engine. Everything
  // statistical below therefore runs LAB.HEADLINE_RUNS fights (noise ≈ 0.8
  // points) and asserts bands with several points of air on both sides.
  //
  // Round 25 closed the loop: the "checked against three disjoint windows"
  // that used to be a claim in a comment is now `converge()`, which re-measures
  // over windows 100k seeds apart and hands back every reading. The bands are
  // unchanged — they are asserted three times instead of once, so a bound that
  // only holds in one window now fails instead of shipping.
  const SEEDS = LAB.HEADLINE_RUNS;

  /**
   * Side-0 winrate as a percentage, at a chosen seed window.
   *
   * Deliberately ONE-SIDED rather than `mirrored()`. The control below asserts
   * that Fire-vs-Wood with no weather is a coin flip, and that assertion is
   * the whole reason the matched number is attributable to the day: side 0
   * rolls first every turn, and this proves that buys it nothing. Averaging
   * the side-swap in would force that number to 50 by construction and throw
   * away the evidence.
   */
  const wrCache = new Map<string, number>();
  function winRatePct(aEl: Element, bEl: Element, weather?: Element, seedFrom: number = LAB.SEED_FROM) {
    // Memoised because the neutral pairing is the shared control for two
    // different tests, and re-fighting 4000 bouts to learn the same number is
    // pure wall clock.
    const key = `${aEl}|${bEl}|${weather ?? "-"}|${seedFrom}`;
    // Equal 350-stat birds on shortKnife: no stat gap, no star gap, so the
    // only asymmetry left is whichever element rule is under test.
    if (!wrCache.has(key)) {
      const opts = { format: "shortKnife", weather, runs: SEEDS, seedFrom } as const;
      wrCache.set(key, duel(bird("A", 350, aEl), bird("B", 350, bEl), opts).winRate);
    }
    return wrCache.get(key)!;
  }

  test("weatherOfDay is deterministic and covers all five elements", () => {
    expect(weatherOfDay(42)).toBe(weatherOfDay(42)); // stable across calls
    const seen = new Set<Element>();
    for (let d = 0; d < 200; d++) seen.add(weatherOfDay(d));
    expect(seen.size).toBe(ELEMENTS.length); // every element shows up
  });

  test("the weather edge is felt but not decisive between two equal birds", () => {
    // Wood is NEUTRAL to Fire in the wuxing cycle (Fire beats Metal, Water
    // beats Fire), so on a Fire day the weather is the only term separating
    // these two — this measures WEATHER.EDGE and nothing else.
    const neutral = converge((s) => winRatePct("Fire", "Wood", undefined, s));
    const matched = converge((s) => winRatePct("Fire", "Wood", "Fire", s));

    // The no-weather control is a coin flip, which is what makes the matched
    // number attributable: side 0 rolls first each turn but that buys it
    // nothing, so any lift above ~50 is the day and not the turn order.
    // Measured 49.7 / 49.4 / 49.8 — spread 0.4, i.e. the windows agree.
    inEveryWindow(neutral, 47, 53);
    // Measured 56.8 / 58.0 / 57.7 across three disjoint windows (n=4000 each).
    // The floor says the edge is REAL — a matched bird is favoured, not just
    // flattered. The ceiling says it is not the fight: at the old EDGE=1 this
    // read 76.7%, so 65 fails loudly if anyone restores a near-1.0 modifier.
    inEveryWindow(matched, 53, 65);
  });

  // ── THE CENTERPIECE ───────────────────────────────────────────────────────
  // This is the assertion whose absence let EDGE=1 ship. Nobody compared the
  // weather against the rule it was supposed to be SOFTER than. The design
  // intent (see WEATHER in config) is "soft selection": the day colors a card,
  // the head-to-head RPS matchup decides a fight. Measured on the same seeds
  // and the same birds, the weather must stay a fraction of ELEMENT_EDGE — if
  // someone tunes EDGE up until the day outweighs the matchup, this fails
  // before the balance shows up in a sim.
  test("the weather edge is materially WEAKER than the head-to-head element edge", () => {
    /** Both lifts, measured off the SAME control in the SAME seed window. */
    const lifts = (seedFrom: number) => {
      const neutral = winRatePct("Fire", "Wood", undefined, seedFrom); // ~49.7 — the shared control
      const weather = winRatePct("Fire", "Wood", "Fire", seedFrom); // ~56.8 — day only
      const headToHead = winRatePct("Fire", "Metal", undefined, seedFrom); // ~63.9 — RPS only
      return {
        weatherLift: weather - neutral, // ~7.1 points
        rpsLift: headToHead - neutral, // ~14.1 points
        headToHead,
      };
    };

    const weatherLift = converge((s) => lifts(s).weatherLift); // 7.07 / 8.58 / 7.85
    const ratio = converge((s) => lifts(s).weatherLift / lifts(s).rpsLift);

    expect(Math.min(...weatherLift.values)).toBeGreaterThan(3); // worth chasing a good day
    // The ruling: the day must never rival the matchup. At the old EDGE=1 this
    // ratio was 1.03 — the day BEAT the matchup — which is the bug this test
    // exists for. The margin below is what "junior partner" means. Stated as a
    // ratio rather than as `weatherLift < rpsLift * 0.75` so it can be checked
    // in every window without re-fighting the control four more times.
    inEveryWindow(ratio, 0, 0.75);

    // …and the felt ratio should TRACK the config ratio. Both edges respond
    // near-linearly in this band (0.25 -> ~+7 points of winrate, 0.5 -> ~+14),
    // which is the property that makes the two knobs readable at all: you can
    // reason about "half as strong" in config and get half as strong in the
    // pit. If this ever drifts, the knobs have entered a non-linear regime
    // and every comment in config.ts quoting a winrate needs re-measuring.
    //
    // Measured 0.500 / 0.585 / 0.594 across the three windows. This is the
    // noisiest quantity in the file — a ratio of two differences of two noisy
    // rates — which is exactly why it is now asserted in all three rather than
    // in whichever one happened to be run.
    const configRatio = WEATHER.EDGE / BATTLE.ELEMENT_EDGE; // 0.5 today
    inEveryWindow(ratio, configRatio - 0.15, configRatio + 0.15);

    // Stacked, the day should ADD a few points to a matchup that is already
    // won, not compound into a certainty. Measured ~69.5 vs ~63.9 alone; at
    // EDGE=1 the stack hit 92%, which is where a "small" knob stopped being
    // small. Both bounds are ~6 points from the measurement.
    const { headToHead } = lifts(LAB.SEED_FROM);
    const stacked = winRatePct("Fire", "Metal", "Fire");
    expect(stacked).toBeGreaterThan(headToHead); // it does something
    expect(stacked).toBeLessThan(headToHead + 12); // …but only a few points
  });

  test("both birds matching the weather is a bit-exact no-op", () => {
    // Damage is the roll MARGIN, so a bonus paid to both sides subtracts out
    // and the day cannot leak in through some rounding seam. Asserted over a
    // window rather than one seed, because a single fight that happens to end
    // the same way proves nothing about the arithmetic.
    //
    // Stays hand-rolled: this compares two configurations FIGHT BY FIGHT, and
    // two `DuelResult`s agreeing on their means would be a strictly weaker
    // claim (errors that cancel in an average are precisely what "bit-exact"
    // is meant to rule out).
    for (let seed = 1; seed <= 400; seed++) {
      const a = bird("A", 350, "Fire");
      const b = bird("B", 380, "Fire"); // unequal on purpose — a real contest
      const withWx = simulatePair(a, b, "shortKnife", mulberry32(seed), "T", "Fire");
      const without = simulatePair(a, b, "shortKnife", mulberry32(seed), "T");
      expect(withWx.winner).toBe(without.winner);
      expect(withWx.figures).toEqual(without.figures);
    }
    // …and the narration says so, instead of implying the day picked a side.
    const sim = simulatePair(bird("A", 350, "Fire"), bird("B", 350, "Fire"), "shortKnife", mulberry32(9), "T", "Fire");
    expect(sim.playByPlay).toContain("both birds call it home, so it settles nothing");
  });

  test("the weather edge is narrated, and stacks with the head-to-head element edge", () => {
    // One fight's play-by-play: the lab reports no narration, so this reads a
    // single sim directly. Fire beats Metal (RPS) AND the day is Fire — the
    // Fire bird gets both.
    const sim = simulatePair(bird("A", 350, "Fire"), bird("B", 350, "Metal"), "longGaff", mulberry32(1), "TEST", "Fire");
    expect(sim.playByPlay).toContain("Today's element is Fire");
    expect(sim.playByPlay).toContain("carries the weather edge");
    // The roll detail interpolates the knob, so this tag follows a re-tune
    // instead of pinning the value the sim shipped with.
    expect(sim.playByPlay).toContain(`+${WEATHER.EDGE}wx`);
    expect(sim.playByPlay).toContain(`+${BATTLE.ELEMENT_EDGE}elem`);
  });

  test("a no-match day narrates honestly and figures stay banded", () => {
    const sim = simulatePair(bird("A", 350, "Fire"), bird("B", 350, "Water"), "shortKnife", mulberry32(3), "TEST", "Wood");
    expect(sim.playByPlay).toContain("neither bird calls it home");
    for (const f of sim.figures) {
      expect(f % FIGURE.BAND).toBe(0);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(FIGURE.MAX);
    }
  });

  test("the weather does not relabel the bird — figure inflation stays inside the fog", () => {
    // The Pit Figure is the discovery signal: it is supposed to tell a player
    // what a bird IS, so anything that shifts it by more than the display band
    // is teaching the player about the calendar instead. At EDGE=1 a matched
    // bird's average figure inflated by ~12 — over two full FIGURE.BANDs, and
    // no form line could show that, because the day isn't on the card.
    //
    // `meanFigureA` is the matched bird's OWN figure, wins and losses alike —
    // the same quantity the hand-rolled loop used to sum.
    const meanFigure = (weather: Element | undefined, seedFrom: number) =>
      duel(bird("A", 350, "Fire"), bird("B", 350, "Wood"), {
        format: "shortKnife",
        weather,
        runs: SEEDS,
        seedFrom,
      }).meanFigureA;

    const inflation = converge((s) => meanFigure("Fire", s) - meanFigure(undefined, s)); // ~47.8 vs ~45.1
    // Measured 2.69 / 2.72 / 2.68 across three disjoint windows — spread 0.04,
    // which is the tightest number in the file. Both bounds are stated in the
    // terms that make them READABLE: smaller than one displayed band means two
    // form lines a day apart can print the same number, and inside the ± noise
    // roll means the day is quieter than the fog already baked into every
    // figure.
    inEveryWindow(inflation, 0, FIGURE.BAND); // winning more shows up, but under one band
    inEveryWindow(inflation, 0, FIGURE.NOISE); // …and under the figure's own fog
  });

  test("the weather edge magnitude is WEATHER.EDGE (one knob, not a hardcoded 1)", () => {
    // Pin the ruling; tune here, not in the sim. The scale to judge this
    // against is NOT the 2d6 — it's BATTLE.ROLL_DIVISOR. A turn roll is
    // 2d6 + stat/400, so a 350-stat starter's ENTIRE stat block is worth about
    // +0.875. Anything flat and near 1.0 doesn't nudge the stat term, it
    // replaces it, which is exactly how +1 became the most decisive number in
    // the fight. 0.25 is about a quarter of a whole starter bird.
    expect(WEATHER.EDGE).toBe(0.25);
    const wholeStarterBird = 350 / BATTLE.ROLL_DIVISOR;
    expect(WEATHER.EDGE).toBeLessThan(wholeStarterBird / 2);
  });
});
