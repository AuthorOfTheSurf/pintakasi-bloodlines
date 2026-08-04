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
  CHICK: 1, //        age 1 = discovery year: juvenile fights only
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
  STARTER_MIN: 240,
  STARTER_MAX: 400,
  // The TALENT SPIKE (round 19): a flat 250–400 band graded every starter
  // B or B+ and the Birds table read as one grey wall. Now each stat rolls
  // a small chance to come in ABOVE the band instead — about a third of
  // birds open with a green A somewhere, so a stable has something to point
  // at on day one. Deliberately per-STAT: the six-stat average (the Overall
  // grade) still sits in B/B+, because raising the WHOLE bird is what
  // breeding is for.
  STARTER_SPIKE_CHANCE: 0.07,
  STARTER_SPIKE_MIN: 400,
  STARTER_SPIKE_MAX: 520,
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

// ── Daily Element weather (round 24 — the PFL "going" analog) ───────────────
// One element is ASCENDANT each game-day, giving birds OF that element a
// small edge in every fight on the card. This is the random, blade-
// independent axis of fight selection: it's the same for every lobby that
// day (so it never fragments the lobby keys — mode × class × format is
// already plenty), and it rotates irregularly so a bird's "day" comes
// around without being predictable to the week.
//
// The intent is SOFTER selection, not a second matchmaking dimension. A
// bird rarely gets its ideal blade AND its ideal weather in the same fight,
// so players constantly trade one for the other — and the matching birds
// drawn in by a good-weather day pull their natural counters in after them,
// then the counters' counters. Logical and foggy, by design.
//
// Deterministic from dayIndex (no schema change, no storage): reproducible
// across reloads and sims, stable for any given day. The head-to-head
// element RPS edge (ELEMENT_EDGE) is SEPARATE and stacks with this — a Fire
// bird vs a Metal opponent on a Fire day gets both.
export const WEATHER = {
  // The flat bonus on a turn's roll when your element matches the day's
  // ascendant element. Boost-only on purpose — no predator penalty — to keep
  // it soft; a hindrance for the element that beats the ascendant is a
  // tunable later.
  //
  // WHY 0.25 AND NOT 1 (re-ruled after round 24's review). This shipped at
  // +1, matching ELEMENT_EDGE, on the reasoning that "+1 on 2d6 is half a
  // die, so it only nudges." That reasoning is wrong, and the measurement
  // says so: between two equal 350-stat birds a flat +1 takes the matched
  // bird from 50% to 76%, and STACKED on the head-to-head RPS edge it
  // reaches 92%. It was the single most decisive term in the fight.
  //
  // The reason is ROLL_DIVISOR (see BATTLE): a turn roll is 2d6 + stat/400,
  // so a starter bird's ENTIRE stat block is worth about +0.875 on the roll.
  // Anything flat and near 1.0 doesn't nudge the stat term, it outweighs it.
  // Every flat modifier in this engine has to be read against 0.875, not
  // against the dice.
  //
  // 0.25 is about a quarter of what a whole starter bird contributes.
  // Measured on equal 350-stat birds over 4000 seeds, shortKnife:
  //   weather alone   50% → 57%   (a felt edge; a coin-flip stays a coin-flip)
  //   stacked on RPS  76% → 82%   (weather adds ~6 points, not ~16)
  // It also keeps the Pit Figure honest: at +1 a weather-matched winner's
  // average figure inflated by ~12 points — over two full FIGURE.BANDs, so
  // the day leaked into the discovery signal and no form line could show it.
  // At 0.25 the inflation is ~2.7, inside the ±FIGURE.NOISE fog that's
  // already there. The weather colors a fight; it doesn't relabel the bird.
  EDGE: 0.25,
  // The salt that makes weatherOfDay irregular without cycling every 5 days.
  SALT: 0x6c29a1d3,
} as const;

