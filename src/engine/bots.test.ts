import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/db/client";
import { birds, farms, gameState, lobbies, lobbyEntries } from "@/db/schema";
import { recordFight } from "./scout";
import { seedGame } from "@/db/seed-data";
import { BOT_FARMS, BREEDING_PLAN, WEATHER_APPETITE } from "./bot-config";
import {
  Bots,
  bestFormat,
  pickOffering,
  bestShape,
  foalScore,
  scoutScores,
  weatherCardsToday,
  weatherOrder,
} from "./bots";
import {
  BREEDING_SHAPES,
  COVERS,
  ENTRY_FEES,
  cardOfDay,
  feeFor,
  ELEMENTS,
  FORMAT_NAMES,
  LT_CENTS,
  SCOUT,
  weatherOfDay,
  type Element,
  type StatName,
} from "./config";
import type { StudView } from "./breeding";
import { diagnose } from "./doctor";
import { Farms } from "./farms";
import { Flock, type BirdView } from "./flock";
import { mulberry32 } from "./rng";
import { expectConserved, makeBird, onCard, world as testWorld } from "./testkit";
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
      // recordFight, not a bare insert — the scout reads the running book now.
      recordFight(w.db, {
        dayIndex: i, lobbyId: 1, farmId: bird.farmId, birdId: bird.id,
        mode: "real", format: "b1", opponentBirdId: "ghost", opponentFarmId: "house",
        opponentName: "Sparring Ghost", side: 0, result: "loss", pitFigure: 50,
        gpDeltaCents: 0, seed: i,
      });
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
 * ── FIGHTING UP (round 42) ──────────────────────────────────────────────────
 *
 * `BotProfile.ladderCourage` is a NEW DOOR, and this codebase has twice shipped
 * a door nobody walked through: claiming measured zero in round 19 and paid
 * gacha rolls measured zero in round 22, both because no bot had an appetite for
 * the mechanic. Round 42 priced the class ladder and made the land curve
 * superlinear across it — but a ladder only pays off if somebody CLIMBS it, so
 * the knob has to be shown to do something at both ends of its range.
 *
 * Tested against `pickOffering` directly rather than through a bot day: the
 * knob is a probability, and one seeded day tells you nothing about a 0.35.
 */
