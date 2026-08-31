import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/db/client";
import { birds, events, farms } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { applyProposals, brainRng, buildView, collectProposals, type BotAction } from "./bot-brain";
import { ECONOMY } from "./config";
import { Bots } from "./bots";
import { Game } from "./game";
import { Tournaments } from "./tournaments";
import { seedWorld } from "./rng";

/**
 * ── THE OUTSIDE DECIDER (round 49) ─────────────────────────────────────────
 *
 * Two things have to be true for this seam to be safe, and they pull in
 * opposite directions:
 *
 *   1. UNUSED, IT CHANGES NOTHING. A world with no llm barn must play the
 *      day it has always played — same ledger, byte for byte. This is the
 *      one that protects determinism.test.ts, replay.test.ts and every
 *      balance number ever measured.
 *   2. USED, IT ACTUALLY PLAYS. Proposals must reach the engine, be bound by
 *      the same house rules as everyone else, and refuse to corrupt anything
 *      when the decider is wrong, hostile, or asleep.
 *
 * The `seedWorld(null)` in every `finally` is the house pattern from
 * determinism.test.ts — never leak a pinned stream into another test.
 */

const FAST_ROSTER = ["scripted-1", "scripted-3", "scripted-5"];

/** A world with a few bot stables, ready to tick. */
function world(): { db: DB; devFarmId: string } {
  const db: DB = createDb(":memory:");
  const dev = seedGame(db, { flock: "legacy" });
  Bots.seed(db, { flock: "legacy", only: FAST_ROSTER });
  return { db, devFarmId: dev.farmId };
}

const ledger = (db: DB): string[] =>
  db
    .select()
    .from(events)
    .all()
    .map((e) => `${e.dayIndex}|${e.type}|${e.farmId ?? ""}|${e.gpCents ?? ""}|${e.lt ?? ""}|${e.message}`);

describe("the seam is inert until somebody uses it", () => {
  test("no llm barn: the ledger is identical with and without the proposals argument", () => {
    seedWorld(7);
    try {
      const plain = world();
      const plainGame = new Game(plain.db, plain.devFarmId);
      for (let i = 0; i < 8; i++) plainGame.tickDay();

      seedWorld(7);
      const passed = world();
      const passedGame = new Game(passed.db, passed.devFarmId);
      // An EMPTY map, not `undefined` — the argument being present must not
      // itself change a day. This is the exact shape the sim will use on
      // every ordinary world once collectProposals is wired in: it returns an
      // empty map when no barn carries brain='llm', and hands it over anyway.
      for (let i = 0; i < 8; i++) passedGame.tickDay({ proposals: new Map() });

      expect(ledger(plain.db).length).toBeGreaterThan(200); // a real world, not an empty pass
      expect(ledger(passed.db)).toEqual(ledger(plain.db));
    } finally {
      seedWorld(null);
    }
  });

  test("every seeded farm defaults to the scripted brain", () => {
    const { db } = world();
    const rows = db.select().from(farms).all();
    expect(rows.length).toBeGreaterThan(3);
    expect(rows.every((r) => r.brain === "scripted")).toBe(true);
  });
});

describe("collect", () => {
  test("no decider, or no llm barn, means no work and no proposals", async () => {
    const { db } = world();
    expect((await collectProposals(db, null)).size).toBe(0);
    // A decider that would throw if called — proof the llm-farm query short
    // circuits before anything is built, which is what keeps an ordinary
    // tick free of this file entirely.
    const boom = async () => {
      throw new Error("should never be called");
    };
    expect((await collectProposals(db, boom)).size).toBe(0);
  });

  test("one broken brain does not take the world down with it", async () => {
    const { db } = world();
    db.update(farms).set({ brain: "llm" }).where(eq(farms.id, "scripted-1")).run();
    db.update(farms).set({ brain: "llm" }).where(eq(farms.id, "scripted-3")).run();

    const proposals = await collectProposals(db, async (view) => {
      if (view.farm.id === "scripted-1") throw new Error("model timed out");
      return [{ do: "check_in" }];
    });

    // The healthy barn proposed; the broken one simply is not in the map, and
    // `playDay` sits it out rather than falling back to a scripted day.
    expect(proposals.has("scripted-1")).toBe(false);
    expect(proposals.get("scripted-3")).toEqual([{ do: "check_in" }]);
  });
});

