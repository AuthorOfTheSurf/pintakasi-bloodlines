import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { events, farms, gameState } from "@/db/schema";
import { seedGame, seedStarterFlock } from "@/db/seed-data";
import { Breeding, splitBreedFee } from "./breeding";
import { ECONOMY, ENTRY_FEES, FIGHTS_PER_GROUP_BIRD, LT_CENTS, stakePerFight } from "./config";
import { Farms } from "./farms";
import { Game } from "./game";
import { mulberry32 } from "./rng";
import { onCard } from "./testkit";

/**
 * The unified ledger: every money/land/lifecycle touchpoint appends a
 * self-contained row. These tests pin the emission points — the admin
 * view is only as honest as the ledger underneath it.
 */

/**
 * What the ADULT OPEN night costs — the one key every fight test below cards.
 *
 * Round 42 deleted `ECONOMY.REAL_ENTRY_FEE`: there is no such thing as "the real
 * entry fee" any more, because every rung of the class ladder is priced
 * separately. These tests are about what the LEDGER writes, not about pricing, so
 * they name the rung they card and read its fee off the table.
 */
const OPEN_FEE = ENTRY_FEES.real.open;

function world() {
  const db = createDb(":memory:");
  const dev = seedGame(db, { flock: "legacy" });
  const game = new Game(db, dev.farmId);
  const { farm: rival } = game.farms.register({
    name: "Rival Gamefarm",
    primaryColor: "black",
    secondaryColor: "red",
  });
  seedStarterFlock(db, rival.id, { seed: 42, idPrefix: "rival", shape: "legacy" });
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

    // [0] is the genesis juice seed (round 20) — the cover's cut is next.
    const pools = ofType(w.db, "pool_accrual")[1];
    expect(pools.farmId).toBeNull(); // a world event
    expect(JSON.parse(pools.data!)).toEqual({
      stakerPoolCents: split.stakerPoolCents,
      juicePoolCents: split.juicePoolCents,
      // Named since round 24 — the breed cut was the one accrual that never
      // said where it came from, so the doctor's inflow report had to guess.
      source: "breed",
    });
  });

  test("a fight day: entries escrow, each fight is one world row, each entry settles", () => {
    const w = world();
    const spec = onCard(w.db, { mode: "real", classType: "open" });
    w.game.lobbies.enter("starter-6", spec, 77); // Alab
    w.game.lobbies.enter("starter-7", spec); // Sinag — Alab's barn-mate
    const rivalLobbies = new Game(w.db, w.rivalId).lobbies;
    rivalLobbies.enter("rival-6", spec); // rival Alab
    w.game.tickDay();

    const entries = ofType(w.db, "entry");
    expect(entries.length).toBe(3);
    expect(entries[0].gpCents).toBe(-OPEN_FEE * 100); // the WHOLE fee escrows
    expect(entries[0].message).toContain("OPEN"); // "REAL" is the unsaid default (round 20)

    // ⚠ ROUND 34 REWROTE THE SECOND HALF OF THIS TEST, and the old shape can't
    // be recovered: three entries used to mean one pair and one stranded
    // barn-mate, so there was a `refund` row to assert. The group stage puts
    // all three in one group, and the two dev birds each get a card off the
    // visitor — nobody is stranded, so nothing refunds in full. What every
    // entry gets instead is a `card_settled` row.
    const stake = stakePerFight(OPEN_FEE);
    const fights = ofType(w.db, "fight");
    expect(fights.length).toBe(2); // one row per fight, not per side
    expect(fights[0].farmId).toBeNull();
    expect(fights[0].message).toContain(" def. ");
    // The pot is two STAKES, not two fees (round 34) — and the rake has been
    // zero since round 23, so the line mentions no rake at all.
    expect(fights[0].message).toContain(`pot ${stake * 2} GP`);
    expect(fights[0].message).not.toContain("to stakers");
    expect(fights[0].message).toContain("group 1");

    expect(ofType(w.db, "refund").length).toBe(0); // nobody drew nobody
    const settled = ofType(w.db, "card_settled");
    expect(settled.length).toBe(3);
    // The dev birds fought once of three and are handed the rest back; the
    // visitor fought twice. All three lines say what came home.
    const devSettled = settled.filter((e) => e.farmId === w.devId);
    expect(devSettled.length).toBe(2);
    expect(devSettled.every((e) => e.gpCents === (OPEN_FEE - stake) * 100)).toBe(true);
    expect(devSettled[0].message).toContain("GP unfought and returned");
    const rivalSettled = settled.find((e) => e.farmId === w.rivalId)!;
    expect(rivalSettled.gpCents).toBe((OPEN_FEE - 2 * stake) * 100);
    expect(rivalSettled.message).toContain(`2 of ${FIGHTS_PER_GROUP_BIRD} fights`);
  });

  test("a bird alone in a room still refunds in full — the one case groups can't fix", () => {
    const w = world();
    w.game.lobbies.enter("starter-6", onCard(w.db, { mode: "real", classType: "open" }), 77);
    w.game.tickDay();
    const refunds = ofType(w.db, "refund");
    expect(refunds.length).toBe(1);
    expect(refunds[0].farmId).toBe(w.devId);
    expect(refunds[0].gpCents).toBe(OPEN_FEE * 100);
    expect(refunds[0].message).toContain("drew nobody");
    expect(ofType(w.db, "card_settled").length).toBe(0); // land is for fighting
  });

  test("staking writes both sides: the stake and the daily yield", () => {
    const w = world();
    // 10 whole tokens in the column's own unit (hundredths, round 36) — stake()
    // takes the whole number and the log line quotes it back the same way.
    w.db.update(farms).set({ landTokensCents: 10 * LT_CENTS }).where(eq(farms.id, w.devId)).run();
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
