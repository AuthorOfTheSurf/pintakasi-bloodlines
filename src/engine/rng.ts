/**
 * Seeded RNG (mulberry32) so breeding, battles, and gacha are deterministic
 * under test and battles are replayable from a stored seed.
 */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random integer in [min, max] inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One six-sided die. */
export function d6(rng: Rng): number {
  return randInt(rng, 1, 6);
}

/** Two six-sided dice — the battle engine's heartbeat. */
export function roll2d6(rng: Rng): [number, number] {
  return [d6(rng), d6(rng)];
}

/** Pick one item, weighted. */
export function weightedPick<T extends string>(rng: Rng, weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let ticket = rng() * total;
  for (const [item, w] of entries) {
    ticket -= w;
    if (ticket <= 0) return item;
  }
  return entries[entries.length - 1][0];
}

/**
 * THE WORLD SEED (round 35) — the one place the engine was not deterministic,
 * and it was costing us more than we knew.
 *
 * `freshSeed` is called wherever the world needs unpredictability a caller
 * didn't supply: a new lobby's draw, a gacha roll, a bracket. In live play
 * that is exactly right. In a SIMULATION it meant every run built a different
 * world, which quietly invalidated the two things we use simulation for:
 *
 *   1. A/B measurement. Round 35's speed work compared 2:37, 2:22 and 2:58
 *      across three runs that fought 10,556, 10,000 and 10,277 fights — the
 *      wall-clock differences were mostly different amounts of work, so the
 *      numbers could not tell an optimization from a fluke.
 *   2. Balance reading. Three runs of effectively identical code produced
 *      gen-2 stat gains of +34.4, +23.4 and +23.2 — an ELEVEN POINT spread
 *      from nothing but the seed. We had been reading five-point round-over-
 *      round deltas on that ladder as signal for several rounds, and round 34
 *      opened an investigation into a "fall" of 10.2 points that sat entirely
 *      inside this band. There was nothing to find.
 *
 * So a run can now pin the stream. `seedWorld(n)` makes every subsequent
 * `freshSeed()` deterministic, which makes a whole 91-day world reproducible
 * — the same fix serves both problems, because both are the same problem.
 * Unseeded (the default, and all of live play) behaves exactly as before.
 *
 * This is the sim's `--converge` moment: `bun run balance` has measured its
 * own noise since round 26, and the world simulation never could.
 */
let worldRng: Rng | null = null;

/** Pin the world stream — `bun run simulate --seed=N`. Null resets to live. */
export function seedWorld(seed: number | null): void {
  worldRng = seed === null ? null : mulberry32(seed);
}

/** Fresh seed for live play (tests pass their own; sims may pin it). */
export function freshSeed(): number {
  if (worldRng) return randInt(worldRng, 1, 2 ** 31 - 1);
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}
