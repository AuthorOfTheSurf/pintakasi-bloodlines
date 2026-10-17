import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { battleLog, gameState } from "@/db/schema";
import { isBargain, pickOffering } from "./bots";
import { AGE, CLAIMER, FIGURE, PAR, PINTAKASI, VALUE, cardOfDay, type Lobby } from "./config";
import { Flock } from "./flock";
import { Lobbies, type EntryCard } from "./lobbies";
import { parBook } from "./pars";
import { mulberry32 } from "./rng";
import { recordFight } from "./scout";
import { diagnose } from "./doctor";
import { makeBird, onCard, world as testWorld } from "./testkit";
import { appraise, crownTerm, type CrownRead } from "./value";

/**
 * THE CLAIM-PAR ROUND. Before it, every claimer tag drew the same field as the
 * open: a bird went to a claimer on a sellRate coin flip and a shopper claimed
 * on a claimAggression coin flip, neither looking at what the bird was worth.
 * These tests pin the replacement: public class pars, a public game value built
 * on them, owners who never tag a bird under its value, and shoppers who claim
 * only bargains.
 */

// A day whose grown card posts the 90 and the 270 tag (the dear rung alternates).
const TODAY = 21;
const PARS: { classType: Lobby; price?: number; figure: number }[] = [
  { classType: "open", figure: 45 },
  { classType: "claimer", price: 270, figure: 40 },
  { classType: "claimer", price: 180, figure: 35 },
  { classType: "claimer", price: 90, figure: 30 },
];

let ghost = 0;
function fight(
  db: DB,
  row: {
    birdId?: string;
    day: number;
    classType: Lobby;
    price?: number;
    figure: number;
    win: boolean;
    tournamentId?: number;
    gpDeltaCents?: number;
  }
) {
  recordFight(db, {
    dayIndex: row.day,
    lobbyId: 1,
    tournamentId: row.tournamentId ?? null,
    farmId: "house",
    birdId: row.birdId ?? `ghost-${++ghost}`,
    mode: "real",
    format: "b3",
    lobby: row.classType,
    claimPrice: row.price ?? null,
    opponentBirdId: "ghost",
    opponentFarmId: "house",
    opponentName: "Sparring Ghost",
    side: 0,
    result: row.win ? "win" : "loss",
    pitFigure: row.figure,
    gpDeltaCents: row.gpDeltaCents ?? 0,
    seed: ghost,
  });
}

/**
 * A world standing on TODAY with recent fights on every rung: winners at the
 * rung's par, and as many losers a good deal under it, so each class has an
 * even-money level about VALUE.EVEN_GAP under its par, like a real one.
 */
function paredWorld() {
  const w = testWorld({ rivalFlock: false });
  w.db.update(gameState).set({ dayIndex: TODAY }).where(eq(gameState.id, 1)).run();
  for (const rung of PARS)
    for (let i = 0; i < PAR.MIN_WINS + 5; i++)
      for (const win of [true, false])
        fight(w.db, {
          day: TODAY - 3,
          classType: rung.classType,
          price: rung.price,
          // The level is the top of the losers' band: half a band over their figure.
          figure: win ? rung.figure : rung.figure - VALUE.EVEN_GAP - FIGURE.BAND / 2,
          win,
        });
  return w;
}

/** A grown bird past maiden and nw3, with ten recent figures of `figure`. */
function birdWithForm(w: ReturnType<typeof paredWorld>, figure: number) {
  const row = makeBird(w.db, { age: 3, wins: 6, losses: 4, stakesWins: 6 });
  for (let i = 0; i < VALUE.FORM_FIGHTS; i++)
    fight(w.db, {
      birdId: row.id,
      day: TODAY - 10 + i,
      classType: "open",
      figure,
      win: i % 2 === 0,
    });
  return new Flock(w.db, w.devId).byId(row.id);
}