/** The ascendant element for a given game-day — deterministic, irregular. */
export function weatherOfDay(dayIndex: number): Element {
  // The engine's own mulberry32 generator, seeded per day, gives one well-
  // mixed draw — so the rotation reads as irregular without clumping on any
  // one element (a one-shot finalizer hash over sequential dayIndex values
  // under-mixed and starved one element). Deterministic: a sim re-run lands
  // on the same element for day N every time.
  let a = (Math.imul(dayIndex, 0x9e3779b9) + WEATHER.SALT) >>> 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return ELEMENTS[Math.floor(r * ELEMENTS.length)];
}

// ── Element stars (typed 0–5 in half-steps; stored as half-stars 0–10) ──────
export const STARS = {
  MAX_HALF_STARS: 10, // 10 half-stars = 5.0★, the max
  // Baseline boost: every FULL star adds this many effective points to ALL
  // six stats in battle (format-agnostic — stars work in every blade class).
  // +20 on the 0–2000 scale ≈ +0.05 on a turn roll per star.
  BOOST_PER_FULL_STAR: 20,
  // What a STARTER bird is born with (nerfed round 23). Zane: "I was seeing
  // way-too-high star levels for so early into the game." Day-one stock now
  // tops out at 1.5★ — a 4★ bird on the board in week one made the whole
  // rating meaningless. Stars are supposed to be the thing you CHASE: the
  // gacha's Purple and Gold tiers are where 2–4★ birds enter the world, and
  // breeding is how you compound them from there.
  STARTER_MIN_HALF: 0, // 0.0★
  STARTER_MAX_HALF: 3, // 1.5★
} as const;

// ── CARRIAGE — the second preference axis (ruled round 23) ──────────────────
// Zane wanted a second star category, PFL-style (that game rates a horse on
// dirt/turf, left/right and soft/firm — a preference AXIS with a magnitude,
// not another power stat). His instinct was Ground vs. Air, and it's the
// authentic one: sabong has always split birds into SHUFFLERS that work low
// and drive along the ground, and HIGH-FLYERS that leave their feet and come
// down over the top. Handlers say pang-baba ("low") and pang-itaas ("high").
//
// TWO poles, not five, on purpose: the element wheel already supplies a 5-way
// rock-paper-scissors, and a second wheel would turn matchups into noise. A
// clean axis stays legible — and legibility is the whole point of a rating
// players are meant to read off a table.
//
// ⚠ NOT WIRED INTO THE FIGHT ENGINE YET (Zane's scope call: "we don't need to
// adjust the fight algo yet"). This is the data layer — carried, inherited,
// rolled and displayed — so the breeding population starts accumulating the
// trait now and the mechanic can land on a world that already has it.
//
// THE INTENDED HOME, when it does land: the sim already runs in PHASES
// (fight-sim.ts — break turns, open turns, then the deep water). Air should
// pay in the EARLY phase (over the top of a low fighter before anyone's wind
// is gone); Ground should pay LATE (once the flyer is blown, the shuffler
// grinds him down). That hooks into blades for free, because each blade has
// its own maxTurns: a short knife is decided early — Air country — while a
// long gaff goes deep, which is Ground country. Elements tell you WHO a bird
// beats; carriage would tell you WHERE it wins.
export const CARRIAGES = ["Ground", "Air"] as const;
export type Carriage = (typeof CARRIAGES)[number];