describe("the mail tells a barn only what a player could see", () => {
  test("a bird seated in this week's crowns leaves the eligible list", () => {
    const { db } = world();
    // Manufacture a crown-eligible veteran: hardcore age, proven record.
    const candidate = db.select().from(birds).where(eq(birds.farmId, "scripted-1")).all()
      .find((b) => b.status === "active")!;
    db.update(birds)
      .set({ named: 1, birthWeek: -4, stakesWins: 10 })
      .where(eq(birds.id, candidate.id))
      .run();

    const before = buildView(db, "scripted-1");
    expect(before.crowns.eligibleBirdIds).toContain(candidate.id);

    // Register it — the same call the crown verb translates to. From here
    // enter() would refuse a second declaration, so the mail must stop
    // calling the bird eligible or the brief re-advertises a dead row all week.
    new Tournaments(db, "scripted-1").enter(candidate.id, before.crowns.weekFormats[0], "major");
    const after = buildView(db, "scripted-1");
    expect(after.crowns.eligibleBirdIds).not.toContain(candidate.id);
  });

  test("a live bird's six stats stay fogged, even from its owner", () => {
    const { db } = world();
    const view = buildView(db, "scripted-1");
    const live = view.flock.filter((b) => b.status === "active");
    expect(live.length).toBeGreaterThan(0);
    // Round 28 hid live stats from EVERYONE. The view inherits that by being
    // built from Flock.view rather than reading the rows — if this ever fails,
    // somebody has started hand-rolling the view and the fog has a hole in it.
    for (const bird of live) expect(bird.agility).toBeNull();
  });

  test("the view carries the day, the wallet, the card and a scout read per fighter", () => {
    const { db } = world();
    const view = buildView(db, "scripted-1");
    expect(view.day).toBe(0);
    expect(view.farm.id).toBe("scripted-1");
    expect(view.farm.gp).toBeGreaterThan(0);
    expect(view.card.today.length).toBeGreaterThan(0);
    const live = view.flock.filter((b) => b.status === "active");
    for (const bird of live) expect(view.scout[bird.id]).toBeDefined();
  });
});

