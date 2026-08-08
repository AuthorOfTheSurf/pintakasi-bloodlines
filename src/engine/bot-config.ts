import type { FarmColor } from "./config";

/**
 * The BOT STABLES — house-run farms that play every game-day so lobbies
 * fill (pure PvP needs live opponents; with the 19-barn roster the card
 * stays liquid). They are RIVALS, not the house: their GP, land, and birds are
 * their own, won and lost by the same rules as everyone else's.
 *
 * This file is the whole personality system — tweak the knobs, restart,
 * done. Every knob is a 0–1 probability unless noted.
 */

// Round 23 adds two SPECULATOR styles. The point isn't liquidity any more —
// it's that the gacha and the land market need somebody with an appetite for
// them, so the sim can show what those doors do when a human walks through.
export type BotStyle = "claimer" | "breeder" | "pit" | "whale" | "landlord";

export interface BotProfile {
  id: string; // stable across reseeds — keys the farm row
  name: string;
  country: string;
  primaryColor: FarmColor;
  secondaryColor: FarmColor;
  /** Flavor label — the knobs below do the actual work. */
  style: BotStyle;
  /** Starter-flock stat roll seed — different birds per bot. */
  flockSeed: number;
  /** Chance an eligible bird gets carded on a given day. */
  entryRate: number;
  /** Chance to place a claim on an appealing tagged bird (max 2/day). */
  claimAggression: number;
  /**
   * DEPTH, not frequency (round 32): the share of this barn's retired hens it
   * intends to cover each day. 0.9 works nearly the whole band, 0.3 works the
   * best third. It used to be a daily coin flip in front of a one-cover cap,
   * which left most hens barren — see BREEDING_PLAN.MIN_HENS_COVERED.
   */
  breedDrive: number;
  /**
   * Which of the three BREEDING_SHAPES this barn breeds toward — an index
   * into that list (0 = agility & sight, 1 = sight & stamina, 2 = stamina &
   * gameness). A barn's house style, stable across reseeds.
   *
   * Spread deliberately unevenly across the roster rather than round-robin:
   * if every shape had exactly the same number of barns behind it, the stud
   * market would offer each one in equal supply forever and a player choosing
   * a shape would face no market at all. Sprint blood being scarcer than
   * deep-water blood is a price signal, and price signals are the game.
   *
   * ROUND 30 DEMOTED IT TO A FALLBACK, and kept it rather than deleting it.
   * The shape a cover aims at is now read off the HEN (see BREEDING_PLAN.
   * OWN_SHAPE_MIN) — but a third of the flock measures near-flat, so "no clear
   * shape of her own" is the common case, not an edge case, and something has
   * to decide for those hens. Left to the hen's noise they would scatter over
   * all three axes at random; left to the house pair the barn still
   * CONCENTRATES, which is what keeps a farm identifiable and the shapes
   * scarce. So: her grain when she has one, the barn's when she doesn't.
   */
  housePair: number;
  /** Chance an age-3+ card is a HARDCORE card (pit nerve). */
  hardcoreNerve: number;
  /** Chance an age-2+ card sells — a claimer at a tag instead of open. */
  sellRate: number;
  /** How high up the tag ladder its claimers card (0 = always the cheapest rung). */
  tagCourage: number;
  /**
   * THE APPETITE TO FIGHT UP (round 42) — chance per card that this barn skips
   * the protection it is entitled to and enters a DEARER class instead.
   *
   * ⚠ WITHOUT THIS KNOB THE WHOLE ROUND MEASURES ZERO, and that is not a
   * hypothesis — it is the third time this exact failure has happened here
   * (claiming in round 19, paid gacha rolls in round 22). Round 42 priced the
   * class ladder so that harder company costs more and mints disproportionately
   * more land, the entire point being that a stable CHOOSES to climb. But
   * `pickOffering` walks PROTECTION_ORDER and takes the most protective rung a
   * bird is eligible for, every time — so a maiden would card maidens at 30 GP
   * forever, an open lobby would only ever hold birds with no cheaper option,
   * and "we want players to ladder up" would be a rule nobody could observe.
   *
   * It is a CHANCE rather than a rule because laddering is a gamble: dearer
   * company is harder company, and the bird is risking more GP per fight for the
   * same 50-ish% of winning. A barn that always climbed would simply be a barn
   * that loses money faster. Scaled per-barn so the population spreads across
   * the ladder instead of all sitting on one rung.
   */
  ladderCourage: number;
  /** The person behind the barn — shown beside the farm name (round 23). */
  handler?: string;
  /**
   * THE HABIT (round 43). Chance per day this barn buys ONE paid gacha roll on
   * top of its free pull. REQUIRED, unlike the whale knob below, because the
   * measured world without it was two barns funding 71% of all championship
   * juice (174,168 of 246,868 GP over 91 days) while the other 18 took their
   * free pulls and paid for nothing — Zane: "currently they just do free spins
   * and thats it… and then one single farm is programmed to blow all it's cash
   * on gatcha. That's not really realistic."
   *
   * Deliberately a SEPARATE knob from gachaAppetite: dumping bundles to the
   * bottom of the wallet is a whale's move, and a modest barn buying one roll
   * with its coffee is a different behaviour that should read differently in
   * the code. The median barn spends 141 GP of its 800 GP daily drip, so an
   * 80 GP roll changes nobody's solvency.
   *
   * ⚠ THE BINDING CONSTRAINT IS EGG SUPPLY, NOT GP. Round 23 raised the roll
   * price 16 → 80 precisely because the gacha out-supplied the breeding barn
   * 8-to-1 ("I want stables primarily breeding to create birds"). Purple and
   * Gold drop eggs at ~6 per 100 rolls, so the roster's habits are tuned to
   * ~0.5 rolls/barn/day — about +50 eggs a season against ~1,400 hatches.
   * Read POPULATION's `supply hatches · gacha eggs · covers` line after any
   * retune here; that line is the guard on a standing ruling.
   */
  gachaHabit: number;
  /**
   * THE HIGH ROLLER (round 23). Chance per day this barn dumps its spare GP
   * into gacha bundles. Zane's model: stables breed, and "human speculation
   * and human high rollers and humans/bots that desire the prizes will drive
   * gatcha rolling" — so one bot exists to BE that person.
   */
  gachaAppetite?: number;
  /**
   * THE LANDLORD (round 23). Chance per day this barn maxes out the daily
   * land-buy cap. Land can't be sold, so this is a pure conviction play: it
   * spends GP on an asset whose only return is the staking yield.
   */
  landAppetite?: number;
}

