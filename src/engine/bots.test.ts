import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/db/client";
import { birds, farms, lobbies, lobbyEntries } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { BOT_FARMS, WEATHER_APPETITE } from "./bot-config";
import { Bots, bestFormat, scoutScores, weatherCardsToday, weatherOrder } from "./bots";
import { ELEMENTS, FORMAT_NAMES, SCOUT, weatherOfDay, type Element } from "./config";
import { Flock, type BirdView } from "./flock";
import { mulberry32 } from "./rng";
import { makeBird, world as testWorld } from "./testkit";
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

  test("the day's ascendant element is visible in what the stables card", () => {
    // The end-to-end version of the two unit tests below: no assertion about
    // any one bird, just the question the doctor asks — over a fortnight of
    // real bot play, does the card lean toward birds whose element is
    // ascendant? Chance is 1-in-5. Anything at or below that means the
    // appetite got disconnected somewhere between here and lobbies.enter,
    // which is exactly how claiming and paid gacha rolls shipped dead.
    const w = world();
    for (let d = 0; d < 14; d++) w.game.tickDay();
    const element = new Map(
      w.db.select().from(birds).all().map((b) => [b.id, b.element as Element])
    );
    const dayOf = new Map(w.db.select().from(lobbies).all().map((l) => [l.id, l.dayOpened]));
    const entries = w.db.select().from(lobbyEntries).all();
    const timed = entries.filter(
      (e) => element.get(e.birdId) === weatherOfDay(dayOf.get(e.lobbyId)!)
    );
    expect(entries.length).toBeGreaterThan(100); // enough for the rate to mean anything
    expect(timed.length / entries.length).toBeGreaterThan(1 / ELEMENTS.length);
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

/**
 * THE SCOUT'S BLADE PICK (round 28 — the fog). bestFormat is the one place a
 * stable decides WHERE a bird fights, and since the fog it may only read the
 * figure history — never the sheet. Distribution properties, so they are
 * tested here directly rather than through a seeded bot day.
 */
describe("the scout's blade pick", () => {
  test("a fresh bird gets carded at every blade eventually — discovery is alive", () => {
    // WHY (round 28: the fog): without the EXPLORE draw, a bird's first
    // blade is self-fulfilling — the only blade with figures is the only
    // one scoring above prior, so a B5 monster would live and die as a
    // mediocre B1 bird. If any blade stops appearing here, discovery is
    // dead and no other test will notice.
    const w = testWorld({ rivalFlock: false });
    const row = makeBird(w.db); // unraced two-year-old, zero battle log
    const bird = new Flock(w.db, w.devId).byId(row.id);
    const rng = mulberry32(2028);
    const seen = new Set<string>();
    for (let i = 0; i < 500 && seen.size < FORMAT_NAMES.length; i++) {
      seen.add(bestFormat(w.db, bird, rng));
    }
    expect([...seen].sort()).toEqual([...FORMAT_NAMES].sort());
  });

  test("a fogged view flows through the whole entry path — the bots never need the sheet", () => {
    // WHY: the round-28 rework swapped the bots' stat-weight table for the
    // scout report precisely because the old table read hidden stats. This
    // pins that a BirdView full of nulls carries a bird from scoring all
    // the way through lobbies.enter without anything reaching for a number
    // that is no longer there.
    const w = testWorld({ rivalFlock: false });
    const row = makeBird(w.db);
    const bird = new Flock(w.db, w.devId).byId(row.id);
    expect(bird.agility).toBeNull(); // the fog is actually down on this fixture
    const scores = scoutScores(w.db, bird.id);
    for (const f of FORMAT_NAMES) expect(scores[f]).toBe(SCOUT.PRIOR_FIGURE); // unraced = prior
    const format = bestFormat(w.db, bird, mulberry32(7));
    expect(FORMAT_NAMES).toContain(format);
    expect(() =>
      w.dev.lobbies.enter(bird.id, { mode: "real", classType: "maiden", format })
    ).not.toThrow();
  });
});

/**
 * READING THE GOING (round 25). The two helpers the bots and auto-play share
 * for the daily element weather. They are tested here rather than through a
 * bot day because the whole point of the knobs is a distribution — one seeded
 * day tells you nothing about a 0.9 probability.
 */
describe("the weather appetite", () => {
  /** A day whose ascendant element differs from tomorrow's — most of them. */
  function eveOfADifferentDay(): number {
    for (let d = 0; d < 100; d++) if (weatherOfDay(d) !== weatherOfDay(d + 1)) return d;
    throw new Error("weatherOfDay never changes — the salt is broken");
  }

  /** Three birds in one barn: today's, tomorrow's, and neither's. */
  function trio(day: number) {
    const w = testWorld({ rivalFlock: false });
    const today = weatherOfDay(day);
    const tomorrow = weatherOfDay(day + 1);
    const neither = ELEMENTS.find((e) => e !== today && e !== tomorrow)!;
    for (const [name, element] of [
      ["Ascendant", today],
      ["Eve", tomorrow],
      ["Ordinary", neither],
    ] as const)
      makeBird(w.db, { name, element });
    const flock = new Flock(w.db, w.devId).all();
    const by = (name: string) => flock.find((b) => b.name === name)!;
    return { w, ascendant: by("Ascendant"), eve: by("Eve"), ordinary: by("Ordinary") };
  }

  test("the roster puts today's birds first and tomorrow's last", () => {
    const day = eveOfADifferentDay();
    const { ascendant, eve, ordinary } = trio(day);
    // Handed to it in the WORST order, so a pass can't be the input's doing.
    const ordered = weatherOrder([eve, ordinary, ascendant], day).map((b) => b.name);
    expect(ordered).toEqual(["Ascendant", "Ordinary", "Eve"]);
  });

  test("…and tomorrow's birds sink BELOW ordinary ones, not just below today's", () => {
    // This tier is the whole fix for the round-25 first draft: the liquidity
    // pass is ungated on purpose, so without it that pass spends the very
    // birds the entry gate just decided to hold, and the hold measures zero.
    const day = eveOfADifferentDay();
    const { eve, ordinary } = trio(day);
    expect(weatherOrder([eve, ordinary], day).map((b) => b.name)).toEqual(["Ordinary", "Eve"]);
  });

  test("reordering never adds or drops a bird — it is free by construction", () => {
    const day = eveOfADifferentDay();
    const { ascendant, eve, ordinary } = trio(day);
    const roster = [eve, ordinary, ascendant];
    expect(weatherOrder(roster, day).length).toBe(roster.length);
    expect(new Set(weatherOrder(roster, day).map((b) => b.id))).toEqual(
      new Set(roster.map((b) => b.id))
    );
  });

  const rateOf = (bird: BirdView, day: number, base: number) => {
    const rng = mulberry32(20250104);
    const trials = 4000;
    let carded = 0;
    for (let i = 0; i < trials; i++) if (weatherCardsToday(bird, day, rng, base)) carded++;
    return carded / trials;
  };

  test("a bird cards more often on its own day, and rarely on the eve of it", () => {
    const day = eveOfADifferentDay();
    const { ascendant, eve, ordinary } = trio(day);
    const base = 0.5; // a broodfarm's appetite — plenty of headroom to boost
    const boosted = base + (1 - base) * WEATHER_APPETITE.MATCH_BOOST;
    const held = base * (1 - WEATHER_APPETITE.HOLD_FOR_TOMORROW);

    expect(rateOf(ascendant, day, base)).toBeCloseTo(boosted, 1);
    expect(rateOf(eve, day, base)).toBeCloseTo(held, 1);
    // The bird with no stake either way is untouched — the appetite must not
    // quietly re-rate the two thirds of the flock it has no opinion about.
    expect(rateOf(ordinary, day, base)).toBeCloseTo(base, 1);
  });

  test("auto-play's every-bird stable still times: no headroom to boost, but it holds", () => {
    // Auto-play passes a base rate of 1, so the boost is arithmetically a
    // no-op there and the hold is the only lever it has. If that ever stopped
    // being true the player-side stable would drift back to pure chance.
    const day = eveOfADifferentDay();
    const { ascendant, eve } = trio(day);
    expect(rateOf(ascendant, day, 1)).toBe(1);
    expect(rateOf(eve, day, 1)).toBeCloseTo(1 - WEATHER_APPETITE.HOLD_FOR_TOMORROW, 1);
  });
});
