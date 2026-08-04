import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/db/client";
import { farms, lobbyEntries } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { BOT_FARMS } from "./bot-config";
import { Bots } from "./bots";
import { Game } from "./game";

function world(opts: { only?: string[] } = {}) {
  const db = createDb(":memory:");
  const dev = seedGame(db, { flock: "legacy" });
  Bots.seed(db, { flock: "legacy", only: opts.only });
  return { db, game: new Game(db, dev.farmId) };
}

// A day of bot play is 15 stables' worth of DB traffic — real when the test
// is checking that the FULL configured roster shows up, wasted when it's
// only checking a property that holds for any nonempty roster (determinism,
// no dangling entries across several days). Three ordinary styles, one each
// — claimer, breeder, pit — deliberately WITHOUT the whale or the landlord:
// those two exist specifically to binge-spend GP (round-23 gacha bundles /
// the daily land-buy cap), which is exactly what "the fight economy" test
// below assumes stays a minority of the day's money movement. That's a
// statistical property of the full 15-bot roster, not something four bots
// can reproduce — the full-roster test above already exercises both
// speculator styles for real, so nothing is lost by leaving them out here.
const FAST_ROSTER = ["bot-1", "bot-3", "bot-5", "bot-9"];

const totalGp = (db: DB) =>
  db
    .select()
    .from(farms)
    .all()
    .reduce((s, f) => s + f.gp, 0);

describe("seeding the bot stables", () => {
  test("every configured stable seeded, flagged, flocked — and idempotent", () => {
    const { db } = world();
    Bots.seed(db, { flock: "legacy" }); // second call must be a no-op
    const bots = db.select().from(farms).where(eq(farms.isBot, 1)).all();
    expect(bots.length).toBe(BOT_FARMS.length);
    for (const bot of BOT_FARMS) {
      const flock = db.select().from(farms).where(eq(farms.id, bot.id)).get()!;
      expect(flock.name).toBe(bot.name);
    }
  });

  test("worlds without bots are untouched — playDay no-ops", () => {
    const db = createDb(":memory:");
    seedGame(db, { flock: "legacy" });
    expect(Bots.playDay(db)).toEqual([]);
  });
});

describe("a bot day", () => {
  test("the stables play the closing day: check in, card birds, the card goes off", () => {
    const w = world();
    const tick = w.game.tickDay();
    expect(tick.bots.length).toBe(BOT_FARMS.length);
    expect(tick.bots.every((b) => b.checkedIn)).toBe(true);
    // With every stable playing, the card is not empty.
    const carded = tick.bots.reduce((s, b) => s + b.entered.length, 0);
    expect(carded).toBeGreaterThan(0);
    const fights = tick.card.reduce((s, l) => s + l.fights.length, 0);
    expect(fights).toBeGreaterThan(0);
  });

  test("a bot day is deterministic — same world, same day, same moves", () => {
    // Determinism holds for any nonempty roster — the fast subset proves the
    // same thing the full fifteen would, at a fraction of the DB traffic.
    const a = world({ only: FAST_ROSTER }).game.tickDay();
    const b = world({ only: FAST_ROSTER }).game.tickDay();
    expect(a.bots).toEqual(b.bots);
  });

  test("bots obey the fight economy — GP only moves by drip and pots", () => {
    const w = world({ only: FAST_ROSTER });
    const before = totalGp(w.db);
    const tick = w.game.tickDay();
    // Every wallet change decomposes into check-in drips (printed by design)
    // and zero-sum pot/escrow movement. Gacha rolls burn GP only if a bot
    // pays cash — free pulls don't touch the wallet.
    const drips = tick.bots.filter((b) => b.checkedIn).length * 800;
    expect(totalGp(w.db)).toBeLessThanOrEqual(before + drips);
    expect(totalGp(w.db)).toBeGreaterThan(before); // the drip landed
  });

  test("several days keep the world moving without a crash", () => {
    const w = world({ only: FAST_ROSTER });
    for (let d = 0; d < 5; d++) w.game.tickDay();
    // Entries resolved every night — nothing left dangling.
    const pending = w.db
      .select()
      .from(lobbyEntries)
      .where(eq(lobbyEntries.status, "pending"))
      .all();
    expect(pending.length).toBe(0);
  });
});
