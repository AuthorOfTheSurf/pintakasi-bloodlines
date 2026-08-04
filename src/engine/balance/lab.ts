/**
 * THE FIGHT BALANCE LAB — primitives.
 *
 * Why this exists. Two balance knobs shipped at several times their intended
 * strength in consecutive rounds (WEATHER.EDGE at 4x, BATTLE.ELEMENT_EDGE at
 * 2x), and both were caught by hand. They survived because the only fight
 * measurement in the repo was one closure inside one `describe` block, wired
 * to two identical 350-stat birds on b2 — it could vary the element
 * and nothing else. Every number written into a config comment was produced
 * by editing the constant, running a throwaway script, copying the number out
 * and editing the constant back.
 *
 * This module is the middle layer of three:
 *
 *   unit tests   — is the code correct?
 *   THE LAB      — what is each knob actually WORTH?      <- here
 *   simulation   — what happens in a messy live world?
 *
 * The lab is deliberately synthetic. Fixed birds, one variable at a time,
 * thousands of fights, every other factor held still. That is the opposite of
 * `bun run simulate`, and it is the point: the sim tells you what happened,
 * the lab tells you why. Organic feedback stays the doctor's job.
 *
 * Nothing here touches a database. The fight engine is pure and fast (~16k
 * fights/sec measured), which is the whole reason a lab is affordable at all.
 */
import {
  BATTLE,
  FIGURE,
  FORMATS,
  PHASES,
  STARS,
  STATS,
  WEATHER,
  type Element,
  type FightFormat,
} from "@/engine/config";
import { simulatePair, type BirdStats, type Combatant } from "@/engine/fight-sim";
import { mulberry32 } from "@/engine/rng";

/**
 * Tooling thresholds — NOT game balance, which is why they aren't in config.
 * (Same rule the doctor's own DOCTOR block follows.) These decide how hard we
 * look at the engine; they never change what the engine does.
 */
const LAB = {
  // Default sample. At n=1000 a win rate carries ~±1.6 points at 95%, which is
  // fine for reading a table and far too loose to write into a comment.
  DEFAULT_RUNS: 1000,
  // Headline sample, for numbers that get quoted. ~±0.8 points at 95%.
  // Named after the window formats.test.ts standardised on after a 200-seed
  // test produced a documented FALSE PASS — a bound placed within the noise
  // is decided by the seed window, not by the engine.
  HEADLINE_RUNS: 4000,
  // Where the standard seed window starts. Fixed so every run of the lab is
  // reproducible; `converge` is how you check a result isn't an artifact of
  // this particular window.
  SEED_FROM: 1,
  // Disjoint windows are spaced by this so they cannot share a single seed.
  // Larger than HEADLINE_RUNS on purpose.
  WINDOW_STRIDE: 100_000,
  // z for a 95% two-sided normal interval.
  Z95: 1.96,
} as const;

export { LAB };

// ── Building combatants ─────────────────────────────────────────────────────
// Supersedes the private `bird()` in formats.test.ts and testkit's `makeBird`
// (which returns a DB row pinned at 300 stats and drags in `bun:test`).

export interface BirdOptions {
  element?: Element;
  halfStars?: number;
  name?: string;
}

/** Every stat at one level — the control bird almost every case starts from. */
export function flat(level: number, opts: BirdOptions = {}): Combatant {
  return {
    name: opts.name ?? "A",
    element: opts.element ?? "Fire",
    halfStars: opts.halfStars ?? 0,
    stats: {
      agility: level,
      sight: level,
      stamina: level,
      gameness: level,
      station: level,
      condition: level,
    },
  };
}

/**
 * A bird with a SHAPE: named stats set explicitly, the rest at `base`. This is
 * how you ask "is a specialist worth more than a generalist" without also
 * changing the bird's total, which would silently trip the underdog gate (see
 * `duel`'s note on the confound).
 */
export function shaped(
  stats: Partial<BirdStats>,
  opts: BirdOptions & { base?: number } = {}
): Combatant {
  const bird = flat(opts.base ?? 350, opts);
  return { ...bird, stats: { ...bird.stats, ...stats } };
}

/** Total base stats — the quantity the underdog gate actually compares. */
export function statTotal(c: Combatant): number {
  return Object.values(c.stats).reduce((x, y) => x + y, 0);
}

// ── Running fights ──────────────────────────────────────────────────────────

export interface DuelOptions {
  format: FightFormat;
  weather?: Element;
  runs?: number;
  seedFrom?: number;
}

