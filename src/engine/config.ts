/**
 * ALL balance seeds live here — first-guess values, tune by play.
 * Every value is commented with what it does in gameplay terms.
 * Spec: wiki/projects/pintakasi-mvp.md in the zane-knowledge-system repo.
 */

// ── Calendar ────────────────────────────────────────────────────────────────
// The in-game calendar starts on the first Friday of the Year 3000.
// Day 0 = that Friday. Birds age one bird-year per game-week (per Hatch Friday).
export const CALENDAR = {
  START_YEAR: 3000, // in-game year — far-future so dates never confuse with today's
  DAYS_PER_WEEK: 7, // a game-week; every 7th day is a Hatch Friday
} as const;

// ── Age gates (in bird-years, derived: currentWeek - birthWeek) ─────────────
export const AGE = {
  EGG: 0, //          age 0 = egg (sex hidden until hatch)
  CHICK: 1, //        age 1 = discovery year: amateur fights + training only
  REAL_STAKES: 2, //  age 2+ = real fights (career record starts)
  FORK: 3, //         age 3+ = hardcore AND manual retirement unlock together
  FIGHTING_CAP: 9, // age 9 = force-retire (natural lifespan, compressed)
} as const;

// ── Stats ───────────────────────────────────────────────────────────────────
export const STAT_NAMES = [
  "agility", //   speed of attack — drives turn rolls (turn 1 of each rotation)
  "heart", //     the comeback stat — kicks in when a bird is low on wind
  "avoidance", // defense — shaves damage off every hit taken
  "stamina", //   endurance — sets the size of the "wind" pool (battle HP)
  "ruthless", //  killer instinct — adds damage to every hit landed
  "sight", //     read of the opponent — drives turn rolls (turn 2 of rotation)
] as const;
export type StatName = (typeof STAT_NAMES)[number];

export const STATS = {
  MIN: 1, //          floor for any stat
  MAX: 100, //        ceiling for any stat
  STARTER_MIN: 30, // seed-flock stats roll in this range —
  STARTER_MAX: 60, // leaves headroom so bred generations visibly improve
} as const;

// ── Elements (BaZi wuxing 克 kè "overcoming" cycle) ─────────────────────────
// Fire beats Metal, Metal beats Wood, Wood beats Earth, Earth beats Water,
// Water beats Fire. A slight edge only — a Fire bird can still lose to Water.
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
  MAX_HALF_STARS: 10, // 10 half-stars = 5.0★, the max
  // Baseline boost: every FULL star adds this many effective points to ALL
  // six stats in battle. At +1/star a 5★ bird fights like +5 on everything.
  BOOST_PER_FULL_STAR: 1,
} as const;

// ── Battle (2d6) ────────────────────────────────────────────────────────────
export const BATTLE = {
  // "Wind" is the fight's HP pool. maxWind = BASE_WIND + stamina × WIND_PER_STAMINA
  // (e.g. 50 stamina → 20 + 10 = 30 wind). Bigger pool = longer fights.
  BASE_WIND: 20,
  WIND_PER_STAMINA: 0.2,
  // The element edge: flat bonus added to a turn's roll (2d6 scale, so +1 is
  // ~a half-die advantage) when your element overcomes the opponent's.
  ELEMENT_EDGE: 1,
  // Safety valve: if neither bird is out of wind by this turn, the referee
  // calls it and the bird with more wind remaining wins.
  MAX_TURNS: 30,
  // House-bird generation: each opponent stat rolls within ± this of the
  // player bird's stat average. Bigger spread = swingier matchups.
  HOUSE_SPREAD: 8,
} as const;

// ── Economy (GP — one closed number) ────────────────────────────────────────
export const ECONOMY = {
  STARTING_GP: 1000, // the bankroll a new game opens with
  BREED_FEE: 200, //   cost to lay one egg — the main GP sink
  // Real fights (age 2+): pay the entry, win the prize. A win nets +70,
  // a loss costs the 50 entry. These build the CAREER record.
  REAL_ENTRY_FEE: 50,
  REAL_PRIZE: 120,
  // Hardcore (age 3+): the charged decision. A win nets +350 — but a loss
  // costs the entry AND the career (loser is force-retired).
  HARDCORE_ENTRY_FEE: 150,
  HARDCORE_PRIZE: 500,
  // Amateur fights (age 1+, the discovery year's arena): real but small
  // stakes — a win nets +15, a loss costs the 10 entry. These build the
  // separate AMATEUR record and never touch career record or stud value.
  PRACTICE_ENTRY_FEE: 10,
  PRACTICE_PRIZE: 25,
  GACHA_ROLL_PRICE: 100, // one rarity-token roll
} as const;

// ── Breeding ────────────────────────────────────────────────────────────────
export const BREEDING = {
  // Child stat = average of the parents ± up to this much, either direction.
  // The randomness that makes two eggs from the same pair differ.
  STAT_VARIANCE: 6,
  // Per stat: chance of a mutation, and how far it can swing (± up to SWING).
  // This is where surprise stars (and duds) come from.
  MUTATION_CHANCE: 0.05,
  MUTATION_SWING: 15,
  // Star inheritance (PFL preference-pair model): child half-stars land
  // within ± this of the parents' average; element leans 70/25/5 toward the
  // higher-starred parent / other parent / random mutation.
  STAR_SPREAD_HALF_STARS: 2,
  // Bloodline restriction: how many generations up count as forbidden kin.
  // 3 = parents, grandparents, great-grandparents (siblings checked separately).
  ANCESTOR_DEPTH: 3,
  // Egg sex: 50-50 male/female, decided at breeding, HIDDEN until hatch.
  FEMALE_CHANCE: 0.5,
} as const;

// ── Stud value (what a CAREER record converts to at retirement) ─────────────
// studValue = BASE + wins×PER_WIN + losses×PER_LOSS, never below MIN.
// Only real + hardcore fights count — the amateur record doesn't move this.
export const STUD = {
  BASE: 100, //    every retiree is worth at least a foundation price…
  PER_WIN: 30, //  …each career win adds this…
  PER_LOSS: -10, // …each career loss shaves this…
  MIN: 50, //      …but no career craters below this floor
} as const;

// ── Training (age-1 discovery year) ─────────────────────────────────────────
export const TRAINING = {
  GAIN_PER_SESSION: 1, // +1 to one chosen stat per session
  SESSIONS_PER_DAY: 3, // daily cap — tick a day to reset
} as const;

// ── Barn ────────────────────────────────────────────────────────────────────
export const BARN = {
  CAPACITY: 100, // max birds + eggs; breeding is blocked when full
} as const;

// ── Gacha (pure rarity tokens — correspond to nothing yet) ──────────────────
export const GACHA_TOKENS = ["White", "Green", "Blue", "Purple", "Gold"] as const;
export type GachaToken = (typeof GACHA_TOKENS)[number];

// Drop weights out of 100 rolls: ~50 White, ~27 Green, ~15 Blue, ~6 Purple,
// ~2 Gold. What the tokens DO comes later — the MVP tests the price flow.
export const GACHA_WEIGHTS: Record<GachaToken, number> = {
  White: 50,
  Green: 27,
  Blue: 15,
  Purple: 6,
  Gold: 2,
};
