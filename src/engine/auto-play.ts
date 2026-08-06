import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { farms, gameState } from "@/db/schema";
import {
  chaseCrowns,
  chaseJuvenileCrowns,
  pickOffering,
  type DiscoveryPolicy,
  weatherCardsToday,
  weatherOrder,
} from "./bots";
import { Breeding } from "./breeding";
import { Farms } from "./farms";
import { Flock } from "./flock";
import { Gacha } from "./gacha";
import { Lobbies } from "./lobbies";
import { CLAIMER, ECONOMY, LT_CENTS } from "./config";
import { canHardcore } from "./lifecycle";
import { drawStarterNames } from "./naming";
import { mulberry32, randInt } from "./rng";
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

export function playHonestDay(
  db: DB,
  farmId: string,
  discoveryPolicy: DiscoveryPolicy = "current"
): void {
  const state = db.select().from(gameState).where(eq(gameState.id, 1)).get();
  if (!state) return;
  const day = state.dayIndex;

  const farmsApi = new Farms(db);
  quietly(() => farmsApi.checkIn(farmId));

  // The free pull only (round 23). Round 22 had every stable grinding cheap
  // paid rolls, and the gacha ended up out-supplying the breeding barn 8 to 1
  // — Zane pulled that back: "I want stables primarily breeding to create
  // birds." An honest stable takes its free roll and puts its GP into covers.
  // The rolling is left to the high roller (see the whale bot in bot-config).
  const gacha = new Gacha(db, farmId, mulberry32(9000 + day));
  for (;;) {
    const farm = farmsApi.rowById(farmId);
    if (farm.freePulls <= 0) break;
    quietly(() => gacha.roll());
  }

  const flock = new Flock(db, farmId).all();

  // Studs first, THEN staking: a stud seat costs 100 LT since round 23, and
  // a barn that has already staked every token has nothing liquid to pay it.
  const breeding = new Breeding(db, farmId, mulberry32(500 + day));
  for (const rooster of flock.filter((b) => b.status === "retired" && b.sex === "male"))
    quietly(() => breeding.listStud(rooster.id));

  // Whole tokens in, hundredths stored (round 36) — see the note in bots.ts.
  // Floor, or `stake` throws on a 100× request and `quietly` hides it.
  quietly(() => {
    const whole = Math.floor(farmsApi.rowById(farmId).landTokensCents / LT_CENTS);
    if (whole > 0) farmsApi.stake(farmId, whole);
  });

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
  // …and the discovery-year stage on Wednesday (round 23).
  quietly(() => void chaseJuvenileCrowns(db, farmId, day));

  // Card by style, like the bots do (round 17): one format for everyone
  // piled the whole stable into a single lobby key, where matchmaking's
  // no-barn-mates rule sent most of them home unmatched.
  //
  // …and up the CLASS LADDER (round 19): the old auto-play carded every
  // bird in the open, so player-side stables never used maidens or the
  // conditions ladder at all. Now a bird climbs as it wins at stakes.
  //
  // …and by the GOING (round 25). An honest stable reads the weather board
  // the same way a bot does: it cards its whole flock as before, except that
  // a bird whose element is ascendant TOMORROW will sometimes wait a night
  // for it. There is no boost to apply here — auto-play already cards every
  // eligible bird, so HONEST_ENTRY_RATE is 1 and the matched branch of
  // weatherCardsToday resolves to "yes" on its own. The ordering still
  // matters: matched birds hit the board first, so when a lobby key ends up
  // odd it is a mistimed bird left over, not a well-timed one.
  const cardRng = mulberry32(1100 + day);
  const lobbies = new Lobbies(db, farmId);
  const carding = weatherOrder(
    flockApi.all().filter((b) => b.status === "active"),
    day
  );
  for (const bird of carding) {
    if (!weatherCardsToday(bird, day, cardRng, HONEST_ENTRY_RATE)) continue;
    // ⚠ ROUND 31 deleted the copy of this decision that used to live here.
    // Auto-play and the bots had independently encoded the same ladder and had
    // already drifted apart — auto-play never entered a grown claimer at all,
    // and priced juvenile tags uniformly at random rather than by record. With
    // a daily card there is a third thing to agree about (what is even posted
    // tonight), so the decision now lives in exactly one place.
    const spec = pickOffering(db, AUTO_PLAY_STYLE, bird, cardRng, day, discoveryPolicy);
    if (spec === null) continue; // nothing on tonight's card this bird can enter
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
/** How often a juvenile is carded with a tag on it (round 23). */
/**
 * The honest stable's carding style, in the shape `pickOffering` wants. It is
 * deliberately plainer than any bot profile: a player-side barn sells a fifth
 * of the time and tags near the bottom of the ladder, which is the cautious
 * read a human learning the game would make.
 */
const AUTO_PLAY_STYLE = { sellRate: 0.2, tagCourage: 0.3 };
/**
 * An honest stable cards everything it legally can — that has been true since
 * round 17 and this is just that rule written down, so weatherCardsToday has a
 * base rate to bend. Not a knob: lower it and auto-play starts benching birds
 * for no stated reason.
 */
const HONEST_ENTRY_RATE = 1;

/** Every player-owned (non-bot) stable plays its honest day. */
export function playAllHonestDays(db: DB, discoveryPolicy: DiscoveryPolicy = "current"): void {
  for (const farm of ownedFarms(db)) playHonestDay(db, farm.id, discoveryPolicy);
}

/** …and shops the claimer board once the night's tags are up (see above). */
export function shopAllClaimers(db: DB): void {
  for (const farm of ownedFarms(db)) shopClaimers(db, farm.id);
}

const ownedFarms = (db: DB) => db.select().from(farms).all().filter((f) => f.isBot === 0);
