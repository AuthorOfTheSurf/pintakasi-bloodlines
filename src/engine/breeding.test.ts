import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { birds, gameState } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { Breeding } from "./breeding";
import { ECONOMY, STATS } from "./config";
import { Flock } from "./flock";
import { mulberry32 } from "./rng";

function freshGame(seed = 42) {
  const db = createDb(":memory:");
  seedGame(db);
  return { db, breeding: new Breeding(db, mulberry32(seed)), flock: new Flock(db) };
}

// Seed ids: starter-1 Tandang Pula (retired rooster), starter-2 Dalisay
// (retired hen), starter-3 Bagwis (retired rooster), starter-4 Perlas
// (retired hen).

describe("breed", () => {
  test("lays 'Egg of <mother>' at age 0 and charges the fee", () => {
    const { db, breeding } = freshGame();
    const { egg, feePaid } = breeding.breed("starter-2", "starter-1");
    expect(egg.name).toBe("Egg of Dalisay");
    expect(egg.status).toBe("egg");
    expect(egg.age).toBe(0);
    expect(egg.motherId).toBe("starter-2");
    expect(egg.fatherId).toBe("starter-1");
    expect(feePaid).toBe(ECONOMY.BREED_FEE);
    const state = db.select().from(gameState).where(eq(gameState.id, 1)).get()!;
    expect(state.gp).toBe(ECONOMY.STARTING_GP - ECONOMY.BREED_FEE);
  });

  test("child stats stay in bounds and near the parent average", () => {
    const { breeding, flock } = freshGame();
    const mother = flock.byId("starter-2");
    const father = flock.byId("starter-1");
    const { egg } = breeding.breed("starter-2", "starter-1");
    for (const stat of ["agility", "heart", "avoidance", "stamina", "ruthless", "sight"] as const) {
      expect(egg[stat]).toBeGreaterThanOrEqual(STATS.MIN);
      expect(egg[stat]).toBeLessThanOrEqual(STATS.MAX);
      // within variance + max mutation swing of the parent average
      const avg = (mother[stat] + father[stat]) / 2;
      expect(Math.abs(egg[stat] - avg)).toBeLessThanOrEqual(6 + 15 + 1);
    }
    expect(egg.halfStars).toBeGreaterThanOrEqual(0);
    expect(egg.halfStars).toBeLessThanOrEqual(10);
    expect(egg.element).toBeTruthy(); // 0★ would still resolve to a type
    expect(egg.sex).toBe("hidden"); // the 50-50 surprise belongs to hatch day
    expect(egg.sexLabel).toBeNull();
  });

  test("same seed → identical egg (deterministic)", () => {
    const a = freshGame(7).breeding.breed("starter-2", "starter-1").egg;
    const b = freshGame(7).breeding.breed("starter-2", "starter-1").egg;
    const { id: _a, ...restA } = a;
    const { id: _b, ...restB } = b;
    expect(restA).toEqual(restB);
  });

  test("active birds cannot breed; sexes must be hen × rooster", () => {
    const { breeding, flock } = freshGame();
    const sinag = flock.all().find((b) => b.name === "Sinag")!; // active hen
    expect(() => breeding.breed(sinag.id, "starter-1")).toThrow(/not retired/);
    expect(() => breeding.breed("starter-1", "starter-2")).toThrow(/must be a hen/);
  });

  test("insufficient GP blocks breeding", () => {
    const { db, breeding } = freshGame();
    db.update(gameState).set({ gp: 50 }).where(eq(gameState.id, 1)).run();
    expect(() => breeding.breed("starter-2", "starter-1")).toThrow(/costs 200 GP/);
  });
});

describe("bloodline restriction", () => {
  /** Insert a retired bird with given parents. */
  function insertRetired(
    db: ReturnType<typeof createDb>,
    id: string,
    sex: "female" | "male",
    motherId: string | null,
    fatherId: string | null
  ) {
    db.insert(birds)
      .values({
        id,
        name: id,
        sex,
        status: "retired",
        agility: 50, heart: 50, avoidance: 50, stamina: 50, ruthless: 50, sight: 50,
        element: "Fire",
        halfStars: 4,
        birthWeek: -5,
        birthDay: -35,
        retiredBy: "manual",
        retiredWeek: 0,
        motherId,
        fatherId,
      })
      .run();
  }

  test("parent × child is forbidden", () => {
    const { db, breeding } = freshGame();
    insertRetired(db, "daughter", "female", "starter-2", "starter-1");
    expect(() => breeding.breed("daughter", "starter-1")).toThrow(/ancestor/);
  });

  test("grandparent and great-grandparent are forbidden", () => {
    const { db, breeding } = freshGame();
    insertRetired(db, "gen1-hen", "female", "starter-2", "starter-1");
    insertRetired(db, "gen2-hen", "female", "gen1-hen", "starter-3");
    insertRetired(db, "gen3-hen", "female", "gen2-hen", "bagwis-line"); // father id not in ancestor path
    // starter-1 is grandfather of gen2-hen and great-grandfather of gen3-hen
    expect(() => breeding.breed("gen2-hen", "starter-1")).toThrow(/ancestor/);
    expect(() => breeding.breed("gen3-hen", "starter-1")).toThrow(/ancestor/);
  });

  test("siblings are forbidden (shared either parent)", () => {
    const { db, breeding } = freshGame();
    insertRetired(db, "sib-hen", "female", "starter-2", "starter-1");
    insertRetired(db, "sib-rooster", "male", "starter-2", "starter-3"); // half-siblings via mother
    expect(() => breeding.breed("sib-hen", "sib-rooster")).toThrow(/siblings/);
  });

  test("unrelated retired pairs may breed", () => {
    const { db, breeding } = freshGame();
    insertRetired(db, "line-a-hen", "female", "starter-2", "starter-1");
    insertRetired(db, "line-b-rooster", "male", "starter-4", "starter-3");
    expect(() => breeding.breed("line-a-hen", "line-b-rooster")).not.toThrow();
  });
});

describe("lineage", () => {
  test("parent tree is derivable through great-grandparents", () => {
    const { db, breeding } = freshGame();
    db.insert(birds)
      .values({
        id: "kid",
        name: "Kid",
        sex: "female",
        status: "egg",
        agility: 50, heart: 50, avoidance: 50, stamina: 50, ruthless: 50, sight: 50,
        element: "Water",
        halfStars: 4,
        birthWeek: 0,
        birthDay: 0,
        motherId: "starter-2",
        fatherId: "starter-1",
      })
      .run();
    const tree = breeding.lineage("kid")!;
    expect(tree.mother?.name).toBe("Dalisay");
    expect(tree.father?.name).toBe("Tandang Pula");
    expect(tree.mother?.mother).toBeNull(); // starters have no recorded parents
  });
});
