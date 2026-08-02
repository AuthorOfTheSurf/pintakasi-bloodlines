import type { DB } from "./client";
import { birds, gameState, type NewBird } from "./schema";
import { ECONOMY, ELEMENTS, STATS, type Element } from "@/engine/config";
import { mulberry32, randInt, type Rng } from "@/engine/rng";

/**
 * Starter flock — includes retired birds so the breeding loop works on turn
 * one (spec item 2). Ages are set via negative birthWeek (born before day 0).
 */

interface StarterSpec {
  name: string;
  sex: "rooster" | "hen";
  status: "active" | "retired";
  age: number; // bird-years at week 0
  element: Element;
  halfStars: number;
  wins?: number;
  losses?: number;
}

const STARTERS: StarterSpec[] = [
  // The retired barn — breeding stock from day one (two unrelated pairs).
  { name: "Tandang Pula", sex: "rooster", status: "retired", age: 10, element: "Fire", halfStars: 5, wins: 14, losses: 3 },
  { name: "Dalisay", sex: "hen", status: "retired", age: 9, element: "Water", halfStars: 4, wins: 8, losses: 2 },
  { name: "Bagwis", sex: "rooster", status: "retired", age: 11, element: "Metal", halfStars: 6, wins: 11, losses: 5 },
  { name: "Perlas", sex: "hen", status: "retired", age: 10, element: "Earth", halfStars: 3, wins: 6, losses: 4 },
  // The active roster — one bird at each interesting gate.
  { name: "Kidlat", sex: "rooster", status: "active", age: 1, element: "Wood", halfStars: 2 }, // discovery year
  { name: "Alab", sex: "rooster", status: "active", age: 2, element: "Fire", halfStars: 3, wins: 1, losses: 1 }, // real stakes
  { name: "Sinag", sex: "hen", status: "active", age: 3, element: "Metal", halfStars: 4, wins: 4, losses: 1 }, // the fork is open
  { name: "Batong Buhay", sex: "rooster", status: "active", age: 5, element: "Earth", halfStars: 2, wins: 7, losses: 6 }, // veteran
];

function rollStats(rng: Rng) {
  const stat = () => randInt(rng, STATS.STARTER_MIN, STATS.STARTER_MAX);
  return {
    agility: stat(),
    heart: stat(),
    avoidance: stat(),
    stamina: stat(),
    ruthless: stat(),
    sight: stat(),
  };
}

export function seedGame(db: DB, opts: { seed?: number; startingGp?: number } = {}): void {
  const rng = mulberry32(opts.seed ?? 3000);

  db.insert(gameState)
    .values({ id: 1, dayIndex: 0, gp: opts.startingGp ?? ECONOMY.STARTING_GP })
    .run();

  const rows: NewBird[] = STARTERS.map((s, i) => ({
    id: `starter-${i + 1}`,
    name: s.name,
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