describe("the class pars", () => {
  test("a par is the median WINNING figure per rung, over the window, without championships", () => {
    const w = testWorld({ rivalFlock: false });
    w.db.update(gameState).set({ dayIndex: TODAY }).where(eq(gameState.id, 1)).run();
    for (let i = 0; i < 30; i++)
      fight(w.db, { day: TODAY - 1, classType: "open", figure: 45, win: true });
    // None of these may move it: losers, a Major, a fight from before the window.
    for (let i = 0; i < 30; i++)
      fight(w.db, { day: TODAY - 1, classType: "open", figure: 10, win: false });
    for (let i = 0; i < 30; i++)
      fight(w.db, { day: TODAY - 1, classType: "open", figure: 90, win: true, tournamentId: 1 });
    for (let i = 0; i < 30; i++)
      fight(w.db, { day: TODAY - PAR.WINDOW_DAYS - 1, classType: "open", figure: 90, win: true });
    const par = parBook(w.db, TODAY).par({ mode: "real", classType: "open" });
    expect(par).not.toBeNull();
    expect(Math.abs((par ?? 0) - 45)).toBeLessThanOrEqual(2.5); // inside the figure's own band
  });

  test("a thin claimer rung is estimated from the open; no open par means no par at all", () => {
    const w = testWorld({ rivalFlock: false });
    w.db.update(gameState).set({ dayIndex: TODAY }).where(eq(gameState.id, 1)).run();
    expect(parBook(w.db, TODAY).par({ mode: "real", classType: "open" })).toBeNull();
    for (let i = 0; i < 30; i++)
      fight(w.db, { day: TODAY - 1, classType: "open", figure: 45, win: true });
    const book = parBook(w.db, TODAY + 1); // a new day, so a fresh book
    const open = book.par({ mode: "real", classType: "open" }) ?? 0;
    expect(book.par({ mode: "real", classType: "claimer", price: CLAIMER.PRICES[0] })).toBe(
      open - CLAIMER.PRICES.length * PAR.RUNG_STEP
    );
  });

  test("the lobby board prints each lobby's par", () => {
    const w = paredWorld();
    const board = new Lobbies(w.db, w.devId).board({ detail: "fills" });
    const open = board.find((l) => l.mode === "real" && l.classType === "open");
    const cheap = board.find(
      (l) => l.classType === "claimer" && l.price === CLAIMER.PRICES[0] && l.mode === "real"
    );
    expect(open?.par).toBeGreaterThan(cheap?.par ?? Infinity);
  });
});

describe("the game value", () => {
  test("rises with form, never drops under the floor, and is shown on the bird", () => {
    const w = paredWorld();
    const weak = birdWithForm(w, 15);
    const mid = birdWithForm(w, 33);
    const strong = birdWithForm(w, 60);
    expect(weak.value ?? 0).toBeGreaterThanOrEqual(VALUE.FLOOR);
    expect(weak.value ?? Infinity).toBeLessThanOrEqual(CLAIMER.PRICES[0]);
    expect(mid.value ?? 0).toBeGreaterThan(weak.value ?? 0);
    expect(strong.value ?? 0).toBeGreaterThan(mid.value ?? 0);
    expect(strong.value ?? 0).toBeGreaterThan(Math.max(...CLAIMER.PRICES));
    expect((strong.value ?? 0) % VALUE.ROUND_TO).toBe(0);
  });

  test("a bird whose only winning classes are claimers is worth no more than a tag", () => {
    const w = paredWorld();
    const mid = birdWithForm(w, 33);
    // A winner in the claimers, not in the open: running there, anyone may buy
    // it at the tag, so it is worth more than the cheap tag but not the dearest.
    expect(mid.value ?? 0).toBeGreaterThan(CLAIMER.PRICES[0]);
    expect(mid.value ?? Infinity).toBeLessThanOrEqual(Math.max(...CLAIMER.PRICES));
  });

  test("an unraced bird reads as what its grade usually posts, not as zero", () => {
    const w = paredWorld();
    const row = makeBird(w.db, { age: 2 });
    const { form } = appraise(w.db, new Flock(w.db, w.devId).byId(row.id), TODAY);
    expect(form).toBe(
      parBook(w.db, TODAY).prior(new Flock(w.db, w.devId).byId(row.id).overallGrade)
    );
  });
});