export const CARRIAGE_LABEL: Record<Carriage, string> = {
  Ground: "Ground (pang-baba — the shuffler, works low and drives)",
  Air: "Air (pang-itaas — the flyer, leaves its feet and comes over the top)",
};

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
// REBUILT round 20, PFL-true. The old figure scored each bird against its
// OPPONENT, which let a loser out-figure the winner of the same fight
// (Zane: "in PFL this wouldn't be possible"). PFL horses are timed against
// an invisible maxed-out GHOST, and the rest of the field is scored down
// from the winner by beaten lengths. Same shape here:
//
//  1. The WINNER's figure is absolute — its damage output per turn
//     (normalized by the blade, so figures compare across distances)
//     measured against GHOST_PACE, the pace a maxed-out bird sets.
//     Matching the ghost = GHOST_FIGURE (100). Typical starters ≈ 50.
//  2. The LOSER is scored DOWN from the winner by the finishing margin —
//     wind left, the fight's "beaten lengths." A narrow loss to a big
//     performance still figures well; a blowout does not.
//  3. ONE noise roll per fight, applied to both sides (PFL's track
//     variant), so the fog never reorders the result.
//
// Still deliberately coarse — banded, never decomposed by stat. The
// play-by-play carries the qualitative tell.
// One wrinkle the calibration run exposed: because every turn is decided by
// the DIFFERENCE between two rolls, two maxed-out birds trade exactly as
// much damage as two starters — raw pace alone carries no quality signal at
// all. So the figure also books the CLASS of the bird that was beaten,
// measured off the starter band. That's how graded-stakes figures work too:
// a strong field lifts everyone's number, and beating a monster is the
// whole point. The old "narrow loss to a monster figures well" property
// survives — the loser now inherits it through the winner's figure instead
// of leapfrogging it.
export const FIGURE = {
  // The pace a maxed-out ghost sets, per blade — tuned so an even fight
  // between STARTERS figures ~50 in every format (gaff fights run longer,
  // so their damage-per-turn is lower by nature; this is the normalizer).
  GHOST_PACE: { longKnife: 5.6, shortKnife: 5.2, longGaff: 4.0, shortGaff: 3.6 },
  GHOST_FIGURE: 100, //  what matching the ghost's pace scores
  CLASS_BASE: 320, //    the starter band's middle — class credit starts here
  CLASS_DIVISOR: 20, //  each 20 points of beaten-opponent average = +1 figure
  BEATEN_SCALE: 45, //   figure points subtracted across a full-margin loss
  MIN_BEATEN: 5, //      a loss is always at least one band below the win
  NOISE: 4, //           ± uniform, ONE roll per fight (the track variant)
  BAND: 5, //            displayed to the nearest 5
  MAX: 150, //           clamp range [0, MAX] — headroom for bred stock
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
  // The breed price ($2) — for now BOTH the minimum AND the maximum (ruled
  // 2026-08-03): player-set stud pricing comes later; today every cover
  // costs exactly this, and it SPLITS (see BREED_SPLIT below).
  BREED_FEE: 160,
  // Entries (winner takes the pooled pot = 2× entry):
  REAL_ENTRY_FEE: 40, //      $0.50 a side — CAREER record
  HARDCORE_ENTRY_FEE: 120, // $1.50 a side — and the loser's career (the key rule)
  JUVENILE_ENTRY_FEE: 8, //   $0.10 a side — AMATEUR record, discovery year
  // ROUND 23 — the gacha goes back UP to 80 GP, and stops being the cheap
  // way to fill a barn. Round 22 cut it to 16 so the bots would finally buy;
  // they did, and it worked so well that gacha out-supplied the breeding barn
  // 8 to 1. Zane's correction: "I want stables primarily breeding to create
  // birds. Human speculation and human high rollers and humans/bots that
  // desire the prizes will drive gatcha rolling." So the roll is a LUXURY
  // again — priced above what a body is worth, sold on the chance of stars.
  GACHA_ROLL_PRICE: 80, //   $1 a roll
  FREE_PULLS_PER_CHECK_IN: 1, // daily login bonus: ONE free gacha pull
  // The 11-for-800 bundle (round 23): ten rolls' money, eleven rolls. The
  // standard gacha multi-pull — it exists to give a high roller a reason to
  // commit a whole day's drip in one motion, and to make the bonus roll feel
  // like the house's gift rather than a discount.
  BUNDLE_ROLLS: 11,
  BUNDLE_PRICE: 800, // = DAILY_DRIP — one full day of income, in one pull
  // The world opens with juice already in the pot (ruled round 20): three
  // days of drip, so the first championships are worth entering before
  // breeding fees have had time to fill the pool. Printed once, at genesis,
  // like the starting purses — never again.
  SEED_JUICE: 2_400, // = DAILY_DRIP × 3
} as const;

