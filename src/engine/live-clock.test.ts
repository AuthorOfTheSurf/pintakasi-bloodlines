import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { claims, farms, lobbyEntries } from "@/db/schema";
import { DEV_FARM_ID, seedGame } from "@/db/seed-data";
import { Bots } from "./bots";
import { GameClock } from "./game-clock";
import { catchUp, liveTargetDay, parseLiveStart } from "./live-clock";
import { expectConserved } from "./testkit";

const START = "2026-10-13";
/** A Manila wall-clock time, as the instant it is everywhere else. */
const manila = (local: string) => new Date(`${local}+08:00`);

describe("the live calendar", () => {
  test("day 0 is the whole start date in Manila; each Manila midnight adds one", () => {
    expect(liveTargetDay(START, manila("2026-10-13T00:00:00"))).toBe(0);
    expect(liveTargetDay(START, manila("2026-10-13T23:59:59"))).toBe(0);
    expect(liveTargetDay(START, manila("2026-10-14T00:00:00"))).toBe(1);
    expect(liveTargetDay(START, manila("2026-10-16T12:00:00"))).toBe(3);
  });

  test("midnight is Manila's, not UTC's: 16:00 UTC is already tomorrow", () => {
    expect(liveTargetDay(START, new Date("2026-10-13T15:59:59Z"))).toBe(0);
    expect(liveTargetDay(START, new Date("2026-10-13T16:00:00Z"))).toBe(1);
  });

  test("a start date in the future holds the world at day 0", () => {
    expect(liveTargetDay(START, manila("2026-10-01T12:00:00"))).toBe(0);
  });

  test("a malformed or impossible start date is refused", () => {
    expect(() => parseLiveStart("yesterday")).toThrow(/YYYY-MM-DD/);
    expect(() => parseLiveStart("2026-02-30")).toThrow(/calendar date/);
    expect(() => parseLiveStart("2026-13-01")).toThrow(/calendar date/);
  });
});

const ROSTER = ["scripted-1", "scripted-3", "scripted-5", "bot-4"];

function liveWorld() {
  const db = createDb(":memory:");
  // The legacy flock: the owner's barn has fight-age actives on day 0, so a
  // tick that auto-played it would card them and the test would see entries.
  seedGame(db, { flock: "legacy" });
  Bots.seed(db, { flock: "legacy", only: ROSTER });
  return db;
}

describe("catchUp", () => {
  test("missed days run back to back, in order, and a second call does nothing", () => {
    const db = liveWorld();
    const now = manila("2026-10-16T09:30:00");
    const first = catchUp(db, START, now);
    expect(first.ticks.map((t) => t.clock.dayIndex)).toEqual([1, 2, 3]);
    expect(new GameClock(db).currentDay()).toBe(3);

    const again = catchUp(db, START, now);
    expect(again.ticks).toEqual([]);
    expect(new GameClock(db).currentDay()).toBe(3);
    expectConserved(db);
  });

  test("a world ahead of the calendar is never ticked backwards or further", () => {
    const db = liveWorld();
    catchUp(db, START, manila("2026-10-16T09:30:00"));
    const early = catchUp(db, START, manila("2026-10-14T09:30:00"));
    expect(early.ticks).toEqual([]);
    expect(new GameClock(db).currentDay()).toBe(3);
  });

  test("the bots play; the owner's farm and every other player farm are left alone", () => {
    const db = liveWorld();
    const before = db.select().from(farms).where(eq(farms.id, DEV_FARM_ID)).get();
    const { ticks } = catchUp(db, START, manila("2026-10-16T09:30:00"));

    expect(ticks.flatMap((t) => t.bots).length).toBe(ROSTER.length * 3);
    const botEntries = db.select().from(lobbyEntries).all();
    expect(botEntries.length).toBeGreaterThan(0);

    expect(botEntries.filter((e) => e.farmId === DEV_FARM_ID)).toEqual([]);
    expect(db.select().from(claims).where(eq(claims.farmId, DEV_FARM_ID)).all()).toEqual([]);
    const after = db.select().from(farms).where(eq(farms.id, DEV_FARM_ID)).get();
    // No check-in, no pulls, no staking: a hands-off barn's purse is the
    // purse it started with, give or take what the tick itself pays it.
    expect(after?.lastCheckInDay).toBe(before?.lastCheckInDay);
    expect(after?.freePulls).toBe(before?.freePulls);
    expect(after?.gp).toBe(before?.gp);
  });
});
