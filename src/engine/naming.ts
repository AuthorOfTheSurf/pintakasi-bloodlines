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

/** The starter-name pool for non-dev farms — Filipino/sabong-flavored. */
export const NAME_POOL = [
  "Agila", "Amihan", "Habagat", "Bagyo", "Sigwa", "Unos", "Daluyong", "Bituin",
  "Tala", "Liwayway", "Takipsilim", "Maharlika", "Lakan", "Lakambini", "Mutya",
  "Diwata", "Sampaguita", "Hiraya", "Marikit", "Malakas", "Maganda", "Bathala",
  "Mayari", "Apolaki", "Urduja", "Sikatuna", "Bagani", "Datu", "Rajah",
  "Kalasag", "Sibat", "Kampilan", "Balisong", "Sundang", "Panday", "Bayani",
  "Magiting", "Salakay", "Dagundong", "Kulog", "Bulkan", "Apoy", "Baga",
  "Alitaptap", "Tikbalang", "Sarimanok", "Adarna", "Katala", "Kalaw", "Ginto",
  "Pilak", "Tanso", "Bakal", "Patalim", "Tari", "Llamado", "Dehado",
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

/**
 * Draw `count` distinct, world-unique starter names — shuffled from the
 * pool by the farm's flock rng (deterministic per seed). If the pool ever
 * runs dry, later farms get roman successors of pool names.
 */
export function drawStarterNames(database: DB, count: number, rng: Rng): string[] {
  const taken = takenNames(database);
  const pool = [...NAME_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const out: string[] = [];
  for (let generation = 1; out.length < count; generation++) {
    for (const base of pool) {
      if (out.length === count) break;
      const name = generation === 1 ? base : `${base} ${roman(generation)}`;
      if (!taken.has(name.toLowerCase())) {
        taken.add(name.toLowerCase());
        out.push(name);
      }
    }
  }
  return out;
}
