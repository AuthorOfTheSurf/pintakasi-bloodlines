import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { DB } from "@/db/client";
import { birds, farms, gachaTokens, gameState } from "@/db/schema";
import {
  BASE_COATS,
  CARRIAGES,
  BREEDING,
  ECONOMY,
  ELEMENTS,
  GACHA_BIRDS,
  GACHA_TOKENS,
  GACHA_WEIGHTS,
  LAND,
  STAKER_FLOWS,
  TRIM_BY_ELEMENT,
  type Carriage,
  type Element,
  type GachaToken,
  fmtLt,
} from "./config";
import { emit, fmtGp } from "./events";
import { Flock, type BirdView } from "./flock";
import { uniqueName } from "./naming";
import { GameClock } from "./game-clock";
import { freshSeed, mulberry32, randInt, weightedPick, type Rng } from "./rng";

export interface GachaResult {
  token: GachaToken;
  pricePaid: number; // 0 when a free pull was used
  freePullUsed: boolean;
  freePullsLeft: number;
  landTokensCents: number; // every roll pays land, alongside whatever drops
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

  /**
   * One roll. A free pull from the daily check-in spends first; past that it
   * costs GP. There is NO daily cap any more (round 23) — at 80 GP the price
   * is the limiter, and the whole point of the repricing is that rolling is a
   * choice a high roller gets to make as often as they can afford it.
   */
  roll(): GachaResult {
    const today = this.today();
    const farm = this.database.select().from(farms).where(eq(farms.id, this.farmId)).get()!;
    const freePullUsed = farm.freePulls > 0;
    const price = freePullUsed ? 0 : ECONOMY.GACHA_ROLL_PRICE;
    if (farm.gp < price)
      throw new Error(`A roll costs ${ECONOMY.GACHA_ROLL_PRICE} GP — you have ${farm.gp}`);
    this.database
      .update(farms)
      .set({
        gp: farm.gp - price,
        freePulls: freePullUsed ? farm.freePulls - 1 : farm.freePulls,
      })
      .where(eq(farms.id, this.farmId))
      .run();
    this.routeSpend(price, 1);
    const drawn = this.draw(today, price, freePullUsed);
    return {
      ...drawn,
      pricePaid: price,
      freePullUsed,
      freePullsLeft: this.database.select().from(farms).where(eq(farms.id, this.farmId)).get()!
        .freePulls,
      landTokensCents: LAND.PER_GACHA_ROLL,
      collection: this.collection(),
    };
  }

  /**
   * THE MULTI (round 23): ELEVEN rolls for the price of ten, bought in one
   * motion for exactly one day's drip. Free pulls are NOT consumed by it —
   * a bundle is a purchase, not a spend of the daily allowance.
   *
   * Why it exists: an 80 GP roll is priced as a luxury, so the gacha needs a
   * door built for someone who wants to commit real money at once. The bonus
   * roll is the house's gift rather than a discount — same eleven rolls, but
   * it reads as generosity, which is the whole psychology of a multi.
   */
  bundle(): { rolls: GachaResult[]; pricePaid: number; eggs: number } {
    const today = this.today();
    const farm = this.database.select().from(farms).where(eq(farms.id, this.farmId)).get()!;
    if (farm.gp < ECONOMY.BUNDLE_PRICE)
      throw new Error(
        `The ${ECONOMY.BUNDLE_ROLLS}-roll bundle costs ${ECONOMY.BUNDLE_PRICE} GP — you have ${farm.gp}`
      );
    this.database
      .update(farms)
      .set({ gp: farm.gp - ECONOMY.BUNDLE_PRICE })
      .where(eq(farms.id, this.farmId))
      .run();
    this.routeSpend(ECONOMY.BUNDLE_PRICE, ECONOMY.BUNDLE_ROLLS);

    const rolls: GachaResult[] = [];
    for (let i = 0; i < ECONOMY.BUNDLE_ROLLS; i++) {
      // ⚠ ROUND 37 — this read `i === ECONOMY.BUNDLE_ROLLS - 1`, which
      // silenced only the LAST roll: the bundle wrote twelve ledger lines
      // rather than the one its doc comment promises, and that one silent
      // roll minted a Land Token that no `lt` delta ever recorded. A single
      // gacha bundle therefore put the world's land books permanently one
      // token out. Every roll is silent now; the summary below carries the
      // whole bundle's land, and an egg still announces itself.
      const drawn = this.draw(today, 0, false, true);
      rolls.push({
        ...drawn,
        pricePaid: 0, // the bundle paid, not this roll
        freePullUsed: false,
        freePullsLeft: this.database.select().from(farms).where(eq(farms.id, this.farmId)).get()!
          .freePulls,
        landTokensCents: LAND.PER_GACHA_ROLL,
        collection: this.collection(),
      });
    }
    const eggs = rolls.filter((r) => r.egg).length;
    // The bundle's land is banked ONCE, here, for all eleven rolls — see the
    // note on the silent flag above.
    const land = LAND.PER_GACHA_ROLL * ECONOMY.BUNDLE_ROLLS;
    emit(this.database, {
      type: "gacha",
      farmId: this.farmId,
      gpCents: -ECONOMY.BUNDLE_PRICE * 100,
      lt: land,
      message:
        `bought the ${ECONOMY.BUNDLE_ROLLS}-roll bundle (${ECONOMY.BUNDLE_PRICE} GP — ` +
        `${ECONOMY.BUNDLE_ROLLS - 1} rolls, one on the house) — +${fmtLt(land)} LT · ` +
        (eggs > 0 ? `${eggs} mystery egg${eggs === 1 ? "" : "s"} dropped!` : "no eggs"),
      data: { bundle: true, rolls: ECONOMY.BUNDLE_ROLLS, price: ECONOMY.BUNDLE_PRICE, eggs, land },
    });
    return { rolls, pricePaid: ECONOMY.BUNDLE_PRICE, eggs };
  }

