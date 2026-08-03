import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { events, farms, gameState } from "@/db/schema";
import { seedGame, seedStarterFlock } from "@/db/seed-data";
import { Breeding, splitBreedFee } from "./breeding";
import { ECONOMY } from "./config";
import { Farms } from "./farms";
import { Game } from "./game";
import { mulberry32 } from "./rng";

/**
 * The unified ledger: every money/land/lifecycle touchpoint appends a
 * self-contained row. These tests pin the emission points — the admin
 * view is only as honest as the ledger underneath it.
 */

function world() {
  const db = createDb(":memory:");
  const dev = seedGame(db);
  const game = new Game(db, dev.farmId);
  const { farm: rival } = game.farms.register({
    name: "Rival Gamefarm",
    primaryColor: "black",
    secondaryColor: "red",
  });
  seedStarterFlock(db, rival.id, { seed: 42, idPrefix: "rival" });
  return { db, game, devId: dev.farmId, rivalId: rival.id };
}

const ofType = (db: ReturnType<typeof createDb>, type: string) =>
  db.select().from(events).all().filter((e) => e.type === type);

describe("the unified ledger", () => {
  test("registration and check-in land on the ledger with exact deltas", () => {
    const w = world();
    const reg = ofType(w.db, "farm_registered");
    expect(reg.length).toBe(2); // the seeded dev farm logs its purse too
    expect(reg.map((r) => r.farmId).sort()).toEqual([w.devId, w.rivalId].sort());
    expect(reg[0].gpCents).toBe(ECONOMY.STARTING_GP * 100);

    w.game.farms.checkIn(w.devId);
    const [checkIn] = ofType(w.db, "check_in");
    expect(checkIn.farmId).toBe(w.devId);
    expect(checkIn.gpCents).toBe(ECONOMY.DAILY_DRIP * 100);
    expect(checkIn.message).toContain(`+${ECONOMY.DAILY_DRIP} GP`);
  });

  test("a cover writes the money trail: breed, stud_income, pool_accrual", () => {
    const w = world();
    new Breeding(w.db, w.devId, mulberry32(5)).breed("starter-2", "starter-1");
    const split = splitBreedFee(ECONOMY.BREED_FEE);

    const [breed] = ofType(w.db, "breed");
    expect(breed.farmId).toBe(w.devId);
    expect(breed.gpCents).toBe(-ECONOMY.BREED_FEE * 100);
    expect(breed.message).toContain("Dalisay × Tandang Pula");
    expect(JSON.parse(breed.data!)).toEqual(split);

    const [income] = ofType(w.db, "stud_income");
    expect(income.farmId).toBe(w.devId); // own stud — the share comes home
    expect(income.gpCents).toBe(split.studOwnerCents);

    const [pools] = ofType(w.db, "pool_accrual");
    expect(pools.farmId).toBeNull(); // a world event
    expect(JSON.parse(pools.data!)).toEqual({
      stakerPoolCents: split.stakerPoolCents,
      juicePoolCents: split.juicePoolCents,
    });
  });

  test("a fight day: entries escrow, the fight is one world row, the odd bird refunds", () => {
    const w = world();
    const spec = { mode: "real", classType: "open", format: "shortKnife" } as const;
    w.game.lobbies.enter("starter-6", spec, 77); // Alab
    w.game.lobbies.enter("starter-7", spec); // Sinag — barn-mate, will go unmatched
    const rivalLobbies = new Game(w.db, w.rivalId).lobbies;
    rivalLobbies.enter("rival-6", spec); // rival Alab
    w.game.tickDay();

    const entries = ofType(w.db, "entry");
    expect(entries.length).toBe(3);
    expect(entries[0].gpCents).toBe(-ECONOMY.REAL_ENTRY_FEE * 100);
    expect(entries[0].message).toContain("REAL");

    const fights = ofType(w.db, "fight");
    expect(fights.length).toBe(1); // one row per fight, not per side
    expect(fights[0].farmId).toBeNull();
    expect(fights[0].message).toContain(" def. ");
    expect(fights[0].message).toContain(`pot ${ECONOMY.REAL_ENTRY_FEE * 2} GP`);

    const refunds = ofType(w.db, "refund");
    expect(refunds.length).toBe(1);
    expect(refunds[0].farmId).toBe(w.devId);
    expect(refunds[0].gpCents).toBe(ECONOMY.REAL_ENTRY_FEE * 100);
  });

  test("staking writes both sides: the stake and the daily yield", () => {
    const w = world();
    w.db.update(farms).set({ landTokens: 10 }).where(eq(farms.id, w.devId)).run();
    w.game.farms.stake(w.devId, 10);
    const [stake] = ofType(w.db, "stake");
    expect(stake.message).toContain("staked 10 LT");

    w.db.update(gameState).set({ stakerPoolCents: 250 }).where(eq(gameState.id, 1)).run();
    Farms.distributeStaking(w.db);
    const [payout] = ofType(w.db, "staking_payout");
    expect(payout.farmId).toBe(w.devId);
    expect(payout.gpCents).toBe(250);
    expect(payout.message).toContain("+2.50 GP");
  });

  test("the manual retirement logs", () => {
    const w = world();
    w.game.flock.retire("starter-7"); // Sinag, age 3
    const [retire] = ofType(w.db, "retire");
    expect(retire.message).toContain("Sinag");
    expect(JSON.parse(retire.data!)).toEqual({ by: "manual" });
  });
});
