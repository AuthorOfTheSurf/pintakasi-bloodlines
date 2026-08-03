import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { DB } from "@/db/client";
import { birds, farms, gachaTokens, gameState } from "@/db/schema";
import {
  BARN,
  BREEDING,
  ECONOMY,
  ELEMENTS,
  GACHA_BIRDS,
  GACHA_TOKENS,
  GACHA_WEIGHTS,
  LAND,
  type Element,
  type GachaToken,
} from "./config";
import { emit } from "./events";
import { Flock, type BirdView } from "./flock";
import { GameClock } from "./game-clock";
import { freshSeed, mulberry32, randInt, weightedPick, type Rng } from "./rng";

export interface GachaResult {
  token: GachaToken;
  pricePaid: number; // 0 when a free pull was used
  freePullUsed: boolean;
  freePullsLeft: number;
  landTokens: number; // every roll pays land, alongside whatever drops
  // Blue/Purple/Gold rolls drop a MYSTERY EGG (random element, hidden sex,
  // no parents) that hatches next Hatch Friday. Null on White/Green — or
  // when the barn is full (barnFull says which).
  egg: BirdView | null;
  barnFull: boolean;
  collection: Record<GachaToken, number>;
}

/**
 * The gacha (ledger item 12, upgraded 2026-08-02): rarity tokens (prizes
 * TBD), a flat land award on every roll, and mystery eggs on Blue+ — the
 * non-breeding bird faucet, balanced against breeding purely by price.
 */
export class Gacha {
  private flock: Flock;

  constructor(
    private database: DB,
    private farmId: string,
    private rng: Rng = mulberry32(freshSeed())
  ) {
    this.flock = new Flock(database, farmId);
  }

  roll(): GachaResult {
    const today = this.database.select().from(gameState).where(eq(gameState.id, 1)).get()!.dayIndex;
    const farm = this.database.select().from(farms).where(eq(farms.id, this.farmId)).get()!;

    // Free pulls (from the daily check-in) spend before GP does.
    const freePullUsed = farm.freePulls > 0;
    const price = freePullUsed ? 0 : ECONOMY.GACHA_ROLL_PRICE;
    if (farm.gp < price) throw new Error(`A roll costs ${ECONOMY.GACHA_ROLL_PRICE} GP — you have ${farm.gp}`);
    this.database
      .update(farms)
      .set({
        gp: farm.gp - price,
        freePulls: freePullUsed ? farm.freePulls - 1 : farm.freePulls,
        landTokens: farm.landTokens + LAND.PER_GACHA_ROLL,
      })
      .where(eq(farms.id, this.farmId))
      .run();

    const token = weightedPick(this.rng, GACHA_WEIGHTS);
    this.database.insert(gachaTokens).values({ farmId: this.farmId, token, rolledDay: today }).run();

    // The mystery egg, on qualifying tiers.
    let egg: BirdView | null = null;
    let barnFull = false;
    const tier = GACHA_BIRDS[token];
    if (tier) {
      if (this.flock.barnCount() >= BARN.CAPACITY) {
        barnFull = true; // the token still counts; the egg is forfeit
      } else {
        const stat = () => randInt(this.rng, tier.statMin, tier.statMax);
        const row = {
          id: randomUUID(),
          farmId: this.farmId,
          name: `Mystery Egg (${token})`,
          sex: this.rng() < BREEDING.FEMALE_CHANCE ? ("female" as const) : ("male" as const),
          status: "egg" as const,
          agility: stat(),
          sight: stat(),
          stamina: stat(),
          gameness: stat(),
          station: stat(),
          condition: stat(),
          element: ELEMENTS[randInt(this.rng, 0, ELEMENTS.length - 1)] as Element,
          halfStars: randInt(this.rng, tier.halfStars[0], tier.halfStars[1]),
          birthWeek: GameClock.weekOf(today),
          birthDay: today,
          motherId: null,
          fatherId: null,
        };
        this.database.insert(birds).values(row).run();
        egg = this.flock.byId(row.id);
      }
    }

    emit(this.database, {
      type: "gacha",
      farmId: this.farmId,
      birdId: egg?.id ?? null,
      gpCents: -price * 100,
      lt: LAND.PER_GACHA_ROLL,
      message:
        `rolled the gacha${freePullUsed ? " (free pull)" : ` (${price} GP)`} — ${token} token, +${LAND.PER_GACHA_ROLL} LT` +
        (egg ? ` — a mystery egg dropped!` : barnFull ? ` — egg forfeit, barn full` : ""),
    });

    const after = this.database.select().from(farms).where(eq(farms.id, this.farmId)).get()!;
    return {
      token,
      pricePaid: price,
      freePullUsed,
      freePullsLeft: after.freePulls,
      landTokens: LAND.PER_GACHA_ROLL,
      egg,
      barnFull,
      collection: this.collection(),
    };
  }

  collection(): Record<GachaToken, number> {
    const counts = Object.fromEntries(GACHA_TOKENS.map((t) => [t, 0])) as Record<GachaToken, number>;
    for (const row of this.database
      .select()
      .from(gachaTokens)
      .where(eq(gachaTokens.farmId, this.farmId))
      .all())
      counts[row.token]++;
    return counts;
  }
}
