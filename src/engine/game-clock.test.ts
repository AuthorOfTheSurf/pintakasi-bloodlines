import { describe, expect, test } from "bun:test";
import { createDb } from "@/db/client";
import { seedGame } from "@/db/seed-data";
import { GameClock } from "./game-clock";

function freshClock() {
  const db = createDb(":memory:");
  seedGame(db);
  return new GameClock(db);
}

describe("calendar math", () => {
  test("day 0 is a Hatch Friday in the Year 3000", () => {
    const s = GameClock.stateOf(0);
    expect(s.isHatchFriday).toBe(true);
    expect(s.date).toContain("Friday");
    expect(s.date).toContain("3000");
    expect(s.weekIndex).toBe(0);
  });

  test("every 7th day is a Friday, nothing else is", () => {
    for (let d = 0; d <= 28; d++) {
      expect(GameClock.isFriday(d)).toBe(d % 7 === 0);
    }
    expect(GameClock.dateOf(7)).toContain("Friday");
    expect(GameClock.dateOf(10)).not.toContain("Friday");
  });
});

describe("ticks", () => {
  test("tickDay advances one day and fires on Fridays only", () => {
    const clock = freshClock();
    const fired: number[] = [];
    for (let i = 0; i < 7; i++) clock.tickDay((w) => fired.push(w));
    expect(clock.currentDay()).toBe(7);
    expect(fired).toEqual([1]); // only day 7 was a Friday
  });

  test("tickWeek from a Friday advances exactly 7 days", () => {
    const clock = freshClock();
    const result = clock.tickWeek();
    expect(result.daysAdvanced).toBe(7);
    expect(result.state.isHatchFriday).toBe(true);
    expect(result.hatchFridaysCrossed).toEqual([1]);
  });

  test("tickWeek mid-week lands on the NEXT Friday (late eggs hatch <7 days)", () => {
    const clock = freshClock();
    clock.tickDay();
    clock.tickDay();
    clock.tickDay(); // Monday, day 3
    const result = clock.tickWeek();
    expect(result.state.dayIndex).toBe(7);
    expect(result.daysAdvanced).toBe(4);
    expect(result.state.isHatchFriday).toBe(true);
  });

  test("weeks derive from days: age = currentWeek - birthWeek", () => {
    const clock = freshClock();
    clock.tickWeek();
    clock.tickWeek();
    clock.tickWeek();
    expect(GameClock.weekOf(clock.currentDay())).toBe(3);
    // a starter retired at age 10 (birthWeek -10) is now 13
    expect(GameClock.weekOf(clock.currentDay()) - -10).toBe(13);
  });
});
