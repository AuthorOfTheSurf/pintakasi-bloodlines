import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { DB } from "@/db/client";
import { farms, gameState, type FarmRow } from "@/db/schema";
import {
  ECONOMY,
  FARM_COLORS,
  LAND,
  LT_CENTS,
  STAKER_FLOWS,
  barnCapacity,
  fmtLt,
  nextExpansionCost,
  type FarmColor,
} from "./config";
import { emit, fmtGp } from "./events";

export interface FarmView {
  id: string;
  name: string;
  country: string | null;
  primaryColor: string;
  secondaryColor: string;
  gp: number; // decimal — whole GP + cents (staking yield goes fractional)
  landTokensCents: number; // liquid land
  stakedLandCents: number; // land in THE pool — earning the breed-fee cut daily
  freePulls: number;
  checkedInToday: boolean;
  // The FARM's own career record (real + hardcore), stamped at fight time.
  wins: number;
  losses: number;
}

/**
 * Credit a farm in centi-GP, exactly — cents roll into whole GP. This is
 * the only doorway for fractional money (stud shares, staking payouts);
 * everything else in the game stays whole-GP.
 */
export function creditCents(database: DB, farmId: string, cents: number): void {
  if (cents <= 0) return;
  const farm = database.select().from(farms).where(eq(farms.id, farmId)).get()!;
  const total = farm.gpCents + cents;
  database
    .update(farms)
    .set({ gp: farm.gp + Math.floor(total / 100), gpCents: total % 100 })
    .where(eq(farms.id, farmId))
    .run();
}

/**
 * Pay the Land Token staking pool, in centi-GP (round 22). Every flow named
 * in STAKER_FLOWS lands here: the fight rake, the claim rake, the gacha
 * share, the breed cut, and land purchases. The pool splits pro-rata across
 * staked land at the next day tick — see distributeStaking below.
 *
 * `source` is what the ledger will say the money came from, and the events
 * carry the same `pool_accrual` shape the breed cut has always used, so the
 * office's GP tab picks them up without a special case.
 */
export function payStakers(
  database: DB,
  cents: number,
  source: string,
  note: string,
  farmId: string | null = null
): void {
  if (cents <= 0) return;
  const state = database.select().from(gameState).where(eq(gameState.id, 1)).get()!;
  database
    .update(gameState)
    .set({ stakerPoolCents: state.stakerPoolCents + cents })
    .where(eq(gameState.id, 1))
    .run();
  emit(database, {
    type: "pool_accrual",
    farmId,
    message: `${note}: +${fmtGp(cents)} GP staker pool`,
    data: { stakerPoolCents: cents, juicePoolCents: 0, source },
  });
}

export interface RegisterInput {
  name: string;
  country?: string; // flag emoji or country name — encouraged
  primaryColor: FarmColor;
  secondaryColor: FarmColor;
}

/**
 * Farms — one per player or agent. Registration is deliberately low-friction
 * (beta: invite the tester, they call register_farm, done); auth is the
 * returned bearer key. Wallets, land, free pulls, and the daily check-in
 * all live here.
 */
export class Farms {
  constructor(private database: DB) {}

  private today(): number {
    return this.database.select().from(gameState).where(eq(gameState.id, 1)).get()!.dayIndex;
  }

  register(input: RegisterInput): { farm: FarmView; apiKey: string } {
    const name = input.name.trim();
    if (!name) throw new Error("A farm needs a name");
    for (const [label, color] of [
      ["primaryColor", input.primaryColor],
      ["secondaryColor", input.secondaryColor],
    ] as const) {
      if (!FARM_COLORS.includes(color))
        throw new Error(`${label} must be one of: ${FARM_COLORS.join(", ")}`);
    }
    const existing = this.database.select().from(farms).all();
    if (existing.some((f) => f.name.toLowerCase() === name.toLowerCase()))
      throw new Error(`A farm named "${name}" already exists`);

    const id = randomUUID();
    const apiKey = `fk_${randomUUID().replace(/-/g, "")}`;
    this.database
      .insert(farms)
      .values({
        id,
        name,
        country: input.country?.trim() || null,
        primaryColor: input.primaryColor,
        secondaryColor: input.secondaryColor,
        apiKey,
        gp: ECONOMY.STARTING_GP,
        landTokensCents: 0,
        freePulls: 0,
        createdDay: this.today(),
      })
      .run();
    emit(this.database, {
      type: "farm_registered",
      farmId: id,
      gpCents: ECONOMY.STARTING_GP * 100,
      message: `${name} registered — starting purse ${ECONOMY.STARTING_GP} GP`,
    });
    return { farm: this.view(this.rowById(id)), apiKey };
  }

