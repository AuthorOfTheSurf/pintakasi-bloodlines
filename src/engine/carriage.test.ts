import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { birds, farms } from "@/db/schema";
import { seedGame, seedStarterFlock } from "@/db/seed-data";
import { Breeding } from "./breeding";
import { BREEDING, CARRIAGES, STARS } from "./config";
import { Gacha } from "./gacha";
import { mulberry32 } from "./rng";

/**
 * CARRIAGE (round 23, the Ground/Air preference axis) shipped with zero test
 * references. Standalone file rather than folding into breeding.test.ts:
 * carriage is seeded in db/seed-data.ts, rolled in gacha.ts, AND inherited in
 * breeding.ts, so no single existing test file owns its whole surface.
 */

function freshGame(seed = 42) {
  const db = createDb(":memory:");
  const fid = seedGame(db, { flock: "legacy", startingGp: 50_000_000 }).farmId;
  return { db, farmId: fid, breeding: new Breeding(db, fid, mulberry32(seed)) };
}

describe("seeded carriage", () => {
  test("every starter and every cold-start egg carries a valid carriage and an in-range magnitude", () => {
    const db = createDb(":memory:");
    const legacy = seedGame(db, { flock: "legacy" }).farmId;
    // A production farm too — cold-start eggs roll carriage the same way.
    seedStarterFlock(db, "farm-2", { seed: 9, idPrefix: "eggs" }); // default shape: "eggs"
    const all = db.select().from(birds).all();
    expect(all.length).toBeGreaterThan(0);
    for (const bird of all) {
      expect(CARRIAGES).toContain(bird.carriage);
      expect(bird.carriageHalfStars).toBeGreaterThanOrEqual(0);
      expect(bird.carriageHalfStars).toBeLessThanOrEqual(STARS.MAX_HALF_STARS);
    }
    expect(legacy).toBe("farm-1"); // sanity: the legacy farm did seed
  });
});

describe("carriage inheritance", () => {
  test("magnitude lands within STAR_SPREAD_HALF_STARS of the parents' average, clamped to [0, MAX]", () => {
    const { db, breeding } = freshGame(3);
    // Three configs: mid-range, and BOTH extremes — the clamp only bites at
    // the extremes, so the boundary cases are the ones worth proving.
    const configs: [mother: number, father: number][] = [
      [4, 6], // avg 5, comfortably inside the range either direction
      [0, 0], // avg 0 — the floor; a downward roll must clamp, not go negative
      [10, 10], // avg 10 (STARS.MAX_HALF_STARS) — the ceiling
      [0, 10], // avg 5 via two extremes, same avg as the midrange config
    ];
    for (const [motherHalf, fatherHalf] of configs) {
      db.update(birds).set({ carriage: "Ground", carriageHalfStars: motherHalf }).where(eq(birds.id, "starter-2")).run();
      db.update(birds).set({ carriage: "Ground", carriageHalfStars: fatherHalf }).where(eq(birds.id, "starter-1")).run();
      const avg = (motherHalf + fatherHalf) / 2;
      for (let i = 0; i < 40; i++) {
        const { egg } = breeding.breed("starter-2", "starter-1");
        expect(egg.carriageHalfStars).toBeGreaterThanOrEqual(0);
        expect(egg.carriageHalfStars).toBeLessThanOrEqual(STARS.MAX_HALF_STARS);
        // Clamping only ever pulls a roll CLOSER to the average, never
        // further — so the raw-spread bound still holds post-clamp.
        expect(Math.abs(egg.carriageHalfStars - avg)).toBeLessThanOrEqual(BREEDING.STAR_SPREAD_HALF_STARS);
        db.delete(birds).where(eq(birds.id, egg.id)).run(); // free the hen for the next trial
      }
    }
  });

  test("the lean is selectable: a strong Ground parent over a weak Air one yields Ground ~CARRIAGE_LEAN_STRONGER of the time", () => {
    const { db, breeding } = freshGame(7);
    // The "stronger" parent is whichever has the higher carriageHalfStars —
    // pin that unambiguously to Ground (10, the max) against Air at the
    // floor (0), so every trial's lean roll is the only source of variance.
    db.update(birds).set({ carriage: "Ground", carriageHalfStars: STARS.MAX_HALF_STARS }).where(eq(birds.id, "starter-2")).run();
    db.update(birds).set({ carriage: "Air", carriageHalfStars: 0 }).where(eq(birds.id, "starter-1")).run();

    // STATISTICAL, not exact: each trial is one Bernoulli draw at p =
    // CARRIAGE_LEAN_STRONGER (0.75). At N = 400 the sampling standard
    // deviation is sqrt(0.75 * 0.25 / 400) ≈ 0.0217, so a ±0.08 window is
    // ~3.7 sd wide — tight enough to catch a real regression (e.g. the lean
    // silently flipped to 50/50) but wide enough not to flake on a fixed
    // seed's ordinary variance (empirically 0.70–0.80 across a spread of
    // seeds tried while writing this test).
    const N = 400;
    let ground = 0;
    for (let i = 0; i < N; i++) {
      const { egg } = breeding.breed("starter-2", "starter-1");
      if (egg.carriage === "Ground") ground++;
      db.delete(birds).where(eq(birds.id, egg.id)).run();
    }
    const fraction = ground / N;
    expect(fraction).toBeGreaterThan(BREEDING.CARRIAGE_LEAN_STRONGER - 0.08);
    expect(fraction).toBeLessThan(BREEDING.CARRIAGE_LEAN_STRONGER + 0.08);
    // And it's genuinely selectable, not just "usually Ground" by luck of
    // the axis: it must beat a coin flip by a wide margin.
    expect(fraction).toBeGreaterThan(0.6);
  });
});

describe("gacha eggs", () => {
  test("a Purple/Gold roll's mystery egg carries a valid, in-range carriage", () => {
    const db = createDb(":memory:");
    const { farmId } = seedGame(db);
    db.update(farms).set({ gp: 10_000_000 }).where(eq(farms.id, farmId)).run();
    const gacha = new Gacha(db, farmId, mulberry32(7));
    let checked = 0;
    for (let i = 0; i < 200 && checked < 3; i++) {
      const { egg } = gacha.roll();
      if (!egg) continue;
      checked++;
      expect(CARRIAGES).toContain(egg.carriage);
      expect(egg.carriageHalfStars).toBeGreaterThanOrEqual(0);
      expect(egg.carriageHalfStars).toBeLessThanOrEqual(STARS.MAX_HALF_STARS);
    }
    expect(checked).toBeGreaterThan(0); // the seed must actually drop an egg to prove anything
  });
});
