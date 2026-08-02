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

/** Fresh unpredictable seed for live play (tests pass their own). */
export function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}
