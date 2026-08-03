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

export type BotStyle = "claimer" | "breeder" | "pit";

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
}

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
];