/**
 * THE WEATHER APPETITE (round 25) — how hard a stable plays the daily element
 * weather. One knob set for every barn: unlike nerve or tag courage, reading
 * the going is not a personality trait, it's just competence, and every
 * conditioner in a real cockpit knows what day it is.
 *
 * WHAT THIS IS A PREFERENCE OVER. Not birds — DAYS. No bird is ever benched
 * for its element; the most that happens is one bird waits one night. That is
 * why both knobs can sit near certainty without the card noticing: a barn
 * still cards essentially its whole flock every day, and the decision only
 * changes at all for the ~36% of birds whose element is ascendant today or
 * tomorrow. The failure mode to avoid is the OTHER shape — a stable that runs
 * only weather-matched birds, which with five elements empties four fifths of
 * the card. Fill first, timing second, always.
 *
 * THE TWO LEVERS ARE NOT SYMMETRICAL. The boost only ever ADDS an entry; the
 * hold only ever REMOVES one. They must not be tuned as a matched pair. The
 * first draft did exactly that (0.5/0.5) and a 35-day sim came back at 20.8%
 * of entries timed against a 20% floor — inside noise — while unmatched went
 * 15.7% → 18.4%: all cost, no signal.
 *
 * WHY THAT FIRST DRAFT FAILED, which is the useful part. Instrumenting the
 * two entry passes in bots.ts showed the liquidity pass (fill the odd lobbies)
 * running at 36% timed off the ORDERING alone, and the styled pass at 12% —
 * far BELOW chance. The liquidity pass had already spent every matched bird
 * before the gated pass got to choose, so the gate was choosing from a pool
 * with the good days picked out of it. The fix was in the ordering, not the
 * knobs: see weatherOrder's third tier.
 *
 * THE CEILING is about 28%, and it is arithmetic, not tuning. Even a barn
 * that cards every matched bird and banks every eve-of-its-day bird still runs
 * the other two thirds of its flock on ordinary days — a bird cannot wait five
 * days for its element or it would never fight at all. A reading much above
 * that means the bots have stopped filling the card; the doctor's weather line
 * and its unmatched rate are meant to be read together.
 *
 * MEASURED, 35 days, 15 stables, against a CONTROL run of the same code with
 * both knobs set to 0:
 *   control   19.4% timed (0.97× — chance, as it should be), unmatched 15.9%
 *   shipped   23.4% timed (1.17×),                            unmatched 16.7%
 * So the timing is real and it cost about a point of unmatched. Read that
 * point with care: repeated 35-day runs land anywhere in 14.8–18.7% unmatched
 * on a 130-bird world, so one point is inside the noise and NOT a licence to
 * spend another one. If a future round wants a stronger reading, take it out
 * of the ordering (free) before taking it out of the hold (not free).
 */
