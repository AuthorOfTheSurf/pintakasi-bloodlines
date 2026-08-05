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
  // Recalibrated for round 27's engine (uniform 100 wind rescaled every
  // damageMult, so pace-per-damageMult moved on every blade).
  GHOST_PACE: { b1: 8.0, b2: 6.2, b3: 4.3, b4: 3.7, b5: 3.4 },
  GHOST_FIGURE: 100, //  what matching the ghost's pace scores
  CLASS_BASE: 320, //    the starter band's middle — class credit starts here
  CLASS_DIVISOR: 20, //  each 20 points of beaten-opponent average = +1 figure
  BEATEN_SCALE: 45, //   figure points subtracted across a full-margin loss
  MIN_BEATEN: 5, //      a loss is always at least one band below the win
  NOISE: 4, //           ± uniform, ONE roll per fight (the track variant)
  BAND: 5, //            displayed to the nearest 5
  MAX: 150, //           clamp range [0, MAX] — headroom for bred stock
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
  // An unread blade scores the even-starter figure — the same ~50 that
  // GHOST_PACE is tuned to. Reading "nothing known" as "average" is what
  // stops a single lucky 80 from looking like a destiny.
  PRIOR_FIGURE: 50,
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
  // FIXED at B2 and B4 (re-ruled 2026-08-04, round 27 — the rotation dies).
  // The Majors own the ends and the middle of the dial (B1/B3/B5), so the
  // juveniles get the two in-between blades, every week, no parity to
  // remember. A discovery year still sees both halves of the spectrum —
  // and the two crowns no other stage runs.
  BLADES: ["b2", "b4"],
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
  // The week's three blades — FIXED at the ends and the middle of the dial
  // (re-ruled 2026-08-04, round 27). With B5 the dial has a true midpoint,
  // so the crowns sit at B1 / B3 / B5 — sprint, middle, classic, exactly
  // PFL's Sprint/Gallop/Classic — and the old middle-blade rotation dies.
  // B2 and B4 get their stage too: they are the Juvenile Championship's
  // fixed blades (see JUVENILE_MAJOR.BLADES), so every blade crowns
  // SOMEWHERE every single week.
  BLADES: ["b1", "b3", "b5"],
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
