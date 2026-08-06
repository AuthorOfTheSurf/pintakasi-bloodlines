import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/db/client";
import { battleLog, birds, farms, lobbies, lobbyEntries } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { BOT_FARMS, BREEDING_PLAN, WEATHER_APPETITE } from "./bot-config";
import {
  Bots,
  bestFormat,
  bestShape,
  foalScore,
  scoutScores,
  weatherCardsToday,
  weatherOrder,
} from "./bots";
import {
  BREEDING_SHAPES,
  ELEMENTS,
  FORMAT_NAMES,
  SCOUT,
  weatherOfDay,
  type Element,
  type StatName,
} from "./config";
import type { StudView } from "./breeding";
import { Flock, type BirdView } from "./flock";
import { mulberry32 } from "./rng";
import { makeBird, onCard, world as testWorld } from "./testkit";
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

  test("the simulation-only end-first policy samples the opposite extreme before moving inward", () => {
    const w = testWorld({ rivalFlock: false });
    const row = makeBird(w.db);
    const bird = new Flock(w.db, w.devId).byId(row.id);
    // B1 is no longer unread. With the deterministic first target draw, the
    // current grid goes B2 while the PFL-style policy goes to the opposite
    // extreme, B5. The figure values are irrelevant: both choices are still
    // in the exploration branch.
    for (let i = 0; i < SCOUT.MIN_READS; i++) {
      w.db.insert(battleLog).values({
        dayIndex: i, lobbyId: 1, farmId: bird.farmId, birdId: bird.id,
        mode: "real", format: "b1", opponentBirdId: "ghost", opponentFarmId: "house",
        opponentName: "Sparring Ghost", result: "loss", pitFigure: 50,
        gpDeltaCents: 0, seed: i, playByPlay: "[]",
      }).run();
    }
    const explore = () => 0;
    expect(bestFormat(w.db, bird, explore, "current")).toBe("b2");
    expect(bestFormat(w.db, bird, explore, "end-first")).toBe("b5");
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
    // The blade the scout PREFERS may not be posted tonight — the bots choose
    // from the card, so the door gets the carded key and the fogged bird.
    expect(() =>
      w.dev.lobbies.enter(bird.id, onCard(w.db, { mode: "real", classType: "maiden" }))
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

/**
 * THE BREEDING PLAN (round 29). Round 28 revealed every retired bird's sheet
 * on the stud card so a shopper could read it — and then nobody read it. The
 * bots took the first legal cover off a shuffled list, which optimises for
 * nothing and breeds the world flat: the doctor measured a MEDIAN home-blade
 * margin of 11 weighted points, meaning half the flock had no home for the
 * scout to find. Discovery was pointed at a population with nothing to
 * discover.
 *
 * These tests pin the appetite, in Zane's stated order: shape first, then
 * station, condition and stars.
 */
describe("the breeding plan", () => {
  const SPRINT = BREEDING_SHAPES[0]; // agility & sight
  const DEEP = BREEDING_SHAPES[2]; //   stamina & gameness

  /** A retired hen with a chosen sheet — retired, so her stats are revealed. */
  const dam = (db: DB, sheet: Partial<Record<StatName, number>>) => {
    const row = makeBird(db, { age: 4, status: "retired", sex: "female", ...sheet });
    return new Flock(db, row.farmId).byId(row.id);
  };

  /** A stud card. Only `sheet`, `halfStars` and `birdId` reach the pricing. */
  const sire = (sheet: Partial<Record<StatName, number>>, halfStars = 0): StudView =>
    ({
      birdId: "sire",
      farm: "Rival",
      name: "Sire",
      stars: `${halfStars / 2}★ Fire`,
      halfStars,
      age: 4,
      career: { wins: 0, losses: 0 },
      sheet: {
        agility: 350, sight: 350, stamina: 350, gameness: 350,
        station: 350, condition: 350, ...sheet,
      },
      overallGrade: "B+",
      price: 160,
      coversLeft: 1,
      mine: false,
    }) as StudView;

  test("a barn prefers the mate that gives its house shape, at equal total points", () => {
    const w = testWorld({ rivalFlock: false });
    // Two studs carrying the SAME surplus, spent at opposite ends of the dial.
    const sprintSire = sire({ agility: 550, sight: 550, stamina: 150, gameness: 150 });
    const deepSire = sire({ agility: 150, sight: 150, stamina: 550, gameness: 550 });
    const flatDam = dam(w.db, {});

    // Equal totals, so this is purely a question of shape — the level, anchor
    // and star terms are identical on both sides and cancel exactly.
    expect(foalScore(flatDam, sprintSire, SPRINT)).toBeGreaterThan(
      foalScore(flatDam, deepSire, SPRINT)
    );
    expect(foalScore(flatDam, deepSire, DEEP)).toBeGreaterThan(
      foalScore(flatDam, sprintSire, DEEP)
    );
  });

  test("shape does not buy a weakling: a big enough level gap still wins", () => {
    const w = testWorld({ rivalFlock: false });
    const flatDam = dam(w.db, {});
    // Perfectly shaped but 200 points down on every distance stat, against a
    // shapeless bird that is simply better. A bird that loses at every blade
    // is not a breeding plan, which is what LEVEL_WEIGHT is there to say.
    const shapelyRunt = sire({ agility: 250, sight: 250, stamina: 50, gameness: 50 });
    const plainGiant = sire({ agility: 650, sight: 650, stamina: 650, gameness: 650 });
    expect(foalScore(flatDam, plainGiant, SPRINT)).toBeGreaterThan(
      foalScore(flatDam, shapelyRunt, SPRINT)
    );
  });

  test("with shape and level tied, the anchors and the stars break it", () => {
    const w = testWorld({ rivalFlock: false });
    const flatDam = dam(w.db, {});
    const plain = sire({});
    expect(foalScore(flatDam, sire({ station: 550, condition: 550 }), SPRINT)).toBeGreaterThan(
      foalScore(flatDam, plain, SPRINT)
    );
    expect(foalScore(flatDam, sire({}, 10), SPRINT)).toBeGreaterThan(
      foalScore(flatDam, plain, SPRINT)
    );
  });

  test("every configured barn breeds toward one of the three shapes", () => {
    // A housePair index off the end of the list would silently fall back to
    // shape 0 for that barn via the modulo in playFarm — legal, but it would
    // quietly narrow the stud market to two shapes and nobody would notice.
    for (const profile of BOT_FARMS) {
      expect(profile.housePair).toBeGreaterThanOrEqual(0);
      expect(profile.housePair).toBeLessThan(BREEDING_SHAPES.length);
    }
    // Deliberately UNEVEN (see BotProfile.housePair) — an equal split would
    // make every shape equally cheap forever, and scarcity is a price signal.
    const counts = BREEDING_SHAPES.map(
      (_, i) => BOT_FARMS.filter((b) => b.housePair === i).length
    );
    expect(Math.min(...counts)).toBeGreaterThan(0);
  });

  // ── Round 30: the shape is read off the HEN, not off the barn ────────────
  test("a bird's own shape is the pair its sheet already leans toward", () => {
    expect(bestShape({ agility: 600, sight: 600, stamina: 300, gameness: 300 }).shape).toEqual(
      SPRINT
    );
    expect(bestShape({ agility: 300, sight: 300, stamina: 600, gameness: 600 }).shape).toEqual(
      DEEP
    );
    // …and the separation it reports is the same arithmetic foalScore prices
    // on, so BREEDING_PLAN.OWN_SHAPE_MIN is a like-for-like bar: (600+600)/2
    // minus (300+300)/2.
    expect(
      bestShape({ agility: 600, sight: 600, stamina: 300, gameness: 300 }).separation
    ).toBe(300);
  });

  test("a fogged sheet reads as flat, never as NaN", () => {
    // Round 28 nulls the six stats on any bird that isn't retired. A NaN here
    // would sort silently to the bottom of every comparison and turn the whole
    // plan back into random pairing — the exact bug that has bitten this file
    // twice. Zero-shaped is the honest read: we know nothing about her.
    const fogged = bestShape({ agility: null, sight: null, stamina: null, gameness: null });
    expect(Number.isNaN(fogged.separation)).toBe(false);
    expect(fogged.separation).toBe(0);
    expect(bestShape({}).separation).toBe(0); // and a sheet with no keys at all
  });

  test("a shaped hen prefers the sire that reinforces HER pair", () => {
    const w = testWorld({ rivalFlock: false });
    // A deep-water hen, well clear of the flat bar.
    const deepDam = dam(w.db, { agility: 250, sight: 250, stamina: 550, gameness: 550 });
    const own = bestShape(deepDam);
    expect(own.shape).toEqual(DEEP);
    expect(own.separation).toBeGreaterThanOrEqual(BREEDING_PLAN.OWN_SHAPE_MIN);

    // Two sires with identical totals, spent at opposite ends of the dial.
    // Priced against HER shape, the one that compounds her wins; round 29
    // would have priced both against the barn's single house pair and, in a
    // sprint barn, bought the sire that undoes her.
    const deepSire = sire({ agility: 150, sight: 150, stamina: 550, gameness: 550 });
    const sprintSire = sire({ agility: 550, sight: 550, stamina: 150, gameness: 150 });
    expect(foalScore(deepDam, deepSire, own.shape)).toBeGreaterThan(
      foalScore(deepDam, sprintSire, own.shape)
    );
  });

  test("a near-flat hen falls back to the barn's house pair", () => {
    const w = testWorld({ rivalFlock: false });
    // Ten points of lean is noise, not a bloodline. Following it would scatter
    // a barn's covers over all three axes; below the bar the house pair
    // decides, so the barn still concentrates.
    const flattish = dam(w.db, { agility: 355, sight: 355, stamina: 345, gameness: 345 });
    const own = bestShape(flattish);
    expect(own.shape).toEqual(SPRINT); // she does technically lean sprint…
    expect(own.separation).toBeLessThan(BREEDING_PLAN.OWN_SHAPE_MIN); // …but not enough to count
    // And the bar is set where the flock actually is: a genuinely shaped hen
    // clears it comfortably.
    expect(
      bestShape({ agility: 450, sight: 450, stamina: 300, gameness: 300 }).separation
    ).toBeGreaterThanOrEqual(BREEDING_PLAN.OWN_SHAPE_MIN);
  });
});
