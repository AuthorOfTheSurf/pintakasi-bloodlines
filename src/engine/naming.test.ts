import { describe, expect, test } from "bun:test";
import { createDb } from "@/db/client";
import { birds } from "@/db/schema";
import { seedGame, seedStarterFlock } from "@/db/seed-data";
import { Farms } from "./farms";
import { Flock } from "./flock";
import { roman, uniqueName } from "./naming";

/** Bird names are unique across the WORLD — ruled 2026-08-03 (round 12). */

describe("world-unique bird names", () => {
  test("every farm's starters draw distinct names — no seven Dalisays", () => {
    const db = createDb(":memory:");
    seedGame(db);
    const farms = new Farms(db);
    for (let i = 1; i <= 6; i++) {
      const { farm } = farms.register({ name: `Farm ${i}`, primaryColor: "blue", secondaryColor: "white" });
      seedStarterFlock(db, farm.id, { seed: 100 + i, idPrefix: `f${i}` });
    }
    const names = db.select({ name: birds.name }).from(birds).all().map((r) => r.name);
    expect(names.length).toBe(7 * 8);
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length);
  });

  test("uniqueName hands out roman successors; rename refuses a taken name", () => {
    const db = createDb(":memory:");
    const { farmId } = seedGame(db);
    expect(uniqueName(db, "Dalisay")).toBe("Dalisay II");
    expect(uniqueName(db, "Halimaw")).toBe("Halimaw"); // free — untouched
    const flock = new Flock(db, farmId);
    expect(() => flock.rename("starter-5", "Alab")).toThrow(/taken/);
    expect(() => flock.rename("starter-5", "alab")).toThrow(/taken/); // case-blind
    expect(flock.rename("starter-5", "Kidlat").name).toBe("Kidlat"); // his own name is fine
  });

  test("roman numerals hold up", () => {
    expect([2, 3, 4, 9, 14, 40].map(roman)).toEqual(["II", "III", "IV", "IX", "XIV", "XL"]);
  });
});