describe("apply: the house rules bind an llm barn exactly as they bind a bot", () => {
  test("a legal day is played and reported", () => {
    const { db } = world();
    const before = db.select().from(farms).where(eq(farms.id, "scripted-1")).get()!;
    const report = applyProposals(db, "scripted-1", [{ do: "check_in" }], brainRng(0, 0));
    const after = db.select().from(farms).where(eq(farms.id, "scripted-1")).get()!;

    expect(report.style).toBe("llm");
    expect(report.checkedIn).toBe(true);
    expect(after.gp).toBeGreaterThan(before.gp); // the drip landed
  });

  test("nonsense is refused without throwing, and without moving money", () => {
    const { db } = world();
    const before = db.select().from(farms).where(eq(farms.id, "scripted-1")).get()!;
    const nonsense: BotAction[] = [
      { do: "breed", motherId: "no-such-bird", fatherId: "also-fake" },
      { do: "enter", birdId: "ghost", mode: "real", classType: "maiden", format: "b1" },
      { do: "claim", entryId: 999_999 },
      { do: "list_stud", birdId: "" },
      { do: "buy_land", tokens: 10_000_000 },
      { do: "unstake", tokens: 10_000_000 },
      { do: "expand_barn" },
    ];
    const report = applyProposals(db, "scripted-1", nonsense, brainRng(0, 0));
    const after = db.select().from(farms).where(eq(farms.id, "scripted-1")).get()!;

    expect(report.bred).toEqual([]);
    expect(report.entered).toEqual([]);
    expect(report.claimsPlaced).toBe(0);
    // The wallet moved by exactly the check-in drip and nothing else —
    // check-in became an apply-path CHORE in round 63 (spec decision #1),
    // so even a nonsense day banks the reflex. Every refusal still happened
    // at the engine's door: a decider cannot spend what the rules forbid.
    expect(report.checkedIn).toBe(true);
    expect(after.gp).toBe(before.gp + ECONOMY.DAILY_DRIP);
    expect(after.landTokensCents).toBe(before.landTokensCents);
  });

  test("a runaway reply is capped rather than obeyed", () => {
    const { db } = world();
    // 500 check-ins: the first succeeds, the rest are refused by the once-a-day
    // rule anyway — what is being pinned here is that the loop is BOUNDED, so
    // a model stuck repeating itself costs one tick and not a world.
    const flood: BotAction[] = Array.from({ length: 500 }, () => ({ do: "check_in" }) as const);
    const report = applyProposals(db, "scripted-1", flood, brainRng(0, 0));
    expect(report.checkedIn).toBe(true);
  });

  test("proposal order does not change the day", () => {
    // Rule 2 of apply: actions run in a fixed sequence, so a model that lists
    // its day back-to-front is not punished for it — and one that discovers a
    // reordering advantage has found a bug, not a strategy.
    const forward: BotAction[] = [{ do: "check_in" }, { do: "roll_gacha" }];
    const backward: BotAction[] = [{ do: "roll_gacha" }, { do: "check_in" }];

    const a = world();
    const first = applyProposals(a.db, "scripted-1", forward, brainRng(0, 0));
    const b = world();
    const second = applyProposals(b.db, "scripted-1", backward, brainRng(0, 0));

    expect(second.checkedIn).toBe(first.checkedIn);
    expect(second.paidPulls).toBe(first.paidPulls);
    expect(db2gp(b.db, "scripted-1")).toBe(db2gp(a.db, "scripted-1"));
  });
});

describe("an llm barn plays a real day inside a real tick", () => {
  test("proposals reach the engine through tickDay, and the world stays sound", () => {
    seedWorld(11);
    try {
      const { db, devFarmId } = world();
      db.update(farms).set({ brain: "llm" }).where(eq(farms.id, "scripted-1")).run();
      const game = new Game(db, devFarmId);

      const proposals = new Map<string, BotAction[]>([
        ["scripted-1", [{ do: "check_in" }, { do: "roll_gacha" }]],
      ]);
      const tick = game.tickDay({ proposals });

      const llm = tick.bots.filter((b) => b.style === "llm");
      expect(llm.length).toBe(1);
      expect(llm[0].checkedIn).toBe(true);
      // …and the scripted stables played their ordinary day alongside it.
      expect(tick.bots.filter((b) => b.style !== "llm").length).toBe(FAST_ROSTER.length - 1);
    } finally {
      seedWorld(null);
    }
  });

  test("an llm barn with no proposals sits the day out — it never falls back to scripted", () => {
    seedWorld(11);
    try {
      const { db, devFarmId } = world();
      db.update(farms).set({ brain: "llm" }).where(eq(farms.id, "scripted-1")).run();
      const game = new Game(db, devFarmId);
      const tick = game.tickDay(); // nobody collected anything

      // Silently handing the day to the scripted brain would make a broken
      // model look like a working one — the single most expensive mistake
      // available here, because it would corrupt the very comparison the
      // whole round exists to make.
      expect(tick.bots.some((b) => b.farm === "scripted-1")).toBe(false);
      expect(tick.bots.length).toBe(FAST_ROSTER.length - 1);
    } finally {
      seedWorld(null);
    }
  });
});

/** The farm's whole-GP balance — a spelling used in two tests above. */
function db2gp(db: DB, farmId: string): number {
  return db.select().from(farms).where(eq(farms.id, farmId)).get()!.gp;
}