describe("the crown term: a shot at a Major final is worth something", () => {
  const market = { purseGp: 35_000, field: 1_750 };
  const age3 = (vsPar: number, earningsGp: number): CrownRead => ({
    age: AGE.FORK,
    overallGrade: "B+",
    vsPar,
    earningsGp,
    juvenileCrownWins: 0,
  });

  test("strong figures and big earnings at age 3 price far over a typical bird", () => {
    const strong = crownTerm(age3(10, 8_000), market);
    const typical = crownTerm(age3(VALUE.CROWN_NO_READ, 800), market);
    expect(typical).toBeGreaterThan(0);
    expect(strong).toBeGreaterThan(10 * typical);
  });

  test("no bird is priced over a CROWN_P_CAP chance of a final", () => {
    const sure = crownTerm(age3(40, 1_000_000), { ...market, field: 1 });
    expect(sure).toBeCloseTo(VALUE.CROWN_P_CAP * VALUE.CROWN_ADULT.K * market.purseGp, 6);
  });

  test("a bird past the last Major age, or still an egg, has no crown term", () => {
    expect(crownTerm({ ...age3(40, 1_000_000), age: AGE.FIGHTING_CAP }, market)).toBe(0);
    expect(crownTerm({ ...age3(40, 1_000_000), age: AGE.EGG }, market)).toBe(0);
  });

  test("the same bird is worth less to the crowns as the field it shares them with grows", () => {
    const bird = age3(5, 3_000);
    expect(crownTerm(bird, { ...market, field: 400 })).toBeGreaterThan(crownTerm(bird, market));
  });

  test("a juvenile is priced by its grade and its juvenile-crown wins", () => {
    const chick = { ...age3(0, 0), age: AGE.CHICK, overallGrade: "A" as const };
    const crowned = crownTerm({ ...chick, juvenileCrownWins: 2 }, market);
    expect(crowned).toBeGreaterThan(crownTerm(chick, market));
    expect(crownTerm(chick, market)).toBeGreaterThan(
      crownTerm({ ...chick, overallGrade: "B" }, market)
    );
  });

  test("the game value carries it: Major-blade figures and earnings lift an age-3 bird", () => {
    const w = paredWorld();
    // No Major has run, so the going purse is the juice split across the blades.
    w.db
      .update(gameState)
      .set({ juicePoolCents: PINTAKASI.BLADES.length * 35_000 * 100 })
      .where(eq(gameState.id, 1))
      .run();
    const fought = (figure: number, gpDeltaCents: number) => {
      const row = makeBird(w.db, { age: AGE.FORK, wins: 6, losses: 4, stakesWins: 6 });
      for (let i = 0; i < VALUE.FORM_FIGHTS; i++)
        fight(w.db, {
          birdId: row.id,
          day: TODAY - 10 + i,
          classType: "open",
          figure,
          win: i % 2 === 0,
          gpDeltaCents: i % 2 === 0 ? gpDeltaCents : 0,
        });
      return appraise(w.db, new Flock(w.db, w.devId).byId(row.id), TODAY);
    };
    const strong = fought(60, 100_000);
    const weak = fought(15, 0);
    expect(weak.crown).toBeGreaterThan(0);
    expect(strong.crown).toBeGreaterThan(weak.crown);
    expect(strong.crown).toBeLessThanOrEqual(VALUE.CROWN_P_CAP * VALUE.CROWN_ADULT.K * 35_000);
    expect(strong.value % VALUE.ROUND_TO).toBe(0);
  });
});

describe("the owner: fight where it earns most, never tag under value", () => {
  // The most eager seller there could be, and a barn with no lean at all.
  const seller = { sellRate: 1, tagCourage: 0, ladderCourage: 0 };
  const neutral = { sellRate: 0.5, tagCourage: 0.5, ladderCourage: 0 };
  const postsTags = cardOfDay(TODAY).filter((k) => k.mode === "real" && k.classType === "claimer");

  test("today's card posts the cheap and the dear tag (the fixture's premise)", () => {
    expect(postsTags.map((k) => k.price).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([
      CLAIMER.PRICES[0],
      CLAIMER.PRICES[2],
    ]);
  });

  test("a bird worth more than the dearest tag is never carded into a claimer, even by a seller", () => {
    // The old chooser sent a bird to a claimer on rng() < sellRate: at 1, every time.
    const w = paredWorld();
    const strong = birdWithForm(w, 80);
    for (let seed = 1; seed <= 40; seed++) {
      const spec = pickOffering(w.db, seller, strong, mulberry32(seed), TODAY);
      expect(spec?.classType).toBe("open");
    }
  });

  test("a bird that can only win the cheap tag runs the cheap tag, every night", () => {
    // The old chooser tagged on rng() < sellRate: at 0.5, about half the nights.
    const w = paredWorld();
    const weak = birdWithForm(w, 5);
    expect(weak.value ?? Infinity).toBeLessThanOrEqual(CLAIMER.PRICES[0]);
    for (let seed = 1; seed <= 40; seed++) {
      const spec = pickOffering(w.db, neutral, weak, mulberry32(seed), TODAY);
      expect(spec).toMatchObject({ classType: "claimer", price: CLAIMER.PRICES[0] });
    }
  });

  test("a bird worth the dear tag is never tagged at the cheap one", () => {
    const w = paredWorld();
    const mid = birdWithForm(w, 33);
    let tagged = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const spec = pickOffering(w.db, seller, mid, mulberry32(seed), TODAY);
      expect(spec?.price).not.toBe(CLAIMER.PRICES[0]);
      if (spec?.classType === "claimer") tagged++;
    }
    expect(tagged).toBeGreaterThan(0); // …and the dear tag is a door it does walk through
  });
});

