import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/db/client";
import { farms, lobbyEntries } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { BOT_FARMS } from "./bot-config";
import { Bots } from "./bots";
import { Game } from "./game";

function world() {
  const db = createDb(":memory:");
  const dev = seedGame(db, { flock: "legacy" });
  Bots.seed(db, { flock: "legacy" });
  return { db, game: new Game(db, dev.farmId) };
}

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
    const a = world().game.tickDay();
    const b = world().game.tickDay();
    expect(a.bots).toEqual(b.bots);
  });

  test("bots obey the fight economy — GP only moves by drip and pots", () => {
    const w = world();
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
    const w = world();
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
