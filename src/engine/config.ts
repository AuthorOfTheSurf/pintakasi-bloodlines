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

// ── Simulation ─────────────────────────────────────────────────────────────
// A thirteen-week run lets the population pass the cold-start burst, cycle
// multiple generations through the nest, and show whether hardcore attrition
// is sustainable. Short smoke runs can still pass an explicit day count.
export const SIMULATION = {
  DEFAULT_DAYS: 91,
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
// Four DISTANCE stats (all four join every roll, weighted per blade by
// FORMATS[].weights — that's the "distance" dial, re-ruled round 27) + two
// BEHAVIORAL anchors that matter in every format but define none.
export const STAT_NAMES = [
  "agility", //   [distance · PFL Start]   the break — keys B1; the burst that wins short fights
  "sight", //     [distance · PFL Speed]   accuracy in a sustained trade — keys B2
  "stamina", //   [distance · PFL Stamina] the FUEL TANK (BATTLE.FUEL) plus its own weight — keys B4
  "gameness", //  [distance · PFL Finish]  deep-water grit — keys B5, never walls; low gameness birds can RUN when hurt
  "station", //   [anchor   · PFL Heart]   the rivalry modifier — clutch boost when outmatched; the underdog's path to upsets
  "condition", // [anchor   · PFL Temper]  the RNG stabilizer — high = fights at 95-100% of book; low = ugly off-days
] as const;
export type StatName = (typeof STAT_NAMES)[number];

/**
 * The four distance stats, in dial order — the axis FORMATS[].weights runs
 * along, sprint end first. Spelled out rather than sliced off STAT_NAMES
 * because a tuple type is what the shape arithmetic below needs; `satisfies`
 * keeps it honest against StatName, and docs.test.ts pins it against both
 * STAT_NAMES' first four and the weight matrix's own keys, so the two cannot
 * drift apart in silence.
 */
export const DISTANCE_STATS = ["agility", "sight", "stamina", "gameness"] as const satisfies
  readonly StatName[];
export type DistanceStat = (typeof DISTANCE_STATS)[number];

/**
 * THE THREE BREEDING SHAPES (ruled 2026-08-06) — the ADJACENT pairs on the
 * distance dial: agility & sight, sight & stamina, stamina & gameness.
 *
 * Derived from the dial order, never listed, so a re-ordering of the axis
 * moves the shapes with it. Why adjacent pairs and not any two stats: the
 * `pairs` balance case measured it. A bird carrying a grade step on two
 * NEIGHBOURING stats is strong at both blades those stats key and still
 * clearly ahead of a flat bird in the middle — one plan, two homes, and a
 * FLOOR (never below ~62% against flat at any blade, where a single spike
 * drops to ~55% at the blade it guessed wrong). Under round 28's fog, where
 * nobody knows what a chick is until it has fought, that floor is what a
 * breeder actually owns.
 *
 * These are the shapes the bots breed toward (BREEDING_PLAN in bot-config).
 * Zane's ruling: aim for a pair, THEN chase station, condition and element
 * stars on top. More advanced plans can come later — the point of this one
 * is that a flock bred for level alone has no shape for anyone to discover,
 * and round 29 measured exactly that (median home-blade margin: 11 points).
 */
export const BREEDING_SHAPES = DISTANCE_STATS.slice(0, 3).map((stat, i) => ({
  pair: [stat, DISTANCE_STATS[i + 1]] as [DistanceStat, DistanceStat],
  off: DISTANCE_STATS.filter((s) => s !== stat && s !== DISTANCE_STATS[i + 1]) as DistanceStat[],
}));

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
// Water beats Fire. Worth a real but beatable edge (BATTLE.ELEMENT_EDGE —
// about 64% between two otherwise equal birds), so the matchup is something
// you play for and not something you lose to.
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
  // The bonus CEILING on a turn's roll when your element matches the day's
  // ascendant element — like ELEMENT_EDGE, scaled by the bird's stars
  // (× halfStars/10) since the 2026-08-04 stars rework: the day only speaks
  // as loudly as the bird's element does. Boost-only on purpose — no
  // predator penalty — to keep it soft; a hindrance for the element that
  // beats the ascendant is a tunable later.
  //
  // History: shipped at a flat +1 "because +1 on 2d6 only nudges" — wrong,
  // it measured 50%→76% between equals, the single most decisive term in
  // the fight. Round 24 cut it to a flat 0.25 (50%→57%, and Pit Figure
  // inflation inside the ±NOISE fog instead of two full bands over it).
  // The lesson, twice now: read every flat modifier against ROLL_DIVISOR
  // (what a whole stat block adds to a roll), never against the dice.
  //
  // 0.5 as the star-scaled ceiling keeps the DELIVERED value at or below
  // round 24's ruling for nearly the whole ladder: a 2.5★ bird gets
  // exactly the old 0.25, only a 5.0★ bird doubles it, and day-one stock
  // (≤1.5★) feels the weather as a whisper. Still exactly half of
  // ELEMENT_EDGE, the ratio docs.test.ts pins.
  EDGE: 0.5,
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
// REWORKED 2026-08-04 (Zane's ruling — this was the declared intent all
// along): stars no longer add stat points. A star is an AMPLIFIER on the
// bird's element: every element/weather edge is scaled by halfStars/10, so
// 5.0★ = the full edge, 0.5★ = a twentieth of it, 0★ = the element is
// decorative. Two things the old flat boost got wrong, both measured:
//   · Math.floor(halfStars/2) threw every half-step away — 0.5★ was
//     bit-identical to 0★, half the ladder did nothing
//   · 5 full stars were worth +0.25 on a roll (one weather day) AND the
//     boost inflated the bird's total, which tripped the old underdog gate
//     and made a 5★ bird measure WORSE than a 0★ twin (33-41%)
// Now stars are exactly one thing: how loudly the bird's element plays.
// Every half-step is real (10 distinct rungs), and a star bird without a
// favorable matchup gets nothing — stars reward PLAYING the wheel.
export const STARS = {
  MAX_HALF_STARS: 10, // 10 half-stars = 5.0★, the max
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
// ENUMERATED B1..B4 (re-ruled 2026-08-04). Zane: rather than knife/gaff names
// as identity, blades are an ordered SPECTRUM, like PFL's nine race distances
// — because the plan is an ODD count (5, maybe 7) where the MIDDLE blade
// weighs every stat evenly and tuning works outward from that midpoint. B1 is
// the sprint end (shortest fights), B4 the marathon end; a future B5 slots in
// and the midpoint moves to B3. The sabong flavor survives in `flavor` — the
// weapon is still a 4.5″ slasher, it just isn't the KEY anymore.
//
// ROUND 27 — THE WEIGHT MATRIX replaces the absolute phase windows. Every
// turn roll now blends ALL FOUR distance stats by the blade's `weights`
// (each row sums to 1), instead of one phase stat owning a window of turns.
// Zane's PFL model, translated: Agility=Start keys B1, Sight=Speed keys B2,
// B3 weighs everything EQUALLY (the flat bird's home — the whole reason the
// dial got an odd count), Stamina keys B4, Gameness=Finish keys B5. Every
// stat carries SOME weight on EVERY blade — the old windows made gameness
// structurally dead on B1 (its phase started at turn 11, the blade capped at
// 5) and made agility 40% of a B1 but 7% of a B4, which is why three of four
// blades missed their intent in the round-26 lab. The matrix is symmetric on
// purpose: agility's column read B1→B5 mirrors gameness's read B5→B1, and
// sight's mirrors stamina's — tune one end, the other end is the mirror.
// Stamina ALSO owns the fuel wall (BATTLE.FUEL), which is why its direct
// weights can stay modest and still key B4: the wall pays it extra on the
// long blades and nothing on the short ones.
//
// `statScale` is the second half of the round-27 rework: the LOUDNESS dial.
// A long fight samples the same stat gap dozens of times, so the better bird
// converges — the identical +100 grade step measured 69% on B1 but 89% on B5
// before this knob existed. statScale multiplies EVERYTHING the bird brings
// to a roll (the weighted blend, the station clawback, the deep-water
// gameness bonus, and both element edges) so that fewer rolls hear a louder
// signal: one grade of breeding buys ROUGHLY THE SAME win rate at every
// distance, per Zane's targets (~80% for +100, ~98% for +200), and a 5★
// matchup is worth roughly the same fight-level edge everywhere too. Tuned
// at B3 = 1.0 (the middle is the reference, by the round-27 philosophy:
// tune the midpoint, work outward). The knives keep their swing — that
// identity lives in damageMult/critMult, not here.
//
// Knife-end blades are SWINGY, gaff-end blades are true tests — though the
// crit lab case showed that story is only half true: B2 flips the most
// fights (15%), because turn count multiplies crit exposure faster than the
// multiplier shrinks.
export const FORMATS = {
  b1: {
    label: "B1",
    flavor: "Long Knife — 4.5″ Filipino Slasher, the sprint",
    maxTurns: 5, //          fights end in the opening frames
    damageMult: 13, //       one clean hit takes a big bite of 100 wind
    critMult: 2.5, //        a Tari Strike here is usually the fight
    weights: { agility: 0.5, sight: 0.3, stamina: 0.12, gameness: 0.08 },
    statScale: 1.5, //       5 turns hear the least evidence — loudest stats
  },
  b2: {
    label: "B2",
    flavor: "Short Knife — 2.5″ Mexican Slasher, the hybrid",
    maxTurns: 12, //          tactical pacing; consistent hit output wins
    damageMult: 7,
    critMult: 2.0,
    weights: { agility: 0.25, sight: 0.45, stamina: 0.18, gameness: 0.12 },
    statScale: 1.15,
  },
  b3: {
    label: "B3",
    flavor: "Long Gaff — 2½″ Long Spur, the route",
    maxTurns: 20, //        the dial's exact middle — every stat weighs the same
    damageMult: 4.5,
    critMult: 1.3,
    // Slightly under-weighting stamina/gameness is what MAKES B3 even: those
    // two carry side routes (the fuel wall; the morale check and deep-water
    // bonus), so equal weights measured them ~4 points louder than
    // agility/sight. The lab's sensitivity case is the referee of "even",
    // not this row's cosmetics.
    weights: { agility: 0.29, sight: 0.29, stamina: 0.21, gameness: 0.21 },
    statScale: 1.0, //       the reference point of the whole dial
  },
  b4: {
    label: "B4",
    flavor: "Short Gaff — 1″ Short Heel, the marathon",
    maxTurns: 30, //         attrition; the fuel wall starts deciding fights
    damageMult: 3,
    critMult: 1.1,
    weights: { agility: 0.15, sight: 0.2, stamina: 0.4, gameness: 0.25 },
    statScale: 0.9,
  },
  // B5 (ruled 2026-08-04, round 27): the fifth blade the enumeration was FOR.
  // The dial now has a true middle — B3 — and the odd count Zane asked for.
  // In sabong terms the shortest heel of all: the shorter the gaff, the less
  // each puncture does and the deeper the fight goes. This is the deep-water
  // classic — the longest test in the game, where stamina and gameness are
  // everything and a sprint bird drowns.
  b5: {
    label: "B5",
    flavor: "Needle Gaff — ⅝″ heel, the deep-water classic",
    maxTurns: 45, //         the ultra-stayer's test; nobody sprints for 45 turns
    damageMult: 2,
    critMult: 1.05,
    weights: { agility: 0.1, sight: 0.15, stamina: 0.25, gameness: 0.5 },
    statScale: 0.8, //       45 turns of evidence — quietest stats, same verdict
  },
} as const;
export type FightFormat = keyof typeof FORMATS;
export const FORMAT_NAMES = Object.keys(FORMATS) as FightFormat[];

// ── Fight phases — NARRATION ONLY since round 27 ────────────────────────────
// These used to be the distance curve itself: absolute windows where one stat
// owned the roll (agility 1–2, sight 3–10, gameness 11+). The weight matrix
// (FORMATS[].weights) replaced that — every stat rolls on every turn now —
// but the play-by-play still names the stretch of the fight it's narrating:
// "the break", "the open", "deep water". Kept because the story of a fight
// having chapters is true even when the math no longer switches stats.
export const PHASES = {
  BREAK_THROUGH_TURN: 2,
  OPEN_THROUGH_TURN: 10,
} as const;

// ── Battle (2d6) ────────────────────────────────────────────────────────────
export const BATTLE = {
  // "Wind" is the fight's HP pool — UNIFORM at 100 for every bird since
  // round 27 (Zane: "I'd make HP uniform across all birds (e.g. 100 HP), and
  // then build the stats from there"). Stamina used to buy hit points here,
  // which quietly made it a defense stat; now a bird's toughness is the same
  // everywhere and stamina's whole job is the FUEL tank below. Uniform wind
  // also makes "beaten lengths" (wind left at the end) mean the same thing
  // in every fight, which the Pit Figure math leans on.
  WIND: 100,
  // THE FUEL TANK (round 27) — stamina's real job, Zane's PFL theory made
  // mechanical: there is a hidden gas resource, and when it runs out the
  // bird HITS THE WALL. A bird fights at full book for
  //   FUEL.BASE_TURNS + stamina × FUEL.TURNS_PER_STAMINA
  // turns; every turn after that, its agility and sight deliver only
  // WALL_FACTOR of themselves. Gameness never walls — grit is mental, and
  // the blown bird "running on heart" is the whole deep-water story.
  // The dial does the rest for free: a B1 bout (5 turns) ends before ANY
  // tank empties, so stamina is nearly decorative there by construction; at
  // B4/B5 the wall decides who is still fighting at book when it matters.
  // A starter (~350) carries ~13 turns of fuel; a 2000-stamina monster ~36 —
  // which still blows before a 45-turn B5 ends, so the deep water tests
  // heart in EVERY bout, by design.
  FUEL: {
    BASE_TURNS: 8,
    TURNS_PER_STAMINA: 0.014,
    WALL_FACTOR: 0.5,
  },
  // Turn roll = 2d6 + stat/ROLL_DIVISOR.
  //
  // RE-RULED 400 → 85 (2026-08-04, the grade-target tuning). At 400 a whole
  // grade of breeding (+100 on every stat) was worth +0.25 on a roll and won
  // only 56-67% — against Zane's targets of ~80% for one grade and ~98% for
  // two. Breeding is the whole progression; the dice were louder than a
  // generation of work. (The original rationale also leaned on grade being
  // readable pre-fight — round 28's fog ended that, but the targets stand:
  // a bred generation must WIN more, visibly, in the figures, or discovery
  // has nothing to discover.)
  //
  // 85 was picked AT THE MIDDLE OF THE BLADE DIAL, per Zane's tuning
  // philosophy (tune the midpoint, work outward): on B3, +100 measures
  // ~84% and +200 ~97% — both inside a few points of target. The blade-end
  // deviation this note used to carry (±10 points, turn count amplifying
  // stats) was CLOSED by round 27's per-blade statScale: the ends now sit
  // within a point or two of the middle (B1 76 / B5 85 at +100), with only
  // B1's +200 still short (92 vs 98 — five turns of dice have a variance
  // floor no knob clears; the sprint stays the upset blade, recorded in
  // BALANCE.md). Note the station clawback is DEFINED via ROLL_DIVISOR
  // (a fraction of the gap's roll value), so this retune could not
  // reintroduce the inversion it was measured against.
  ROLL_DIVISOR: 85,
  // The element edge — now a CEILING, not a constant (re-ruled 2026-08-04
  // with the stars rework). A bird with the wheel advantage adds
  //   ELEMENT_EDGE × (halfStars / 10)
  // to every roll: a 5★ bird gets the full value, a 0★ bird gets nothing.
  //
  // History of the number, because it keeps teaching the same lesson: it
  // shipped at a flat +1 ("a slight edge only") which measured 76% between
  // equal 350-stat birds — a verdict, not an edge — and round 24's review
  // cut it to a flat 0.5 (64%). The trap both times was reading it against
  // the DICE (+1 sounds like half a die) instead of against ROLL_DIVISOR —
  // every flat modifier must be judged against what a whole stat block adds
  // to a roll, which is a handful of tenths.
  //
  // Since round 27 the delivered edge is ALSO scaled by the blade's
  // statScale, like every other thing the bird brings — so a matchup is
  // worth roughly the same fight-level edge at every distance instead of
  // compounding on the long blades (the round-26 watch item where 5★ wheel
  // + weather stacked to 95.8% on the marathon).
  //
  // With stars scaling it, 1.0 is safe as the ceiling precisely BECAUSE it
  // is rare: only a 5.0★ bird at a favorable matchup ever sees the full +1
  // (~76% between equals — the "Maximum elemental advantage" Zane asked 5★
  // to mean), a 2.5★ bird gets round 24's 0.5, and day-one stock (≤1.5★)
  // plays for tenths. The delivered edge across a real population sits far
  // below the ceiling; the lab's `elements` and `stars` cases are the
  // check that this stays true. Still exactly 2x WEATHER.EDGE — the
  // relationship the Handbook states and docs.test.ts pins.
  ELEMENT_EDGE: 1.0,
  // Station — the rivalry stat, REBUILT from a gate into a slope (re-ruled
  // 2026-08-04, the balance lab's headline finding). It used to be binary:
  // opponent total ≥ 1.1× yours flipped a flag, and the flag paid your FULL
  // station/400 on every roll. Measured, that inverted the grade ladder — a
  // bird +100 better on every stat LOST 59-67% of the time, because the
  // +100 lead is worth +0.25 on a roll while the weaker bird's station paid
  // ~0.88 × form. Breeding, the game's whole progression, pointed backwards.
  // It also carved two invisible cliffs: station 159→160 switched your own
  // bonus OFF (-16 points of win rate for one stat point), and past 560 you
  // switched the OPPONENT'S on.
  //
  // Now station claws back a FRACTION OF THE GAP ITSELF: the outmatched
  // bird's bonus per roll is
  //   (station / 2000) × UNDERDOG_CLAWBACK × (statDeficit / 6 / ROLL_DIVISOR)
  // i.e. full station at max claws back half the per-roll value of the
  // deficit. The deficit compares FIGHTING totals — station itself is
  // excluded from both sides, because heart is not class: counted in, more
  // station shrank the bird's own measured deficit and the stat cancelled
  // itself. Four properties the old gate lacked, all load-bearing:
  //   · capped BELOW the gap — a superior bird of the same shape is ALWAYS
  //     still favored (Zane: "otherwise there's no point in breeding")
  //   · smooth from zero — no thresholds, so no cliffs
  //   · more station is never worse, at any opponent
  //   · defined relative to the gap's own roll value, so retuning
  //     ROLL_DIVISOR can never reintroduce the inversion
  // At parity station still does nothing — that stays true until the Crowd
  // Noise mechanic gives station its per-fight stage role (planned).
  UNDERDOG_CLAWBACK: 0.5,
  // Gameness — the deep-fight anchor: below QUIT_WIND_FRACTION of max wind,
  // gameness/GAMENESS_DIVISOR joins every roll… and ONCE per fight the hurt
  // bird checks morale: quit chance = QUIT_BASE_CHANCE × (1 − gameness/2000).
  // A 300-gameness bird runs ~42% of the time it gets badly hurt. Marathon
  // formats are where this stat is the whole game.
  QUIT_WIND_FRACTION: 0.25,
  QUIT_BASE_CHANCE: 0.5,
  GAMENESS_DIVISOR: 400,
  // Condition — the Temper analog (re-ruled 2026-08-04; the lab caught the
  // old comment lying). Each turn each bird rolls its "form" in [floor, 1.0]
  // where floor = WORST_FORM + FORM_RANGE × (condition/2000). At 2000 the
  // floor is 0.95 (never an off-turn); at 300 it's ~0.61 (some turns arrive
  // badly).
  //
  // The old comment called this "a variance buffer" that "only ever hurts"
  // when low. Measured, condition BOOSTS: a favourite gains 4-9 points of
  // win rate across the condition range, because a higher floor raises the
  // MEAN form, not just the worst case — every stat-derived term in the
  // roll (phase stat, station clawback, gameness bonus) delivers more of
  // its book more often. Zane ruled the boost intended: condition is the
  // wildcard stat, PFL-Temper-style — it targets no distance, it makes
  // everything the bird already is arrive more reliably, and a condition
  // advantage can offset a stat weakness without replacing it. It also
  // lifts the Pit Figure (~15 points across the range between identical
  // birds): accepted, because the figure reports PERFORMANCE and a
  // consistent bird genuinely performs better — that is form, in the
  // racing sense, showing in the form book.
  WORST_FORM: 0.55,
  FORM_RANGE: 0.4,
} as const;

// ── Pit Figure (the Fleet-Figure analog — every fight pays out signal) ──────
// REBUILT round 30 — the figure finally has a UNIT.
//
// THE DIAGNOSIS (Zane, 2026-08-06): "Scientifically I think we are missing a
// piece. Going in the direction of DPS vs. a fixed target dummy was the right
// call, but somehow better defining what it's supposed to be should help us
// design and tune it."
//
// He was right, and the missing piece was the unit. In PFL a figure is
// anchored to something physical — seconds at 8 furlongs — and that one fact
// does all the work: a grade step is 1.0 second, so a grade step is a fixed
// number of figure points forever, and the scale cannot drift because the
// clock cannot drift.
//
// Rounds 20–29 only LOOKED like that. `pace / GHOST_PACE × 100` reads as
// "percent of a maxed bird", but `pace` was wind DEALT, and how much wind you
// deal depends on who you were fighting. So it was never measured against a
// fixed thing at all, and it showed twice:
//   · it DRIFTED — round 27 rescaled the wind pools and every figure in the
//     game moved ~20 points, silently, because nothing pinned it
//   · we already patched around it — CLASS_BASE/CLASS_DIVISOR existed only
//     because pace lost the quality signal (every turn rolls on the
//     DIFFERENCE between two books, so two maxed birds trade exactly as much
//     wind as two starters, and pace alone cannot tell them apart)
// The ghost was never a bird. It was a divisor named after one.
//
// THE REBUILD — spine × night:
//
//  1. THE SPINE is absolute and dice-free: the bird's weighted stat blend at
//     this blade, on a fixed scale. PEG_STAT flat = PEG_FIGURE at every
//     blade. Nothing in it depends on the opponent, the wind pool, damageMult
//     or ROLL_DIVISOR, so no future combat rebalance can move the scale
//     again. This is the target dummy, taken seriously: a dummy with no
//     defence and no dice, which is the only kind whose reading never drifts.
//
//  2. THE NIGHT modulates it — what the bird actually brought tonight,
//     measured as the ratio of the roll bonus it really rolled to the bonus a
//     NOMINAL_CONDITION bird would have rolled. That captures condition
//     (form is drawn fresh every turn), the element wheel, the day's weather,
//     station's clawback and — the good one — the FUEL WALL: a bird that
//     blows its tank spends the rest of the fight delivering WALL_FACTOR of
//     its speed stats, and now that shows in its number. The dice are
//     deliberately NOT in here; they are what the track variant is for.
//
//  3. A LOSS is marked down by beaten lengths, as a SHARE rather than a flat
//     subtraction, so the mark-down means the same thing at every level.
//
//  4. ONE noise roll per fight, applied to both sides (PFL's track variant),
//     so the fog never reorders the result.
//
// WHAT FALLS OUT FOR FREE, and this is the happy part: every format's weight
// matrix sums to exactly 1.00, so a FLAT bird blends identically at all five
// blades — cross-blade comparability by construction, with no hand-tuned
// per-blade table to go stale. And a SHAPED bird's blade fit becomes
// MULTIPLICATIVE without a fit term being written at all: an agility/sight
// bird carrying +200 on its pair blends 1120 at B1 against 900 at B5, a 24%
// swing. Round 29 measured the old additive fit signal shrinking as birds
// improved (11.9 points at B+ down to 3.5 at S+, against ±4 of fog) — that
// was the bug, and a proportional signal is the fix: the better the bird, the
// louder its shape. Ruled 2026-08-06 at ~25%, and MEASURED after the rebuild
// on a true specialist (pair +200, off-pair −200) at five levels:
//
//   base   B1     B2     B3     B4     B5    home−middle   home−worst
//    320  37.0   32.0   25.8   16.3   13.2       11.2         23.8
//    500  54.7   49.4   43.1   31.1   27.1       11.6         27.6
//    800  84.5   79.6   74.0   58.8   53.7       10.5         30.8
//   1200 127.7  122.2  118.0  103.0   95.7        9.6         32.0
//   1600 175.7  170.8  168.2  153.0  147.6        7.5         28.2
//
// Home−middle now holds near 10 at EVERY level instead of collapsing, and
// home−worst GROWS with the bird. Against the ±NOISE fog of 4 that is a
// signal a scout can actually read on a good bird, which is the thing the old
// figure stopped being able to do.

//
// Still deliberately coarse — banded, never decomposed by stat. The
// play-by-play carries the qualitative tell.
//
// ONE ACCEPTED CONSEQUENCE: the figure now tracks a bird's distance-stat
// average closely, and Overall grade is already public (the one exception to
// round 28's fog). So the figure does not leak much that a player could not
// already see — but the two disagree in a useful way, because the blend
// EXCLUDES station and condition. A bird whose figures run below its grade is
// carrying its weight in the anchors. That is a read worth having, not a leak.
export const FIGURE = {
  // The peg. A flat PEG_STAT bird posts PEG_FIGURE at every blade, and
  // because the spine is linear in the blend, a letter grade (100 stat
  // points, see grades.ts) is worth exactly 10 figure points EVERYWHERE on
  // the ladder — Zane's PFL analogy, where a grade is a fixed 1.0 seconds at
  // 8 furlongs, made literally true.
  //
  // PEG_STAT is 1000 because that is the top of the letter ladder (O+) and
  // the middle of the raw 0–2000 stat scale: "get the middle right and then
  // extend outwards." Today's starters (~320) therefore post ~32, which is
  // roughly where live figures already sat — so the rebuild re-centres the
  // MEANING of the scale without yanking every number players have seen.
  // There is no upper clamp any more (ruled 2026-08-06: "let's forget about
  // the 0–150 range, I don't think it's helpful to cap pit figures like
  // this"). A bred monster posting 140 should read 140.
  //
  // ⚠ MEASURED at build time, 600 fights per cell. Two identical flat-1000
  // birds at B3: the WINNER posts 102.8, the loser 81.6 (beaten lengths),
  // mean 92.1. So read PEG_FIGURE as "what a flat PEG_STAT bird posts when it
  // wins" — the peg is on the number, not near it. Flat 320 (today's
  // starters) reads 25.2 mean, flat 1500 reads 153.1.
  PEG_STAT: 1000,
  PEG_FIGURE: 100,
  // The condition the night multiplier is measured against — the form a
  // PEG_STAT bird brings. Derived into a form factor in fight-sim from
  // BATTLE.WORST_FORM/FORM_RANGE rather than typed here, so a change to the
  // form curve moves the reference with it instead of silently rebasing
  // every figure in the game. That is exactly the drift that made this
  // rebuild necessary.
  NOMINAL_CONDITION: 1000,
  // How far the night is allowed to move a bird off its spine, either way.
  // 0.25 is sized to sit just above the ~24% blade-fit swing: a bird can
  // out-figure its own class by having a great night, which is what makes a
  // figure a PERFORMANCE and not a stat read-out, but it cannot routinely
  // out-figure a bird a full blade-fit better. Raise it and the scout goes
  // blind; drop it to 0 and the figure becomes the sheet, decoded in three
  // fights.
  NIGHT_RANGE: 0.25,
  // Beaten lengths, as a SHARE of the loser's own figure. Multiplicative for
  // the same reason blade fit is: the old flat 45 wiped out a starter's whole
  // number and cost a bred monster a third of its own.
  BEATEN_SHARE: 0.35, //     lost by the length of the pit
  MIN_BEATEN_SHARE: 0.05, // a loss always sits below the win it lost to
  NOISE: 4, //               ± uniform, ONE roll per fight (the track variant)
  BAND: 5, //                displayed to the nearest 5
} as const;

// ── The Scout Report (round 28 — the fog comes down) ────────────────────────
// Stats are HIDDEN until retirement (Zane's ruling, 2026-08-05): while a
// bird can still fight, the only read on it is its figures. That makes the
// wiki's old promise — "the skill is DISCOVERY" — literally true for the
// first time, and it makes small samples dangerous: one big figure at B1
// would type a bird forever if raw averages ranked the blades. So each
// blade's read is SHRUNK toward what an unraced blade would score — a
// Bayesian prior sized in pseudo-fights. Players (get_bird), auto-play and
// the bots all read this same report; nobody reads the sheet.
export const SCOUT = {
  // Pit Figures are public performance, not a pure blade read: a higher
  // public grade predicts a louder number before the blade tells us anything.
  // The scout removes that coarse expectation, centered on B+, and leaves
  // result and beaten lengths in.
  REFERENCE_GRADE: "B+" as const,
  // ⚠ BOTH REBASED IN ROUND 30, and this is the second time the same lesson
  // has been learnt: a constant fitted to the figure's OUTPUT goes stale the
  // moment the figure changes. Round 29 caught PRIOR_FIGURE 18 points adrift
  // after round 27 moved the scale. So these are no longer fitted — they are
  // read off the figure's own construction, which is exactly what round 30
  // made possible by giving the figure a unit.
  //
  // OWN_GRADE_STEP is a letter grade in figure points, and it is now exactly
  // that number by design: the spine is linear in the stat blend, a grade
  // band is 100 stat points (grades.ts), and PEG_STAT stat points are
  // PEG_FIGURE figure points. So one grade = 100/1000 × 100 = 10, at every
  // rung of the ladder. Measured in the round-30 sim to confirm rather than
  // to derive: B 21.4 → B+ 27.1 → A 37.1 over 5,588 fights. It was 15, fitted
  // against the old ghost-divisor scale.
  OWN_GRADE_STEP: 10,
  // The opponent has LEFT the figure entirely. The old figure paid a class
  // credit for the company you beat (FIGURE.CLASS_BASE/CLASS_DIVISOR) because
  // raw pace could not tell a monster from a maiden; the spine reads the
  // bird's own blend, so there is nothing of the opponent left to remove.
  // Measured, holding own grade at B+: mean figure against B+ company 27.0,
  // against B 27.8, against A 25.8 — flat inside the noise. Kept as a knob at
  // zero rather than deleted, because the opponent still reaches the figure
  // faintly through beaten lengths, and a future rule that pays for company
  // would want this dial back.
  OPPONENT_GRADE_STEP: 0,
  // An unread blade scores what an AVERAGE outing scores. Reading "nothing
  // known" as "average" is what stops a single lucky 80 from looking like a
  // destiny.
  //
  // Round 29 re-measured this and it was badly wrong. It was set to 50
  // because GHOST_PACE's comment claims an even fight between starters
  // figures ~50 — but round 27 rescaled the wind and every damageMult, and
  // the calibration went with it. The `symmetry` control now reads 26.9–31.5
  // across the five blades and the live world's mean normalized figure is
  // 32.1. A prior of 50 therefore sat ~18 points ABOVE reality, which means
  // every blade a bird had actually fought was dragged toward 32 while every
  // blade it hadn't stayed parked at 50: EVIDENCE LOST TO IGNORANCE, by
  // construction. Replaying the 5,505 entries of sim-20260806-1318 with only
  // this number changed moved scout accuracy 26.5% -> 31.2% exact and
  // 52.2% -> 56.0% on-or-adjacent. PRIOR_WEIGHT barely mattered (0.5/1/2 all
  // landed within 0.3 points) — this was the prior itself, not the Bayes.
  //
  // ROUND 30 re-measured it again, because rebuilding the figure moved the
  // scale under it exactly as round 27 had. In the round-30 sim a bird at the
  // REFERENCE_GRADE averages 27.1 over 4,689 fights (whole world: 26.4 over
  // 5,588, range 5–55). So the prior is 27.
  //
  // This one genuinely cannot be derived the way OWN_GRADE_STEP now is, and
  // it is worth writing down why. The spine says a B+ bird "should" figure
  // ~35; the live flock averages 27 because its CONDITION is starter-grade
  // (~320 against FIGURE.NOMINAL_CONDITION of 1000), so nearly every bird
  // fights below nominal form, and the loser of every fight is marked down by
  // beaten lengths on top. Both of those are properties of the population,
  // not of the formula — which means this number will drift UP on its own as
  // the flock breeds up. Re-measure it when the BLOODLINES ladder shows the
  // mean grade has moved a band; do not fit it to a formula it does not obey.
  PRIOR_FIGURE: 27,
  // Pseudo-fights behind the prior: by the third real figure at a blade,
  // the bird's own evidence carries the read.
  PRIOR_WEIGHT: 2,
  // Fewer figures than this and a blade still counts as UNREAD — it stays
  // an exploration target even if its one figure was loud.
  MIN_READS: 2,
  // The chance a stable cards an UNREAD blade instead of its best-known
  // one. Without this a bird's first blade is self-fulfilling: the only
  // blade with figures is the only blade that scores above prior, so it
  // would be the only blade ever carded. Discovery must be bought — this
  // is the price, paid mostly during the juvenile year (which is when the
  // fights are cheap and the record doesn't count).
  EXPLORE: 0.35,
  // Bots misread the margin calls by up to ~2 figure bands. Replaces the
  // old rng()*100 jitter, which was scaled to stat-weight sums in the
  // hundreds — on figure-scale scores (roughly 40-70) that would have been
  // pure noise.
  JITTER: 10,
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
  // ⚠ THE TWO ENTRY-FEE CONSTANTS THAT LIVED HERE ARE GONE (round 42).
  //
  // There was a `REAL_ENTRY_FEE` (42) and a `JUVENILE_ENTRY_FEE` (9): ONE price
  // per division, stamped on maidens, claimers and the open alike. That flat
  // rate is what round 42 set out to kill — see ENTRY_FEES below, which prices
  // every rung of the ladder separately. Keeping either constant as an alias
  // for "the maiden rung" would have been the worst of both: a name that reads
  // like the division's price while being one of five, and 60-odd call sites
  // quoting it as though it still meant something.
  //
  // What was load-bearing about them survives in two places. The DIVISIBILITY
  // rule (round 34: a fee must divide by FIGHTS_PER_GROUP_BIRD exactly, or the
  // stake split stops balancing to the cent) now applies to every entry in
  // ENTRY_FEES and is pinned there. The LAND CURVE still reads a fee — it just
  // reads whichever rung the bird actually carded, which is the whole point.
  // HARDCORE_ENTRY_FEE (120) died earlier, in round 31, with the hardcore lobby.
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
  // ⚠ AND KEEPING IT AT ZERO IS A DELIBERATE BET AGAINST A KNOWN FAILURE, which
  // is worth recording here because it is the reason nobody should "just add a
  // small rake" the next time the GP faucet looks too generous (round 42).
  //
  // Zane, on the game this one is descended from: "we've kept the fights part of
  // the economy 0 rake AND it emits LT. In PFL there was a heavy 10% rake and the
  // CROWN was intended to offset this, and perhaps completely offset it and cause
  // +EV racing. This occurred for just a few seasons before a negative spiral of
  // -EV racing went on for years. We should be in a better position because our
  // whole fight economy is +EV due to 0 rake and sprinkling in LT."
  //
  // The mechanism of that spiral is the thing to understand. A rake makes the
  // AVERAGE entrant lose money on every card; a prize pool funded from that rake
  // hands it back concentrated at the top. So the median stable bleeds and only
  // the winners are whole, which means racing is rational for fewer and fewer
  // barns each season — and the fewer race, the thinner the fields, the worse the
  // median outcome. It does not correct itself, because every step is individually
  // rational.
  //
  // Two things insulate this game from it, and BOTH have to keep holding. The pot
  // is pure — win +stake, lose −stake, so the median entrant breaks even rather
  // than bleeding. And land mints on every fight regardless of result, so the
  // median entrant is actually +EV once the subsidy is counted. Round 42 made both
  // matter more by multiplying the stakes: at 300 GP an open night, a 10% rake
  // would cost a barn 30 GP a card, which is the PFL trap at PFL's scale.
  //
  // If GP ever needs draining, drain it somewhere a losing stable does not pay for
  // the privilege of playing — breeding, the gacha, a tax on the top. Not here.
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
/** Hundredths in one Land Token — the same relationship GP has to its cents. */
export const LT_CENTS = 100;

export const LAND = {
  // The linear base: 1 LT per this much GP risked.
  //
  // ⚠ BACK TO 8 IN ROUND 36, and the round-34/35 detour is worth reading. It
  // was 8 forever; round 34 moved it to 9 to fix an inversion it had itself
  // created. Moving the juvenile night 8 GP → 9 pushed (9/8)^1.15 = 1.145
  // across a rounding boundary and `ceil` made it TWO whole tokens, so the
  // discovery year minted 0.222 LT per GP risked against a real card's 0.167
  // — the cheapest company in the game paying the best land in it, exactly
  // backwards from the ruling this curve exists to express.
  //
  // Base 9 fixed the direction by landing a juvenile night on exactly 1.0,
  // but it was a goalpost move: it cost a ~13% haircut everywhere (a real
  // night 7 → 6 LT, a Major's round 56 → 49) and it would have broken again
  // the next time a fee changed. Round 36 cured the CAUSE instead — land is
  // minted in hundredths now, so `ceil` is no longer load-bearing and the
  // exponent decides the ordering by itself. With that done, 8 is simply
  // correct again, and the haircut is handed back.
  FEE_PER_TOKEN: 8,
  FIGHT_EXPONENT: 1.15, //    …raised past linear — the "fight up" incentive
  // ⚠ THE THREE BELOW ARE IN HUNDREDTHS since round 36, like every other
  // `…Cents` quantity. They are written as `n * LT_CENTS` rather than as
  // 100/8000/100000 so the ROUND NUMBER a human ruled on stays legible: this
  // is one token a roll, a hundred tokens for 80 GP, a thousand tokens a day.
  // Spelling them out as raw hundredths is how a "1,000 LT cap" silently
  // becomes a 10 LT cap in somebody's later edit.
  PER_GACHA_ROLL: 1 * LT_CENTS,
  GP_PER_100_TOKENS: 80, //          GP, not land — untouched: $1 buys 100 LT
  DAILY_BUY_CAP: 1_000 * LT_CENTS, // max LT a farm may buy per game-day ($10)
  // ── THE PENCILLED VALUATION (round 42) — a yardstick, not a rule ──────────
  //
  // Nothing in the engine reads these two numbers. They exist so the doctor can
  // report issuance in dollars instead of in tokens, because "2,876 LT a day" is
  // a number nobody can be right or wrong about and "$0.50 of land handed out
  // per $1 of GP sold" is.
  //
  // Zane's frame, and it is worth writing down because it is the only stated
  // theory of what Land Token is FOR: "My overall vision for LT would be for us
  // to emit 100 billion tokens, and for them to be valued at $0.01 each = A
  // billion dollars… As a company we are more or less selling GP in exchange for
  // fun and LT. So in a super basic sense, if we get people to spend a billion
  // dollars on GP in pursuit of a billion dollars worth of LT, then we win."
  //
  // ⚠ TREAT BOTH AS ARBITRARY. There is no way to exchange LT for money today —
  // the return is the staking yield, and the price is a pencil mark. Do NOT
  // derive a game rule from either: the moment a fee or a cap is computed off a
  // valuation, a marketing decision becomes a balance decision. The one honest
  // use is a ratio the doctor prints for a human to judge.
  PENCILLED_USD_PER_TOKEN: 0.01,
  TARGET_SUPPLY: 100_000_000_000, // whole tokens, not hundredths — the $1B mark
} as const;

// The land curve, fed the TOTAL a bird risked in a night. Superlinear on
// purpose, and since round 42 that property is what the whole class ladder rests
// on: a juvenile maiden risks 30 GP a night and mints 4.57 LT, a grown open
// risks 300 and mints 64.55 — 14× the land for 10× the stake. Fighting up pays
// EXTRA, per GP risked, and that surplus is the only thing paying a stable for
// taking harder company. The doctor's FIGHT ECONOMY BY RUNG block prints land per
// 100 GP risked down the whole ladder; it must RISE, and if it ever goes flat the
// ladder is all cost and no reward.
//
// Worth noting for balance: the group stage tripled the fights per entry while
// LT per real night went 7 → 6, so this round TIGHTENS the land faucet per
// fight considerably (7 per fight became 2 per fight). That is the intended
// direction — land was never meant to be paid for showing up three times.
//
// ⚠ ROUND 34 MOVED THE CALL SITE, and that mattered more than the numbers.
// Land used to be paid per FIGHT on the entry fee. With the group stage a bird
// takes up to three fights on one fee, so paying per fight on the FEE would
// have tripled the LT supply outright. Land is paid ONCE per entry at
// settle-up instead, on stake × fights actually taken: a bird that fought
// twice of three gets landForFight(28) = 4.22 of the 6.73, so a short card is
// honestly paid short.
//
// ⚠ THE SECOND HALF OF THIS ARGUMENT DIED IN ROUND 36, and it is worth saying
// so rather than leaving a comment that quietly stopped being true. The old
// reasoning was that feeding the curve the per-fight STAKE would flatten it,
// because 14 GP and 3 GP both sat on the `max(1, …)` floor where superlinear
// is indistinguishable from linear. Hundredths dissolved that floor — 14 GP is
// 1.90 LT now, not a floored 1 — so the flattening argument no longer holds.
//
// Paying once per night is still right, for a cleaner reason: the curve is
// superlinear, so f(a+b+c) > f(a)+f(b)+f(c). A full real night pays 6.73
// against the 5.70 that three separate 14 GP fights would pay. That is not a
// bonus bolted on; it is the SAME "fighting up pays extra" property, read
// across one bird's evening instead of across two price rungs. A bird that
// risks a whole entry in a night has fought up, and the curve should say so.
/**
 * ⚠ RETURNS HUNDREDTHS OF A TOKEN (round 36), like every `…Cents` figure in
 * the game. 673 means 6.73 LT.
 *
 * This is the structural cure for the round-34 inversion, and the reason is
 * worth stating in one line: WHOLE TOKENS MADE `ceil` LOAD-BEARING. At the
 * cheap end of a superlinear curve the rounding is worth more than the
 * exponent — the old 9 GP juvenile night was genuinely 1.145 tokens, and
 * rounding that up to 2 was a 75% overpayment, while the same rounding on the
 * old 42 GP grown night was worth 4%.
 * So the distortion was always largest exactly where the curve is shallowest,
 * which is how the ordering flipped. Round 34 answered by moving the base
 * until the numbers landed on friendly integers; that worked once and would
 * have broken on the next fee change, silently, because nothing could see it.
 *
 * At 1/100th resolution the rounding error is two orders of magnitude smaller
 * than the gap it was corrupting, and the ordering falls out of the exponent
 * by itself — verified in `lobbies.test.ts` across every fee from 1 to 300,
 * which is the guard that should have existed before round 34 touched a fee.
 *
 * Fed the TOTAL a bird risked in a night (see the group stage). Across the
 * round-42 ladder: a juvenile claimer's 24 GP → 3.54 LT, a juvenile maiden's
 * 30 → 4.57, a grown maiden's 60 → 10.15, a juvenile open's 150 → 29.10, a
 * grown open's 300 → 64.55.
 */
export function landForFight(fee: number): number {
  return Math.max(
    1, // never zero: a fight always mints something, even a hundredth
    Math.round(LT_CENTS * Math.pow(fee / LAND.FEE_PER_TOKEN, LAND.FIGHT_EXPONENT))
  );
}

/** Land Tokens for display, from hundredths: 673 → "6.73". */
export function fmtLt(cents: number): string {
  return (cents / LT_CENTS).toFixed(2);
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
  // ⚠ IN HUNDREDTHS since round 36 (see LT_CENTS). Written as `100 * LT_CENTS`
  // so the ruled number — a hundred tokens to stand a stud, the game's first
  // land SINK — stays readable. Stored raw it would be 10000, and a later edit
  // "correcting" that to 100 would silently make the seat cost one token.
  STUD_LISTING_LT: 100 * LT_CENTS,
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
// ⚠ THE CAPACITY IS GONE (round 31). A lobby grows without limit.
//
// It was LOCKED at 8, an even number, so that a full lobby guaranteed every
// bird a fight — and when it filled, the next entrant opened a SECOND lobby on
// the same key. That duplication was quietly working against the thing lobbies
// are for. Round 31 posts a small daily card precisely to make entries collide;
// splitting a hot key back into two half-empty rooms undid the concentration in
// the same breath. Zane: "no more 8-max and then duplicating the lobby. Just
// let it grow infinitely."
//
// It also removes any reason to CAMP. Under a cap, a late entrant could find
// the room full and be shunted into a duplicate with a different field, so
// watching and waiting paid. Unbounded, you can always get in and the fill
// count you saw only ever grows — which is what we want, since the whole round
// is about encouraging entries.
//
// The trade, stated plainly: 8 was even ON PURPOSE. Unbounded means parity is a
// coin flip, so roughly half of lobbies strand one bird. That residue is what
// the next round's group stage removes; see cardOfDay's note below.
//
// The old LOBBY.CAPACITY block lived here. Tournament brackets never used it —
// they don't touch the lobbies table at all — so nothing inherited it.

// ── THE GROUP STAGE (round 34) — one entry, three fights ───────────────────
// The residue round 31 left behind, now collected. Unbounded lobbies pair
// birds two at a time, so a lobby with an odd field strands one bird and a
// lobby of one strands it entirely: 4.5% of entries in round 31, and 5.7% in
// round 32 once the population nearly doubled. Better matchmaking cannot fix
// that — with pairs, an odd number is odd.
//
// So a lobby no longer draws PAIRS, it deals GROUPS. Zane's framing was the
// FIFA group stage: a lobby of thirty becomes seven groups of four plus one of
// two, everybody fights everybody in their group, and NOBODY sits out unless
// they were the only bird in the room. A group of four is three fights.
//
// Why four and not more: three fights is already a full evening for one bird,
// the pit-figure read from three blades' worth of evidence in a night is the
// discovery payoff, and every extra group member is quadratic in fights (a
// group of six would be five fights a bird). Four is also the smallest size
// that survives one same-barn collision and still gives everyone a card.
//
// ⚠ SIZE is load-bearing arithmetic, not a preference. EVERY fee in ENTRY_FEES
// must divide evenly by SIZE - 1 (see stakePerFight, and the test that sweeps
// ALL_ENTRY_FEES to pin it), because the stake splits across the fights and GP is
// kept to the cent. This said "both entry fees" until round 42, when there
// stopped being two of them and started being eleven — which is exactly why the
// test sweeps the table now instead of naming constants.
export const GROUP = {
  SIZE: 4, //     four to a group — three fights a bird
  MIN_SIZE: 2, // below this there is no fight to make: a lone entry refunds
} as const;

// FIGHTS a bird can take in one night: everyone else in its group.
export const FIGHTS_PER_GROUP_BIRD = GROUP.SIZE - 1;

// THE STAKE SPLITS (Zane's ruling): "just divide the total entry among them…
// If the bird is the odd bird out and only gets two fights, then I'd expect
// them to get refunded 20." One entry fee buys a night, not a fight — it is
// escrowed whole at the door, spent a third at a time, and whatever the bird
// never got to risk comes back at post time. So a 60 GP grown maiden entry is
// three 20 GP fights, and a bird whose group was short of a barn-mate fights
// twice, risks 40 and is handed 20 back.
//
// The pot per fight is therefore 2 × this, NOT 2 × the entry fee — a fact that
// is easy to get wrong in prose. Land is the other way round: it pays ONCE per
// entry, on the TOTAL risked (see landForFight's note), so the superlinear
// "fighting up pays extra" curve reads the night rather than the third.
export function stakePerFight(fee: number): number {
  return fee / FIGHTS_PER_GROUP_BIRD;
}

// ── The mode dial ───────────────────────────────────────────────────────────
// Which SEASON a fight belongs to. Lived as a bare union in lobbies.ts until
// round 31 and was re-typed literally in four other places; it belongs here
// with the rest of the dials, and cardOfDay needs it below.
//
// HARDCORE IS NOT ON THIS LIST ANY MORE (round 31, Zane: "There should be 0
// hardcore fights outside the Finals. This is a regression in the fight
// schedule. Accomplishes nothing and further fragments participation and isn't
// balanced by the heavy +EV nature of the Finals."). It measured exactly that:
// 201 entries across a 91-day world producing 55 fights — a 45.3% unmatched
// rate, the worst of any mode, for under one fight a day. Hardcore survives
// where it earns its keep: the Pintakasi Majors, which are tournaments and
// never open a lobby. `battleLog.mode` therefore still carries "hardcore" —
// that is where those fights are recorded.
export const FIGHT_MODES = ["juvenile", "real"] as const;
export type FightMode = (typeof FIGHT_MODES)[number];

// The class dial. Entry restrictions self-sort the fields (no matchmaker):
// maidens take never-winners, the win-cap takes light records, claimers put a
// price on every bird entered.
//
// `nw2` was MERGED INTO `nw3` in round 31. The two differed by a single win
// and the measurement was damning: of 181 active birds, nw2's exclusive
// constituency — past maiden but under two wins — was 10 birds, and nw3's was
// 18. Two whole classes, ten lobby keys, separating 28 birds. One conditioned
// rung between maiden and open now serves all 148 birds under three wins.
//
// The classes NEST: maiden ⊂ nw3 ⊂ open. That property is load-bearing for the
// daily card — see cardOfDay.
export const LOBBIES = ["open", "maiden", "nw3", "claimer"] as const;
export type Lobby = (typeof LOBBIES)[number];

// How many stakes wins graduate a bird out of the conditioned class. Named
// because the class is called "nw3" after it — change one and the label lies.
export const NW_CAP = 3;

// Claimers (re-ruled 2026-08-03): FARM-TO-FARM, escrowed, pre-fight.
// Enter a bird at a tag price; the entry sits on the public board for the
// rest of the game-day while OTHER farms place sealed claims; the card goes
// off on the day tick. The bird fights for its ORIGINAL owner (who keeps
// the pooled prize); a successful claimant receives the bird only AFTER
// the fight. Multiple claims → RNG picks one, the rest refund. The house
// never claims — bot farms with claim-heavy playstyles are the liquidity.
//
// The tag ladder still brackets the 160 GP breed floor: ONE rung below it
// (claim cheaper than breeding) and two above. It self-balances: a dear tag =
// safer from claims but dearer company and a real entry at risk; a cheap tag =
// claimable, but win-and-get-claimed is an income spike.
//
// ⚠ THINNED IN ROUND 31, and this was the single biggest fragmentation fix
// available anywhere in the game. The tag is part of a lobby's KEY, so a b3
// claimer at 200 and a b3 claimer at 400 never merge — which meant claimers
// alone accounted for 40 of the 75 possible keys, 53% of the whole space, off
// one axis. Measured over 91 days: 13.1 claimer entries a day divided into 0.33
// entries per key. The dear rungs were not thin, they were dead — b3@400 drew
// TWO entries in 84 days. At three grown rungs and two juvenile the same
// traffic concentrates about 13× and the marketplace gets healthier, not
// smaller.
//
// ⚠ ROUND 42 — ONE LADDER FOR BOTH SEASONS, AND THE JUVENILE RUNGS ARE GONE.
// Round 23 gave the discovery year its own cheap tags (25/100) on the reasoning
// that "a one-year-old is an unproven animal — pricing it against the grown-bird
// ladder would mean nobody dares tag one." Zane reversed that deliberately:
// "let's adjust the claimer tags to 90, 180, and 270… this positions tags above
// and below the breed cost."
//
// What changed underneath is that a juvenile is no longer cheap to campaign. The
// discovery year's own entries now run 24–150 GP (see ENTRY_FEES), so a
// one-year-old that has fought a real card has real earnings behind it and is
// worth something like a grown bird's tag. Pricing juveniles at 25 GP against
// that would have made the discovery year the bargain bin of the whole game.
//
// A SEPARATE ENTRY PRICE, THOUGH — this is the axis that survived the merge. The
// tag says what the BIRD costs and is shared; the entry says what the NIGHT
// costs and is still per-division (24/48/72 juvenile against 48/96/144 grown).
// Same animal price, half the cost to campaign it as a juvenile.
export const CLAIMER = {
  // 90 under the 160 GP breed floor, 180 and 270 over it — the round-31 shape
  // ("one rung below, two above") re-priced rather than re-thought.
  PRICES: [90, 180, 270], // $1.125 · $2.25 · $3.375
} as const;

// ── THE FEE LADDER (round 42) — the flat rate dies ──────────────────────────
//
// Zane: "The other problem with the costing is the flat cost among fight types.
// This is not intended. We have a ladder with maidens, claimers, nw, open, and
// then Championships… But we basically just charge a flat rate on these fights.
// We want the more competitive fights to cost more, more risk, more reward…
// We want players to ladder up."
//
// Until now there was ONE price per division — 42 GP grown, 9 GP juvenile — so
// a maiden and the open cost the same and the class ladder carried no economic
// weight at all. A bird climbing it took on harder company for exactly no extra
// stake and no extra reward. Now every rung is priced, and the land curve
// (landForFight, superlinear at 1.15) turns each step up into disproportionately
// more Land Token — which is the incentive to climb, paid in the currency that
// is supposed to be the subsidy.
//
// ⚠ EVERYTHING IS PRICED AGAINST THE 160 GP BREED FEE, and that is the ruling
// worth understanding. Zane: "we want fights to cost more vs. the min breed fee,
// so that a profitable bird is worth many multiples the amount that it took to
// create it. If profit potential per bird is high, then speculation on bird
// value can go high, which will drive potential demand for buying birds and
// breeding birds… This also means that the birds are cheaper vs. fights, which
// is good, allows players to have more birds and their funds are focused on
// fighting rather than acquiring the instruments to fight."
//
// So a body is cheap and a night is dear. A juvenile maiden is 30 GP — 18.75% of
// what it costs to make the bird — and one grown open night is 300, nearly two
// covers. A bird that can win in the open earns back its own creation cost in a
// single evening, which is what makes a good one worth speculating on. When
// player-set stud pricing unlocks, THAT is the demand it will be priced against.
//
// ⚠ EVERY FEE MUST DIVIDE BY FIGHTS_PER_GROUP_BIRD (3), because one entry buys
// a GROUP and the stake splits across it to the cent — see stakePerFight, and
// the test that pins it over this whole table. Zane's rule: keep the numbers
// divisible by 6. This is why the maiden rungs are 30/60 and not the 32/64 that
// "20% of the breed fee" would have given: 32 is not divisible by 3, and making
// the split carry a remainder would have put arithmetic into the one place this
// codebase has already lost money twice.
export const ENTRY_FEES = {
  // THE DISCOVERY YEAR, roughly half the grown price at every rung — a
  // one-year-old is still learning what it is, and the season it learns in
  // should not cost what a veteran's does.
  juvenile: {
    maiden: 30, //  the home number: 18.75% of a breed fee
    nw3: 30, //     never posted (the juvenile card has no nw3 — see CARD), priced
    //              anyway so the lookup is total and a future card cannot crash
    // ⚠ THE OPEN IS THE EXPENSIVE ONE, and deliberately more than a grown
    // maiden. Zane: "This should be high… This allows for players to fight
    // their strongest birds hard, and it also should result in the best quality
    // discovery. If your bird can win @ open competition at a specific blade,
    // that is basically the best possible info in the game." Discovery is the
    // product of the juvenile year, and the sharpest read costs the most.
    open: 150,
    claimer: [24, 48, 72], // against CLAIMER.PRICES — cheapest rung is the
    //                        cheapest fight in the game, because the bird is
    //                        for sale at 90 GP while it runs
  },
  // GROWN — exactly 2× the juvenile at every rung. Zane: "for simplicity we
  // just double it." The ratio is worth keeping deliberate rather than letting
  // the rungs drift apart: it is what makes "campaign it as a juvenile" a real
  // economic choice instead of a rounding difference.
  real: {
    maiden: 60,
    // ⚠ MAIDEN AND NW3 ARE THE SAME PRICE, on purpose. Zane: "I'll group them
    // together because they kinda become the same thing, since most birds should
    // get a win in their juvi season with the multi-fight lobbies." A group
    // stage hands out three fights a night, so a maiden graduates almost
    // immediately and nw3 is where a bird actually spends its early career.
    // Pricing them apart would tax an accident of timing.
    nw3: 60,
    open: 300, //   the dearest fight on any daily card — two covers a night
    claimer: [48, 96, 144],
  },
} as const;

/**
 * WHAT ONE NIGHT COSTS at a given rung — the single door every entry fee comes
 * through, replacing round 31's `MODE_FEES[mode]` lookup in lobbies.ts.
 *
 * Claimers index by their POSITION on CLAIMER.PRICES rather than by the tag
 * value, so re-pricing the tag ladder cannot silently orphan a fee: an unknown
 * tag throws here instead of quietly billing the cheap rung. That failure mode
 * is not hypothetical — the tag is part of a lobby's key, so a stale tag reaches
 * this function from any lobby row written before a reprice.
 */
export function feeFor(mode: FightMode, classType: Lobby, price?: number): number {
  const rungs = ENTRY_FEES[mode];
  if (classType !== "claimer") return rungs[classType];
  const rung = CLAIMER.PRICES.indexOf(price as (typeof CLAIMER.PRICES)[number]);
  if (rung < 0)
    throw new Error(
      `No claimer rung at a ${price} GP tag — the ladder is ${CLAIMER.PRICES.join(" / ")} GP`
    );
  return rungs.claimer[rung];
}

/** Every fee on the ladder, for the tests and the docs that sweep it. */
export const ALL_ENTRY_FEES: number[] = FIGHT_MODES.flatMap((mode) =>
  LOBBIES.map((classType) =>
    classType === "claimer" ? ENTRY_FEES[mode].claimer : [ENTRY_FEES[mode][classType]]
  ).flat()
);

// ── THE CARD (round 31) — a published daily schedule ────────────────────────
// Until now lobbies were CONJURED ON DEMAND: entering created the lobby if it
// did not exist, so every fight type was available every day and the perfect
// fight always existed because you invented it by asking. Zane: "The on-demand
// lobbies of perfect fights is crazy lol. Never intended that."
//
// What it cost, measured over 91 days: 74 live keys taking ~70 entries a day —
// an average of 2.9 birds per lobby — and 16.3% of all entries never drawing an
// opponent. That unmatched rate decomposed as 35% sole entrant in a lobby
// nobody else joined, 31% two barn-mates alone (matchmaking never pairs
// same-barn birds), 34% odd bird out. The first two are pure key-space damage:
// no matchmaker can fix them, only collision can.
//
// So each day now POSTS a small card and entries must land on it. The PFL
// rhythm Zane wanted: "if you just wanted to wait for a perfect race, you might
// have to wait 3-4 days, this causes players to settle for close-to-ideal races
// which is great and increases fills and softens competition."
//
// WHERE THE SCARCITY GOES, and this is the whole design. Every CLASS appears
// every day in both divisions; what rotates is which BLADES each class runs.
// Two reasons. First, the classes nest (maiden ⊂ nw3 ⊂ open) and 33 of 181
// active birds are open-only, so an adult open lobby must exist daily or
// veterans have nowhere to card — nothing may ever be stranded. Second, the
// blade is the DISCOVERY axis, so putting the shortage there makes the
// wait-or-settle choice land on the most interesting question a player has.
//
// Sized against real traffic. Round 31 aimed for ~6-7 deep; the measured world
// came in fuller than that, which is what paid for round 32's third juvenile
// open blade — 12 keys a day now, 7 adult and 5 juvenile.
export const CARD = {
  real: { open: 3, maiden: 1, nw3: 1, claimer: 2 },
  // JUVENILE OPEN RUNS THREE BLADES, one more than the adults' share of their
  // own division — widened in round 32 and the discovery year is the reason.
  // At two blades the worst gap between two appearances of a blade is FOUR
  // DAYS, and a juvenile career is SEVEN (canJuvenile is age 1 exactly), so a
  // chick could finish the only year it is allowed to experiment in having
  // never been offered two of the five blades. Three closes the gap to two
  // days. It is affordable because juvenile open was the fullest key on the
  // board — 8.41 birds a lobby in the round-31 sim against a 7.36 world mean.
  juvenile: { open: 3, maiden: 1, claimer: 1 },
  // Thursday is the Majors' crown day and every registrant is barred from the
  // daily card that day (their crown IS their card), so the adult field thins
  // exactly when the card is widest. Drop one open blade to keep the rest full.
  CROWN_DAY_OPEN_BLADES: 2,
  // The salt for this schedule's shuffle, a sibling of WEATHER.SALT. Distinct
  // so the card and the weather never correlate — a blade must not reliably
  // arrive on its own element's day.
  SALT: 0x3fb17e59,
} as const;

/** One posted fight on the day's card — a lobby key. */
export type CardKey = {
  mode: FightMode;
  classType: Lobby;
  format: FightFormat;
  price?: number; // claimer tag
};

/**
 * The blades a given (mode, class) runs on a given day — a ROTATING DECK, not
 * independent random draws.
 *
 * Independent draws would let a blade vanish for a week or more by luck, and a
 * juvenile's whole discovery year is SEVEN DAYS (canJuvenile is age === 1
 * exactly, a closed division), so a bad run of luck would cost a generation its
 * coverage. Instead: walk a cursor `dayIndex * k` through decks of every blade,
 * each deck a shuffle seeded from its own index. Every blade is therefore
 * guaranteed once per deck, and the walk only ever moves forward.
 *
 * Written against FORMAT_NAMES.length rather than a literal 5 — a sixth blade
 * must widen the guarantee, not silently break it.
 */
function bladeDeck(dayIndex: number, key: string, count: number): FightFormat[] {
  const n = FORMAT_NAMES.length;
  const want = Math.min(count, n); // never ask for more blades than exist
  const out: FightFormat[] = [];
  // Walk forward, SKIPPING a blade already posted today. Without the skip a
  // slot group that straddles a deck boundary can draw the same blade twice —
  // deck d's tail and deck d+1's head are independently shuffled — and the card
  // would post a duplicate key, silently costing that day a lobby.
  for (let pos = dayIndex * want; out.length < want; pos++) {
    const blade = shuffledBlades(Math.floor(pos / n), key)[pos % n];
    if (!out.includes(blade)) out.push(blade);
  }
  return out;
}

/** One deck: a Fisher-Yates shuffle of every blade, seeded and reproducible. */
function shuffledBlades(deckIndex: number, key: string): FightFormat[] {
  const deck = [...FORMAT_NAMES];
  const rng = saltedRng(deckIndex, key);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * The same one-step mulberry32 weatherOfDay uses, mixed with a string key so
 * each (division, class) rotates independently. Inlined rather than imported
 * because config.ts deliberately depends on nothing.
 */
function saltedRng(n: number, key: string): () => number {
  let h = CARD.SALT >>> 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h ^ key.charCodeAt(i), 0x01000193) + 1) >>> 0;
  let a = (Math.imul(n + 1, 0x9e3779b9) + h) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * TONIGHT'S CARD — every lobby key on offer for a given day.
 *
 * Pure and derived from dayIndex alone, exactly like weatherOfDay: no schema,
 * no storage, reproducible for any past day, and `cardOfDay(day + 1)` is free
 * so tomorrow is public and a stable can plan around it.
 *
 * NOTE ON THE ODD BIRD OUT: concentrating entries kills the sole-entrant and
 * barn-mate halves of the unmatched rate, but each lobby still strands its odd
 * bird — expect single digits, not zero. Removing that residue is the next
 * round's job (a group stage inside each lobby, which unbounded lobbies make
 * natural: a room of 30 becomes seven groups of four plus one of two, and
 * everybody fights).
 */
export function cardOfDay(dayIndex: number): CardKey[] {
  const keys: CardKey[] = [];
  // `take` exists so the crown-day thinning DROPS a blade rather than walking
  // the deck with a different stride. The cursor is `dayIndex * count`, so
  // asking for 2 instead of 3 on one day lands somewhere else in the rotation
  // entirely and desyncs it — measured as a jump in the worst blade gap. Walk
  // the full count always; slice afterwards.
  const add = (
    mode: FightMode,
    classType: Lobby,
    count: number,
    opts: { prices?: number[]; take?: number } = {}
  ) => {
    bladeDeck(dayIndex, `${mode}:${classType}`, count)
      .slice(0, opts.take ?? count)
      .forEach((format, i) => {
        keys.push({ mode, classType, format, ...(opts.prices ? { price: opts.prices[i] } : {}) });
      });
  };

  // Adult open thins on the Majors' crown day — see CARD.CROWN_DAY_OPEN_BLADES.
  const crownDay = dayIndex % CALENDAR.DAYS_PER_WEEK === PINTAKASI.DAY_OF_WEEK;
  add("real", "open", CARD.real.open, {
    take: crownDay ? CARD.CROWN_DAY_OPEN_BLADES : CARD.real.open,
  });
  add("real", "maiden", CARD.real.maiden);
  add("real", "nw3", CARD.real.nw3);
  // CLAIMER TAGS ARE DRAWN ONE CHEAP, ONE DEAR — deliberately, not as two free
  // draws. A day that happened to post only dear tags would put the bots' claim
  // gate at tag + reserve (1000 GP at the 600 rung) and price half the field
  // out of the marketplace entirely; a day of only cheap tags would waste the
  // ladder. One of each means the cheap rung — where nearly all the volume is —
  // is always available, and the dear rungs rotate above it.
  add("real", "claimer", CARD.real.claimer, {
    prices: [CLAIMER.PRICES[0], CLAIMER.PRICES[1 + (dayIndex % (CLAIMER.PRICES.length - 1))]],
  });

  add("juvenile", "open", CARD.juvenile.open);
  add("juvenile", "maiden", CARD.juvenile.maiden);
  // The juvenile card posts ONE claimer a day, so its tag simply walks the
  // shared ladder (round 42 merged the two ladders — see CLAIMER). A rotation
  // rather than a draw, for the same reason the blades rotate: the discovery
  // year is seven days long and a tag that vanished for a week by luck would
  // cost a generation its shot at the marketplace.
  add("juvenile", "claimer", CARD.juvenile.claimer, {
    prices: [CLAIMER.PRICES[dayIndex % CLAIMER.PRICES.length]],
  });
  return keys;
}

/** Is this exact key posted today? The card is matched on all four axes. */
export function isOnCard(dayIndex: number, spec: CardKey): boolean {
  return cardOfDay(dayIndex).some(
    (k) =>
      k.mode === spec.mode &&
      k.classType === spec.classType &&
      k.format === spec.format &&
      (k.price ?? null) === (spec.price ?? null)
  );
}

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
  // FIXED at B2 and B4 (re-ruled 2026-08-04, round 27 — the rotation dies).
  // The Majors own the ends and the middle of the dial (B1/B3/B5), so the
  // juveniles get the two in-between blades, every week, no parity to
  // remember. A discovery year still sees both halves of the spectrum —
  // and the two crowns no other stage runs.
  BLADES: ["b2", "b4"],
  // Purse shape — flatter than the Majors on purpose (see PINTAKASI.PURSE for
  // how the three numbers work). This is a discovery stage, so more of the
  // money rides on ADVANCEMENT and less on the trophy: showing up with a live
  // one and winning a fight should pay a juvenile barn, because that is the
  // whole behaviour the discovery year is trying to buy.
  //
  // ⚠ ROUND 42 PUSHED IT FLATTER STILL (0.65 → 0.80), and it was forced rather
  // than chosen. The crown stopped being free the same round, and a 48 GP door
  // has to be cleared by a bird that won ONE fight — round 41's standing rule.
  // A first-round win in a 32-bracket is structurally about 1% of the purse (16
  // of the 31 fights happen in that round), so the only lever big enough to
  // cover a real entry fee is the advancement share itself. Measured at 0.65 the
  // one-win bird came home at −11 GP; at 0.80 it clears at +7.
  PURSE: { ADVANCEMENT: 0.8, CHAMPION: 0.12, RUNNER_UP: 0.08, ROUND_MULTIPLIER: 1.5 },
  // ⚠ NO LONGER FREE (round 42, reversing round 41). Zane: "We wont do freeroll
  // like PFL. We want a cost here. There is no forced retirement, and the
  // discovery potential is high. And there is Juice."
  //
  // Round 41 made this the one free crown in the game, reasoning that a toll on
  // "a chick learning its trade would gate the exact stage that is supposed to
  // be open." What changed is the rest of the ladder: a juvenile open night now
  // costs 150 GP (see ENTRY_FEES), so a free championship had become the
  // CHEAPEST serious fight available to a one-year-old — the discovery year's
  // best stage, at no stake, which is backwards.
  //
  // ⚠ WHY 48 AND NOT THE 80 FIRST PROPOSED. The juvenile juice pool is thin
  // (JUICE_SHARE 0.2, split across two crowns — about 2,360 GP each), so at an
  // 80 GP door the entrants would fund 42% of their own purse and a one-win
  // bird lands at −14 GP even with the advancement share at 0.80. Raising
  // JUICE_SHARE just moves the same failure onto the Majors, since the pool is
  // finite. 48 is where one win still pays (+7) — and it is still 1.6× a
  // juvenile maiden night, so it is a real price, not a token one.
  ENTRY_FEE: 48,
  // ⚠ ONE FIXED POT, replacing a per-fight mint AND an elimination-grant ladder
  // (round 42). See PINTAKASI.LAND_POT for the whole argument — it applies to
  // both crowns and this is the smaller of the two.
  //
  // 3,000 LT a crown, 6,000 a week across the two. Sized as a fifth of a
  // Major's pot, the same ratio JUICE_SHARE gives the purse, so the two
  // currencies say the same thing about how much this stage matters.
  LAND_POT: 3_000 * LT_CENTS,
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
//
// ROUND 37 — THURSDAY OPENS UP, AND QUALIFICATION POINTS ARE GONE. Zane:
// "let's just shift to earnings-based and get rid of qualifier points
// concept." So the hard gate is deleted outright: ANY age-FORK bird may
// declare for a crown, and the Selection Committee decides who actually
// stands, ranking on CAREER EARNINGS.
//
// Why this is better than the points gate it replaces, rather than merely
// simpler. (1) Points were a second, parallel scoreboard that measured
// almost the same thing as earnings — win real fights — while being invisible
// everywhere except one gate, so the game taught a number nobody could see
// the consequences of. (2) A hard threshold is BINARY: at 3 points you are
// in, at 2 you are nothing, and the 40th-best bird in the world had exactly
// the same standing as the 4th. A rank is continuous — every GP a bird has
// ever earned moves it up the seating list. (3) The gate is now COMPETITIVE
// instead of absolute. MAX_BRACKET was always the real ceiling; with the
// points gate gone it becomes the actual contest, and the committee's
// existing bump line does the selecting. A bird with no earnings may stand
// on a quiet week and will be bumped on a busy one, which is exactly what
// "Thursday opens up" should mean.
//
// ⚠ The thing to watch: the crowns are HARDCORE, so an open Thursday can cull
// the adult population harder than the gated one did. The bots' appetite
// (bots.ts) and MAX_BRACKET are the two brakes. Read the doctor's population
// and championship-field blocks after changing either.
export const PINTAKASI = {
  // ── 80 GP TO STAND (re-ruled round 41, reversing round 22) ────────────────
  //
  // Entry was 200 GP until round 22 made it free, on the reasoning that a
  // crown should be earned in the pit rather than bought. That reasoning still
  // holds for the GATE — age is the only door and the Committee seats the
  // field on earnings — but it left the purse funded by people who weren't
  // there. Traced over a 91-day world, the juice pool that pays every crown
  // came from:
  //
  //   gacha spend   187,056 GP   57%     ← and only 2 of 20 barns buy bundles
  //   breed fees    136,040 GP   42%
  //   the genesis     2,400 GP    1%
  //   THE ENTRANTS        0 GP    0%
  //
  // So the biggest stage in the game was bankrolled by whoever happened to be
  // rolling the gacha, and a barn that never entered a Major still paid for
  // its purse through every cover it bought. A fee makes the crowns partly
  // ENTRANT-funded, which is the round-16 fight economy the daily card has
  // always followed: the money in the pot is the money the fighters put there.
  //
  // Fees are additive on top of the juice (see runChampionship), take no
  // staker rake, and are escrowed per entry — so a mid-season reprice refunds
  // everyone what they actually paid, not what the knob says today.
  // ⚠ DOUBLED TO 160 IN ROUND 42, when the whole fee ladder doubled. Zane:
  // "Pintakasi Finals: 160 GP (doubled, easy, done)." It reads as roughly half
  // a grown open night (300 GP) rather than the "2× a night's card" the round-41
  // comment claimed — that comparison died with the flat 42 GP rate it was
  // measured against. Against the ladder it now sits between the dearest
  // claimer (144) and the open, which is about right for a stage you qualify
  // into on earnings.
  ENTRY_FEE: 160,
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
  // ── ONE FIXED LAND POT, replacing a curve and a grant ladder (round 42) ───
  //
  // Zane: "I actually don't know why we are both minting and granting LT here.
  // I think we could just have one number. We juice the whole season by a fixed
  // 2400 GP right? We can do the same thing with both of the finals. Where we
  // just assign a fixed number of LT to each finals and then it gets auto-split
  // up between rounds and participants."
  //
  // WHAT THIS DELETES, and why all of it had to go together. A crown used to pay
  // land twice: a per-fight MINT off `landForTournamentFight(LAND_BASIS)` (a
  // second land curve, with its own exponent), plus an elimination GRANT ladder
  // paying the earliest-out the most. Two independent scales, and they had
  // drifted into an outright inversion at the juvenile crown — a champion banked
  // 6.75 LT against a first-round loser's 10.15, because the grants there were
  // ~8× the per-fight mint while the Majors' were ~1:1. Nothing was wrong with
  // either number on its own; they were simply never priced against each other.
  //
  // A single pot makes that class of bug UNREACHABLE rather than fixed. Land is
  // now strictly monotone in fights fought, because it is one division of one
  // number — there is no second scale left to disagree with the first.
  //
  // HOW IT SPLITS: evenly across every fight actually FOUGHT, so a bird's share
  // is (its fights ÷ every fighter-slot in the bracket) of the pot. Three
  // consequences, all intended. A deep run earns more than an early exit — Zane:
  // "It's ok for a first round loss to be a little disappointing because the
  // overall fight economy is so rewarding." A BYE PAYS NOTHING, the same rule
  // the purse already follows (a bye is not a fight, so it buys no share). And a
  // THIN FIELD PAYS BETTER per bird, because the same pot divides across fewer
  // fights — Zane: "if there's just a few participants, they should see a big LT
  // pot, this is good because it encourages participation and maxed out finals
  // brackets." That last one is the opposite of how a per-fight mint behaved,
  // and it is the reason to prefer a pot: the incentive now points at showing up
  // early in a stage's life, when the fields are short.
  //
  // ⚠ SIZED TO LOOK GENEROUS ON PURPOSE. Zane: "It's good if the finals look
  // super rewarding, especially early on. We want to jumpstart the economy and
  // have everyone wanting to breed every single one of their hens to produce
  // fighters." 15,000 LT a crown is 45,000 a week across the three Majors, and
  // against the round-41 world's ~2,876 LT/day total mint that is a large step
  // up — deliberately. These are starter numbers and the easiest knob in the
  // game to walk back; read the doctor's LAND SUPPLY block and the LT-per-GP
  // faucet ratio after moving them.
  LAND_POT: 15_000 * LT_CENTS,
  // ── THE PURSE: EVERY WIN PAYS (re-ruled round 40) ────────────────────────
  //
  // Zane: "Every round should pay the winners something, even if the winners
  // get to continue on towards championship contention."
  //
  // It used to be a table of shares by FINISHING STAGE — champion 0.5,
  // runner-up 0.2, each semifinalist 0.1, each quarterfinalist 0.025, and
  // nothing below that. In a 32-bracket that paid 8 birds out of 31, so a bird
  // could WIN a championship fight — the hardest fight in the game, hardcore,
  // with its own career on the line — and take home exactly zero GP for it.
  // The stage table also had to special-case its own edges: the shares were
  // renormalized per bracket size, and first-round losers were struck out by
  // an explicit `round > 1` clause bolted on beside it.
  //
  // Now the purse is split three ways and the FIGHTS decide most of it:
  //
  //   ADVANCEMENT — split across every fight WON in the bracket, with a win
  //                 in each round worth ROUND_MULTIPLIER times a win in the
  //                 round before. Deeper wins pay more; how much more is the
  //                 knob.
  //   CHAMPION    — the trophy bonus, on top of the five wins it took.
  //   RUNNER_UP   — the same, smaller, for losing the last one.
  //
  // The three shares must sum to 1 (docs.test.ts pins it). ROUND_MULTIPLIER is
  // separate — it redistributes WITHIN the advancement slice and cannot change
  // the total.
  //
  // ── ROUND 42: THE ADVANCEMENT SHARE ABSORBS A DOUBLED DOOR ────────────────
  //
  // The shares were 0.50 / 0.35 / 0.15. Round 42 doubled entry to 160 GP, and
  // the round-41 rule below — every winner clears the door — broke immediately:
  // a one-win bird in a 32-bracket came home at −37 GP. The multiplier could not
  // fix it this time (it is already down at 1.5, and flattening it further to
  // 1.25 buys only +27 while costing the champion a thousand GP), so the shares
  // moved instead: 0.70 advancement clears one win at +13.
  //
  // ⚠ THE ROUND-41 COMMENT BELOW SAYS THE SHARES CANNOT FIX THIS. It was right
  // at the time and it is worth keeping rather than quietly deleting, because
  // the reason it stopped being true is instructive: it was measured at
  // ROUND_MULTIPLIER 2, where the first round takes so small a slice of the
  // advancement pool that no plausible share covers a fee. At 1.5 the first
  // round already holds a third of the pool, so the share IS the lever. The two
  // knobs are not independent — read them together.
  //
  // The champion still takes about 4,522 GP of a 12,000 GP purse, against 5,677
  // at the old shares: a ~20% haircut on the trophy to keep 16 first-round
  // winners whole. Zane's round-41 framing ("Champion should still receive a
  // lot, but I suspect there's a happier median") is the same trade, one notch
  // further along.
  //
  // ── WHY 1.5 AND NOT 2 (round 41, when entry stopped being free) ───────────
  //
  // It was 2, chosen because the arithmetic is pretty: each round hands out
  // the same total across half as many birds. But an 80 GP door turns "paid
  // something" into "paid enough to be worth turning up", and at ×2 a
  // first-round win in a 32-bird Major is worth 53 GP against an 80 GP entry —
  // NET NEGATIVE. Winning the hardest fight in the game and going home 27 GP
  // lighter is the round-40 complaint wearing a different hat.
  //
  // ⚠ THE THREE SHARES CANNOT FIX THAT — the multiplier is the only lever.
  // Measured: ADVANCEMENT 0.60 / CHAMPION 0.28 at ×2 still leaves one win at
  // −19 GP, and closing it that way needs ADVANCEMENT near 0.95, which would
  // gut the trophy. Softening the curve costs the champion far less. Net GP
  // after the fee, 32-bird bracket, 5,931 GP of juice:
  //
  //          champion   runner-up   3 wins   2 wins   1 win
  //   ×2       +4,537      +1,990     +291      +79      −27
  //   ×1.5     +4,039      +1,900     +333     +137       +7   ← ruled
  //   ×1.25    +3,795      +1,828     +339     +167      +30
  //
  // At ×1.5 every winner clears the door AND the champion takes 25% MORE than
  // it did on a free entry (+3,225), because the fees grow the pot. Zane:
  // "Champion should still receive a lot, but I suspect there's a happier
  // median."
  //
  // ⚠ A 64-BIRD FIELD STILL LEAVES ONE WIN AT −27, because twice the birds
  // share one pot. Accepted, not solved: fields average ~22, so 32 is the
  // ordinary bracket and 64 is the busy-week exception.
  //
  // ⚠ A BYE IS NOT A WIN. Byes exist because the field was short, and paying
  // for one would pay a bird that never threw a blade — so the weight counts
  // fights actually fought and won, tracked as the bracket runs.
  //
  // The old ruling SURVIVES, but as a consequence instead of a special case:
  // a bird that never won a fight has zero weight and no bonus, so it is paid
  // nothing without anything having to say so. A straight final still pays its
  // champion everything, because the runner-up won nothing and the remaining
  // shares renormalize. Rounding dust still crowns the champion.
  PURSE: {
    ADVANCEMENT: 0.7,
    CHAMPION: 0.2,
    RUNNER_UP: 0.1,
    ROUND_MULTIPLIER: 1.5,
  },
  // The week's three blades — FIXED at the ends and the middle of the dial
  // (re-ruled 2026-08-04, round 27). With B5 the dial has a true midpoint,
  // so the crowns sit at B1 / B3 / B5 — sprint, middle, classic, exactly
  // PFL's Sprint/Gallop/Classic — and the old middle-blade rotation dies.
  // B2 and B4 get their stage too: they are the Juvenile Championship's
  // fixed blades (see JUVENILE_MAJOR.BLADES), so every blade crowns
  // SOMEWHERE every single week.
  BLADES: ["b1", "b3", "b5"],
} as const;

/**
 * WHAT A BIRD THAT WON `wins` FIGHTS TAKES, as a share of the purse — the
 * closed form of the payout the bracket pays out fight by fight.
 *
 * ⚠ THIS IS A SECOND IMPLEMENTATION, AND IT IS DELIBERATE. `runChampionship`
 * cannot use it: it accumulates weight as the fights happen, because that is
 * the only place a bye can be told from a win, and a short field means the two
 * do not agree. This one assumes a FULL bracket, which is what a page
 * describing the rules to a player wants — "win your first fight in a 32-bird
 * Major and you take about 0.6%" is a sentence you can only write about the
 * general case.
 *
 * It lives here, exported, because the alternative was three copies: the
 * Handbook and the MCP tool descriptions each grew their own within an hour of
 * the rule landing. Two implementations that a test can compare is a guard;
 * three that nothing compares is how documentation starts lying. docs.test.ts
 * pins this against what the engine actually pays in a full bracket.
 *
 * Weights: round `r` runs `bracketSize / 2^r` fights, each paying its winner
 * `m^(r-1)` where `m` is the purse's ROUND_MULTIPLIER. A bird that won `w` of
 * them banked the geometric sum 1 + m + … + m^(w-1).
 */
export function purseShareOf(
  bracketSize: number,
  purse: {
    readonly ADVANCEMENT: number;
    readonly CHAMPION: number;
    readonly RUNNER_UP: number;
    readonly ROUND_MULTIPLIER: number;
  },
  wins: number,
  bonus: "champion" | "runnerUp" | "none" = "none"
): number {
  // No win, no money — including the bonus. See PINTAKASI.PURSE for why the
  // two are coupled (a straight final's runner-up is also a first-round loser).
  if (wins <= 0) return 0;
  const m = purse.ROUND_MULTIPLIER;
  const rounds = Math.log2(bracketSize);
  let totalWeight = 0;
  for (let r = 1; r <= rounds; r++) totalWeight += (bracketSize / 2 ** r) * m ** (r - 1);
  return (
    // 1 + m + … + m^(wins-1) — the geometric sum, which is `wins` itself when
    // the multiplier is 1 and 2^wins − 1 at the old doubling.
    (purse.ADVANCEMENT * (m === 1 ? wins : (m ** wins - 1) / (m - 1))) / totalWeight +
    (bonus === "champion" ? purse.CHAMPION : bonus === "runnerUp" ? purse.RUNNER_UP : 0)
  );
}

// ⚠ `landForTournamentFight` LIVED HERE AND IS GONE (round 42). It was the
// Majors' own land curve — landForFight's shape at a steeper 1.25 exponent, fed
// a standalone LAND_BASIS — and it paid a per-fight mint that the elimination
// grant ladder then paid on top of. Both are replaced by one fixed pot per
// crown; see PINTAKASI.LAND_POT for why two scales were the problem rather than
// either scale's value. The daily card still has its curve (landForFight) —
// that one is fed a real entry fee and is the ladder incentive.

/**
 * ONE BIRD'S CUT OF A CROWN'S LAND POT — the pot divided across every fight
 * actually fought in the bracket, times the fights this bird took.
 *
 * `fighterSlots` is 2 × the fights that happened, i.e. every seat in every fight
 * of the bracket. Byes contribute nothing to either side of the division, which
 * is what makes a bye worth no land (see LAND_POT).
 *
 * Returns HUNDREDTHS, floored. The floor is why `runChampionship` hands the
 * remainder to the champion rather than letting it evaporate: the pot is minted
 * land, so a lost hundredth is a silent gap between what the config says a crown
 * pays and what the ledger shows it paid — exactly the class of leak the land
 * conservation proof exists to catch.
 */
export function landPotShare(potCents: number, fighterSlots: number, fights: number): number {
  if (fighterSlots <= 0 || fights <= 0) return 0;
  return Math.floor((potCents * fights) / fighterSlots);
}

// ── Fight cadence ───────────────────────────────────────────────────────────
// One CARD per bird per GAME-DAY — a hard count, deliberately NOT a 24-hour
// cooldown (fight at 11 PM, fight again at 12:01 AM; fine). Real-time
// complexity stays out until the scheduler arrives.
//
// ⚠ RENAMED IN ROUND 34, because the old name became a lie the moment the
// group stage landed. It was FIGHTS_PER_BIRD_PER_DAY: 1, and both the entry
// gate and the doctor's invariant counted lobby ENTRIES against it — which was
// the same number only while one entry meant one fight. Now one entry means up
// to three, so the cap has to say what it actually caps. Leaving the old name
// would have been worse than cosmetic: the entry gate compares a bird's
// battleLog rows for the day against this, and a bird that had just fought its
// group would show 3 — still correctly over a cap of 1, but only by accident.
export const CADENCE = {
  ENTRIES_PER_BIRD_PER_DAY: 1,
} as const;

// ── Farms (stables — every player + agent runs one) ────────────────────────
// Identity: a name, a country flag (encouraged), and two colors from this
// fixed palette (no hexes yet — iterate later).
// The game week's days, indexed by `dayIndex % 7` — day 0 of the week is a
// Hatch Friday, so 6 is Thursday. Lives here rather than beside the clock
// because the SCHEDULE knobs are what index it (PINTAKASI.DAY_OF_WEEK,
// JUVENILE_MAJOR.DAY_OF_WEEK), and a rule that says "runs on day 6" has to be
// able to say "Thursday" wherever it is quoted.
//
// ⚠ Three Handbook pages still keep private copies of this array. They are
// identical today; if this one is ever reordered they will silently disagree.
export const DAY_NAMES = [
  "Friday", "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday",
] as const;

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
  // Every new farm receives these age-0 eggs, hatching together on its first
  // Hatch Friday. Eight gives a new stable enough discovery-year bodies to
  // card a real week and absorb early attrition without making the gacha the
  // population faucet.
  STARTER_EGGS: 8,
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
