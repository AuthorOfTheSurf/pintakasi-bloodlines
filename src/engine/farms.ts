import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { DB } from "@/db/client";
import { farms, gameState, type FarmRow } from "@/db/schema";
import { ECONOMY, FARM_COLORS, LAND, type FarmColor } from "./config";

export interface FarmView {
  id: string;
  name: string;
  country: string | null;
  primaryColor: string;
  secondaryColor: string;
  gp: number; // decimal — whole GP + cents (staking yield goes fractional)
  landTokens: number; // liquid land
  stakedLand: number; // land in THE pool — earning the breed-fee cut daily
  freePulls: number;
  checkedInToday: boolean;
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
        landTokens: 0,
        freePulls: 0,
        createdDay: this.today(),
      })
      .run();
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
    const boughtToday = farm.landBoughtDay === today ? farm.landBoughtToday : 0;
    if (boughtToday + amount > LAND.DAILY_BUY_CAP)
      throw new Error(
        `Daily land cap is ${LAND.DAILY_BUY_CAP} LT — ${farm.name} has ${LAND.DAILY_BUY_CAP - boughtToday} left today`
      );
    const gpPaid = Math.ceil((amount * LAND.GP_PER_100_TOKENS) / 100);
    if (farm.gp < gpPaid) throw new Error(`${amount} LT costs ${gpPaid} GP — you have ${farm.gp}`);
    this.database
      .update(farms)
      .set({
        gp: farm.gp - gpPaid,
        landTokens: farm.landTokens + amount,
        landBoughtDay: today,
        landBoughtToday: boughtToday + amount,
      })
      .where(eq(farms.id, farmId))
      .run();
    return {
      farm: this.view(this.rowById(farmId)),
      bought: amount,
      gpPaid,
      capLeftToday: LAND.DAILY_BUY_CAP - boughtToday - amount,
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
    if (farm.landTokens < amount)
      throw new Error(`${farm.name} holds ${farm.landTokens} liquid LT — cannot stake ${amount}`);
    this.database
      .update(farms)
      .set({ landTokens: farm.landTokens - amount, stakedLand: farm.stakedLand + amount })
      .where(eq(farms.id, farmId))
      .run();
    return { farm: this.view(this.rowById(farmId)), staked: amount };
  }

  /** Unstake freely — the land comes home liquid (still never sellable). */
  unstake(farmId: string, amount: number): { farm: FarmView; unstaked: number } {
    if (!Number.isInteger(amount) || amount <= 0) throw new Error("Unstake a whole, positive number of Land Tokens");
    const farm = this.rowById(farmId);
    if (farm.stakedLand < amount)
      throw new Error(`${farm.name} has ${farm.stakedLand} LT staked — cannot unstake ${amount}`);
    this.database
      .update(farms)
      .set({ landTokens: farm.landTokens + amount, stakedLand: farm.stakedLand - amount })
      .where(eq(farms.id, farmId))
      .run();
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
    const stakers = database.select().from(farms).all().filter((f) => f.stakedLand > 0);
    const totalStaked = stakers.reduce((s, f) => s + f.stakedLand, 0);
    if (pool <= 0 || totalStaked === 0) return { paidGp: 0, stakers: 0 };

    let paid = 0;
    for (const farm of stakers) {
      const share = Math.floor((pool * farm.stakedLand) / totalStaked);
      if (share > 0) creditCents(database, farm.id, share);
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
      landTokens: row.landTokens,
      stakedLand: row.stakedLand,
      freePulls: row.freePulls,
      checkedInToday: row.lastCheckInDay === this.today(),
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
