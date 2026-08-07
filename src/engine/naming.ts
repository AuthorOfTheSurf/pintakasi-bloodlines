import type { DB } from "@/db/client";
import { birds } from "@/db/schema";
import type { Rng } from "./rng";
import { randInt } from "./rng";

/**
 * Bird names are UNIQUE across the whole world (ruled 2026-08-03 round 12) —
 * seven farms each fielding a "Dalisay" made the admin view unreadable.
 * Enforced at every creation door (seeding, breeding, gacha, rename), not
 * as a DB constraint: collisions resolve to roman-numeral successors
 * ("Egg of Dalisay II"), and rename simply refuses a taken name.
 */

/**
 * The starter-name pool for non-dev farms — short (≤12 chars), English,
 * fun (ruled round 13: no need to emphasize Filipino flavor; have fun).
 *
 * This is TIER 1 of the name supply. A sim grows past it fast — 58 names
 * against a 700-bird world means the curated pool is exhausted within the
 * first few farms, and every bird after used to become "Hotshot II",
 * "Hotshot III"… "Hotshot IX". So the supply is now tiered (see
 * `drawStarterNames`): curated pool first, then combinatorial prefix × root
 * names ("Iron Beak", "Golden Spur"), and only then roman successors. A
 * big world ends up full of two-word fighting names instead of a single
 * name stamped with a number.
 */
export const NAME_POOL = [
  "Thunderbolt", "Razorbeak", "Sawblade", "Firecracker", "Dynamite",
  "Sidewinder", "Warhammer", "Buckshot", "Crowbar", "Tornado", "Vendetta",
  "Scrapper", "Ricochet", "Haymaker", "Uppercut", "Dropkick", "Whirlwind",
  "Steeltoe", "Gunpowder", "Matchstick", "Hotshot", "Jackpot", "Longshot",
  "Moonshine", "Midnight", "Copperhead", "Diesel", "Cyclone", "Monsoon",
  "Avalanche", "Wildfire", "Ember", "Scorch", "Blaze", "Talon", "Spur",
  "Cluck Norris", "Hen Solo", "Eggbert", "Shellshock", "General Tso",
  "Kung Pow", "Drumstick", "Nugget", "Omelet", "Benedict", "Scramble",
  "Sunny Side", "Yolko", "Gizzard", "Featherfist", "Beakonator", "Wingman",
  "Flapjack", "Peckasso", "Birdzilla", "Clucky", "Eggscalibur", "Poultrygeist",
] as const;

/**
 * TIER 2 — combinatorial name banks. When the curated pool runs dry, a
 * prefix is joined to a root ("Iron Beak", "Crimson Talon"). ~54 × ~54 ≈
 * 2,900 two-word names sit between the curated pool and the first roman
 * successor, which is well past any 91-day sim's population — so "Hotshot
 * IX" stops happening long before the world is big enough to matter.
 *
 * The two banks are disjoint by construction (no word is both a prefix
 * and a root), so no "Storm Storm" ever forms. A curated single word like
 * "Ember" may share a word with a prefix, but "Ember Beak" is a different
 * name and the taken-set check would catch a collision regardless.
 */
const PREFIXES = [
  "Iron", "Steel", "Golden", "Silver", "Bronze", "Copper", "Brass",
  "Black", "White", "Red", "Crimson", "Scarlet", "Ruby", "Emerald", "Jade",
  "Obsidian", "Onyx", "Ivory", "Ash", "Smoke", "Thunder", "Lightning",
  "Frost", "Ember", "Blaze", "Midnight", "Dawn", "Dusk", "Solar", "Lunar",
  "Tempest", "Wild", "Mad", "Savage", "Fierce", "Grim", "Bold", "Proud",
  "Mighty", "Royal", "Noble", "Swift", "Brave", "Cruel", "Venom", "Toxic",
  "Razor", "Sharp", "Silent", "Hidden", "Cursed", "Blessed", "Sacred",
  "Wicked", "Lost",
] as const;