  /**
   * The daily ritual: once per game-day, grants the GP drip (accounts can't
   * be funded yet) and the free gacha pulls. "I logged in" = calling this.
   */
  checkIn(farmId: string): { farm: FarmView; gpDripped: number; freePullsGranted: number } {
    const farm = this.rowById(farmId);
    const today = this.today();
    if (farm.lastCheckInDay === today)
      throw new Error(`${farm.name} already checked in today — tick a day or come back tomorrow`);
    this.database
      .update(farms)
      .set({
        gp: farm.gp + ECONOMY.DAILY_DRIP,
        freePulls: farm.freePulls + ECONOMY.FREE_PULLS_PER_CHECK_IN,
        lastCheckInDay: today,
      })
      .where(eq(farms.id, farmId))
      .run();
    emit(this.database, {
      type: "check_in",
      farmId,
      gpCents: ECONOMY.DAILY_DRIP * 100,
      message: `checked in — +${ECONOMY.DAILY_DRIP} GP drip, +${ECONOMY.FREE_PULLS_PER_CHECK_IN} free pulls`,
    });
    return {
      farm: this.view(this.rowById(farmId)),
      gpDripped: ECONOMY.DAILY_DRIP,
      freePullsGranted: ECONOMY.FREE_PULLS_PER_CHECK_IN,
    };
  }

  /**
   * Buy Land Tokens with GP: 80 GP per 100 LT ($0.01/LT), capped per
   * game-day. One-way — land is never sellable back.
   */
  buyLand(farmId: string, amount: number): { farm: FarmView; bought: number; gpPaid: number; capLeftToday: number } {
    if (!Number.isInteger(amount) || amount <= 0) throw new Error("Buy a whole, positive number of Land Tokens");
    const farm = this.rowById(farmId);
    const today = this.today();
    // ⚠ THE PUBLIC API IS WHOLE TOKENS; THE COLUMN IS HUNDREDTHS (round 36).
    // Land is minted fractionally now — a night's fighting pays 6.73 LT — but
    // BUYING and STAKING are deliberately still whole-number player actions:
    // nobody wants to purchase 6.73 tokens, and a cap ruled as "1,000 LT a
    // day" should read as 1,000 at every surface a player touches. So the
    // conversion happens here, at the one boundary, and every stored figure
    // below this line is in hundredths.
    const cents = amount * LT_CENTS;
    const boughtTodayCents = farm.landBoughtDay === today ? farm.landBoughtToday : 0;
    if (boughtTodayCents + cents > LAND.DAILY_BUY_CAP)
      throw new Error(
        `Daily land cap is ${LAND.DAILY_BUY_CAP / LT_CENTS} LT — ${farm.name} has ` +
          `${(LAND.DAILY_BUY_CAP - boughtTodayCents) / LT_CENTS} left today`
      );
    const gpPaid = Math.ceil((amount * LAND.GP_PER_100_TOKENS) / 100);
    if (farm.gp < gpPaid) throw new Error(`${amount} LT costs ${gpPaid} GP — you have ${farm.gp}`);
    this.database
      .update(farms)
      .set({
        gp: farm.gp - gpPaid,
        landTokensCents: farm.landTokensCents + cents,
        landBoughtDay: today,
        landBoughtToday: boughtTodayCents + cents,
      })
      .where(eq(farms.id, farmId))
      .run();
    emit(this.database, {
      type: "buy_land",
      farmId,
      gpCents: -gpPaid * 100,
      lt: cents,
      message: `bought ${amount} LT for ${gpPaid} GP`,
    });
    // …and the payment goes to the people already staking (round 22). Before
    // this it went NOWHERE — deducted from the wallet and never banked, a
    // silent burn that would have broken the conservation proof the moment
    // anyone bought land. No sim ever caught it because the bots only stake
    // land they EARN. It's also the fair answer to dilution: new supply
    // waters down every existing staker's share, so the buyer pays them.
    payStakers(
      this.database,
      Math.round(gpPaid * 100 * STAKER_FLOWS.LAND_PURCHASE_SHARE),
      "land_purchase",
      `${farm.name} bought ${amount} LT`,
      farmId
    );
    return {
      farm: this.view(this.rowById(farmId)),
      bought: amount,
      gpPaid,
      // Reported in WHOLE tokens, like the amount the caller asked for.
      capLeftToday: (LAND.DAILY_BUY_CAP - boughtTodayCents - cents) / LT_CENTS,
    };
  }