export const WEATHER_APPETITE = {
  /**
   * Extra willingness to card a bird on its OWN element's day, applied to the
   * headroom left in the profile's entryRate: p = rate + (1 − rate) × BOOST.
   *
   * Headroom rather than a multiplier because entryRate runs 0.45–0.9 across
   * the roster, and a flat ×1.5 would be a no-op for the pit crews (0.9 already,
   * capped at 1) while nearly doubling the broodfarms' — the barns that card
   * LEAST would react MOST, which is backwards. Headroom moves every barn the
   * same fraction of the way toward certainty: 0.9 → 0.99, 0.5 → 0.95.
   *
   * High because this lever is nearly free: it can only put MORE birds on the
   * card, so leaning on it helps lobby fill rather than hurting it. It stops
   * short of 1.0 on principle — the edge is 0.25 on a roll, not a certainty,
   * and a barn that NEVER fails to run a matched bird is following a rule
   * rather than reading a card.
   */
  MATCH_BOOST: 0.9,
  /**
   * Chance a bird that is NOT matched today but IS matched tomorrow sits the
   * day out. The only lever here that takes an entry off tonight's card, and
   * it does not hand it back: the bird would have run tomorrow anyway, so a
   * hold is a lost start, not a deferred one.
   *
   * It can still be this high because the liquidity pass overrides it. A held
   * bird is not withdrawn from the barn — it drops to the bottom of the order
   * (weatherOrder tier 2) and still gets pulled in if an odd lobby has nobody
   * else to give it. So the hold yields the moment the card actually needs the
   * body, which is the whole reason it costs so little: at 0.9 the measured
   * unmatched rate came back level with the weather-blind baseline.
   *
   * ONE day of foresight, deliberately. weatherOfDay(today + 1) is free to
   * compute and a player reads it straight off the office header, so a bot
   * holding for tomorrow is using public information. Looking further out
   * would be both unfair and much worse for the card — a bird four days from
   * its element that waits is a bird that does not fight.
   */
  HOLD_FOR_TOMORROW: 0.9,
} as const;

/**
 * THE BREEDING PLAN (round 29) — how a barn picks a stud.
 *
 * Until now it did not pick one. `Bots.playFarm` shuffled the hens, shuffled
 * the studs, and took the first cover that was legal. Round 28 revealed every
 * retired bird's sheet on the stud card precisely so a shopper could read it,
 * and then nobody read it — the same failure mode as claiming in round 19 and
 * paid gacha in round 22: a door with no appetite behind it.
 *
 * The cost of that showed up in the doctor's answer key. Breeding for nothing
 * in particular regresses every line to the middle, and round 29 measured the
 * result: the MEDIAN bird's best blade beat its runner-up by 11 weighted stat
 * points, p90 by only 28. Half the flock had no home blade at all. The fog and
 * the scout report were built to make discovery the skill, and they were
 * pointed at a flock with nothing to discover.
 *
 * So a barn now has a HOUSE SHAPE — one of BREEDING_SHAPES — and scores every
 * legal (hen, stud) pair on the foal it would expect. Expected foal sheet is
 * just the parents' midpoint (BREEDING.STAT_VARIANCE is symmetric noise on top
 * of it), which makes the whole plan readable arithmetic rather than a
 * simulation.
 *
 * The four terms, in Zane's stated order of priority: get the SHAPE, then take
 * station, condition and stars where you can.
 */
