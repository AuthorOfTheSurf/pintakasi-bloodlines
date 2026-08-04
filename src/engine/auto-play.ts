import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { farms, gameState } from "@/db/schema";
import { bestFormat, chaseCrowns, ladderClass } from "./bots";
import { Breeding } from "./breeding";
import { Farms } from "./farms";
import { Flock } from "./flock";
import { Gacha } from "./gacha";
import { Lobbies, type LobbySpec } from "./lobbies";
import { ECONOMY } from "./config";
import { canHardcore } from "./lifecycle";
import { drawStarterNames } from "./naming";
import { mulberry32 } from "./rng";
import { Tournaments } from "./tournaments";

/**
 * The honest day a player-owned stable plays when nobody is at the keyboard.
 * Zane's ruling (2026-08-03): while the game is sim-driven and the player UI
 * doesn't exist yet, the sim plays ALL stables — his included — so a tick is
 * a tick no matter where it came from (CLI sim or the /admin buttons).
 * Revisit when real players arrive: their farms should NOT be auto-played.
 *
 * The day, in order: check in, spend every free gacha pull, stake all liquid
 * land, stand retired roosters at stud, buy one cover for the first hen with
 * an empty nest, enter every active bird on the card (real at 2+, juvenile
 * under it).
 */
const quietly = (fn: () => unknown): boolean => {
  try {
    fn();
    return true;
  } catch {
    return false; /* auto-play takes no for an answer, like the bots do */
  }
};

export function playHonestDay(db: DB, farmId: string): void {
  const state = db.select().from(gameState).where(eq(gameState.id, 1)).get();
  if (!state) return;
  const day = state.dayIndex;

  const farmsApi = new Farms(db);
  quietly(() => farmsApi.checkIn(farmId));

  // Free pulls first, then PAID rolls up to the daily cap (round 22). The
  // paid pass is the whole point of the repricing: at 80 GP a roll not one
  // stable ever bought a single pull in 35 days, so the gacha's flows into
  // the pools measured exactly zero. A barn rolls while it can spare the GP.
  const gacha = new Gacha(db, farmId, mulberry32(9000 + day));
  for (;;) {
    const farm = farmsApi.rowById(farmId);
    if (farm.freePulls <= 0) break;
    quietly(() => gacha.roll());
  }
  for (let i = 0; i < ECONOMY.PAID_PULLS_PER_DAY; i++) {
    const farm = farmsApi.rowById(farmId);
    if (farm.gp < ECONOMY.GACHA_ROLL_PRICE + AUTO_RESERVE) break;
    if (!quietly(() => gacha.roll())) break; // cap hit, or the barn is full
  }

  const flock = new Flock(db, farmId).all();

  quietly(() => {
    const farm = farmsApi.rowById(farmId);
    if (farm.landTokens > 0) farmsApi.stake(farmId, farm.landTokens);
  });

  const breeding = new Breeding(db, farmId, mulberry32(500 + day));
  for (const rooster of flock.filter((b) => b.status === "retired" && b.sex === "male"))
    quietly(() => breeding.listStud(rooster.id));

  // One cover a day, first hen whose nest is empty (one egg per hen).
  for (const hen of flock.filter((b) => b.status === "retired" && b.sex === "female")) {
    let bred = false;
    quietly(() => {
      const barn = breeding.browseStuds(hen.id);
      if (barn.studs.length > 0) {
        breeding.breed(hen.id, barn.studs[0].birdId);
        bred = true;
      }
    });
    if (bred) break;
  }

  // The naming law (round 14): christen unnamed hatchlings before carding.
  const flockApi = new Flock(db, farmId);
  for (const bird of flock.filter((b) => b.status === "active" && !b.named)) {
    quietly(() => void flockApi.rename(bird.id, drawStarterNames(db, 1, mulberry32(700 + day))[0]));
  }

  // The Pintakasi (rounds 18–19): a specialist for every crown the week is
  // running — one bird per championship, not one per stable. Hardcore: the
  // strongest stables put their strongest birds in; that's the design.
  quietly(() => void chaseCrowns(db, farmId, day, mulberry32(1300 + day)));

  // Card by style, like the bots do (round 17): one format for everyone
  // piled the whole stable into a single lobby key, where matchmaking's
  // no-barn-mates rule sent most of them home unmatched.
  //
  // …and up the CLASS LADDER (round 19): the old auto-play carded every
  // bird in the open, so player-side stables never used maidens or the
  // conditions ladder at all. Now a bird climbs as it wins at stakes.
  const cardRng = mulberry32(1100 + day);
  const lobbies = new Lobbies(db, farmId);
  for (const bird of flockApi.all().filter((b) => b.status === "active")) {
    const format = bestFormat(bird, cardRng);
    const spec: LobbySpec =
      bird.age >= 2
        ? { mode: "real", classType: ladderClass(bird.stakesWins), format }
        : { mode: "juvenile", classType: "open", format };
    quietly(() => lobbies.enter(bird.id, spec));
  }

}

/**
 * Shop the claimer board (round 19). Claiming was a bot-only habit — half
 * the tag ladder's point (birds changing barns) never showed on a player-
 * side stable at all. Two a day, on the same public read the bots use: a
 * winning record, career left, never one of our own.
 *
 * SEPARATE from the honest day on purpose: auto-play runs before the bots
 * card their birds, so at that moment the claimer fields are still empty.
 * The tick calls this afterwards, once tonight's tags are actually posted.
 */
export function shopClaimers(db: DB, farmId: string): void {
  const state = db.select().from(gameState).where(eq(gameState.id, 1)).get();
  if (!state) return;
  const farmsApi = new Farms(db);
  const lobbies = new Lobbies(db, farmId);
  const rng = mulberry32(1700 + state.dayIndex);
  let placed = 0;
  for (const lobby of lobbies.board()) {
    if (placed >= AUTO_CLAIMS_PER_DAY) break;
    if (lobby.classType !== "claimer" || lobby.status !== "open") continue;
    for (const entry of lobby.entries) {
      if (placed >= AUTO_CLAIMS_PER_DAY) break;
      if (entry.mine) continue;
      if (rng() >= AUTO_CLAIM_APPETITE) continue;
      if (entry.bird.career.wins < entry.bird.career.losses) continue; // no lost causes
      if (entry.bird.age > 6) continue; // too little career left to pay for the tag
      if (farmsApi.rowById(farmId).gp <= (lobby.price ?? 0) + AUTO_RESERVE) continue;
      quietly(() => {
        lobbies.claim(entry.entryId);
        placed++;
      });
    }
  }
}

/** Auto-play's claiming appetite — knobs, not doctrine. */
const AUTO_CLAIMS_PER_DAY = 2;
const AUTO_CLAIM_APPETITE = 0.35;
const AUTO_RESERVE = 400; // GP never gambled into a tag

/** Every player-owned (non-bot) stable plays its honest day. */
export function playAllHonestDays(db: DB): void {
  for (const farm of ownedFarms(db)) playHonestDay(db, farm.id);
}

/** …and shops the claimer board once the night's tags are up (see above). */
export function shopAllClaimers(db: DB): void {
  for (const farm of ownedFarms(db)) shopClaimers(db, farm.id);
}

const ownedFarms = (db: DB) => db.select().from(farms).all().filter((f) => f.isBot === 0);
