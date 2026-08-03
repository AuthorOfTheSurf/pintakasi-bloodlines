import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { farms, gameState } from "@/db/schema";
import { Breeding } from "./breeding";
import { Farms } from "./farms";
import { Flock } from "./flock";
import { Gacha } from "./gacha";
import { Lobbies, type LobbySpec } from "./lobbies";
import { drawStarterNames } from "./naming";
import { mulberry32 } from "./rng";

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
const quietly = (fn: () => unknown) => {
  try {
    fn();
  } catch {
    /* auto-play takes no for an answer, like the bots do */
  }
};

export function playHonestDay(db: DB, farmId: string): void {
  const state = db.select().from(gameState).where(eq(gameState.id, 1)).get();
  if (!state) return;
  const day = state.dayIndex;

  const farmsApi = new Farms(db);
  quietly(() => farmsApi.checkIn(farmId));

  const gacha = new Gacha(db, farmId, mulberry32(9000 + day));
  for (;;) {
    const farm = farmsApi.rowById(farmId);
    if (farm.freePulls <= 0) break;
    quietly(() => gacha.roll());
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

  const lobbies = new Lobbies(db, farmId);
  for (const bird of flockApi.all().filter((b) => b.status === "active")) {
    const spec: LobbySpec =
      bird.age >= 2
        ? { mode: "real", classType: "open", format: "shortKnife" }
        : { mode: "juvenile", classType: "open", format: "shortKnife" };
    quietly(() => lobbies.enter(bird.id, spec));
  }
}

/** Every player-owned (non-bot) stable plays its honest day. */
export function playAllHonestDays(db: DB): void {
  const owned = db.select().from(farms).all().filter((f) => f.isBot === 0);
  for (const farm of owned) playHonestDay(db, farm.id);
}