// ── What flows into the Land Token staking pool (ruled round 22) ────────────
// Round 21's Staking tab measured the old economy honestly and it was thin:
// ten barns staked 10,627 LT and earned 55.96 GP across 35 days, because
// breed fees were the pool's ONLY inflow. Zane's intent here is a loop —
// more GP flowing to stakers makes LT worth holding, which makes players
// play FOR it. So every way GP changes hands now pays the landholders a
// slice. All shares are of the GROSS, computed in centi-GP.
//
// NOTE this reverses the standing zero-rake ruling on fights: the pot is no
// longer a pure 2× your entry. A 40 GP card now pays the winner 78.40, not
// 80.00. GP is still never printed and still conserves to the cent — the
// 1.60 moves to the staker pool instead of vanishing.
export const STAKER_FLOWS = {
  // ⚠ BACK TO ZERO (round 23). Round 22 put 2% of every pot into the pool and
  // it worked — too well: staking went from 56 GP a month to 3,657, and Zane
  // called it ("we are getting enough LT yield it seems"). So the daily card
  // is a PURE POT again — win +entry, lose −entry, exactly as round 16 ruled.
  // The plumbing stays wired at 0 so a future season can turn it back on with
  // one number instead of a rebuild.
  FIGHT_RAKE: 0,
  CLAIM_RAKE: 0.02, //     2% of every claiming tag — the owner banks 98%
  MARKET_RAKE: 0.02, //    the same rule, reserved for the marketplace (not built)
  GACHA_SHARE: 0.1, //     10% of paid gacha spend (the other 90% is juice)
  // Buying LT with GP pays the people already staking (round 22 fix): that
  // GP used to be DELETED — deducted from the wallet and routed nowhere,
  // which would have broken the conservation proof the first time anyone
  // bought land. It also offsets the dilution new supply hands existing
  // stakers. The whole payment goes to the pool.
  LAND_PURCHASE_SHARE: 1,
} as const;

// ── Land Tokens (the second currency — the subsidy, and one-way) ────────────
// Unconditional on the RESULT (win or lose pays the same) but scaled to the
// STAKES (re-ruled 2026-08-03): the award grows with the entry fee, and
// slightly MORE than linearly — fighting "up" into dearer, harder company
// pays disproportionately. landForFight() below is the curve. An unmatched
// entry (odd bird out) earns nothing — land is for FIGHTING, not queueing.
// Priced: $0.01 = 1 LT, i.e. 80 GP buys 100 LT. Buyable with GP up to a
// daily cap; NEVER sellable back — land only accumulates. STAKING IS LIVE
// (2026-08-03): one pool for now; staked LT earns a pro-rata share of every
// inflow in STAKER_FLOWS above — fight rake, claim rake, gacha share, breed
// cut and land purchases — distributed daily at the tick. (Multiple pools —
// breeding vs. arenas: later.)
export const LAND = {
  FEE_PER_TOKEN: 8, //        the linear base: 1 LT per 8 GP of entry fee…
  FIGHT_EXPONENT: 1.15, //    …raised past linear — the "fight up" incentive
  PER_GACHA_ROLL: 1,
  GP_PER_100_TOKENS: 80, // $1 buys 100 LT
  DAILY_BUY_CAP: 1000, //  max LT purchasable per farm per game-day ($10 worth)
} as const;

// The land curve: juvenile (8 GP) → 1 LT · real/claimer (40 GP) → 7 LT ·
// hardcore (120 GP) → 23 LT. Superlinear on purpose (7 > 5×1, 23 > 3×7·⅓).
export function landForFight(fee: number): number {
  return Math.max(1, Math.ceil(Math.pow(fee / LAND.FEE_PER_TOKEN, LAND.FIGHT_EXPONENT)));
}

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
  // How often a chick's CARRIAGE (round 23) follows the better-rated parent
  // rather than the other one. Higher than the element lean on purpose:
  // carriage is meant to be SELECTABLE — breed shufflers, get shufflers.
  CARRIAGE_LEAN_STRONGER: 0.75,
  // Bloodline restriction: how many generations up count as forbidden kin.
  // 3 = parents, grandparents, great-grandparents (siblings checked separately).
  ANCESTOR_DEPTH: 3,
  // Egg sex: 50-50 male/female, decided at breeding, HIDDEN until hatch.
  FEMALE_CHANCE: 0.5,
} as const;