export interface DuelResult {
  runs: number;
  /** Side A's win rate as a percentage. */
  winRate: number;
  /** ± percentage points at 95%. A difference smaller than this is not a result. */
  ci95: number;
  meanTurns: number;
  /**
   * The longest fight in the sample. A turn CAP is a per-fight invariant and a
   * mean cannot testify about it — an average of 3.4 says nothing about the one
   * bout that ran to 6. Added because the cap test was the last thing still
   * hand-rolling a loop for want of this field.
   */
  maxTurns: number;
  meanFigureA: number;
  meanFigureB: number;
  /**
   * The mean figure of whichever bird WON — not of a fixed corner. Distinct
   * from meanFigureA, which averages one side's wins and losses together and
   * so answers a different question: this one is "what does a win in this
   * company look like", which is how the figure scale gets calibrated.
   */
  meanWinnerFigure: number;
  /** How often each side broke and ran — gameness's morale check, made visible. */
  ranRateA: number;
  ranRateB: number;
  /** How fights ENDED, as percentages. Three ways, and they mean different things. */
  endings: { ran: number; windOut: number; bell: number };
  /**
   * Whether the underdog flag fired, and for whom. Surfaced on every result
   * because it is the engine's one binary gate and the easiest way to
   * accidentally measure something other than what you meant to.
   */
  underdog: "A" | "B" | "neither";
}

/** Fought turns, read off the play-by-play's T<n> markers. */
const turnsIn = (playByPlay: string) =>
  Math.max(0, ...[...playByPlay.matchAll(/^T(\d+) /gm)].map((m) => Number(m[1])));

/**
 * Reproduce the engine's underdog decision WITHOUT running a fight.
 *
 * This mirrors fight-sim.ts:89-92 — and note it compares STAR-BOOSTED totals,
 * despite the comment there saying "total base stats". That discrepancy is not
 * academic: 0★ vs 5★ at equal base stats compares 2100 to 2700, which trips
 * the gate and hands the WEAKER bird a station bonus worth more than the whole
 * star boost being measured. A star measurement that ignores this reports
 * stars as weaker than they are, or negative. Cases control for it; this
 * function is how they can see it coming.
 */
export function underdogOf(a: Combatant, b: Combatant): "A" | "B" | "neither" {
  // Clamp PER STAT before totalling, exactly as fight-sim.ts:56 does. The
  // shortcut — total + 6 × boost — is right for every bird that exists today
  // and silently wrong at the ceiling: a 1950-stat 5★ bird totals 12,300 here
  // and 12,000 in the engine, which is the difference between the gate firing
  // and not. Nothing is near 2000 yet, but bred stock is meant to climb there,
  // and a measuring instrument that drifts from the thing it measures exactly
  // when the interesting birds arrive is worse than no instrument.
  const boostedTotal = (c: Combatant) => {
    const boost = Math.floor(c.halfStars / 2) * STARS.BOOST_PER_FULL_STAR;
    return Object.values(c.stats).reduce((sum, v) => sum + Math.min(STATS.MAX, v + boost), 0);
  };
  const ta = boostedTotal(a);
  const tb = boostedTotal(b);
  if (tb >= ta * BATTLE.UNDERDOG_RATIO) return "A";
  if (ta >= tb * BATTLE.UNDERDOG_RATIO) return "B";
  return "neither";
}

/**
 * Run N fights between two fixed birds and report what happened.
 *
 * One fresh mulberry32 per fight, seeded from a contiguous window. A fight
 * consumes a VARIABLE number of draws (3 per roll per side, plus a morale
 * check, plus a coin flip on an exact tie, plus the figure's noise roll), so
 * sharing one stream across fights would make run i depend on run i-1 and the
 * window would stop being reproducible piecewise. Fresh stream per seed is the
 * only way to get independent samples out of this generator.
 */