export const BREEDING_PLAN = {
  /**
   * Per point the foal's target pair is expected to clear its off-pair by
   * (both measured as two-stat averages, so this is a like-for-like gap).
   *
   * Sized against the LEVEL term below using the balance lab's own numbers,
   * not by feel. A pair carrying +100 on both its stats has a separation of
   * 100 by this arithmetic and measures 67–71% against a flat bird at its two
   * home blades (`pairs`); +100 on all four stats is a separation of 0 and
   * measures 76–85% (`grade`). So a point of LEVEL is genuinely worth more
   * win rate than a point of SEPARATION — roughly 0.30 versus 0.18 in win
   * points per stat point.
   *
   * This deliberately inverts that, about 3×, because the two terms are not
   * under equal pressure. Level rises on its own no matter what anyone does:
   * every barn retires its best birds and stands them at stud, so the stud
   * market drifts upward for free. NOTHING pushes back on shape drifting to
   * zero — which is precisely what the doctor found. An unbiased plan would
   * leave the flock exactly where round 29 found it.
   *
   * Judge it on the doctor's `flock shape` line, not here: median home margin
   * climbing off 11 points is this number working.
   */
  SHAPE_WEIGHT: 0.6,
  /**
   * Per point of the foal's expected four-stat average. Keeps the plan from
   * breeding a beautifully-shaped weakling: a bird 200 points down on every
   * stat loses at EVERY blade, and no amount of shape fixes losing everywhere.
   * Big enough that a genuine level gap still outbids a genuine shape gap —
   * the tilt above is a thumb on the scale, not a veto.
   */
  LEVEL_WEIGHT: 0.5,
  /**
   * Per point of the foal's expected station+condition average — the two
   * behavioral anchors, third on Zane's list. Under the level weight because
   * they key no blade: station pays only when outmatched (measured: +9 points
   * of win rate at full station, and nothing at all against an equal bird) and
   * condition is a multiplier on an edge you already have rather than an edge.
   * They never fight the shape term, so they are pure "take it where you can".
   */
  ANCHOR_WEIGHT: 0.25,
  /**
   * Per HALF-star of the foal's expected inheritance.
   *
   * Lower than it first looks like it should be, and the wheel is why. Stars
   * are the element wheel's volume knob (round 26), and at 5★ a favourable
   * matchup is worth 77–87% — but the wheel is SYMMETRIC: one element in five
   * is prey, one is predator, three are neutral. Averaged over the opponents
   * a bird will actually meet, a big star rating is close to EV-neutral. What
   * makes it worth paying for at all is that stars can be TIMED — the barn
   * picks the day (WEATHER_APPETITE), and the doctor measures ~25% of starred
   * entries running on their own element's day against 20% by chance.
   *
   * So: 15 puts a full 5★ (ten half-stars) at 150 points of score, about the
   * same as 300 points of level. Real money, not a trump card.
   */
  STAR_WEIGHT: 15,
  /**
   * How many (hen, stud) pairs a barn is willing to price before it breeds.
   * A cap on WORK, not a sample of the market: browseStuds is a query per hen,
   * and a broodfarm with twenty retired hens facing a hundred listed studs
   * would otherwise price two thousand foals to buy one cover.
   *
   * Both loops shuffle before the cap bites, and that is not tidiness — it is
   * the whole difference between this plan working and not. browseStuds
   * returns rows in insertion order, so the first cut (cap 60, unshuffled)
   * priced every farm's covers against the SIXTY OLDEST studs in the game:
   * the unselected founders, every single day, forever. Selection was picking
   * perfectly out of exactly the wrong pool, and 91 days of it moved the
   * flock's median home-blade margin from 11.1 to 10.7 — i.e. nothing.
   *
   * Sized to comfortably clear the whole stud market as it stands (117 listed
   * in a 13-week world), so the cap is a runaway guard rather than a real
   * constraint. If the market ever outgrows it, the shuffle keeps what gets
   * dropped honest instead of systematically old.
   */
  MAX_PAIRS_PRICED: 150,
  /**
   * …and how many of those may go to any ONE hen. This is what makes the plan
   * select a DAM as well as a sire.
   *
   * Without it the total cap alone spent a barn's entire budget on the first
   * hen out of the shuffle — 117 studs priced, cap reached, done. Every cover
   * in the game therefore had a chosen father and a RANDOM mother, which
   * halves the selection pressure on shape before `STAT_VARIANCE` (±120 per
   * stat, ~69 points of separation noise per foal) gets to work on what's
   * left. Splitting the budget across several hens costs nothing but a query
   * each and puts both halves of the pairing under the same plan.
   *
   * 40 of ~117 listed studs is still a wide market per hen, and 150/40 means
   * roughly four hens compete for the day's single cover.
   */
  MAX_STUDS_PER_HEN: 40,
  /**
   * THE PER-HEN SHAPE BAR (round 30). How far a hen's own best pair must clear
   * its off-pair before the barn breeds HER shape instead of the house shape.
   * Same unit as SHAPE_WEIGHT prices: a difference of two two-stat averages.
   *
   * Zane's ruling (2026-08-06): "Each hen is different, and ought to be bred
   * strategically. If a hen has b1/b2 oriented stats, it should breed with a
   * b1/b2 oriented rooster if possible." Round 29 aimed every cover in a barn
   * at ONE axis, so roughly two hens in three were being bred across their own
   * grain and the foal's midpoint went on undoing the dam instead of
   * compounding her.
   *
   * WHY THERE IS A BAR AT ALL, rather than always following the hen. A hen at
   * separation 2 is flat, and the "best" of three near-identical numbers is
   * noise. Chasing it would scatter a barn's covers over all three axes at
   * random, which is how you get a farm with no bloodline — and the whole
   * point of housePair is that shapes stay SCARCE and therefore priced.
   *
   * MEASURED, not felt: over the 149 breeding hens in the round-29 sim
   * (sim-20260806-1548), the best-pair separation ran p25 = 32, median = 55.5,
   * p75 = 91. 40 sits just above the first quartile, so about a third of the
   * flock — the genuinely shapeless third — falls back to the house pair and
   * the rest is bred to itself. Raise it if the doctor's shape line stalls
   * because barns are chasing noise; lower it if the three shapes stop being
   * distinguishable from one another.
   */
  OWN_SHAPE_MIN: 40,
  /**
   * The floor on how many hens a barn covers in a day, whatever its style
   * (round 32 — see `breedTarget`). Ruled by Zane 2026-08-06 after the
   * round-31 sim showed 73 of 154 retired hens had never bred once.
   *
   * ⚠ IT MUST STAY BELOW MAX_COVERS_PER_DAY, and the first cut of round 32 did
   * not. With floor === cap the target collapses to `min(freeHens, cap)` for
   * every barn that isn't the landlord, `breedDrive` stops being observable at
   * all, and thirteen stables breed identically while the config comment
   * cheerfully describes three different styles. A test pins the gap now.
   *
   * Three, not five: it is a floor on EFFORT, not a target. A barn with three
   * hens free today works all three whatever its style, which is enough that
   * no good hen rots, while leaving room above for a broodfarm to be visibly
   * a broodfarm.
   */
  MIN_HENS_COVERED: 3,
  /**
   * The daily runaway guard — the most covers any barn buys in one day.
   *
   * Sized against the drip rather than against any observed barn: eight covers
   * is 8 × BREED_FEE, comfortably above one day's DAILY_DRIP, so a barn that
   * ever hits this is spending down its stake and something upstream is wrong.
   * The real limiter is biology — one pregnancy per hen until her egg lays the
   * following Friday — so a band of twenty supports under three covers a day
   * and this cap should almost never bind. It is a brake against a bug.
   */
  MAX_COVERS_PER_DAY: 8,
  /**
   * How many hens beyond the day's target get priced anyway.
   *
   * A priced cover can still fail at the counter — kinship, a stud already
   * covered out for the week, the hen already carrying. Without slack a barn
   * whose top pick bounces simply buys fewer foals than it meant to, and the
   * failures are invisible because `quietly` eats them. Three is roughly one
   * spare per two intended covers at the observed failure rate.
   */
  HENS_PRICED_SLACK: 3,
} as const;

