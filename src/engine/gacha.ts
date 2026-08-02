import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { gachaTokens, gameState } from "@/db/schema";
import { ECONOMY, GACHA_TOKENS, GACHA_WEIGHTS, type GachaToken } from "./config";
import { freshSeed, mulberry32, weightedPick, type Rng } from "./rng";

/**
 * The gacha stub (ledger item 12): pure rarity tokens that correspond to
 * nothing yet. What the MVP tests is pricing and economic flow, not prizes.
 */
export class Gacha {
  constructor(
    private database: DB,
    private rng: Rng = mulberry32(freshSeed())
  ) {}

  roll(): { token: GachaToken; pricePaid: number; collection: Record<GachaToken, number> } {
    const state = this.database.select().from(gameState).where(eq(gameState.id, 1)).get()!;
    if (state.gp < ECONOMY.GACHA_ROLL_PRICE)
      throw new Error(`A roll costs ${ECONOMY.GACHA_ROLL_PRICE} GP — you have ${state.gp}`);
    this.database
      .update(gameState)
      .set({ gp: state.gp - ECONOMY.GACHA_ROLL_PRICE })
      .where(eq(gameState.id, 1))
      .run();

    const token = weightedPick(this.rng, GACHA_WEIGHTS);
    this.database.insert(gachaTokens).values({ token, rolledDay: state.dayIndex }).run();
    return { token, pricePaid: ECONOMY.GACHA_ROLL_PRICE, collection: this.collection() };
  }

  collection(): Record<GachaToken, number> {
    const counts = Object.fromEntries(GACHA_TOKENS.map((t) => [t, 0])) as Record<GachaToken, number>;
    for (const row of this.database.select().from(gachaTokens).all()) counts[row.token]++;
    return counts;
  }
}
