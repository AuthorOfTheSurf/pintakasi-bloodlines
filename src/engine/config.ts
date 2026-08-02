/**
 * ALL balance seeds live here — first-guess values, tune by play.
 * Spec: wiki/projects/pintakasi-mvp.md in the zane-knowledge-system repo.
 */

// ── Calendar ────────────────────────────────────────────────────────────────
// The in-game calendar starts on the first Friday of the Year 3000.
// Day 0 = that Friday. Birds age one bird-year per game-week (per Hatch Friday).
export const CALENDAR = {
  START_YEAR: 3000,
  // 3000-01-01 falls midweek; the engine computes the first Friday at runtime.
  DAYS_PER_WEEK: 7,
} as const;

// ── Age gates (in bird-years, derived: currentWeek - birthWeek) ─────────────
export const AGE = {
  EGG: 0, //       age 0 = egg
  CHICK: 1, //     age 1 = discovery year: practice battles + training only
  REAL_STAKES: 2, // age 2+ = real fights (fees, prizes, record)
  FORK: 3, //      age 3+ = hardcore-eligible AND manual-retirement-eligible
  FIGHTING_CAP: 9, // age 9 = force-retire (natural lifespan, compressed)
} as const;

// ── Stats ───────────────────────────────────────────────────────────────────
export const STAT_NAMES = [
  "agility",
  "heart",
  "avoidance",
  "stamina",
  "ruthless",
  "sight",
] as const;
export type StatName = (typeof STAT_NAMES)[number];

export const STATS = {
  MIN: 1,
  MAX: 100,
  STARTER_MIN: 30, // seed-flock stat range
  STARTER_MAX: 60,
} as const;

// ── Elements (BaZi wuxing 克 kè "overcoming" cycle) ─────────────────────────
// Fire beats Metal, Metal beats Wood, Wood beats Earth, Earth beats Water,
// Water beats Fire. A slight edge only.
export const ELEMENTS = ["Fire", "Metal", "Wood", "Earth", "Water"] as const;
export type Element = (typeof ELEMENTS)[number];

export const ELEMENT_BEATS: Record<Element, Element> = {
  Fire: "Metal",
  Metal: "Wood",
  Wood: "Earth",
  Earth: "Water",
  Water: "Fire",
};

// ── Element stars (typed 0–5 in half-steps; stored as half-stars 0–10) ──────
export const STARS = {
  MAX_HALF_STARS: 10, // 5.0★
  // Baseline boost: effective stat bonus per FULL star (so 1 per 2 half-stars).
  BOOST_PER_FULL_STAR: 1,
} as const;

// ── Battle (2d6) ────────────────────────────────────────────────────────────
export const BATTLE = {
  // Each side's condition pool ("wind") — battle ends when one side is emptied.
  BASE_WIND: 20,
  WIND_PER_STAMINA: 0.2, // + stamina * this
  // The element edge: flat bonus added to a turn's effective roll when your
  // element beats the opponent's.
  ELEMENT_EDGE: 1,
  MAX_TURNS: 30, // safety valve; higher remaining wind wins on expiry
  // House-bird generation: opponent stats ~ bird's stat average ± this spread.
  HOUSE_SPREAD: 8,
} as const;

// ── Economy (GP — one closed number) ────────────────────────────────────────
export const ECONOMY = {
  STARTING_GP: 1000,
  BREED_FEE: 200,
  REAL_ENTRY_FEE: 50,
  REAL_PRIZE: 120,
  HARDCORE_ENTRY_FEE: 150,
  HARDCORE_PRIZE: 500,
  PRACTICE_ENTRY_FEE: 0,
  PRACTICE_PRIZE: 0,
  GACHA_ROLL_PRICE: 100,
} as const;

// ── Breeding ────────────────────────────────────────────────────────────────
export const BREEDING = {
  // Child stat = avg(parents) ± uniform(VARIANCE), clamped to STATS bounds.
  STAT_VARIANCE: 6,
  MUTATION_CHANCE: 0.05, // per stat
  MUTATION_SWING: 15, // mutated stat shifts ± up to this much
  // Star inheritance (PFL preference-pair model): child half-stars drawn
  // around the parents' average with a small spread; element type leans
  // toward the higher-starred parent.
  STAR_SPREAD_HALF_STARS: 2,
  // Bloodline restriction: forbidden shared ancestry depth.
  // 3 generations up = parents, grandparents, great-grandparents (+ siblings).
  ANCESTOR_DEPTH: 3,
} as const;

// ── Training (age-1 discovery year) ─────────────────────────────────────────
export const TRAINING = {
  GAIN_PER_SESSION: 1, // +1 to a chosen stat
  SESSIONS_PER_DAY: 3,
} as const;

// ── Barn ────────────────────────────────────────────────────────────────────
export const BARN = { CAPACITY: 100 } as const;

// ── Gacha (pure rarity tokens — correspond to nothing yet) ──────────────────
export const GACHA_TOKENS = ["White", "Green", "Blue", "Purple", "Gold"] as const;
export type GachaToken = (typeof GACHA_TOKENS)[number];

export const GACHA_WEIGHTS: Record<GachaToken, number> = {
  White: 50,
  Green: 27,
  Blue: 15,
  Purple: 6,
  Gold: 2,
};