  /**
   * Stake land into THE pool (single pool for now — breeding/arena pools
   * may split later). Staked land earns the breed-fee staker cut, paid
   * pro-rata at every day tick. Stack it — it may be worth real money one
   * day; it is NEVER sellable either way.
   */
  stake(farmId: string, amount: number): { farm: FarmView; staked: number } {
    if (!Number.isInteger(amount) || amount <= 0) throw new Error("Stake a whole, positive number of Land Tokens");
    const farm = this.rowById(farmId);
    // Whole tokens in, hundredths stored — see buyLand's note.
    const cents = amount * LT_CENTS;
    if (farm.landTokensCents < cents)
      throw new Error(
        `${farm.name} holds ${fmtLt(farm.landTokensCents)} liquid LT — cannot stake ${amount}`
      );
    this.database
      .update(farms)
      .set({ landTokensCents: farm.landTokensCents - cents, stakedLandCents: farm.stakedLandCents + cents })
      .where(eq(farms.id, farmId))
      .run();
    emit(this.database, {
      type: "stake",
      farmId,
      message: `staked ${amount} LT (now ${fmtLt(farm.stakedLandCents + cents)} staked / ${fmtLt(farm.landTokensCents - cents)} liquid)`,
    });
    return { farm: this.view(this.rowById(farmId)), staked: amount };
  }

  /**
   * Buy the next barn expansion: +BARN.EXPANSION_SLOTS slots for an ESCALATING
   * Land Token burn — the (n+1)th expansion costs (n+1) × EXPANSION_BASE_LT.
   * See the BARN config comment for the ruling and why the price climbs.
   *
   * The land is SPENT, not staked — it leaves the world exactly like a stud
   * seat does, and the emit carries a signed negative `lt` so the land
   * conservation proof can see the burn. An unlogged burn here would fail
   * `checkLandConservation` on the first expansion anyone bought.
   */
  expandBarn(farmId: string): { farm: FarmView; expansions: number; capacity: number; landSpent: number } {
    const farm = this.rowById(farmId);
    const cost = nextExpansionCost(farm.barnExpansions);
    if (farm.landTokensCents < cost)
      throw new Error(
        `Expansion #${farm.barnExpansions + 1} costs ${cost / LT_CENTS} LT — ${farm.name} holds ` +
          `${fmtLt(farm.landTokensCents)} liquid (unstake some, or earn more in the pit)`
      );
    const expansions = farm.barnExpansions + 1;
    this.database
      .update(farms)
      .set({ landTokensCents: farm.landTokensCents - cost, barnExpansions: expansions })
      .where(eq(farms.id, farmId))
      .run();
    emit(this.database, {
      type: "barn_expanded",
      farmId,
      lt: -cost,
      message:
        `barn expanded to ${barnCapacity(expansions)} slots — ` +
        `${cost / LT_CENTS} LT paid for expansion #${expansions}`,
    });
    return {
      farm: this.view(this.rowById(farmId)),
      expansions,
      capacity: barnCapacity(expansions),
      landSpent: cost,
    };
  }

