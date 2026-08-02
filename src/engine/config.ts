/**
 * ALL balance seeds live here — first-guess values, tune by play.
 * Every value is commented with what it does in gameplay terms.
 * Spec: wiki/projects/pintakasi-mvp.md + pintakasi-fight-formats.md
 * in the zane-knowledge-system repo.
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

// ── Stats (the PFL-mapped 6-stat combat matrix, ruled 2026-08-02) ───────────
// Four PHASE stats (which ones matter depends on how long the blade lets the
// fight run — that's the "distance" dial) + two BEHAVIORAL anchors that
// matter in every format but define none.
export const STAT_NAMES = [
  "agility", //   [phase 1 · PFL Start]  the break — the opening fly-up; who strikes first
  "sight", //     [phase 2 · PFL Speed]  accuracy and strike placement in open exchange
  "stamina", //   [fuel    · PFL Stamina] the wind pool AND decay resistance — physical stats fade as wind burns
  "gameness", //  [phase 3 · PFL Finish] deep-fight grit — drives the late turns; low gameness birds can RUN when hurt
  "station", //   [anchor  · PFL Heart]  the rivalry modifier — clutch boost when outmatched; the underdog's path to upsets
  "condition", // [anchor  · PFL Temper] the RNG stabilizer — high = fights at 95-100% of book; low = ugly off-days
] as const;
export type StatName = (typeof STAT_NAMES)[number];

export const STATS = {
  MIN: 0, //    floor for any stat
  MAX: 2000, // ceiling — the PFL 0–2000 scale (letter-grade display comes later; store raw forever)
  // Starter flock rolls in this band (Zane: "~300"). Low on purpose — the
  // best birds in the game don't exist yet; breeding is the way up.
  STARTER_MIN: 250,
  STARTER_MAX: 400,
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
  // six stats in battle (format-agnostic — stars work in every blade class).
  // +20 on the 0–2000 scale ≈ +0.05 on a turn roll per star.
  BOOST_PER_FULL_STAR: 20,
} as const;

// ── Weapon formats — the "distance" dial (blade style & length) ─────────────
// The four buckets, sprint → marathon. Shorter fights only ever exercise the
// early phase stats (agility/sight); long fights burn wind and hand the late
// turns to gameness. Knife formats are SWINGY (big crits — upsets happen);
// gaff formats are true tests (crits barely matter).
export const FORMATS = {
  longKnife: {
    label: "Long Knife", // 4.5″ Filipino Slasher — the sprint
    maxTurns: 5, //          fights end in the opening frames
    damageMult: 3.0, //      one clean hit takes a third of a wind pool
    critMult: 2.5, //        a Tari Strike here is usually the fight
  },
  shortKnife: {
    label: "Short Knife", // 2.5″ Mexican Slasher — the hybrid
    maxTurns: 12, //          tactical pacing; consistent hit output wins
    damageMult: 1.6,
    critMult: 2.0,
  },
  longGaff: {
    label: "Long Gaff", // 2½″ Long Spur — the route
    maxTurns: 20, //        punctures wear a bird down; wind starts to rule
    damageMult: 1.0,
    critMult: 1.3,
  },
  shortGaff: {
    label: "Short Gaff", // 1″ Short Heel — the marathon
    maxTurns: 30, //         deep-round attrition; gameness dictates the end
    damageMult: 0.7,
    critMult: 1.1,
  },
} as const;
export type FightFormat = keyof typeof FORMATS;
export const FORMAT_NAMES = Object.keys(FORMATS) as FightFormat[];

// ── Fight phases (absolute turn windows — the distance curve itself) ────────
// Turn 1–2 = the break (agility drives). Turns 3–10 = open exchange (sight).
// Turn 11+ = the deep fight (gameness). A 5-turn long-knife bout never
// reaches the deep fight; a 30-turn short-gaff bout mostly lives there.
export const PHASES = {
  BREAK_THROUGH_TURN: 2,
  OPEN_THROUGH_TURN: 10,
} as const;

// ── Battle (2d6) ────────────────────────────────────────────────────────────
export const BATTLE = {
  // "Wind" is the fight's HP pool. maxWind = BASE_WIND + stamina × WIND_PER_STAMINA
  // (e.g. 300 stamina → 20 + 3 = 23 wind; a 2000-stamina monster → 40).
  BASE_WIND: 20,
  WIND_PER_STAMINA: 0.01,
  // Turn roll = 2d6 + stat/ROLL_DIVISOR: a 2000 stat adds +5 (about two dice
  // pips); a 300 starter adds +0.75. Dice stay loud, stats stay real.
  ROLL_DIVISOR: 400,
  // The element edge: flat bonus on a turn's roll when your element overcomes
  // the opponent's (2d6 scale, so +1 ≈ half a die).
  ELEMENT_EDGE: 1,
  // House-bird generation: each opponent stat rolls within ± this of the
  // player bird's stat average. Bigger spread = swingier matchups.
  HOUSE_SPREAD: 160,
  // Stat decay (stamina's second job): agility and sight fade each turn by
  // PER_TURN × (1 − stamina/2000). A 300-stamina bird loses ~2.6%/turn — by
  // turn 20 it's fighting at ~half book. FLOOR stops decay short of zero.
  DECAY_PER_TURN: 0.03,
  DECAY_FLOOR: 0.2,
  // Station — the rivalry modifier: if the opponent's total base stats are
  // ≥ UNDERDOG_RATIO × yours, your station/STATION_DIVISOR joins every roll.
  // The programmatic path for underdogs to pull upsets.
  UNDERDOG_RATIO: 1.1,
  STATION_DIVISOR: 400,
  // Gameness — the deep-fight anchor: below QUIT_WIND_FRACTION of max wind,
  // gameness/GAMENESS_DIVISOR joins every roll… and ONCE per fight the hurt
  // bird checks morale: quit chance = QUIT_BASE_CHANCE × (1 − gameness/2000).
  // A 300-gameness bird runs ~42% of the time it gets badly hurt. Marathon
  // formats are where this stat is the whole game.
  QUIT_WIND_FRACTION: 0.25,
  QUIT_BASE_CHANCE: 0.5,
  GAMENESS_DIVISOR: 400,
  // Condition — the variance buffer: each turn each bird rolls its "form" in
  // [floor, 1.0] where floor = WORST_FORM + FORM_RANGE × (condition/2000).
  // At 2000 condition the floor is 0.95 (never an off-turn); at 300 it's
  // ~0.61 (some turns arrive badly). Low condition only ever hurts.
  WORST_FORM: 0.55,
  FORM_RANGE: 0.4,
} as const;

// ── Pit Figure (the Fleet-Figure analog — every fight pays out signal) ──────
// One banded rating per fight, normalized PER FORMAT so figures compare
// across blade classes ("LK 60 · SK 70 · LG 85" says: try gaffs). Computed
// from damage margin per turn vs. the opponent's strength — so a narrow loss
// to a monster can out-figure an ugly win over a dud. Deliberately coarse:
// banded + noisy, and it never decomposes by stat (the play-by-play carries
// the qualitative tell instead). Part of the fog.
export const FIGURE = {
  BASE: 50, //         an even fight figures ~50
  MARGIN_SCALE: 8, //  each point of format-normalized margin-per-turn moves the figure this much
  OPP_ADJ_DIVISOR: 8, // (opponent avg stat − yours)/this — beating up matters more
  NOISE: 4, //         ± uniform noise before banding (fog)
  BAND: 5, //          displayed to the nearest 5
  MAX: 120, //         clamp range [0, MAX]
} as const;

// ── Economy (GP — pegged at $1 = 80 GP, re-ruled 2026-08-03) ────────────────
// Zane walked the peg back from 8,000: $1 = 80 is divisible enough and the
// numbers stay humane ($2 breed = 160, not 16,000). No real money moves yet.
//
// THE FIGHT ECONOMY PRINCIPLE (ruled 2026-08-03): standard fights PRINT no
// GP — the pot is pooled between the participants and the winner takes it
// (win +entry, lose −entry; the house bird posts the same entry you do).
// The subsidy is Land Tokens, not GP. If GP ever gets printed, it happens
// at tournaments/championships only. Rakes/drains are deferred on purpose —
// a scalar that adds nothing to the beta.
export const ECONOMY = {
  GP_PER_DOLLAR: 80,
  STARTING_GP: 8_000, // every new farm opens with $100 — plenty to play with
  // The daily drip ($10/day, claimed via check-in) — accounts can't be
  // funded yet, so the faucet keeps testers liquid.
  DAILY_DRIP: 800,
  // The MINIMUM breed price ($2). Deliberately NO maximum — when the
  // marketplace/stud-cover market arrives, owners price their own retirees
  // above this floor. For now the floor is the only price.
  BREED_FEE: 160,
  // Entries (winner takes the pooled pot = 2× entry):
  REAL_ENTRY_FEE: 40, //      $0.50 a side — CAREER record
  HARDCORE_ENTRY_FEE: 120, // $1.50 a side — and the loser's career (the key rule)
  PRACTICE_ENTRY_FEE: 8, //   $0.10 a side — AMATEUR record, discovery year
  GACHA_ROLL_PRICE: 80, //    one roll = $1
  FREE_PULLS_PER_CHECK_IN: 2, // daily login bonus: two free gacha pulls
} as const;

// ── Land Tokens (the second currency — the subsidy, and one-way) ────────────
// Flat and unconditional: SHOWING UP earns land — every fight pays every
// participant the same amount win or lose, and every gacha roll pays too.
// Priced (2026-08-03): $0.01 = 1 LT, i.e. 80 GP buys 100 LT. Buyable with
// GP up to a daily cap; NEVER sellable back — land only accumulates.
// (Implied fully-diluted headroom: 100B LT = $1B.) Staking comes later.
export const LAND = {
  PER_FIGHT: 1,
  PER_GACHA_ROLL: 1,
  GP_PER_100_TOKENS: 80, // $1 buys 100 LT
  DAILY_BUY_CAP: 1000, //  max LT purchasable per farm per game-day ($10 worth)
} as const;

// ── Breeding ────────────────────────────────────────────────────────────────
export const BREEDING = {
  // Child stat = average of the parents ± up to this much, either direction.
  // The randomness that makes two eggs from the same pair differ. (0–2000 scale.)
  STAT_VARIANCE: 120,
  // Per stat: chance of a mutation, and how far it can swing (± up to SWING).
  // This is where surprise stars (and duds) come from.
  MUTATION_CHANCE: 0.05,
  MUTATION_SWING: 300,
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
// (On the $1 = 80 peg: base $1, each win +$0.30, floor $0.50.)
export const STUD = {
  BASE: 80, //     every retiree is worth at least a foundation price…
  PER_WIN: 24, //  …each career win adds this…
  PER_LOSS: -8, // …each career loss shaves this…
  MIN: 40, //      …but no career craters below this floor
} as const;

// ── Lobbies (fight selection v0 — maiden / win-caps / claimers) ─────────────
// The class ladder's first rungs. Entry restrictions self-sort (no
// matchmaker): maidens take never-winners, win-caps take light records,
// claimers take anyone but put a price on both birds. House-bird quality
// scales with the lobby, so picking the soft spot is the player's edge.
export const LOBBIES = ["open", "maiden", "nw2", "nw3", "claimer"] as const;
export type Lobby = (typeof LOBBIES)[number];

// House-bird strength per lobby, as a multiplier on the mirror-of-your-bird
// center (open = 1.0). Maidens are green; win-cap fields sharpen toward open.
export const LOBBY_HOUSE_QUALITY: Record<Exclude<Lobby, "claimer">, number> = {
  open: 1.0,
  maiden: 0.85,
  nw2: 0.92,
  nw3: 0.96,
};

// Claimers (re-ruled 2026-08-03): FARM-TO-FARM, escrowed, pre-fight.
// Enter a bird at a tag price; the entry sits on the public board for the
// rest of the game-day while OTHER farms place sealed claims; the fight goes
// off on the day tick. The bird fights for its ORIGINAL owner (who keeps the
// pooled prize); a successful claimant receives the bird only AFTER the
// fight. Multiple claims → RNG picks one, the rest refund. The house never
// claims — bot farms with claim-heavy playstyles are the liquidity later.
//
// The tag ladder brackets the 160 GP breed floor on purpose: two rungs
// below it (claim cheaper than breeding) and three above. It self-balances:
// a dear tag = safer from claims but a stronger field and a real entry at
// risk; a cheap tag = claimable, but win-and-get-claimed is an income spike.
export const CLAIMER = {
  PRICES: [50, 100, 200, 400, 600], // $0.625 · $1.25 · $2.50 · $5 · $7.50
  // House OPPONENT stats center on QUALITY_FLAT + tag (the field's strength
  // keys to the PRICE, not to your bird): 50 tag → ~270 avg (green);
  // 600 tag → ~820 (a real bird).
  QUALITY_FLAT: 220,
} as const;

// ── Fight cadence ───────────────────────────────────────────────────────────
// One fight per bird per GAME-DAY — a hard count, deliberately NOT a 24-hour
// cooldown (fight at 11 PM, fight again at 12:01 AM; fine). Real-time
// complexity stays out until the scheduler arrives.
export const CADENCE = {
  FIGHTS_PER_BIRD_PER_DAY: 1,
} as const;

// ── Farms (stables — every player + agent runs one) ────────────────────────
// Identity: a name, a country flag (encouraged), and two colors from this
// fixed palette (no hexes yet — iterate later).
export const FARM_COLORS = [
  "red", "orange", "yellow", "green", "teal", "blue",
  "purple", "pink", "brown", "black", "white", "gold",
] as const;
export type FarmColor = (typeof FARM_COLORS)[number];

// ── Training (age-1 discovery year) ─────────────────────────────────────────
export const TRAINING = {
  GAIN_PER_SESSION: 20, // per session, to one chosen stat (0–2000 scale)
  SESSIONS_PER_DAY: 3, //  daily cap — tick a day to reset
} as const;

// ── Barn ────────────────────────────────────────────────────────────────────
export const BARN = {
  CAPACITY: 100, // max birds + eggs; breeding is blocked when full
} as const;

// ── Gacha (pure rarity tokens — correspond to nothing yet) ──────────────────
export const GACHA_TOKENS = ["White", "Green", "Blue", "Purple", "Gold"] as const;
export type GachaToken = (typeof GACHA_TOKENS)[number];

// Drop weights out of 100 rolls: ~50 White, ~27 Green, ~15 Blue, ~6 Purple,
// ~2 Gold. What the item tokens DO comes later — the MVP tests the price flow.
export const GACHA_WEIGHTS: Record<GachaToken, number> = {
  White: 50,
  Green: 27,
  Blue: 15,
  Purple: 6,
  Gold: 2,
};

// ── Gacha birds (Zane leaning yes, 2026-08-02 — built config-gated) ─────────
// Blue/Purple/Gold rolls ALSO drop a MYSTERY EGG: random element, hidden
// 50-50 sex, no parents, hatches next Hatch Friday like any egg. This is the
// non-breeding bird faucet — the way a stable fills fast and finds elements
// its barn doesn't carry — balanced against breeding purely by price
// (~23% of $1 rolls drop an egg ≈ $4.35/bird vs the $2 breed floor, but no
// retired pair needed). Delete a tier here to turn its eggs off.
export const GACHA_BIRDS: Partial<
  Record<GachaToken, { halfStars: [min: number, max: number]; statMin: number; statMax: number }>
> = {
  Blue: { halfStars: [1, 4], statMin: 250, statMax: 450 }, //   starter-grade, maybe lucky stars
  Purple: { halfStars: [3, 7], statMin: 300, statMax: 550 }, // above the starter band
  Gold: { halfStars: [5, 10], statMin: 350, statMax: 700 }, //  the jackpot hen/rooster
};