// ── The breeding barn (ruled 2026-08-03 — breeding PvP out the gate) ────────
// Stud OWNERS LIST retired roosters; any farm's hen can then buy the cover.
// There is NO formula tying a stud's price to its record — stud price is
// player price-setting, speculation, supply vs. demand (Zane's ruling; the
// old win/loss studValue mechanic is deleted). For now the price is locked
// to BREED_FEE; player-set pricing comes later.
//
// Every cover fee SPLITS (ruled 2026-08-03): per 160 GP — 8 GP (5%) to the
// Land Token staking pool, and the other 152 split 50/50 between the fight-
// juice pool (future tournament subsidy) and the stud's owner. On the 160
// fee: 8.00 staker / 76.00 juice / 76.00 stud owner (see BREED_SPLIT just
// below — the 2.5% figure this comment used to quote was round 21's rate;
// round 22 doubled it). Splits are computed in CENTI-GP (integer hundredths)
// so the accounting stays exact — the staker pool's pro-rata payouts are
// where GP goes decimal.
export const BREED_SPLIT = {
  // Doubled round 22 (2.5% → 5%) as part of widening every LT inflow: on the
  // 160 fee that's 8.00 staker / 76.00 juice / 76.00 stud owner.
  STAKER_SHARE: 0.05, // → the single LT staking pool
  // The remainder splits evenly: fight juice / stud owner.
  JUICE_SHARE_OF_REST: 0.5,
} as const;

export const COVERS = {
  // THE FIRST LAND TOKEN SINK (ruled round 23). Standing a rooster at stud
  // costs LAND, not GP — 100 LT, spent, gone, not staked. Round 22 gave land
  // a strong yield but nowhere to be SPENT, which made its value purely
  // reflexive; a sink is what turns a yield into a price.
  //
  // Why THIS door: a stud is the best asset in the game. It earns on every
  // cover another farm buys, it makes the birds, and its own owner breeds
  // with it at roughly half price (the stud-owner share comes straight back).
  // A gate that desirable is worth paying land for — and it puts every barn
  // in the position of choosing between staking land for yield and spending
  // it to open an income stream. That's the decision a sink is FOR.
  STUD_LISTING_LT: 100,
  PER_WEEK: 14, //     public cover slots per rooster per game-week…
  OWNER_RESERVED: 2, // …plus these, reserved for the rooster's own farm.
  // The point of the cap: top studs sell out → their price can rise (later,
  // when pricing unlocks) → demand overflows into other studs.
} as const;

// ── Lobbies (re-ruled 2026-08-03: PURE PvP — the house supplies NOBODY) ─────
// Every fight is between barns. A lobby is one slot on tonight's card,
// keyed by (mode, class, format[, tag]): entering joins the open lobby for
// that key, or opens a fresh one when it's full. At the day tick every
// lobby goes off — its birds are RANDOMLY PAIRED and fight each other.
//
// Size is LOCKED at 8 (an even number): if a lobby fills, every bird in it
// is guaranteed a fight. A lobby that closes odd strands one bird — the
// odd bird out refunds its entry and earns nothing. That risk is accepted:
// it's up to the players to judge their birds' strength and pick where
// they should be fighting. Tournaments later = capacities of 16/32/64 run
// as back-to-back elimination brackets with separately engineered prizes.
export const LOBBY = {
  CAPACITY: 8,
} as const;

// The class dial. Entry restrictions self-sort the fields (no matchmaker):
// maidens take never-winners, win-caps take light records, claimers put a
// price on every bird entered.
export const LOBBIES = ["open", "maiden", "nw2", "nw3", "claimer"] as const;
export type Lobby = (typeof LOBBIES)[number];