/**
 * THE CROWN CHASE'S APPETITE (round 37).
 *
 * New because round 37 deleted the engine's qualification-points gate and
 * opened Thursday to every age-FORK bird. Restraint that used to be a RULE is
 * now a CHOICE, and a choice needs a knob somewhere a human can find it.
 */
export const CROWN_CHASE = {
  /**
   * How much a bird must have proven before a bot will stand it in a Major.
   *
   * One real win. The Majors are hardcore — every loser force-retires — so a
   * barn that declares its whole age-3 intake is culling itself, and no bot
   * personality should want that. But the number must stay LOW or round 37
   * has changed nothing: the gate it replaces was effectively three real wins,
   * and the point of opening Thursday was to stop that being an absolute wall.
   *
   * `stakesWins` rather than `wins`, because juvenile practice wins are not
   * evidence a bird can survive a hardcore bracket — that is the same line the
   * maiden ladder draws (round 19), and it should be drawn the same way here.
   *
   * Raise it if the doctor's population block shows adult attrition outrunning
   * supply on crown days; lower it (to 0) if championship fields go short.
   */
  CROWN_MIN_REAL_WINS: 1,
} as const;

export const BOT_FARMS: BotProfile[] = [
  // ── The claim sharks: live off the tag ladder, barely breed ─────────────
  {
    id: "bot-1", name: "Sabungero Syndicate", country: "🇵🇭",
    primaryColor: "black", secondaryColor: "gold", style: "claimer",
    flockSeed: 101, entryRate: 0.8, claimAggression: 0.75, breedDrive: 0.05,
    hardcoreNerve: 0.05, sellRate: 0.45, tagCourage: 0.3, ladderCourage: 0.15, housePair: 0,
    gachaHabit: 0.5,
  },
  {
    id: "bot-2", name: "Tari ng Bayan", country: "🇵🇭",
    primaryColor: "teal", secondaryColor: "white", style: "claimer",
    flockSeed: 202, entryRate: 0.75, claimAggression: 0.6, breedDrive: 0.1,
    hardcoreNerve: 0.05, sellRate: 0.35, tagCourage: 0.55, ladderCourage: 0.1, housePair: 1,
    gachaHabit: 0.4,
  },
  // ── The broodfarms: breed for the top, sell the surplus ─────────────────
  {
    id: "bot-3", name: "Bulawan Broodfarm", country: "🇵🇭",
    primaryColor: "gold", secondaryColor: "green", style: "breeder",
    flockSeed: 303, entryRate: 0.5, claimAggression: 0.05, breedDrive: 0.9,
    hardcoreNerve: 0.02, sellRate: 0.5, tagCourage: 0.4, ladderCourage: 0.08, housePair: 2, // deep-water blood
    gachaHabit: 0.3, // covers first — the gacha is a sideline
  },
  {
    id: "bot-4", name: "Dugo't Dangal Farms", country: "🇵🇭",
    primaryColor: "red", secondaryColor: "white", style: "breeder",
    flockSeed: 404, entryRate: 0.55, claimAggression: 0.1, breedDrive: 0.7,
    hardcoreNerve: 0.02, sellRate: 0.4, tagCourage: 0.25, ladderCourage: 0.12, housePair: 1,
    gachaHabit: 0.35,
  },
  // ── The pit crews: fight everything, nerve for hardcore ─────────────────
  {
    id: "bot-5", name: "Sagupaan Stables", country: "🇵🇭",
    primaryColor: "orange", secondaryColor: "black", style: "pit",
    flockSeed: 505, entryRate: 0.9, claimAggression: 0.15, breedDrive: 0.3,
    hardcoreNerve: 0.25, sellRate: 0.1, tagCourage: 0.5, ladderCourage: 0.35, housePair: 2,
    gachaHabit: 0.7, // pit crews are gamblers at heart
  },
  {
    id: "bot-6", name: "Kidlat sa Silangan", country: "🇵🇭",
    primaryColor: "blue", secondaryColor: "yellow", style: "pit",
    flockSeed: 606, entryRate: 0.85, claimAggression: 0.2, breedDrive: 0.35,
    hardcoreNerve: 0.35, sellRate: 0.15, tagCourage: 0.6, ladderCourage: 0.45, housePair: 0, // "lightning" — breeds the break
    gachaHabit: 0.75,
  },
  // ── Round 19: three more stables — the card was running thin and the
  //    Pintakasi's fields were thinner (seven farms, three crowns a week).
  //    Deeper population = fuller lobbies, fuller brackets, more claims.
  {
    id: "bot-7", name: "Talisay Tari Club", country: "🇵🇭",
    primaryColor: "purple", secondaryColor: "white", style: "pit",
    flockSeed: 707, entryRate: 0.9, claimAggression: 0.1, breedDrive: 0.25,
    hardcoreNerve: 0.45, sellRate: 0.1, tagCourage: 0.45, ladderCourage: 0.55, housePair: 2, // the nerviest barn in the game
    gachaHabit: 0.8,
  },
  {
    id: "bot-8", name: "Cuchillos de Sonora", country: "🇲🇽",
    primaryColor: "green", secondaryColor: "red", style: "claimer",
    flockSeed: 808, entryRate: 0.7, claimAggression: 0.8, breedDrive: 0.15,
    hardcoreNerve: 0.1, sellRate: 0.5, tagCourage: 0.7, ladderCourage: 0.2, housePair: 0, // knife barn — shops the dear end of the tag ladder
    gachaHabit: 0.6,
  },
  {
    id: "bot-9", name: "Cavite Bloodlines", country: "🇵🇭",
    primaryColor: "brown", secondaryColor: "gold", style: "breeder",
    flockSeed: 909, entryRate: 0.45, claimAggression: 0.05, breedDrive: 0.95,
    hardcoreNerve: 0.08, sellRate: 0.55, tagCourage: 0.2, ladderCourage: 0.1, housePair: 1, // breeds first, fights second
    gachaHabit: 0.25,
  },
  // ── Round 23: the two speculators ───────────────────────────────────────
  {
    id: "bot-10", name: "Ginto Gaming Club", country: "🇵🇭", handler: "Ginto",
    primaryColor: "gold", secondaryColor: "black", style: "whale",
    flockSeed: 1010, entryRate: 0.5, claimAggression: 0.1, breedDrive: 0.2,
    hardcoreNerve: 0.1, sellRate: 0.2, tagCourage: 0.5, ladderCourage: 0.25, housePair: 1,
    gachaHabit: 1, // a whale's habit is daily by definition
    gachaAppetite: 1, // rolls every single day, to the bottom of the wallet
  },
  {
    id: "bot-11", name: "Lupa Land Holdings", country: "🇵🇭", handler: "Lupa",
    primaryColor: "green", secondaryColor: "brown", style: "landlord",
    flockSeed: 1111, entryRate: 0.6, claimAggression: 0.05, breedDrive: 0.3,
    hardcoreNerve: 0.05, sellRate: 0.15, tagCourage: 0.3, ladderCourage: 0.15, housePair: 2,
    gachaHabit: 0.4,
    landAppetite: 1, // maxes the daily land cap, every day, forever
  },
  // ── Round 23: the cousins' stables ──────────────────────────────────────
  // Zane's cousins are the first testers. Their barns run as bots until they
  // take the keys — the handler name is the tag, and Zane renames the farms.
  {
    id: "bot-marco", name: "Marco Gamefarm", country: "🇵🇭", handler: "Marco",
    primaryColor: "red", secondaryColor: "black", style: "pit",
    flockSeed: 1201, entryRate: 0.85, claimAggression: 0.25, breedDrive: 0.35,
    hardcoreNerve: 0.3, sellRate: 0.2, tagCourage: 0.5, ladderCourage: 0.4, housePair: 2,
    gachaHabit: 0.7,
  },
  {
    id: "bot-reno", name: "Reno Gamefarm", country: "🇵🇭", handler: "Reno",
    primaryColor: "blue", secondaryColor: "white", style: "breeder",
    flockSeed: 1202, entryRate: 0.6, claimAggression: 0.1, breedDrive: 0.85,
    hardcoreNerve: 0.1, sellRate: 0.45, tagCourage: 0.35, ladderCourage: 0.2, housePair: 1,
    gachaHabit: 0.35,
  },
  {
    id: "bot-kevin", name: "Kevin Gamefarm", country: "🇵🇭", handler: "Kevin",
    primaryColor: "purple", secondaryColor: "gold", style: "claimer",
    flockSeed: 1203, entryRate: 0.75, claimAggression: 0.7, breedDrive: 0.2,
    hardcoreNerve: 0.15, sellRate: 0.5, tagCourage: 0.6, ladderCourage: 0.3, housePair: 0,
    gachaHabit: 0.5,
  },
  // ── Round 37: five more stables — chosen to fill HOLES, not to add bodies ─
  //
  // Fifteen barns already covered the middle of every knob well. What they did
  // NOT cover was the extremes, and an extreme is where a mechanic actually
  // gets tested: the whole roster sat between 0.2 and 0.7 on tag courage, the
  // gacha and the land market had exactly ONE customer each, and nobody
  // campaigned lightly. So each of these five is deliberately lopsided, and
  // each one is pointed at a specific door somebody should be walking through.
  {
    // THE SPRINT HOUSE. housePair 0 (agility & sight) is the scarcest blood in
    // the game on purpose — see the note on housePair — but scarcity is only a
    // price signal if there is a supply curve at all, and four barns breeding
    // it at an average drive of 0.2 is barely one. This barn breeds sprint and
    // nothing else, hard, and cards at the short end.
    id: "bot-12", name: "Batangas Sprint Club", country: "🇵🇭", handler: "Tino",
    primaryColor: "yellow", secondaryColor: "black", style: "breeder",
    flockSeed: 1301, entryRate: 0.8, claimAggression: 0.1, breedDrive: 0.85,
    hardcoreNerve: 0.15, sellRate: 0.3, tagCourage: 0.35, ladderCourage: 0.25, housePair: 0,
    gachaHabit: 0.4,
  },
  {
    // THE SECOND LANDLORD — and deliberately NOT a copy of Lupa. Lupa maxes
    // the cap every day forever, which measures the ceiling; nothing measures
    // whether land demand is elastic. This barn buys on about a third of days,
    // so the two together give the land market two different shapes of buyer
    // rather than one very loud one.
    id: "bot-13", name: "Hacienda Verde", country: "🇵🇭", handler: "Doña Pilar",
    primaryColor: "green", secondaryColor: "white", style: "landlord",
    flockSeed: 1302, entryRate: 0.55, claimAggression: 0.05, breedDrive: 0.4,
    hardcoreNerve: 0.05, sellRate: 0.2, tagCourage: 0.3, ladderCourage: 0.12, housePair: 2,
    gachaHabit: 0.35,
    landAppetite: 0.35,
  },
  {
    // THE OCCASIONAL WHALE. Same argument as above, for the gacha: Ginto rolls
    // to the bottom of its wallet every single day, which is one very specific
    // customer. This one splurges now and then — the shape most real spenders
    // have — so gacha revenue stops being a single bot's straight line.
    id: "bot-14", name: "Sugalan Social Club", country: "🇵🇭", handler: "Boyet",
    primaryColor: "pink", secondaryColor: "gold", style: "whale",
    flockSeed: 1303, entryRate: 0.6, claimAggression: 0.2, breedDrive: 0.25,
    hardcoreNerve: 0.2, sellRate: 0.25, tagCourage: 0.55, ladderCourage: 0.3, housePair: 1,
    gachaHabit: 0.8,
    gachaAppetite: 0.3,
  },
  {
    // ⚠ THE CROWN CHASER — this round's stress test, and the reason the roster
    // grew at all this round rather than next. Round 37 opened Thursday: the
    // qualification-points gate is gone and the Selection Committee seats on
    // earnings instead. Nothing in the world tests that hard, because every
    // existing barn campaigns steadily and drifts into a crown.
    //
    // This barn does the opposite. It cards LIGHTLY (0.35 — the lowest in the
    // game), breeds little, and spends its nerve entirely on Thursday: 0.95
    // means it declares for essentially every crown, every week, with whatever
    // it has that has won once. If the open Thursday is going to overfill
    // brackets, cull the adult population, or make the committee's bump line
    // the busiest code in the engine, this is the barn that will show it.
    //
    // Read it in the doctor's championship-field and population blocks. If the
    // fields blow past MAX_BRACKET or adult attrition outruns supply, the brake
    // is CROWN_CHASE.CROWN_MIN_REAL_WINS, not this profile — the barn is doing
    // its job by breaking things.
    id: "bot-15", name: "Ilonggo Ironworks", country: "🇵🇭", handler: "Nonoy",
    primaryColor: "orange", secondaryColor: "teal", style: "pit",
    flockSeed: 1304, entryRate: 0.35, claimAggression: 0.1, breedDrive: 0.15,
    hardcoreNerve: 0.95, sellRate: 0.1, tagCourage: 0.4, ladderCourage: 0.6, housePair: 2,
    gachaHabit: 0.5,
  },
  {
    // THE BOTTOM FEEDER. Round 31 cut the claimer ladder to three rungs
    // [50, 200, 600] and retuned tagCourage for it, but no barn actually lives
    // at the bottom rung: the lowest courage on the roster is 0.2, which still
    // shops the middle. This one always tags cheap and claims constantly — it
    // is the barn that makes the 50 GP rung a real market instead of a rung
    // the config mentions.
    id: "bot-16", name: "Pulang Bagwis", country: "🇵🇭", handler: "Aling Bining",
    primaryColor: "red", secondaryColor: "brown", style: "claimer",
    flockSeed: 1305, entryRate: 0.8, claimAggression: 0.9, breedDrive: 0.1,
    hardcoreNerve: 0.05, sellRate: 0.65, tagCourage: 0.05, ladderCourage: 0.05, housePair: 0,
    gachaHabit: 0.25, // the poorest barn on the roster spends least
  },
];