export function duel(a: Combatant, b: Combatant, opts: DuelOptions): DuelResult {
  const runs = opts.runs ?? LAB.DEFAULT_RUNS;
  const seedFrom = opts.seedFrom ?? LAB.SEED_FROM;
  if (a.name === b.name) {
    // The endings are parsed out of narration, which is name-keyed. Identical
    // names would silently attribute both birds' runs to one side.
    throw new Error(`duel(): both birds are named "${a.name}" — give them distinct names`);
  }

  let winsA = 0;
  let turns = 0;
  let longest = 0;
  let figA = 0;
  let figB = 0;
  let figWinner = 0;
  let ranA = 0;
  let ranB = 0;
  let endRan = 0;
  let endWind = 0;
  let endBell = 0;

  for (let seed = seedFrom; seed < seedFrom + runs; seed++) {
    const sim = simulatePair(a, b, opts.format, mulberry32(seed), "LAB", opts.weather);
    if (sim.winner === 0) winsA++;
    const fought = turnsIn(sim.playByPlay);
    turns += fought;
    if (fought > longest) longest = fought;
    figA += sim.figures[0];
    figB += sim.figures[1];
    figWinner += sim.figures[sim.winner];

    const aRan = sim.playByPlay.includes(`${a.name} breaks and RUNS`);
    const bRan = sim.playByPlay.includes(`${b.name} breaks and RUNS`);
    if (aRan) ranA++;
    if (bRan) ranB++;

    // Three ways a fight ends, and they are not interchangeable: a bird that
    // RAN is a gameness failure, an emptied wind pool is a damage race, and
    // the bell is a fight nobody could finish. A knob that quietly converts
    // one into another has changed the game even if the win rate held still.
    if (aRan || bRan) endRan++;
    else if (sim.playByPlay.includes("is out of wind")) endWind++;
    else endBell++;
  }

  const p = winsA / runs;
  return {
    runs,
    winRate: p * 100,
    ci95: LAB.Z95 * Math.sqrt((p * (1 - p)) / runs) * 100,
    meanTurns: turns / runs,
    maxTurns: longest,
    meanFigureA: figA / runs,
    meanFigureB: figB / runs,
    meanWinnerFigure: figWinner / runs,
    ranRateA: (ranA / runs) * 100,
    ranRateB: (ranB / runs) * 100,
    endings: {
      ran: (endRan / runs) * 100,
      windOut: (endWind / runs) * 100,
      bell: (endBell / runs) * 100,
    },
    underdog: underdogOf(a, b),
  };
}

/**
 * Run the duel AND its side-swap, then average.
 *
 * Side A rolls first every turn, and on an exact tie the winner is a coin
 * flip — so a small positional bias is possible in principle. Rather than
 * assume it away, every headline number is measured both ways round. If the
 * engine is unbiased this costs 2x the fights and changes nothing; if it is
 * biased, this is the difference between a real finding and an artifact.
 */
export function mirrored(a: Combatant, b: Combatant, opts: DuelOptions): DuelResult {
  const forward = duel(a, b, opts);
  const reverse = duel({ ...b, name: b.name }, { ...a, name: a.name }, opts);

  const runs = forward.runs + reverse.runs;
  const p = (forward.winRate + (100 - reverse.winRate)) / 200;
  const avg = (x: number, y: number) => (x + y) / 2;
  return {
    runs,
    winRate: p * 100,
    ci95: LAB.Z95 * Math.sqrt((p * (1 - p)) / runs) * 100,
    meanTurns: avg(forward.meanTurns, reverse.meanTurns),
    maxTurns: Math.max(forward.maxTurns, reverse.maxTurns),
    // In the reverse run, "A" is the second argument — so A's figure is index 1.
    meanFigureA: avg(forward.meanFigureA, reverse.meanFigureB),
    meanFigureB: avg(forward.meanFigureB, reverse.meanFigureA),
    // Corner-agnostic already, so it averages straight across.
    meanWinnerFigure: avg(forward.meanWinnerFigure, reverse.meanWinnerFigure),
    ranRateA: avg(forward.ranRateA, reverse.ranRateB),
    ranRateB: avg(forward.ranRateB, reverse.ranRateA),
    endings: {
      ran: avg(forward.endings.ran, reverse.endings.ran),
      windOut: avg(forward.endings.windOut, reverse.endings.windOut),
      bell: avg(forward.endings.bell, reverse.endings.bell),
    },
    underdog: forward.underdog,
  };
}

export interface PairwiseResult {
  runs: number;
  identical: number;
  identicalRate: number;
  /** The first seed where the two configurations diverged, or null. */
  firstDivergentSeed: number | null;
}

/**
 * Run the SAME seeds under two configurations and compare fight by fight.
 *
 * Two `DuelResult`s agreeing on their means is a strictly weaker claim than
 * this: errors that cancel in an average are exactly what a bit-exactness
 * question is asking about. The motivating case is the weather rule — when
 * BOTH birds match the day's element the bonus lands on both sides of a
 * subtraction (damage is the roll MARGIN), so it must cancel not approximately
 * but exactly, and only a per-fight comparison can say so.
 *
 * `firstDivergentSeed` is returned because "97% identical" is a useless thing
 * to debug and one reproducible seed is not.
 */