// Claimers (re-ruled 2026-08-03): FARM-TO-FARM, escrowed, pre-fight.
// Enter a bird at a tag price; the entry sits on the public board for the
// rest of the game-day while OTHER farms place sealed claims; the card goes
// off on the day tick. The bird fights for its ORIGINAL owner (who keeps
// the pooled prize); a successful claimant receives the bird only AFTER
// the fight. Multiple claims → RNG picks one, the rest refund. The house
// never claims — bot farms with claim-heavy playstyles are the liquidity.
//
// The tag ladder brackets the 160 GP breed floor on purpose: two rungs
// below it (claim cheaper than breeding) and three above. It self-balances:
// a dear tag = safer from claims but dearer company and a real entry at
// risk; a cheap tag = claimable, but win-and-get-claimed is an income spike.
export const CLAIMER = {
  PRICES: [50, 100, 200, 400, 600], // $0.625 · $1.25 · $2.50 · $5 · $7.50
  // The DISCOVERY-YEAR ladder (round 23): juveniles get their own, cheaper
  // rungs. A one-year-old is an unproven animal — pricing it against the
  // grown-bird ladder would mean nobody dares tag one, and the whole point of
  // opening claimers in the juvenile season is to get birds CHANGING HANDS
  // while they're still a guess.
  JUVENILE_PRICES: [25, 50, 100], // $0.31 · $0.625 · $1.25
} as const;

// ── The Juvenile Championship (ruled round 23) ──────────────────────────────
// Zane: "Can we make the Juvenile schedule more interesting? I'd want maidens,
// claimers, stakes, and then a Juvenile Championship… Idea is to generate more
// fight revenue and allow deeper discovery by promoting laddering in the Juvi
// season."
//
// So the discovery year gets a full ladder of its own (maiden → stakes →
// claimer, gated on JUVENILE wins rather than stakes wins, since a juvenile
// has no stakes record by definition) and a stage to climb toward.
//
// TWO crowns, not three: one KNIFE and one GAFF, with the lengths rotating by
// week so a juvenile career sees every blade eventually. It runs the day
// BEFORE the Majors — the week builds to Thursday.
//
// ⚠ AND IT IS NOT HARDCORE. Every other championship in the game force-retires
// its losers; this one cannot. The discovery year exists to find out what a
// bird is, and ending careers at age one would destroy the very population the
// Majors are supposed to inherit. A juvenile crown costs a bird nothing but
// the fight.
export const JUVENILE_MAJOR = {
  DAY_OF_WEEK: 5, //     Wednesday — the day before the Majors
  JUICE_SHARE: 0.2, //   a fifth of the pool, split across the two crowns
  QUALIFYING_WINS: 2, // juvenile wins needed to stand — laddering, enforced
  MAX_PER_BARN: 2,
  MAX_BRACKET: 32,
  MIN_FIELD: 2,
  // The rotation: even weeks run the long blades, odd weeks the short ones.
  // One knife and one gaff either way.
  BLADES: [
    ["longKnife", "longGaff"],
    ["shortKnife", "shortGaff"],
  ],
  // Purse shares — flatter than the Majors on purpose. This is a discovery
  // stage, so spreading the money rewards showing up with a live one.
  PURSE_SHARES: { champion: 0.45, runnerUp: 0.25, sfLoser: 0.15 },
  // Land to the fallen, on the discovery year's much smaller scale. The
  // Majors' grants (40/25/15/10/5) are priced against a 200 GP stake and a
  // career-ending loss; a juvenile risks neither, so paying it Major money
  // would make the cheap crown the best land in the game.
  LAND_GRANTS: { champion: 1, runnerUp: 2, sf: 3, qf: 5, r16: 7, r32: 9 },
} as const;