describe("the shopper: claim bargains only", () => {
  const card = (value: number | null, record: { wins: number; losses: number }, age = 3) =>
    ({
      name: "Target",
      sexLabel: "rooster",
      age,
      stars: "1★ Fire",
      career: record,
      formatRecords: {},
      value,
    }) satisfies EntryCard["bird"];
  const even = 0.5; // a shopper whose judgement agrees with the game's

  test("claims a bird worth clearly more than its tag, whatever its record", () => {
    // The old shopper refused any bird with more losses than wins.
    expect(isBargain(card(600, { wins: 2, losses: 5 }), 270, even)).toBe(true);
  });

  test("passes on a bird worth no more than its tag, however good its record", () => {
    // The old shopper claimed any winning record on its coin flip.
    expect(isBargain(card(270, { wins: 9, losses: 1 }), 270, even)).toBe(false);
    expect(isBargain(card(VALUE.FLOOR, { wins: 9, losses: 1 }), CLAIMER.PRICES[0], even)).toBe(
      false
    );
  });

  test("keeps the old guards: no value, no claim; too old, no claim", () => {
    expect(isBargain(card(null, { wins: 5, losses: 0 }), 90, even)).toBe(false);
    expect(isBargain(card(2000, { wins: 5, losses: 0 }, 7), 90, even)).toBe(false);
  });
});

describe("the value is recorded before every fight, and the doctor calibrates it", () => {
  test("a resolved fight carries the value its bird showed that morning", () => {
    const w = testWorld();
    const morning = new Flock(w.db, w.devId).all().find((b) => b.status === "active" && b.age >= 2);
    if (!morning) throw new Error("the test world seeds active birds");
    const spec = onCard(w.db, { mode: "real", classType: "open" });
    new Lobbies(w.db, w.devId).enter(morning.id, spec);
    const rival = new Flock(w.db, w.rivalId).all().find((b) => b.status === "active" && b.age >= 2);
    if (!rival) throw new Error("the rival seeds grown birds");
    new Lobbies(w.db, w.rivalId).enter(rival.id, spec);
    w.game.tickDay();
    const row = w.db.select().from(battleLog).where(eq(battleLog.birdId, morning.id)).get();
    expect(row?.valueBefore).toBe(morning.value);
  });

  test("the doctor prints value deciles once fights carry a value", () => {
    const w = paredWorld();
    for (let i = 0; i < 40; i++)
      recordFight(w.db, {
        dayIndex: TODAY - 1,
        lobbyId: 1,
        farmId: "house",
        birdId: `calibrated-${i}`,
        mode: "real",
        format: "b3",
        opponentBirdId: "ghost",
        opponentFarmId: "house",
        opponentName: "Sparring Ghost",
        side: 0,
        result: i % 2 === 0 ? "win" : "loss",
        pitFigure: 30,
        gpDeltaCents: i % 2 === 0 ? 100 : -100,
        seed: i,
        valueBefore: 80 + i * 10,
      });
    const section = diagnose(w.db, ":memory:").health.find((h) => h.title === "VALUE CALIBRATION");
    expect(section?.lines.filter((l) => /^d\d/.test(l.trim())).length).toBe(10);
  });
});
