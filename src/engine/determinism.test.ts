import { describe, expect, test } from "bun:test";
import { createDb, type DB } from "@/db/client";
import { events } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { Bots } from "./bots";
import { Game } from "./game";
import { seedWorld } from "./rng";

/**
 * ── THE PROPERTY --seed PROMISES, TESTED WHOLE (round 43) ────────────────────
 *
 * `seedWorld(n)` claims a reproducible world, and for eight rounds the claim
 * was FALSE: the Selection Committee's tie-break sorted on bird ids — which
 * are randomUUIDs that never touch the seeded stream — so any bracket with
 * tied birds reseeded itself per run, and two runs of `simulate --seed=1`
 * crowned different champions from the first championship on. Nothing noticed,
 * because every determinism test replayed a DAY or a FIGHT and the bug lived
 * in a weekly bracket. It finally surfaced when a pure-performance change
 * refused to A/B as world-identical.
 *
 * So this test does the only check that actually pins the property: build the
 * SAME world twice, play it through the week's BOTH championship days (the
 * juvenile Wednesday and the Major Thursday, where the committee seeds and
 * bumps), and require the two event ledgers to be byte-identical. Any new
 * randomUUID(), Date.now(), or iteration-order dependence on the simulated
 * path shows up here as a one-line diff instead of a round-long investigation.
 *
 * Two weeks + a day, not more: the first crown days are where ties are
 * thickest (unraced birds all read identical), so if the ledgers agree
 * through day 15 the property holds where it is most fragile.
 */
describe("a seeded world replays whole", () => {
  const FAST_ROSTER = ["bot-1", "bot-3", "bot-5", "bot-10"];
  const DAYS = 15;

  function playWorld(seed: number): string[] {
    seedWorld(seed);
    try {
      const db: DB = createDb(":memory:");
      const dev = seedGame(db, { flock: "legacy" });
      Bots.seed(db, { flock: "legacy", only: FAST_ROSTER });
      const game = new Game(db, dev.farmId);
      for (let i = 0; i < DAYS; i++) game.tickDay();
      return db
        .select()
        .from(events)
        .all()
        .map((e) => `${e.dayIndex}|${e.type}|${e.farmId ?? ""}|${e.gpCents ?? ""}|${e.lt ?? ""}|${e.message}`);
    } finally {
      seedWorld(null); // never leak a pinned stream into other tests
    }
  }

  test("same seed, same ledger — through both championship days, twice over", () => {
    const first = playWorld(1);
    const second = playWorld(1);
    expect(first.length).toBeGreaterThan(500); // a real world, not an empty pass
    expect(second).toEqual(first);
  });

  test("a different seed is a different world (the test can actually fail)", () => {
    // Guards the guard: if playWorld ignored the seed entirely, the test
    // above would pass vacuously. Different seeds must diverge.
    const first = playWorld(1);
    const other = playWorld(2);
    expect(other).not.toEqual(first);
  });
});
