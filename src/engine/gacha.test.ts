import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { farms } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { gameState } from "@/db/schema";
import {
  BASE_COATS,
  ECONOMY,
  GACHA_BIRDS,
  GACHA_TOKENS,
  GACHA_WEIGHTS,
  LAND,
  STAKER_FLOWS,
  STATS,
  TRIM_BY_ELEMENT,
  type GachaToken,
} from "./config";
import { Flock } from "./flock";
import { Gacha } from "./gacha";
import { Game } from "./game";
import { mulberry32 } from "./rng";

function fresh(opts: { startingGp?: number } = {}) {
  const db = createDb(":memory:");
  const { farmId } = seedGame(db, opts);
  return { db, farmId };
}

describe("gacha", () => {
  test("a roll costs GP and yields a rarity token plus a Land Token", () => {
    const { db, farmId } = fresh();
    const gacha = new Gacha(db, farmId, mulberry32(1));
    const { token, pricePaid, landTokens, freePullUsed, collection } = gacha.roll();
    expect(GACHA_TOKENS).toContain(token);
    expect(pricePaid).toBe(ECONOMY.GACHA_ROLL_PRICE);
    expect(freePullUsed).toBe(false); // no check-in yet, no free pulls
    expect(landTokens).toBe(LAND.PER_GACHA_ROLL);
    expect(collection[token]).toBe(1);
    const farm = db.select().from(farms).where(eq(farms.id, farmId)).get()!;
    expect(farm.gp).toBe(ECONOMY.STARTING_GP - ECONOMY.GACHA_ROLL_PRICE);
    expect(farm.landTokens).toBe(LAND.PER_GACHA_ROLL);
  });

  test("free pulls spend before GP", () => {
    const { db, farmId } = fresh();
    db.update(farms).set({ freePulls: 2 }).where(eq(farms.id, farmId)).run();
    const gacha = new Gacha(db, farmId, mulberry32(9));
    const first = gacha.roll();
    expect(first.freePullUsed).toBe(true);
    expect(first.pricePaid).toBe(0);
    expect(first.freePullsLeft).toBe(1);
    gacha.roll(); // second free pull
    const paid = gacha.roll(); // now GP
    expect(paid.freePullUsed).toBe(false);
    expect(paid.pricePaid).toBe(ECONOMY.GACHA_ROLL_PRICE);
    const farm = db.select().from(farms).where(eq(farms.id, farmId)).get()!;
    expect(farm.gp).toBe(ECONOMY.STARTING_GP - ECONOMY.GACHA_ROLL_PRICE); // only one cost GP
  });

  test("rarity distribution roughly follows the weights (Gold is rare)", () => {
    const { db, farmId } = fresh();
    db.update(farms).set({ gp: 10_000_000 }).where(eq(farms.id, farmId)).run();
    const gacha = new Gacha(db, farmId, mulberry32(2));
    // Round 22 caps PAID rolls per farm per game-day, so a 500-roll sample
    // has to span days — clear the day's counter each time rather than
    // ticking 100 days to make the same point about the weights.
    for (let i = 0; i < 500; i++) {
      db.update(farms).set({ gachaPaidToday: 0 }).where(eq(farms.id, farmId)).run();
      gacha.roll();
    }
    const c = gacha.collection();
    expect(c.White).toBeGreaterThan(c.Gold);
    expect(c.Green).toBeGreaterThan(c.Purple);
    expect(c.White + c.Green + c.Blue + c.Purple + c.Gold).toBe(500);
    // 500 rolls = 500 land tokens, flat and unconditional.
    const farm = db.select().from(farms).where(eq(farms.id, farmId)).get()!;
    expect(farm.landTokens).toBe(500);
  });

  test("Blue+ rolls drop a mystery egg — random element, hidden sex, hatches next Friday", () => {
    const { db, farmId } = fresh();
    db.update(farms).set({ gp: 10_000_000 }).where(eq(farms.id, farmId)).run();
    const gacha = new Gacha(db, farmId, mulberry32(7));
    const flock = new Flock(db, farmId);
    const barnBefore = flock.barnCount();

    let dropped = null;
    let plainRolls = 0;
    for (let i = 0; i < 100 && !dropped; i++) {
      const r = gacha.roll();
      if (r.egg) dropped = r;
      else plainRolls++;
    }
    expect(dropped).not.toBeNull();
    expect(GACHA_BIRDS[dropped!.token]).toBeDefined(); // only qualifying tiers drop
    expect(plainRolls).toBeGreaterThan(0); // and most rolls don't
    const egg = dropped!.egg!;
    expect(egg.status).toBe("egg");
    expect(egg.age).toBe(0);
    expect(egg.sex).toBe("hidden"); // the 50-50 surprise still belongs to hatch day
    expect(egg.motherId).toBeNull(); // no parents — the machine is not kin
    expect(egg.name).toBe(`Mystery Egg (${dropped!.token})`);
    const tier = GACHA_BIRDS[dropped!.token]!;
    expect(egg.halfStars).toBeGreaterThanOrEqual(tier.halfStars[0]);
    expect(egg.halfStars).toBeLessThanOrEqual(tier.halfStars[1]);
    expect(flock.barnCount()).toBeGreaterThan(barnBefore);

    // It hatches like any egg — next Hatch Friday, sex revealed.
    const game = new Game(db, farmId);
    const tick = game.tickWeek();
    expect(tick.fridays[0].hatched.map((b) => b.id)).toContain(egg.id);
    expect(["male", "female"]).toContain(flock.byId(egg.id).sex);
  });

  test("an empty wallet cannot roll", () => {
    const { db, farmId } = fresh({ startingGp: ECONOMY.GACHA_ROLL_PRICE - 1 });
    expect(() => new Gacha(db, farmId, mulberry32(3)).roll()).toThrow(/A roll costs/);
  });

  test("PAID rolls SPLIT to the pools — no GP is ever burned (round 14, split round 22)", () => {
    const { db, farmId } = fresh();
    const gacha = new Gacha(db, farmId, mulberry32(42));
    gacha.roll(); // no free pulls yet — this costs GP
    gacha.roll();
    const state = db.select().from(gameState).where(eq(gameState.id, 1)).get()!;
    const spentCents = 2 * ECONOMY.GACHA_ROLL_PRICE * 100;
    const stakerCents = Math.round(ECONOMY.GACHA_ROLL_PRICE * 100 * STAKER_FLOWS.GACHA_SHARE) * 2;
    // 10% to the stakers, the rest to the juice pool (which opens with the
    // genesis seed, round 20). Not one centavo is burned between them.
    expect(state.stakerPoolCents).toBe(stakerCents);
    expect(state.juicePoolCents).toBe(ECONOMY.SEED_JUICE * 100 + spentCents - stakerCents);
  });

  test("gacha birds are CONSTRAINED — no tier out-muscles bred stock (round 14)", () => {
    // The ruling: gacha stats never meaningfully beat the starter ceiling;
    // the Gold jackpot is STARS (breeding material), not raw stats.
    for (const tier of Object.values(GACHA_BIRDS)) {
      expect(tier.statMax).toBeLessThanOrEqual(STATS.STARTER_MAX + 50);
    }

    // Every dropped egg obeys its tier's stat bounds, wears a coat, and is unnamed.
    const { db, farmId } = fresh();
    db.update(farms).set({ gp: 10_000_000 }).where(eq(farms.id, farmId)).run();
    const gacha = new Gacha(db, farmId, mulberry32(11));
    let eggs = 0;
    for (let i = 0; i < 200 && eggs < 5; i++) {
      db.update(farms).set({ gachaPaidToday: 0 }).where(eq(farms.id, farmId)).run();
      const r = gacha.roll();
      if (!r.egg) continue;
      eggs++;
      const tier = GACHA_BIRDS[r.token]!;
      for (const stat of [r.egg.agility, r.egg.sight, r.egg.stamina, r.egg.gameness, r.egg.station, r.egg.condition]) {
        expect(stat).toBeGreaterThanOrEqual(tier.statMin);
        expect(stat).toBeLessThanOrEqual(tier.statMax);
      }
      expect(r.egg.named).toBe(0); // auto-named — the naming law applies
      expect(BASE_COATS as readonly string[]).toContain(r.egg.baseCoat);
      expect(TRIM_BY_ELEMENT[r.egg.element] as readonly string[]).toContain(r.egg.trimColor);
    }
    expect(eggs).toBeGreaterThan(0);
  });

  // Round 22: cheap rolls, but a limited number of them per day.
  test("five paid rolls a day, then the board is closed until the tick", () => {
    const { db, farmId } = fresh();
    const gacha = new Gacha(db, farmId, mulberry32(77));
    for (let i = 0; i < ECONOMY.PAID_PULLS_PER_DAY; i++) {
      expect(gacha.roll().pricePaid).toBe(ECONOMY.GACHA_ROLL_PRICE);
    }
    expect(() => gacha.roll()).toThrow(/paid rolls today/);
    // A free pull is a separate allowance — it still goes through.
    db.update(farms).set({ freePulls: 1 }).where(eq(farms.id, farmId)).run();
    expect(gacha.roll().pricePaid).toBe(0);
  });

  test("the repricing is what makes rolling rational — an egg now undercuts a cover", () => {
    // The round-22 diagnosis, kept as an assertion: at 80 GP a roll, a ~15%
    // egg rate priced a gacha egg near 543 GP against a 160 GP cover, and 35
    // days of sim produced ZERO paid rolls. The fix has to keep the egg
    // cheaper than breeding one, or nobody rolls again.
    const eggChance = Object.entries(GACHA_WEIGHTS)
      .filter(([token]) => GACHA_BIRDS[token as GachaToken])
      .reduce((s, [, w]) => s + w, 0);
    const totalWeight = Object.values(GACHA_WEIGHTS).reduce((s, w) => s + w, 0);
    const gpPerEgg = ECONOMY.GACHA_ROLL_PRICE / (eggChance / totalWeight);
    expect(gpPerEgg).toBeLessThan(ECONOMY.BREED_FEE);
  });
});
