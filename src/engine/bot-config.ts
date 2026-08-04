import type { FarmColor } from "./config";

/**
 * The BOT STABLES — house-run farms that play every game-day so lobbies
 * fill (pure PvP needs live opponents; with a dozen farms the card stays
 * liquid). They are RIVALS, not the house: their GP, land, and birds are
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
  /** Chance to breed when a legal retired pair + the fee are on hand. */
  breedDrive: number;
  /** Chance an age-3+ card is a HARDCORE card (pit nerve). */
  hardcoreNerve: number;
  /** Chance an age-2+ card sells — a claimer at a tag instead of open. */
  sellRate: number;
  /** How high up the tag ladder its claimers card (0 = always 50 GP). */
  tagCourage: number;
  /** The person behind the barn — shown beside the farm name (round 23). */
  handler?: string;
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

export const BOT_FARMS: BotProfile[] = [
  // ── The claim sharks: live off the tag ladder, barely breed ─────────────
  {
    id: "bot-1", name: "Sabungero Syndicate", country: "🇵🇭",
    primaryColor: "black", secondaryColor: "gold", style: "claimer",
    flockSeed: 101, entryRate: 0.8, claimAggression: 0.75, breedDrive: 0.05,
    hardcoreNerve: 0.05, sellRate: 0.45, tagCourage: 0.3,
  },
  {
    id: "bot-2", name: "Tari ng Bayan", country: "🇵🇭",
    primaryColor: "teal", secondaryColor: "white", style: "claimer",
    flockSeed: 202, entryRate: 0.75, claimAggression: 0.6, breedDrive: 0.1,
    hardcoreNerve: 0.05, sellRate: 0.35, tagCourage: 0.55,
  },
  // ── The broodfarms: breed for the top, sell the surplus ─────────────────
  {
    id: "bot-3", name: "Bulawan Broodfarm", country: "🇵🇭",
    primaryColor: "gold", secondaryColor: "green", style: "breeder",
    flockSeed: 303, entryRate: 0.5, claimAggression: 0.05, breedDrive: 0.9,
    hardcoreNerve: 0.02, sellRate: 0.5, tagCourage: 0.4,
  },
  {
    id: "bot-4", name: "Dugo't Dangal Farms", country: "🇵🇭",
    primaryColor: "red", secondaryColor: "white", style: "breeder",
    flockSeed: 404, entryRate: 0.55, claimAggression: 0.1, breedDrive: 0.7,
    hardcoreNerve: 0.02, sellRate: 0.4, tagCourage: 0.25,
  },
  // ── The pit crews: fight everything, nerve for hardcore ─────────────────
  {
    id: "bot-5", name: "Sagupaan Stables", country: "🇵🇭",
    primaryColor: "orange", secondaryColor: "black", style: "pit",
    flockSeed: 505, entryRate: 0.9, claimAggression: 0.15, breedDrive: 0.3,
    hardcoreNerve: 0.25, sellRate: 0.1, tagCourage: 0.5,
  },
  {
    id: "bot-6", name: "Kidlat sa Silangan", country: "🇵🇭",
    primaryColor: "blue", secondaryColor: "yellow", style: "pit",
    flockSeed: 606, entryRate: 0.85, claimAggression: 0.2, breedDrive: 0.35,
    hardcoreNerve: 0.35, sellRate: 0.15, tagCourage: 0.6,
  },
  // ── Round 19: three more stables — the card was running thin and the
  //    Pintakasi's fields were thinner (seven farms, three crowns a week).
  //    Deeper population = fuller lobbies, fuller brackets, more claims.
  {
    id: "bot-7", name: "Talisay Tari Club", country: "🇵🇭",
    primaryColor: "purple", secondaryColor: "white", style: "pit",
    flockSeed: 707, entryRate: 0.9, claimAggression: 0.1, breedDrive: 0.25,
    hardcoreNerve: 0.45, sellRate: 0.1, tagCourage: 0.45, // the nerviest barn in the game
  },
  {
    id: "bot-8", name: "Cuchillos de Sonora", country: "🇲🇽",
    primaryColor: "green", secondaryColor: "red", style: "claimer",
    flockSeed: 808, entryRate: 0.7, claimAggression: 0.8, breedDrive: 0.15,
    hardcoreNerve: 0.1, sellRate: 0.5, tagCourage: 0.7, // shops the dear end of the tag ladder
  },
  {
    id: "bot-9", name: "Cavite Bloodlines", country: "🇵🇭",
    primaryColor: "brown", secondaryColor: "gold", style: "breeder",
    flockSeed: 909, entryRate: 0.45, claimAggression: 0.05, breedDrive: 0.95,
    hardcoreNerve: 0.08, sellRate: 0.55, tagCourage: 0.2, // breeds first, fights second
  },
  // ── Round 23: the two speculators ───────────────────────────────────────
  {
    id: "bot-10", name: "Ginto Gaming Club", country: "🇵🇭", handler: "Ginto",
    primaryColor: "gold", secondaryColor: "black", style: "whale",
    flockSeed: 1010, entryRate: 0.5, claimAggression: 0.1, breedDrive: 0.2,
    hardcoreNerve: 0.1, sellRate: 0.2, tagCourage: 0.5,
    gachaAppetite: 1, // rolls every single day, to the bottom of the wallet
  },
  {
    id: "bot-11", name: "Lupa Land Holdings", country: "🇵🇭", handler: "Lupa",
    primaryColor: "green", secondaryColor: "brown", style: "landlord",
    flockSeed: 1111, entryRate: 0.6, claimAggression: 0.05, breedDrive: 0.3,
    hardcoreNerve: 0.05, sellRate: 0.15, tagCourage: 0.3,
    landAppetite: 1, // maxes the daily land cap, every day, forever
  },
  // ── Round 23: the cousins' stables ──────────────────────────────────────
  // Zane's cousins are the first testers. Their barns run as bots until they
  // take the keys — the handler name is the tag, and Zane renames the farms.
  {
    id: "bot-marco", name: "Marco Gamefarm", country: "🇵🇭", handler: "Marco",
    primaryColor: "red", secondaryColor: "black", style: "pit",
    flockSeed: 1201, entryRate: 0.85, claimAggression: 0.25, breedDrive: 0.35,
    hardcoreNerve: 0.3, sellRate: 0.2, tagCourage: 0.5,
  },
  {
    id: "bot-reno", name: "Reno Gamefarm", country: "🇵🇭", handler: "Reno",
    primaryColor: "blue", secondaryColor: "white", style: "breeder",
    flockSeed: 1202, entryRate: 0.6, claimAggression: 0.1, breedDrive: 0.85,
    hardcoreNerve: 0.1, sellRate: 0.45, tagCourage: 0.35,
  },
  {
    id: "bot-kevin", name: "Kevin Gamefarm", country: "🇵🇭", handler: "Kevin",
    primaryColor: "purple", secondaryColor: "gold", style: "claimer",
    flockSeed: 1203, entryRate: 0.75, claimAggression: 0.7, breedDrive: 0.2,
    hardcoreNerve: 0.15, sellRate: 0.5, tagCourage: 0.6,
  },
];
