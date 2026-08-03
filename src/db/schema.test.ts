import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "./client";
import { birds, farms, gameState } from "./schema";
import { seedGame } from "./seed-data";
import { ECONOMY, STATS } from "@/engine/config";

describe("seeded database", () => {
  const db = createDb(":memory:");
  const { farmId } = seedGame(db, { flock: "legacy" });

  test("world clock at day 0; the dev farm has the starting stake", () => {
    const state = db.select().from(gameState).where(eq(gameState.id, 1)).get();
    expect(state?.dayIndex).toBe(0);
    const farm = db.select().from(farms).where(eq(farms.id, farmId)).get();
    expect(farm?.gp).toBe(ECONOMY.STARTING_GP);
    expect(farm?.name).toBe("Bukidnon Farms");
  });

  test("starter flock includes retired birds of both sexes (breeding works turn one)", () => {
    const flock = db.select().from(birds).all();
    expect(flock.length).toBe(8);
    const retired = flock.filter((b) => b.status === "retired");
    expect(retired.some((b) => b.sex === "male")).toBe(true);
    expect(retired.some((b) => b.sex === "female")).toBe(true);
  });

  test("stats are in starter range and stars in half-star bounds", () => {
    for (const b of db.select().from(birds).all()) {
      for (const stat of [b.agility, b.sight, b.stamina, b.gameness, b.station, b.condition]) {
        expect(stat).toBeGreaterThanOrEqual(STATS.STARTER_MIN);
        expect(stat).toBeLessThanOrEqual(STATS.STARTER_MAX);
      }
      expect(b.halfStars).toBeGreaterThanOrEqual(0);
      expect(b.halfStars).toBeLessThanOrEqual(10);
      expect(b.element).toBeTruthy(); // 0★ would still resolve to a type
    }
  });

  test("ages derive from birthWeek (active roster covers the gates)", () => {
    const ages = db
      .select()
      .from(birds)
      .all()
      .filter((b) => b.status === "active")
      .map((b) => 0 - b.birthWeek)
      .sort((a, b) => a - b);
    expect(ages).toEqual([1, 2, 3, 5]);
  });

  test("CHECK constraints reject bad rows", () => {
    expect(() =>
      db
        .insert(birds)
        .values({
          id: "bad-1",
          farmId: "farm-1",
          name: "Bad Bird",
          sex: "male",
          status: "active",
          agility: 500, sight: 500, stamina: 500, gameness: 500, station: 500, condition: 500,
          element: "Fire",
          halfStars: 11, // > 10 violates CHECK
          birthWeek: 0,
          birthDay: 0,
        })
        .run()
    ).toThrow();
  });
});