const ROOTS = [
  "Beak", "Talon", "Spur", "Feather", "Wing", "Claw", "Comb", "Hackle",
  "Plume", "Crest", "Rooster", "Hen", "Cock", "Fowl", "Chick", "Crow",
  "Hawk", "Eagle", "Falcon", "Phoenix", "Raven", "Magpie", "Kestrel",
  "Bolt", "Spark", "Flash", "Crash", "Smash", "Strike", "Blow", "Fury",
  "Wrath", "Rage", "Doom", "Glory", "Honor", "Valor", "Legend", "Myth",
  "Echo", "Breaker", "Slayer", "Hunter", "King", "Queen", "Lord", "Knight",
  "Reaper", "Storm", "Wind", "Fire", "Death", "Vengeance", "Scourge",
  "Menace", "Terror",
] as const;

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function roman(n: number): string {
  let out = "";
  for (const [value, glyph] of ROMAN) {
    while (n >= value) {
      out += glyph;
      n -= value;
    }
  }
  return out;
}

function takenNames(database: DB): Set<string> {
  return new Set(
    database
      .select({ name: birds.name })
      .from(birds)
      .all()
      .map((r) => r.name.toLowerCase())
  );
}

/** `base` if free, else the first free roman successor ("base II", "base III"…). */
export function uniqueName(database: DB, base: string): string {
  const taken = takenNames(database);
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} ${roman(n)}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/** Is this exact name (case-insensitive) already worn by another bird? */
export function nameTaken(database: DB, name: string, exceptBirdId?: string): boolean {
  const lower = name.toLowerCase();
  return database
    .select({ id: birds.id, name: birds.name })
    .from(birds)
    .all()
    .some((r) => r.id !== exceptBirdId && r.name.toLowerCase() === lower);
}

/** Fisher–Yates shuffle driven by `rng` — deterministic under `--seed`. */
function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Draw `count` distinct, world-unique starter names — shuffled by the
 * farm's flock rng (deterministic per seed). The supply is tiered so a
 * growing world fills up with original two-word names, not numbered
 * repeats:
 *
 *   1. Curated pool — the hand-picked `NAME_POOL`.
 *   2. Combinatorial — `PREFIXES × ROOTS` ("Iron Beak", "Golden Spur").
 *   3. Roman successors — "Hotshot II", only past ~3,000 birds.
 *
 * The curated pool is shuffled once and reused for tier 3, matching the
 * old generation-by-generation behaviour so `--seed` output is stable.
 * Generation is lazy: we stop the moment `count` is met, so a per-bird
 * `drawStarterNames(db, 1, …)` call never materialises the whole bank.
 */
export function drawStarterNames(database: DB, count: number, rng: Rng): string[] {
  const taken = takenNames(database);
  const out: string[] = [];
  const claim = (name: string): void => {
    const key = name.toLowerCase();
    if (taken.has(key)) return;
    taken.add(key);
    out.push(name);
  };

  const pool = shuffle(NAME_POOL, rng);

  // Tier 1 — curated pool.
  for (const base of pool) {
    if (out.length === count) break;
    claim(base);
  }

  // Tier 2 — combinatorial prefix × root. Two independent shuffles so the
  // pairings vary per call while staying deterministic under --seed.
  if (out.length < count) {
    const prefixes = shuffle(PREFIXES, rng);
    const roots = shuffle(ROOTS, rng);
    for (const p of prefixes) {
      if (out.length === count) break;
      for (const r of roots) {
        if (out.length === count) break;
        claim(`${p} ${r}`);
      }
    }
  }

  // Tier 3 — roman successors of the curated pool, generation by generation.
  for (let generation = 2; out.length < count; generation++) {
    for (const base of pool) {
      if (out.length === count) break;
      claim(`${base} ${roman(generation)}`);
    }
  }

  return out;
}