  private today(): number {
    return this.database.select().from(gameState).where(eq(gameState.id, 1)).get()!.dayIndex;
  }

  /**
   * Where gacha money goes (round 14 routed it out of a silent burn; round 22
   * split it): a slice to the Land Token stakers, the rest to the juice pool
   * that pays the Majors. So rolling directly funds the biggest stage in the
   * game. `rollsCovered` is only for the ledger line.
   */
  private routeSpend(price: number, rollsCovered: number): void {
    if (price <= 0) return;
    const cents = price * 100;
    const stakerCents = Math.round(cents * STAKER_FLOWS.GACHA_SHARE);
    const juiceCents = cents - stakerCents;
    const state = this.database.select().from(gameState).where(eq(gameState.id, 1)).get()!;
    this.database
      .update(gameState)
      .set({
        juicePoolCents: state.juicePoolCents + juiceCents,
        stakerPoolCents: state.stakerPoolCents + stakerCents,
      })
      .where(eq(gameState.id, 1))
      .run();
    emit(this.database, {
      type: "pool_accrual",
      farmId: this.farmId,
      message:
        `gacha spend (${rollsCovered} roll${rollsCovered === 1 ? "" : "s"}): ` +
        `+${fmtGp(stakerCents)} GP staker pool · +${fmtGp(juiceCents)} GP juice pool`,
      data: { stakerPoolCents: stakerCents, juicePoolCents: juiceCents, source: "gacha" },
    });
  }

  /** One draw: the land, the token, and the egg on a qualifying tier. */
  private draw(
    today: number,
    price: number,
    freePullUsed: boolean,
    silent = false
  ): { token: GachaToken; egg: BirdView | null; barnFull: boolean } {
    const farm = this.database.select().from(farms).where(eq(farms.id, this.farmId)).get()!;
    this.database
      .update(farms)
      .set({ landTokensCents: farm.landTokensCents + LAND.PER_GACHA_ROLL })
      .where(eq(farms.id, this.farmId))
      .run();

    const token = weightedPick(this.rng, GACHA_WEIGHTS);
    this.database.insert(gachaTokens).values({ farmId: this.farmId, token, rolledDay: today }).run();

    // The mystery egg — Purple and Gold only since round 23 (Blue's
    // sub-starter body was filling barns the breeding pen should fill).
    let egg: BirdView | null = null;
    let barnFull = false;
    const tier = GACHA_BIRDS[token];
    if (tier) {
      if (this.flock.barnCount() >= this.flock.capacity()) {
        barnFull = true; // the token still counts; the egg is forfeit
      } else {
        const stat = () => randInt(this.rng, tier.statMin, tier.statMax);
        const row = {
          id: randomUUID(),
          farmId: this.farmId,
          name: uniqueName(this.database, `Mystery Egg (${token})`),
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
          // A gacha bird's carriage is a free roll on both the lean and the
          // magnitude — no parents to inherit from (round 23).
          carriage: CARRIAGES[randInt(this.rng, 0, CARRIAGES.length - 1)] as Carriage,
          carriageHalfStars: randInt(this.rng, tier.halfStars[0], tier.halfStars[1]),
          // Generation 0 like a starter (round 30): a mystery egg enters the
          // world from OUTSIDE the bloodline, so it starts the count over.
          generation: 0,
          birthWeek: GameClock.weekOf(today),
          birthDay: today,
          motherId: null,
          fatherId: null,
          named: 0, // "Mystery Egg (…)" is an auto-name — the naming law applies
          baseCoat: BASE_COATS[randInt(this.rng, 0, BASE_COATS.length - 1)],
          trimColor: "", // resolved below, once the element is fixed
        };
        row.trimColor = TRIM_BY_ELEMENT[row.element][this.rng() < 0.5 ? 0 : 1];
        this.database.insert(birds).values(row).run();
        egg = this.flock.byId(row.id);
      }
    }

    // A bundle writes ONE summary line instead of eleven — except for the
    // eggs, which are the news and always get announced.
    if (!silent || egg) {
      emit(this.database, {
        type: "gacha",
        farmId: this.farmId,
        birdId: egg?.id ?? null,
        gpCents: -price * 100,
        // ⚠ ROUND 37 — the land delta belongs to exactly ONE ledger row.
        // A silent roll only reaches this emit because it dropped an egg,
        // and its land is already counted in the bundle's summary line. If
        // this reported it again the world would show more land in its
        // ledger than in its farms, which is precisely what the new LT
        // conservation invariant refuses.
        lt: silent ? undefined : LAND.PER_GACHA_ROLL,
        message:
          `rolled the gacha${freePullUsed ? " (free pull)" : price > 0 ? ` (${price} GP)` : " (bundle)"}` +
          ` — ${token} token` +
          (silent ? "" : `, +${fmtLt(LAND.PER_GACHA_ROLL)} LT`) +
          (egg ? ` — a mystery egg dropped!` : barnFull ? ` — egg forfeit, barn full` : ""),
        data: { token, price, free: freePullUsed, land: LAND.PER_GACHA_ROLL, egg: egg?.name ?? null },
      });
    }
    return { token, egg, barnFull };
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