describe("the ladder courage (a bot that declines its own protection)", () => {
  /** A bot profile with only the three knobs `pickOffering` reads. */
  const style = (ladderCourage: number) => ({ sellRate: 0, tagCourage: 0, ladderCourage });

  test("a brave barn cards a STRICTLY DEARER rung; a timid one takes its protection", () => {
    const w = testWorld({ rivalFlock: false });
    // A maiden — the most protected rung there is, and therefore the bird with
    // the most to decline. Unraced, so the scout has no blade opinion either.
    const row = makeBird(w.db, { wins: 0, stakesWins: 0 });
    const bird = new Flock(w.db, w.devId).byId(row.id);
    const feeOf = (spec: { mode: "juvenile" | "real"; classType: "open" | "maiden" | "nw3" | "claimer"; price?: number }) =>
      feeFor(spec.mode, spec.classType, spec.price);

    // PAIRED BY SEED, which is what makes this a clean read on the knob alone.
    // `pickOffering` spends its rng draws unconditionally and in a fixed order
    // (blade, then the sell draw, then the courage draw), so the same seed at two
    // courage settings picks the same blade off the same card and differs ONLY in
    // whether the courage draw cleared. Comparing distributions would have needed
    // hundreds of seeds to say the same thing less precisely.
    const feeAt = (courage: number, seed: number) => {
      const spec = pickOffering(w.db, style(courage), bird, mulberry32(seed), 0);
      return spec === null ? null : feeOf(spec);
    };
    let climbed = 0;
    let compared = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const timid = feeAt(0, seed);
      const brave = feeAt(1, seed);
      if (timid === null || brave === null) {
        expect(timid).toBe(brave); // eligibility never depends on courage
        continue;
      }
      compared++;
      // COURAGE NEVER MAKES A BIRD SAFER. It either declines the protection it was
      // entitled to — paying strictly more — or, when the card posted nothing
      // dearer at that blade, changes nothing at all.
      expect(brave).toBeGreaterThanOrEqual(timid);
      if (brave > timid) climbed++;
    }
    expect(compared).toBeGreaterThan(0); // …or the card offered this bird nothing
    // AND THE DOOR IS ACTUALLY WALKED THROUGH. This is the assertion that would
    // have caught round 19's claiming and round 22's paid rolls: a knob that
    // measures zero is a mechanic nobody has tested.
    expect(climbed).toBeGreaterThan(0);
  });

  test("the climb is ONE rung, never straight to the top, and never into a claimer", () => {
    // Two properties that would each be invisible in the aggregate above.
    //
    // ⚠ STRICTLY DEARER, NOT "the next class along": maiden and nw3 cost the same
    // 60 GP since round 42, so a climb measured by CLASS would let a maiden move
    // to nw3 for no extra stake and no extra land — the adoption number would
    // show a ladder in use while nothing had moved.
    //
    // And a claimer is never the destination: entering one is a decision to SELL
    // (sellRate, drawn separately), and a bird that just declined to sell must not
    // be put up for sale as a side effect of being brave.
    const w = testWorld({ rivalFlock: false });
    const row = makeBird(w.db, { wins: 0, stakesWins: 0 });
    const bird = new Flock(w.db, w.devId).byId(row.id);
    for (let seed = 1; seed <= 40; seed++) {
      const spec = pickOffering(w.db, style(1), bird, mulberry32(seed), 0);
      if (spec === null) continue;
      expect(spec.classType).not.toBe("claimer");
      // Every rung posted at that blade which is dearer than what it took: there
      // must be none cheaper-but-still-dearer than the pick, i.e. it stepped once.
      const atBlade = cardOfDay(0).filter((k) => k.format === spec.format);
      const chosen = feeFor(spec.mode, spec.classType, spec.price);
      const skipped = atBlade.filter(
        (k) => k.classType !== "claimer" && k.mode === spec.mode &&
          feeFor(k.mode, k.classType, k.price) > ENTRY_FEES.real.maiden &&
          feeFor(k.mode, k.classType, k.price) < chosen
      );
      expect(skipped).toEqual([]);
    }
  });

  test("a budget the dearer rung does not fit is respected — courage is not overdraft", () => {
    // The knob may never spend money the caller said was not there. `chaseCards`
    // hands `pickOffering` a budget precisely so a brave barn cannot card itself
    // broke, and an overdraft here would surface as a swallowed refusal inside
    // `quietly()` — a fill rate that silently collapsed, with nothing said.
    const w = testWorld({ rivalFlock: false });
    const row = makeBird(w.db, { wins: 0, stakesWins: 0 });
    const bird = new Flock(w.db, w.devId).byId(row.id);
    const budget = ENTRY_FEES.real.maiden;
    for (let seed = 1; seed <= 40; seed++) {
      const spec = pickOffering(w.db, style(1), bird, mulberry32(seed), 0, "current", budget);
      if (spec === null) continue;
      expect(feeFor(spec.mode, spec.classType, spec.price)).toBeLessThanOrEqual(budget);
    }
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

/**
 * HOW DEEP A BARN BREEDS IN A DAY (round 32).
 *
 * `breedDrive` stopped being a daily coin flip in front of a hard "one cover a
 * day" break and became DEPTH — the share of a barn's retired hens it intends
 * to work today. The old rule was never a budget rule and the round-31 sim
 * showed what it cost: 73 of 154 retired hens had never bred once while eight
 * carried nine foals each, because a barn could buy exactly one cover a day no
 * matter how many good hens were standing idle.
 *
 * `breedTarget` itself is module-private, so these drive it through a real bot
 * day — which is the better test anyway: the target is only worth anything if
 * the pricing loop can actually SPEND it, and round 32 had to lift a second,
 * quieter cap (hens priced per day) before the first one meant anything.
 *
 * Every fixture below is a bot barn with a hand-built band, so the number of
 * hens is exactly what the test says and nothing else moves: retired birds
 * don't fight, so no lobby, claim or weather decision touches these days.
 */
describe("how deep a barn breeds in a day", () => {
  /**
   * A bot stable holding exactly `hens` retired hens, and enough of its own
   * retired roosters that the stud book is never the binding constraint.
   *
   * The roosters are the barn's OWN on purpose: `browseStuds` always offers a
   * farm its own retired males (owner slots), so the fixture needs no listed
   * studs, no land for the seats, and no second farm. They carry
   * COVERS.OWNER_RESERVED covers each per week, which is why the count is
   * derived from the day cap rather than picked.
   */
  function broodBarn(botId: string, hens: number) {
    const { db, game } = world({ only: [botId] });
    // The seeded starter flock has to go: this is a test about how much of a
    // BAND gets covered, so the band must be exactly the size stated.
    db.delete(birds).where(eq(birds.farmId, botId)).run();
    for (let i = 0; i < hens; i++)
      makeBird(db, { farmId: botId, name: `Hen ${i}`, sex: "female", status: "retired", age: 4 });
    const roosters = Math.ceil(BREEDING_PLAN.MAX_COVERS_PER_DAY / COVERS.OWNER_RESERVED) + 1;
    for (let i = 0; i < roosters; i++)
      makeBird(db, { farmId: botId, name: `Stud ${i}`, sex: "male", status: "retired", age: 4 });
    return { db, game };
  }

  /**
   * DISTINCT hens covered today, read off the eggs rather than off the report.
   * A cover makes the hen pregnant NOW and stamps the conception day on the
   * egg's birthDay, so this counts mothers — "five covers" would be a hollow
   * number if they were five covers of one hen.
   */
  function hensCoveredToday(db: DB): number {
    const today = db.select().from(gameState).where(eq(gameState.id, 1)).get()!.dayIndex;
    const eggs = db
      .select()
      .from(birds)
      .all()
      .filter((b) => b.status === "egg" && b.birthDay === today);
    return new Set(eggs.map((e) => e.motherId)).size;
  }

  test("a broodfarm covers several hens in one day — the one-cover-a-day rule is gone", () => {
    // THE REGRESSION, in one number. The old loop bought its best-scoring pair
    // and then `break; // one cover a day is plenty`, so this was 1 for every
    // barn in the game regardless of style, band size or wallet.
    const { db } = broodBarn("bot-3", BREEDING_PLAN.MAX_COVERS_PER_DAY + 3);
    const report = Bots.playDay(db)[0];
    expect(report.bred.length).toBeGreaterThan(1);
    // A band bigger than the day cap is worked to the cap and stops there —
    // the runaway guard, which is a brake against a bug, not a balance knob.
    expect(hensCoveredToday(db)).toBe(BREEDING_PLAN.MAX_COVERS_PER_DAY);
    expect(report.bred.length).toBe(BREEDING_PLAN.MAX_COVERS_PER_DAY);
    // Five covers in a day is five BREED_FEEs changing hands — the fee splits
    // three ways (staker pool, juice pool, stud owner) and multiplying the
    // number of splits per day is exactly how a rounding burn would ship.
    expectConserved(db);
  });

  test("a band smaller than the floor is covered whole, and no hen twice", () => {
    // The floor says "at least MIN_HENS_COVERED", but a barn cannot cover hens
    // it does not own: the target is clamped to the band. And a hen holds one
    // pregnancy until her egg lays, so the extra intent must not come back as a
    // second cover of the same hen — the plan skips a hen it already covered
    // rather than spending the attempt and letting the door refuse it.
    const hens = BREEDING_PLAN.MIN_HENS_COVERED - 2;
    const { db } = broodBarn("bot-3", hens);
    const report = Bots.playDay(db)[0];
    expect(report.bred.length).toBe(hens);
    expect(hensCoveredToday(db)).toBe(hens);
  });

  test("a barn with no retired hens breeds nothing and doesn't fall over", () => {
    // Zero hens must be zero covers, not a floor applied to an empty band.
    // Every stable in a fresh world looks like this for its first weeks.
    const { db } = broodBarn("bot-3", 0);
    expect(Bots.playDay(db)[0].bred).toEqual([]);
    expectConserved(db);
  });

  test("the landlord is exempt from the floor — it is the one style that can't afford it", () => {
    // Zane's ruling (2026-08-06) was "all barns should basically want to breed,
    // except for the ones with specific non-breeding strategies", and the
    // landlord is that exception in the flesh: it pours its wallet into land
    // every single day. The exemption is keyed off `landAppetite` rather than
    // a bot id, so a future landlord inherits it for the right reason — this
    // test reads the profile the same way the rule does.
    const landlord = BOT_FARMS.find((b) => b.landAppetite)!;
    const hens = BREEDING_PLAN.MIN_HENS_COVERED;
    const { db } = broodBarn(landlord.id, hens);
    Bots.playDay(db);
    // With no floor under it, the landlord works its DRIVE's share of the band
    // and no more — which is strictly fewer hens than the floor would have made
    // it cover. (Still more than one: depth, not abstinence.)
    const wanted = Math.ceil(hens * landlord.breedDrive);
    expect(wanted).toBeLessThan(BREEDING_PLAN.MIN_HENS_COVERED); // …or this proves nothing
    expect(hensCoveredToday(db)).toBe(wanted);
  });

  test("a broodfarm outbreeds a claim shark of the same band — breedDrive is DEPTH", () => {
    // ⚠ THE GAP BETWEEN THE FLOOR AND THE CAP IS LOAD-BEARING, and round 32's
    // first cut shipped without it. The target is min(hens, cap, max(share,
    // floor)); when floor === cap that collapses to min(hens, cap) for every
    // barn without a landAppetite, `breedDrive` goes arithmetically INERT, and
    // thirteen stables breed identically while their profiles claim three
    // different styles. Pin the inequality, not the values.
    expect(BREEDING_PLAN.MIN_HENS_COVERED).toBeLessThan(BREEDING_PLAN.MAX_COVERS_PER_DAY);

    // A band wide enough that the SHARE binds rather than the band itself —
    // otherwise both barns just cover every hen they own and prove nothing.
    const band = BREEDING_PLAN.MAX_COVERS_PER_DAY + 3;
    const eager = BOT_FARMS.filter((b) => !b.landAppetite).sort((a, b) => b.breedDrive - a.breedDrive)[0];
    const idle = BOT_FARMS.filter((b) => !b.landAppetite).sort((a, b) => a.breedDrive - b.breedDrive)[0];
    expect(eager.breedDrive).toBeGreaterThan(idle.breedDrive * 4); // genuinely different styles

    const covered = (bot: (typeof BOT_FARMS)[number]) => {
      const { db } = broodBarn(bot.id, band);
      Bots.playDay(db);
      return hensCoveredToday(db);
    };
    // The shark still works its floor — Zane's ruling that every barn breeds —
    // and the broodfarm still stops at the runaway cap. Style shows in between.
    expect(covered(idle)).toBe(BREEDING_PLAN.MIN_HENS_COVERED);
    expect(covered(eager)).toBe(BREEDING_PLAN.MAX_COVERS_PER_DAY);
  });
});

/**
 * THE NIGHTLY LAND SWEEP (round 40).
 *
 * The bots have staked every whole Land Token they hold since round 22 — as
 * step 1c of their day, alongside checking in. The trouble is WHEN their day
 * runs: `Game.runTick` plays the bots BEFORE the card goes off, so everything
 * the pit paid a stable tonight — the per-fight land mint, the crown
 * elimination grants — landed after the stable had already walked past the
 * land office. It sat liquid until the following morning, earning nothing.
 * Measured across a 91-day world: 6.7% of all land in the game, permanently
 * idle for no reason anybody designed.
 *
 * `Bots.sweepStakes` banks it the moment the card ends. Three things make it
 * correct rather than merely convenient, and each gets a test: it happens
 * AFTER the day's staking payout (tonight's land starts earning tomorrow, not
 * retroactively), it moves land between one farm's own two piles and never
 * mints a hundredth, and it is BOTS ONLY — a real barn's land is its own
 * business, and a game that silently stakes a player's tokens has decided
 * something on their behalf.
 */
describe("the nightly land sweep", () => {
  const landOf = (db: DB, id: string) => db.select().from(farms).where(eq(farms.id, id)).get()!;
  /** Every token in the world, both piles, in hundredths. */
  const allLand = (db: DB) =>
    db
      .select()
      .from(farms)
      .all()
      .reduce((s, f) => s + f.landTokensCents + f.stakedLandCents, 0);

  test("no bot ends a night holding a whole token — tonight's land is banked tonight", () => {
    const w = world({ only: FAST_ROSTER });
    for (let i = 0; i < 3; i++) w.game.tickDay();
    const bots = w.db.select().from(farms).where(eq(farms.isBot, 1)).all();
    let staked = 0;
    for (const bot of bots) {
      // Under a token left liquid is the signature of the sweep: `stake`
      // refuses a fraction, so the remainder is simply change waiting for
      // tomorrow's card to round it up past a whole token.
      expect(bot.landTokensCents).toBeLessThan(LT_CENTS);
      staked += bot.stakedLandCents;
    }
    // …and the sweep is banking real land, not an empty set of farms. Three
    // nights of a full card mints plenty.
    expect(staked).toBeGreaterThan(0);
  });

  test("tonight's land starts earning TOMORROW — the sweep runs after the payout", () => {
    // The ordering ruling, pinned as arithmetic. `Game.runTick` calls
    // `Farms.distributeStaking` and then `Bots.sweepStakes`, in that order and
    // for this reason: the pool is SHARED, so a stake that goes live before
    // tonight's payout is paid for by every barn that was staked all along.
    // Land earned tonight has held for no time at all, and paying it is
    // retroactive interest.
    //
    // Built from the two calls directly rather than from a tick, because a
    // tick's own noise (the bots stake their free gacha token in the morning,
    // long before either of these runs) would drown the one number this is
    // about.
    const w = world({ only: ["bot-1"] });
    const farmsApi = new Farms(w.db);
    const devId = w.db.select().from(farms).where(eq(farms.isBot, 0)).all()[0].id;
    const botId = w.db.select().from(farms).where(eq(farms.isBot, 1)).all()[0].id;
    // The incumbent: a human barn that has been staked since yesterday.
    farmsApi.buyLand(devId, 10);
    farmsApi.stake(devId, 10);
    // …and tonight the bot comes into a pile of land, liquid and unswept.
    farmsApi.buyLand(botId, 90);
    w.db.update(gameState).set({ stakerPoolCents: 10_000 }).where(eq(gameState.id, 1)).run();

    const devBefore = w.db.select().from(farms).where(eq(farms.id, devId)).get()!;
    const paid = Farms.distributeStaking(w.db);
    // ONE staker tonight, and it takes the whole pool: the bot's 90 tokens
    // were not staked when the pool paid out, so they earn nothing from it.
    expect(paid.stakers).toBe(1);
    const devAfter = w.db.select().from(farms).where(eq(farms.id, devId)).get()!;
    expect(devAfter.gp * 100 + devAfter.gpCents).toBe(devBefore.gp * 100 + devBefore.gpCents + 10_000);
    // Had the sweep gone first, the bot's fresh 90 tokens would have taken 9/10
    // of that pool off the barn that had held its land all day.
    expect(w.db.select().from(farms).where(eq(farms.id, botId)).get()!.stakedLandCents).toBe(0);

    // …and only now does the land go to work, for tomorrow.
    expect(Bots.sweepStakes(w.db)).toBe(90);
    w.db.update(gameState).set({ stakerPoolCents: 10_000 }).where(eq(gameState.id, 1)).run();
    expect(Farms.distributeStaking(w.db).stakers).toBe(2);
  });

  test("the sweep moves land between two piles — it never mints or burns a hundredth", () => {
    const w = world({ only: FAST_ROSTER });
    w.game.tickDay();
    // Hand a bot some land through the front door — `buyLand` is a LEDGERED
    // mint, so the doctor's LT invariant can still reconcile it. (Fabricating
    // the column directly would break that invariant before the sweep ever
    // ran, and the test would be proving nothing about the sweep.)
    const bot = w.db.select().from(farms).where(eq(farms.isBot, 1)).all()[0];
    new Farms(w.db).buyLand(bot.id, 3);
    const before = { total: allLand(w.db), staked: landOf(w.db, bot.id).stakedLandCents };

    expect(Bots.sweepStakes(w.db)).toBe(3);
    const after = landOf(w.db, bot.id);
    expect(after.stakedLandCents).toBe(before.staked + 3 * LT_CENTS);
    expect(after.landTokensCents).toBeLessThan(LT_CENTS);
    // ABSOLUTE, not a delta on one farm: a sweep that took a token off one
    // barn and gave it to another would pass a per-farm check.
    expect(allLand(w.db)).toBe(before.total);
    // GP is not involved at all, and the world-level LT proof still closes.
    expectConserved(w.db);
    expect(diagnose(w.db, ":memory:").invariants.find((i) => i.name === "LT conservation")!.passed).toBe(
      true
    );
  });

  test("a human barn is never swept — its land is its own business", () => {
    // The line the sweep must not cross. A player may be saving tokens for a
    // stud seat (100 LT, the game's one land SINK) or simply holding them;
    // staking is reversible but it is still a decision, and the engine does
    // not get to make it. Round 22's posture — stack it, stake it — is the
    // BOTS' modelled behaviour, not a house rule.
    const w = world({ only: FAST_ROSTER });
    const devId = w.db.select().from(farms).where(eq(farms.isBot, 0)).all()[0].id;
    new Farms(w.db).buyLand(devId, 5);
    const before = landOf(w.db, devId);
    w.game.tickDay();
    const after = landOf(w.db, devId);
    expect(after.landTokensCents).toBe(before.landTokensCents);
    expect(after.stakedLandCents).toBe(0);
  });

  test("a world with no bots sweeps nothing and doesn't fall over", () => {
    const db = createDb(":memory:");
    seedGame(db, { flock: "legacy" });
    expect(Bots.sweepStakes(db)).toBe(0);
  });
});
