import { expect, test } from "bun:test";
import { createDb } from "@/db/client";
import { seedGame } from "@/db/seed-data";
import { Game } from "./game";
import { baselineBefore, computeTopline } from "./snapshots";

test("every tick writes a snapshot; the baseline spans the last tick exactly", () => {
  const db = createDb(":memory:");
  const { farmId } = seedGame(db, { flock: "legacy" });
  const game = new Game(db, farmId);

  expect(baselineBefore(db, 99)).toBeNull(); // no memory before the first tick

  game.tickDay(); // day 0 → 1 (writes the day-0 baseline + day-1 snapshot)
  game.farms.checkIn(farmId);
  game.tickDay(); // day 1 → 2

  const base = baselineBefore(db, 2)!; // = the day-1 snapshot
  expect(base.day).toBe(1);
  const now = computeTopline(db);
  // The check-in drip moved GP into circulation between the snapshots.
  expect(now.gpCents).toBeGreaterThan(base.gpCents);

  // A week jump leaves the pre-jump snapshot as the diff baseline.
  game.tickWeek(); // → next Friday
  const today = computeTopline(db).day;
  expect(baselineBefore(db, today)!.day).toBe(2);
});