// ── The Pintakasi (ruled 2026-08-03 round 18) — the weekly blade Majors ─────
// Every THURSDAY (moved off Wednesday in round 20 — the birds get one more
// ordinary card first), three championships — one per blade "distance", PFL-Majors
// style (Sprint/Gallop/Classic): Long Knife and Short Gaff always run, the
// middle blade ROTATES Short Knife / Long Gaff by week parity, so every
// blade gets crowns over time. Specialized-yet-strong birds are the point —
// no crown rewards a bird built to dominate every distance.
//
// The rules: hardcore throughout (every loser force-retires), age 3+, flat
// open-stakes entry, ONE DAY — the whole bracket runs back-to-back at the
// crown-day tick, winners healing to full between rounds (Zane's ruling:
// a game, not a simulation — nobody re-registers day after day). Committee-
// seeded bracket (1v16, 8v9…) from earnings → wins → avg figure; byes to
// the top seeds; barn-mates can draw each other — so be it. Field scales
// with the population: next power of two, 64 max, overflow live-bumps the
// weakest entrant (the Selection Committee's other job).
//
// The money: GP to the TOP (purse = the week's juice-pool share; first-round
// losers take zero), LAND to the FALLEN (fights mint on a steeper curve than
// the daily card, and elimination grants pay the earliest-eliminated the
// most — the winner takes the money, the dead take the land, so a first-round
// hardcore death is never a pure loss).
//
// ROUND 22 — THE CROWNS GO FREE. Zane: "In PFL they are actually free-entry
// and just require qualification points… I don't think they should be the
// highest-cost entry in the game at all." So the 200 GP entry is gone and
// you QUALIFY BY FIGHTING instead: every win on the daily card banks crown
// points (see POINTS_FOR), and a bird needs QUALIFYING_POINTS of them to
// stand in a championship. Two things follow. (1) The purse is now PURE
// JUICE — which means gacha spend and breed fees fund the crowns, so the
// round-22 flows feed the biggest stage in the game. (2) The Selection
// Committee ranks on POINTS first, so the bump line rewards the bird that
// campaigned hardest, not the barn with the deepest wallet.
export const PINTAKASI = {
  ENTRY_FEE: 0, //    FREE — qualification is earned in the pit, not bought
  // What a win on the daily card banks toward a crown. The discovery year
  // is practice and pays nothing; hardcore pays double because the bird
  // wagered its career to earn it. Losses bank nothing.
  POINTS_FOR: { juvenile: 0, real: 1, hardcore: 2 } as Record<string, number>,
  // What it takes to stand in a championship. Three real wins, or two
  // hardcores — a few weeks of honest campaigning for a bird that turns 3.
  QUALIFYING_POINTS: 3,
  MAX_BRACKET: 64,
  // Which day the crowns run. dayIndex % 7: 0 = Friday (day 0 of the game
  // week) … 5 = Wednesday, 6 = THURSDAY. Moved Wed → Thu in round 20 so a
  // bird can take one more ordinary card before its championship.
  DAY_OF_WEEK: 6,
  // How many birds one barn may enter in ONE championship (ruled round 20).
  // Not one per stable — a deep barn should be able to load a blade with
  // three specialists, and the fields should start OVERFLOWING.
  MAX_PER_BARN: 3,
  MIN_FIELD: 2, //    a straight final still crowns; below this, cancelled
  LAND_EXPONENT: 1.25, // vs. LAND.FIGHT_EXPONENT 1.15 — the Majors mint hard
  // What the crown land curve is measured against. It used to be the entry
  // fee, but round 22 made entry free — and landForTournamentFight(0) mints
  // 1 LT, which would have quietly gutted "land to the fallen" from 40 LT a
  // fight to 1. So the basis is now its own number: the old 200 GP entry,
  // held as the STAKE the crowns represent rather than a price anyone pays.
  LAND_BASIS: 200,
  // GP purse shares by FINISHING STAGE. First-round losers are zeroed
  // whatever stage they fell at, and the remaining shares renormalize —
  // so an 8-bracket pays champion/runner-up/SF only, and a straight final
  // pays the champion everything. Rounding dust goes to the champion.
  PURSE_SHARES: {
    champion: 0.5,
    runnerUp: 0.2,
    sfLoser: 0.1, //  each (×2)
    qfLoser: 0.025, // each (×4)
  },
  // LT grants by ELIMINATION STAGE — the fallen-weighted inversion.
  // Keyed by "rounds from the final" at elimination (champion included).
  LAND_GRANTS: {
    champion: 5,
    runnerUp: 10,
    sf: 15,
    qf: 25,
    r16: 40,
    r32: 55,
    r64: 70,
  },
  // The week's three blades: the anchors always run, MIDDLE[week % 2] joins.
  ANCHORS: ["longKnife", "shortGaff"],
  MIDDLE: ["shortKnife", "longGaff"],
} as const;

// The Majors' land curve — same shape as landForFight, steeper exponent.
// On the 200 GP entry: (200/8)^1.25 ≈ 56 LT per fighter per fight.
export function landForTournamentFight(fee: number): number {
  return Math.max(1, Math.ceil(Math.pow(fee / LAND.FEE_PER_TOKEN, PINTAKASI.LAND_EXPONENT)));
}

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