  /** Unstake freely — the land comes home liquid (still never sellable). */
  unstake(farmId: string, amount: number): { farm: FarmView; unstaked: number } {
    if (!Number.isInteger(amount) || amount <= 0) throw new Error("Unstake a whole, positive number of Land Tokens");
    const farm = this.rowById(farmId);
    const cents = amount * LT_CENTS;
    if (farm.stakedLandCents < cents)
      throw new Error(`${farm.name} has ${fmtLt(farm.stakedLandCents)} LT staked — cannot unstake ${amount}`);
    this.database
      .update(farms)
      .set({ landTokensCents: farm.landTokensCents + cents, stakedLandCents: farm.stakedLandCents - cents })
      .where(eq(farms.id, farmId))
      .run();
    emit(this.database, {
      type: "unstake",
      farmId,
      message: `unstaked ${amount} LT (now ${fmtLt(farm.stakedLandCents - cents)} staked / ${fmtLt(farm.landTokensCents + cents)} liquid)`,
    });
    return { farm: this.view(this.rowById(farmId)), unstaked: amount };
  }

  /**
   * The daily staking payout, run at the tick: the staker pool (breed-fee
   * cuts accrued in centi-GP) splits pro-rata across staked land. Integer
   * floor per farm; the dust carries in the pool for tomorrow. No stakers
   * → the whole pool carries.
   */
  static distributeStaking(database: DB): { paidGp: number; stakers: number } {
    const state = database.select().from(gameState).where(eq(gameState.id, 1)).get()!;
    const pool = state.stakerPoolCents;
    const stakers = database.select().from(farms).all().filter((f) => f.stakedLandCents > 0);
    const totalStaked = stakers.reduce((s, f) => s + f.stakedLandCents, 0);
    if (pool <= 0 || totalStaked === 0) return { paidGp: 0, stakers: 0 };

    let paid = 0;
    for (const farm of stakers) {
      const share = Math.floor((pool * farm.stakedLandCents) / totalStaked);
      if (share > 0) {
        creditCents(database, farm.id, share);
        emit(database, {
          type: "staking_payout",
          farmId: farm.id,
          gpCents: share,
          message: `staking yield +${fmtGp(share)} GP on ${fmtLt(farm.stakedLandCents)} staked LT`,
        });
      }
      paid += share;
    }
    database
      .update(gameState)
      .set({ stakerPoolCents: pool - paid })
      .where(eq(gameState.id, 1))
      .run();
    return { paidGp: paid / 100, stakers: stakers.length };
  }

  byKey(apiKey: string): FarmRow {
    const row = this.database.select().from(farms).where(eq(farms.apiKey, apiKey)).get();
    if (!row) throw new Error("Unknown farm key");
    return row;
  }

  /** Dev convenience: when exactly one farm exists, no key is needed. */
  soleFarm(): FarmRow | null {
    const all = this.database.select().from(farms).all();
    return all.length === 1 ? all[0] : null;
  }

  rowById(id: string): FarmRow {
    const row = this.database.select().from(farms).where(eq(farms.id, id)).get();
    if (!row) throw new Error(`No farm with id ${id}`);
    return row;
  }

  view(row: FarmRow): FarmView {
    return {
      id: row.id,
      name: row.name,
      country: row.country,
      primaryColor: row.primaryColor,
      secondaryColor: row.secondaryColor,
      gp: row.gp + row.gpCents / 100,
      landTokensCents: row.landTokensCents,
      stakedLandCents: row.stakedLandCents,
      freePulls: row.freePulls,
      checkedInToday: row.lastCheckInDay === this.today(),
      wins: row.wins,
      losses: row.losses,
    };
  }

  /** The public scoreboard — every farm's identity, no keys. */
  all(): FarmView[] {
    return this.database
      .select()
      .from(farms)
      .all()
      .map((row) => this.view(row));
  }
}