export function pairwise(
  a: Combatant,
  b: Combatant,
  left: DuelOptions,
  right: DuelOptions
): PairwiseResult {
  const runs = left.runs ?? LAB.DEFAULT_RUNS;
  const seedFrom = left.seedFrom ?? LAB.SEED_FROM;
  let identical = 0;
  let firstDivergentSeed: number | null = null;

  for (let seed = seedFrom; seed < seedFrom + runs; seed++) {
    const l = simulatePair(a, b, left.format, mulberry32(seed), "LAB", left.weather);
    const r = simulatePair(a, b, right.format, mulberry32(seed), "LAB", right.weather);
    const same =
      l.winner === r.winner && l.figures[0] === r.figures[0] && l.figures[1] === r.figures[1];
    if (same) identical++;
    else if (firstDivergentSeed === null) firstDivergentSeed = seed;
  }

  return { runs, identical, identicalRate: (identical / runs) * 100, firstDivergentSeed };
}

// ── Sweeping a knob ─────────────────────────────────────────────────────────

/**
 * The knobs a sweep can reach, by dotted name. Explicit rather than reflective
 * so `--sweep=TYPO.FOO=1` fails loudly instead of silently sweeping nothing.
 */
const SWEEP_ROOTS: Record<string, object> = {
  BATTLE,
  WEATHER,
  FIGURE,
  STARS,
  STATS,
  PHASES,
  FORMATS,
};

/** Walk a root recursively so nested numbers (FORMATS.b1.critMult) count too. */
const knobsUnder = (obj: object, prefix: string): string[] =>
  Object.entries(obj).flatMap(([k, v]) => {
    if (typeof v === "number") return [`${prefix}.${k}`];
    if (v && typeof v === "object" && !Array.isArray(v)) return knobsUnder(v, `${prefix}.${k}`);
    return [];
  });

export function sweepableKnobs(): string[] {
  return Object.entries(SWEEP_ROOTS)
    .flatMap(([root, obj]) => knobsUnder(obj, root))
    .sort();
}

/**
 * Temporarily set a config knob, run `fn`, put the knob back.
 *
 * THE ONE DELIBERATE HACK IN THIS MODULE. `config.ts` marks its blocks
 * `as const`, which is a compile-time assertion only — the objects are plain
 * and mutable at runtime. Nothing else in the codebase may rely on that; the
 * mutation is confined to this function, always paired with a `finally`, and
 * exists so that answering "what would 0.5 do?" stops requiring a human to
 * edit a source file and remember to edit it back. That manual loop is how
 * both balance bugs got their wrong numbers written into comments.
 */
export function withKnob<T>(knob: string, value: number, fn: () => T): T {
  // Dotted path of any depth: the last segment is the key, everything before
  // it is a walk (FORMATS.b1.critMult descends two levels). Depth was
  // added for the crit case — per-blade knobs live inside FORMATS entries.
  const segs = knob.split(".");
  const key = segs.pop() as string;
  let holder: unknown = SWEEP_ROOTS[segs[0]];
  for (const s of segs.slice(1)) {
    holder = holder && typeof holder === "object" ? (holder as Record<string, unknown>)[s] : undefined;
  }
  const root = holder as Record<string, number> | undefined;
  if (!root || typeof root[key] !== "number") {
    throw new Error(`Unknown knob "${knob}". Try one of:\n  ${sweepableKnobs().join("\n  ")}`);
  }
  const original = root[key];
  root[key] = value;
  try {
    return fn();
  } finally {
    root[key] = original;
  }
}

/** Run `fn` once per value of a knob. Always restores, even if `fn` throws. */
export function sweep<T>(
  knob: string,
  values: number[],
  fn: (value: number) => T
): { value: number; result: T }[] {
  return values.map((value) => ({ value, result: withKnob(knob, value, () => fn(value)) }));
}

// ── Convergence ─────────────────────────────────────────────────────────────

export interface Convergence {
  values: number[];
  mean: number;
  /** max − min across the windows. */
  spread: number;
}

/**
 * Re-measure over K DISJOINT seed windows and report the spread.
 *
 * This is the check that was missing when a 200-seed test asserted a ceiling
 * that sat BELOW the true value and passed anyway — seeds 1..200 gave 73%,
 * seeds 201..400 gave 80%, and the truth was 77%. A single window can say
 * anything. If a number does not hold across windows, it is not a number yet.
 */
export function converge(
  measure: (seedFrom: number) => number,
  opts: { windows?: number } = {}
): Convergence {
  const windows = opts.windows ?? 3;
  const values = Array.from({ length: windows }, (_, i) =>
    measure(LAB.SEED_FROM + i * LAB.WINDOW_STRIDE)
  );
  return {
    values,
    mean: values.reduce((x, y) => x + y, 0) / values.length,
    spread: Math.max(...values) - Math.min(...values),
  };
}