// NOTE: there is deliberately NO training mechanic (ruled 2026-08-03 round
// 13): a bird's stats are FIXED AT BIRTH — the game is discovering what it's
// good at and using it well. PFL-style aging curves (peak form mid-career)
// are a possible future layer, not a stat-raiser.

// ── Barn ────────────────────────────────────────────────────────────────────
export const BARN = {
  CAPACITY: 100, // max birds + eggs; breeding is blocked when full
} as const;

// ── Gacha (pure rarity tokens — correspond to nothing yet) ──────────────────
export const GACHA_TOKENS = ["White", "Green", "Blue", "Purple", "Gold"] as const;
export type GachaToken = (typeof GACHA_TOKENS)[number];

// Drop weights out of 100 rolls (tuned round 14 — eggs were out-producing
// breeding: 2 free pulls/day × a 23% egg rate ≈ 3.2 eggs/farm/week vs. the
// nest rule's ~1/hen/week; "Mystery Egg (Blue) VIII" in the feed was the
// tell). Now ~16 eggs per 100 rolls. What the item tokens DO comes later.
export const GACHA_WEIGHTS: Record<GachaToken, number> = {
  White: 55,
  Green: 29,
  Blue: 10,
  Purple: 5,
  Gold: 1,
};

// ── Gacha birds (Zane leaning yes, 2026-08-02 — built config-gated) ─────────
// Blue/Purple/Gold rolls ALSO drop a MYSTERY EGG: random element, hidden
// 50-50 sex, no parents, hatches next Hatch Friday like any egg. This is the
// non-breeding bird faucet — the way a stable fills fast and finds elements
// its barn doesn't carry. Delete a tier here to turn its eggs off.
//
// CONSTRAINED round 14 (Zane's ruling): gacha birds must NOT out-muscle the
// bred stock. No tier's statMax exceeds the starter ceiling (400) by more
// than a whisker — the old Gold tier (350–700) strictly dominated anything
// gen-1 breeding could make. The jackpot is now STARS (breeding material),
// never raw stats: breeding stays the only way up the stat ladder.
// ROUND 23 — BLUE NO LONGER DROPS A BIRD. Blue was the volume tier (10 rolls
// in 100 against Purple's 5 and Gold's 1), and its egg was a sub-starter body
// nobody wanted — exactly the "gacha fills the barn" pressure Zane is pulling
// back. Eggs now come only from Purple and Gold, where the draw is the STARS.
// That also halves the egg rate (16 per 100 rolls → 6), which is the point:
// breeding makes the birds, the gacha makes the bloodline material.
export const GACHA_BIRDS: Partial<
  Record<GachaToken, { halfStars: [min: number, max: number]; statMin: number; statMax: number }>
> = {
  Purple: { halfStars: [4, 6], statMin: 250, statMax: 400 }, // 2.0–3.0★ — real breeding material
  Gold: { halfStars: [6, 8], statMin: 300, statMax: 450 }, //   3.0–4.0★ — the jackpot, and it's STARS
};

// ── Coats (round 14 — appearance v0: base coat + element-tinted trim) ───────
// Every bird gets a base coat and a trim color at creation, so birds are
// distinguishable by something besides their names. Trim colors come in two
// per element, loosely keyed to the element itself. Placeholder genetics:
// a bred chick takes a parent's base coat (small mutation chance); proper
// coat-breeding mechanics are a later, deliberate redo.
export const BASE_COATS = ["Grey", "Brown", "Cream"] as const;
export type BaseCoat = (typeof BASE_COATS)[number];

export const TRIM_BY_ELEMENT: Record<Element, [string, string]> = {
  Fire: ["Red", "Orange"],
  Water: ["Blue", "Light Blue"],
  Wood: ["Chestnut", "Green"],
  Earth: ["Dark Brown", "Black"],
  Metal: ["Silver", "Yellow"],
};

// Coat mutation: chance a bred chick's base coat ignores both parents.
export const COAT_MUTATION_CHANCE = 0.1;
