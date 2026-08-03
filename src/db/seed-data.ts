import type { DB } from "./client";
import { birds, farms, gameState, type NewBird } from "./schema";
import { ECONOMY, ELEMENTS, STATS, type Element } from "@/engine/config";
import { emit } from "@/engine/events";
import { drawStarterNames } from "@/engine/naming";
import { mulberry32, randInt, type Rng } from "@/engine/rng";

/**
 * Seeds the WORLD (day 0) plus a default dev farm with the starter flock —
 * retired birds included so the breeding loop works on turn one (spec item
 * 2). Ages are set via negative birthWeek (born before day 0). Additional
 * farms register through the Farms module and get seeded via seedStarterFlock.
 */

export const DEV_FARM_ID = "farm-1";
export const DEV_FARM_KEY = "fk_dev"; // fixed for local play + tests

interface StarterSpec {
  name: string;
  sex: "male" | "female";
  status: "active" | "retired";
  age: number; // bird-years at week 0
  element: Element;
  halfStars: number;
  wins?: number;
  losses?: number;
}

const STARTERS: StarterSpec[] = [
  // The retired barn — breeding stock from day one (two unrelated pairs).
  { name: "Tandang Pula", sex: "male", status: "retired", age: 10, element: "Fire", halfStars: 5, wins: 14, losses: 3 },
  { name: "Dalisay", sex: "female", status: "retired", age: 9, element: "Water", halfStars: 4, wins: 8, losses: 2 },
  { name: "Bagwis", sex: "male", status: "retired", age: 11, element: "Metal", halfStars: 6, wins: 11, losses: 5 },
  { name: "Perlas", sex: "female", status: "retired", age: 10, element: "Earth", halfStars: 3, wins: 6, losses: 4 },
  // The active roster — one bird at each interesting gate.
  { name: "Kidlat", sex: "male", status: "active", age: 1, element: "Wood", halfStars: 2 }, // discovery year
  { name: "Alab", sex: "male", status: "active", age: 2, element: "Fire", halfStars: 3, wins: 1, losses: 1 }, // real stakes
  { name: "Sinag", sex: "female", status: "active", age: 3, element: "Metal", halfStars: 4, wins: 4, losses: 1 }, // the fork is open
  { name: "Batong Buhay", sex: "male", status: "active", age: 5, element: "Earth", halfStars: 2, wins: 7, losses: 6 }, // veteran
];

function rollStats(rng: Rng) {
  // ~300 on the 0–2000 scale (Zane's ruling) — headroom is the point:
  // the best birds in the game don't exist yet.
  const stat = () => randInt(rng, STATS.STARTER_MIN, STATS.STARTER_MAX);
  return {
    agility: stat(),
    sight: stat(),
    stamina: stat(),
    gameness: stat(),
    station: stat(),
    condition: stat(),
  };
}

export function seedGame(
  db: DB,
  opts: { seed?: number; startingGp?: number } = {}
): { farmId: string; apiKey: string } {
  db.insert(gameState).values({ id: 1, dayIndex: 0 }).run();

  db.insert(farms)
    .values({
      id: DEV_FARM_ID,
      name: "Bukidnon Farms",
      country: "🇵🇭",
      primaryColor: "red",
      secondaryColor: "gold",
      apiKey: DEV_FARM_KEY,
      gp: opts.startingGp ?? ECONOMY.STARTING_GP,
      landTokens: 0,
      createdDay: 0,
    })
    .run();

  emit(db, {
    type: "farm_registered",
    farmId: DEV_FARM_ID,
    gpCents: (opts.startingGp ?? ECONOMY.STARTING_GP) * 100,
    message: `Bukidnon Farms registered — starting purse ${opts.startingGp ?? ECONOMY.STARTING_GP} GP`,
  });
  seedStarterFlock(db, DEV_FARM_ID, { seed: opts.seed, idPrefix: "starter" });
  return { farmId: DEV_FARM_ID, apiKey: DEV_FARM_KEY };
}

/** The 8-bird starter shape every new farm opens with. */
export function seedStarterFlock(
  db: DB,
  farmId: string,
  opts: { seed?: number; idPrefix?: string } = {}
): void {
  const rng = mulberry32(opts.seed ?? 3000);
  const prefix = opts.idPrefix ?? `${farmId}-starter`;

  // Names are world-unique (round 12): the dev farm keeps the canonical
  // eight; every other farm draws its own from the pool.
  const names =
    farmId === DEV_FARM_ID ? STARTERS.map((s) => s.name) : drawStarterNames(db, STARTERS.length, rng);

  const rows: NewBird[] = STARTERS.map((s, i) => ({
    id: `${prefix}-${i + 1}`,
    farmId,
    name: names[i],
    sex: s.sex,
    status: s.status,
    ...rollStats(rng),
    element: s.element ?? ELEMENTS[i % ELEMENTS.length],
    halfStars: s.halfStars,
    birthWeek: -s.age, // age at week 0 = 0 - birthWeek
    birthDay: -s.age * 7,
    wins: s.wins ?? 0,
    losses: s.losses ?? 0,
    retiredBy: s.status === "retired" ? ("age" as const) : null,
    retiredWeek: s.status === "retired" ? -1 : null,
    motherId: null,
    fatherId: null,
  }));

  db.insert(birds).values(rows).run();
}
