import { sql } from "drizzle-orm";
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

/**
 * ── ONE NAME, ONE QUERY (round 43) ──────────────────────────────────────────
 *
 * `uniqueName` and `nameTaken` used to build a Set of EVERY name in the world
 * and then ask it one question. That is a full `birds` scan per bird created,
 * and since the table grows all run it is quadratic in the length of a
 * simulation — the exact shape that hurts when the default run doubles to 182
 * days. Every bred egg and every gacha egg paid it.
 *
 * ⚠ WHY THIS IS A QUERY AND NOT A CACHED SET, because a cache is the obvious
 * idea and it is a trap. Names are minted at four doors (`seedStarterFlock`,
 * `Breeding.breed`, `Gacha.roll`, and `Flock.rename` — which also FREES the old
 * name), so a module-level Set would be a fifth thing to keep in sync with no
 * test that would notice it drifting. And the failure mode is silent: uniqueness
 * here is enforced in CODE, not by a DB constraint (see the header note), so two
 * birds would simply end up with the same name and nothing would ever throw.
 * A query cannot go stale.
 *
 * ⚠ ONE DELIBERATE NARROWING. SQLite's `lower()` is ASCII-only where JS
 * `toLowerCase()` is Unicode-aware, so two names differing only in the case of a
 * non-ASCII letter now both pass. Every name this game generates is ASCII (see
 * the banks below); the only door taking arbitrary text is `Flock.rename`. This
 * is a narrowing of a code-enforced rule, not of anything the engine produces,
 * and `naming.test.ts` pins the ASCII behaviour so the trade stays visible.
 *
 * The index that makes it cheap is `ix_birds_name_lower`, declared in BOTH
 * `db/schema.ts` and `db/ddl.ts` (they are hand-synced).
 */
function nameIsTaken(database: DB, name: string, exceptBirdId?: string): boolean {
  const clash = database
    .select({ id: birds.id })
    .from(birds)
    .where(
      exceptBirdId === undefined
        ? sql`lower(${birds.name}) = lower(${name})`
        : sql`lower(${birds.name}) = lower(${name}) and ${birds.id} <> ${exceptBirdId}`
    )
    .limit(1)
    .get();
  return clash !== undefined;
}

/** `base` if free, else the first free roman successor ("base II", "base III"…). */
export function uniqueName(database: DB, base: string): string {
  if (!nameIsTaken(database, base)) return base;
  // Probes one candidate at a time rather than pre-loading the world. The chain
  // is short in practice — a prolific hen's "Egg of Dalisay VII" is about as far
  // as it goes — so a handful of indexed lookups beats one full scan.
  for (let n = 2; ; n++) {
    const candidate = `${base} ${roman(n)}`;
    if (!nameIsTaken(database, candidate)) return candidate;
  }
}

/** Is this exact name (case-insensitive) already worn by another bird? */
export function nameTaken(database: DB, name: string, exceptBirdId?: string): boolean {
  return nameIsTaken(database, name, exceptBirdId);
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
  // ⚠ THIS ONE KEEPS THE FULL SCAN, and it is not an oversight (round 43 moved
  // `uniqueName`/`nameTaken` to per-name queries and deliberately left this
  // alone). A draw walks up to PREFIXES × ROOTS ≈ 3,000 candidates looking for
  // free ones, so probing per candidate would trade a single scan for thousands
  // of queries — a pessimisation, not a fix. It is also SAFE as a snapshot in a
  // way the other two are not: nothing writes to `birds` between this read and
  // the caller's insert, because the whole draw happens before any bird exists.
  const taken = new Set(
    database
      .select({ name: birds.name })
      .from(birds)
      .all()
      .map((r) => r.name.toLowerCase())
  );
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
