import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { birds, farms, gameState } from "@/db/schema";
import { DEV_FARM_ID, seedGame } from "@/db/seed-data";
import { playMyDay } from "./auto-play";
import { STUD_MARKET } from "./bot-config";
import { BARN, LAND, LT_CENTS, STUD_PRICE, nextExpansionCost } from "./config";
import { Flock } from "./flock";
import { makeBirds } from "./testkit";

/**
 * What Play my day TELLS the player, checked against what the honest day did.
 * The two steps here are the ones a player would not guess from "plays a
 * careful day": paying for a barn expansion out of staked land or GP, and the
 * Hatch Friday stud repricing that replaces a hand-set ask.
 */
const expansionLt = nextExpansionCost(0) / LT_CENTS;

function nearlyFullBarn(land: { staked: number; loose: number; gp: number }) {
  const db = createDb(":memory:");
  seedGame(db, { flock: "legacy" });
  db.update(farms)
    .set({ stakedLandCents: land.staked * LT_CENTS, landTokensCents: land.loose, gp: land.gp })
    .where(eq(farms.id, DEV_FARM_ID))
    .run();
  const room = BARN.CAPACITY - BARN.EXPAND_HEADROOM - new Flock(db, DEV_FARM_ID).barnCount();
  // Retired hens: they fill slots without joining the card or the crowns.
  makeBirds(db, room, () => ({ status: "retired", sex: "female" }));
  return db;
}

const stakedLt = (db: ReturnType<typeof createDb>) =>
  (db.select().from(farms).where(eq(farms.id, DEV_FARM_ID)).get()?.stakedLandCents ?? 0) / LT_CENTS;

describe("playMyDay's report", () => {
  test("an expansion paid from the pool reports the unstake apart from the stake", () => {
    const db = nearlyFullBarn({ staked: expansionLt * 2, loose: 0, gp: 10_000 });
    const report = playMyDay(db, DEV_FARM_ID);
    expect(report.barnExpanded).toBe(true);
    // The day's free pull and check-in can bring a token or two loose, so the
    // shortfall is a little under the full price.
    expect(report.ltUnstaked).toBeGreaterThan(expansionLt * 0.9);
    expect(report.ltUnstaked).toBeLessThanOrEqual(expansionLt);
    expect(report.ltBought).toBe(0);
    expect(report.landBoughtGp).toBe(0);
    expect(report.ltStaked).toBeGreaterThanOrEqual(0);
    // Out and in, apart, add up to what the pool did.
    expect(stakedLt(db)).toBe(expansionLt * 2 - report.ltUnstaked + report.ltStaked);
  });

  test("an expansion the pool cannot cover reports the land bought and the GP it cost", () => {
    const db = nearlyFullBarn({ staked: 0, loose: 0, gp: 10_000 });
    const report = playMyDay(db, DEV_FARM_ID);
    expect(report.barnExpanded).toBe(true);
    expect(report.ltUnstaked).toBe(0);
    expect(report.ltBought).toBeGreaterThan(expansionLt * 0.9);
    expect(report.ltBought).toBeLessThanOrEqual(expansionLt);
    expect(report.landBoughtGp).toBe(Math.ceil((report.ltBought * LAND.GP_PER_100_TOKENS) / 100));
  });

  test("on Hatch Friday it names the stud whose hand-set ask the house replaced", () => {
    const db = createDb(":memory:");
    seedGame(db, { flock: "legacy" });
    db.update(gameState).set({ dayIndex: 7 }).where(eq(gameState.id, 1)).run();
    const [stud] = makeBirds(db, 1, () => ({
      status: "retired",
      sex: "male",
      name: "Hand Priced",
      listedStud: 1,
      studPrice: 400,
      studPriceNext: 600, // the owner's own pending ask
    }));
    const report = playMyDay(db, DEV_FARM_ID);
    // No covers sold last week: the cold cut, from the POSTED price.
    const cut = 400 - (400 - STUD_PRICE.FLOOR) * STUD_MARKET.CUT_COLD;
    const to = Math.floor(cut / STUD_MARKET.PRICE_STEP) * STUD_MARKET.PRICE_STEP;
    expect(report.studsRepriced).toEqual([{ birdId: stud.id, name: "Hand Priced", from: 600, to }]);
    const row = db.select().from(birds).where(eq(birds.id, stud.id)).get();
    expect(row?.studPriceNext).toBe(to);
  });

  test("mid-week the same stud keeps its owner's ask", () => {
    const db = createDb(":memory:");
    seedGame(db, { flock: "legacy" });
    db.update(gameState).set({ dayIndex: 9 }).where(eq(gameState.id, 1)).run();
    makeBirds(db, 1, () => ({
      status: "retired",
      sex: "male",
      listedStud: 1,
      studPrice: 400,
      studPriceNext: 600,
    }));
    expect(playMyDay(db, DEV_FARM_ID).studsRepriced).toEqual([]);
  });

  test("the wallet is read with its hundredths", () => {
    const db = createDb(":memory:");
    seedGame(db, { flock: "legacy" });
    db.update(farms).set({ gpCents: 37 }).where(eq(farms.id, DEV_FARM_ID)).run();
    const before = db.select().from(farms).where(eq(farms.id, DEV_FARM_ID)).get();
    const report = playMyDay(db, DEV_FARM_ID);
    expect(report.gpBefore).toBe((before?.gp ?? 0) + 0.37);
  });
});
