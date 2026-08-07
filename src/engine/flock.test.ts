import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { battleLog, birds, events } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { weatherOfDay, type Element } from "./config";
import { Flock } from "./flock";
import { GameClock } from "./game-clock";
import { overallGradeOf } from "./grades";
import {
  canHardcore,
  canManualRetire,
  canJuvenile,
  canRealFight,
  mustRetire,
} from "./lifecycle";

function freshGame() {
  const db = createDb(":memory:");
  const { farmId } = seedGame(db, { flock: "legacy" });
  return { db, farmId, clock: new GameClock(db), flock: new Flock(db, farmId) };
}

function insertEgg(db: ReturnType<typeof createDb>, id: string, birthWeek: number, birthDay: number) {
  db.insert(birds)
    .values({
      id,
      farmId: "farm-1",
      name: "Egg of Dalisay",
      sex: "female",
      status: "egg",
      agility: 400, sight: 400, stamina: 400, gameness: 400, station: 400, condition: 400,
      element: "Water",
      halfStars: 4,
      birthWeek,
      birthDay,
    })
    .run();
}

describe("age gate matrix", () => {
  test("each age hits exactly the ruled gates", () => {
    // [age, juvenile, real, hardcore, manualRetire, forceRetire] — no train
    // column: stats are fixed at birth (ruled round 13).
    const matrix: [number, boolean, boolean, boolean, boolean, boolean][] = [
      [0, false, false, false, false, false], // egg
      [1, true, false, false, false, false], //  discovery year
      [2, false, true, false, false, false], //  real stakes (juvenile CLOSES — round 20)
      [3, false, true, true, true, false], //    the fork opens as a package
      [8, false, true, true, true, false], //    last fighting year
      [9, false, false, false, true, true], //   cap
    ];
    for (const [age, juvenile, real, hardcore, manual, force] of matrix) {
      expect([age, canJuvenile(age)]).toEqual([age, juvenile]);
      expect([age, canRealFight(age)]).toEqual([age, real]);
      expect([age, canHardcore(age)]).toEqual([age, hardcore]);
      expect([age, canManualRetire(age)]).toEqual([age, manual]);
      expect([age, mustRetire(age)]).toEqual([age, force]);
    }
  });
});

describe("hatching", () => {
  test("a late-week egg hatches the very next Friday (<7 days)", () => {
    const { db, clock, flock } = freshGame();
    clock.tickDay();
    clock.tickDay();
    clock.tickDay();
    clock.tickDay();
    clock.tickDay();
    clock.tickDay(); // Thursday, day 6, still week 0
    insertEgg(db, "egg-late", GameClock.weekOf(clock.currentDay()), clock.currentDay());

    const result = clock.tickDay((w) => {
      const events = flock.processHatchFriday(w);
      expect(events.hatched.map((b) => b.id)).toEqual(["egg-late"]);
      expect(events.hatched[0].age).toBe(1);
      expect(events.hatched[0].status).toBe("active");
    });
    expect(result.state.dayIndex).toBe(7); // hatched after ONE day
    expect(flock.byId("egg-late").status).toBe("active");
  });

  test("an egg keeps its auto-name until the player renames the chick", () => {
    const { db, clock, flock } = freshGame();
    insertEgg(db, "egg-1", 0, 0);
    clock.tickWeek((w) => flock.processHatchFriday(w));
    expect(flock.byId("egg-1").name).toBe("Egg of Dalisay");
    const renamed = flock.rename("egg-1", "Ulap");
    expect(renamed.name).toBe("Ulap");
  });
});

describe("retirement", () => {
  test("manual retirement is blocked before the fork (age 3)", () => {
    const { flock } = freshGame();
    const alab = flock.all().find((b) => b.name === "Alab")!; // age 2
    expect(() => flock.retire(alab.id)).toThrow(/retirement unlocks at 3/);
  });

  test("manual retirement works at 3+ and carries stud value from the record", () => {
    const { flock } = freshGame();
    const sinag = flock.all().find((b) => b.name === "Sinag")!; // age 3, 4W-1L
    const retired = flock.retire(sinag.id);
    expect(retired.status).toBe("retired");
    expect(retired.retiredBy).toBe("manual");
    // No studValue anywhere: stud price is player-set (flat 160 for now) —
    // winning does not mechanically raise it (ruled 2026-08-03).
    expect("studValue" in retired).toBe(false);
    expect(retired.wins).toBe(4);
  });

  test("the fighting cap force-retires on Hatch Friday", () => {
    const { clock, flock } = freshGame();
    // Batong Buhay is 5; four week-ticks make him 9.
    let forceRetired: string[] = [];
    for (let i = 0; i < 4; i++) {
      clock.tickWeek((w) => {
        forceRetired = flock.processHatchFriday(w).forceRetired.map((b) => b.name);
      });
    }
    expect(forceRetired).toContain("Batong Buhay");
    const veteran = flock.all().find((b) => b.name === "Batong Buhay")!;
    expect(veteran.status).toBe("retired");
    expect(veteran.retiredBy).toBe("age");
    expect(veteran.age).toBe(9);
  });

  test("hatch and force-retire can happen on the same Friday tick", () => {
    const { db, clock, flock } = freshGame();
    insertEgg(db, "egg-same-day", 0, 0);
    // Age Batong Buhay (5) to 8, egg stays unhatched? No — egg hatches on the
    // first Friday. So check the combined event on tick 1 with a fresh egg
    // plus a bird one week from the cap.
    let lastEvents = { hatched: [] as { id: string }[], forceRetired: [] as { id: string }[] };
    for (let i = 0; i < 4; i++) {
      insertEgg(db, `egg-w${i}`, GameClock.weekOf(clock.currentDay()), clock.currentDay());
      clock.tickWeek((w) => {
        const e = flock.processHatchFriday(w);
        lastEvents = { hatched: e.hatched, forceRetired: e.forceRetired };
      });
    }
    expect(lastEvents.hatched.length).toBe(1); // this week's egg
    expect(lastEvents.forceRetired.length).toBe(1); // Batong Buhay at 9
  });
});

describe("the fog (round 28 — the sheet hides until retirement)", () => {
  const SHEET = ["agility", "sight", "stamina", "gameness", "station", "condition"] as const;

  test("a live bird's view is dark — all six stats null, the card stays public", () => {
    // WHY (round 28: the fog): if a live view ever leaks one number, every
    // client that renders a BirdView leaks it too, and discovery goes back
    // to being a slogan — you'd read the sheet, not the figures.
    const { flock } = freshGame();
    const alab = flock.all().find((b) => b.name === "Alab")!; // active, age 2
    for (const stat of SHEET) expect(alab[stat]).toBeNull();
    // The card — stars, element, record, age — is NOT the sheet: still public.
    expect(alab.stars).toContain("★");
    expect(alab.wins + alab.losses).toBeGreaterThan(0);
    expect(alab.age).toBe(2);
  });

  test("the overall grade is the ONE exception — public on a live bird, and on an egg", () => {
    // WHY (ruled straight after round 28): the grade says how STRONG a bird
    // is and never what SHAPE it is — a B+ sprinter and a B+ stayer read the
    // same letter — so it hints at power without answering the blade
    // question discovery exists to ask. Pinned because the obvious "tidy-up"
    // is to fog it alongside the six numbers it summarises.
    const { db, flock } = freshGame();
    const alab = flock.all().find((b) => b.name === "Alab")!; // active, age 2
    const raw = db.select().from(birds).where(eq(birds.id, alab.id)).get()!;
    const total =
      raw.agility + raw.sight + raw.stamina + raw.gameness + raw.station + raw.condition;
    expect(alab.overallGrade).toBe(overallGradeOf(total));
    insertEgg(db, "egg-grade", 0, 0);
    expect(flock.byId("egg-grade").overallGrade.length).toBeGreaterThan(0);
  });

  test("an egg is fogged too — the shell hides the sheet like it hides the sex", () => {
    // WHY: eggs were the easy regression — view() special-cases them for sex
    // and age, and a refactor that reveals "not active" instead of "retired"
    // would light every unhatched sheet up.
    const { db, flock } = freshGame();
    insertEgg(db, "egg-fog", 0, 0);
    const egg = flock.byId("egg-fog");
    for (const stat of SHEET) expect(egg[stat]).toBeNull();
    expect(egg.sex).toBe("hidden");
  });

  test("retire() IS the reveal — the returned view carries the true numbers", () => {
    // WHY: retirement is the one moment the fog lifts. If this view came back
    // dark, the reveal would exist in prose only and stud shopping would be blind.
    const { db, flock } = freshGame();
    const sinag = flock.all().find((b) => b.name === "Sinag")!; // age 3 — fork open
    const raw = db.select().from(birds).where(eq(birds.id, sinag.id)).get()!;
    const retired = flock.retire(sinag.id);
    for (const stat of SHEET) expect(retired[stat]).toBe(raw[stat]);
    // …and the event log says so, so the barn's neighbors hear the number too.
    const event = db.select().from(events).all().find((e) => e.type === "retire")!;
    expect(event.message).toContain("The sheet is public");
  });

  test("a hardcore force-retire reveals the same way — losing the career buys the sheet", () => {
    // WHY: hardcoreRetire() is the path the fight engine calls on a hardcore
    // loss. It must lift the fog exactly like manual retirement — a loser
    // whose sheet stayed dark would be worthless in the breeding barn.
    const { db, flock } = freshGame();
    const sinag = flock.all().find((b) => b.name === "Sinag")!;
    const raw = db.select().from(birds).where(eq(birds.id, sinag.id)).get()!;
    flock.hardcoreRetire(sinag.id);
    const after = flock.byId(sinag.id);
    expect(after.retiredBy).toBe("hardcore");
    for (const stat of SHEET) expect(after[stat]).toBe(raw[stat]);
  });

  test("the age cap reveals on Hatch Friday — forceRetired views come back lit", () => {
    // WHY: processHatchFriday builds its views from a row it patches in
    // memory ({...row, status: "retired"}) — if that patch ever stopped
    // setting the status BEFORE view() runs, the cap's reveal would arrive
    // one read late and the hatch-day event feed would show a dark sheet.
    const { db, clock, flock } = freshGame();
    const raw = db.select().from(birds).all().find((b) => b.name === "Batong Buhay")!;
    let capped: ReturnType<typeof flock.byId> | undefined;
    for (let i = 0; i < 4; i++) {
      clock.tickWeek((w) => {
        const views = flock.processHatchFriday(w).forceRetired;
        capped ??= views.find((b) => b.name === "Batong Buhay");
      });
    }
    for (const stat of SHEET) expect(capped![stat]).toBe(raw[stat]);
  });
});

describe("the form book (weather on past fights)", () => {
  /** A finished fight, reduced to the two columns the form book reads. */
  function logFight(
    db: ReturnType<typeof createDb>,
    birdId: string,
    farmId: string,
    dayIndex: number,
    pitFigure: number,
    result: "win" | "loss" = "win"
  ) {
    db.insert(battleLog)
      .values({
        dayIndex,
        lobbyId: 1,
        farmId,
        birdId,
        mode: "real",
        format: "b2",
        lobby: "open",
        opponentBirdId: "rival-bird",
        opponentFarmId: "farm-2",
        opponentName: "Rival",
        result,
        pitFigure,
        gpDeltaCents: 0,
        seed: 1,
      })
      .run();
  }

  /** The first `n` days on which `element` is the ascendant one, from day 0. */
  function daysFavouring(element: Element, n: number, favour = true): number[] {
    const out: number[] = [];
    for (let d = 0; out.length < n; d++) if ((weatherOfDay(d) === element) === favour) out.push(d);
    return out;
  }

  test("every line carries its day's element, flagged when the bird held it", () => {
    const { db, farmId, flock } = freshGame();
    const alab = flock.all().find((b) => b.name === "Alab")!;
    const [good] = daysFavouring(alab.element, 1);
    const [bad] = daysFavouring(alab.element, 1, false);
    logFight(db, alab.id, farmId, bad, 70);
    logFight(db, alab.id, farmId, good, 84);

    const book = flock.formBook(alab.id);
    expect(book.element).toBe(alab.element);
    // Oldest first regardless of insert order — a career reads forward.
    expect(book.lines.map((l) => l.dayIndex)).toEqual([bad, good].sort((a, b) => a - b));
    for (const line of book.lines) {
      expect(line.ascendant).toBe(weatherOfDay(line.dayIndex));
      expect(line.edge).toBe(line.ascendant === alab.element);
    }
  });

  test("the on/off split is what decorrelates a good day from a good bird", () => {
    const { db, farmId, flock } = freshGame();
    const alab = flock.all().find((b) => b.name === "Alab")!;
    const [g1, g2] = daysFavouring(alab.element, 2);
    const [b1, b2] = daysFavouring(alab.element, 2, false);
    logFight(db, alab.id, farmId, g1, 88);
    logFight(db, alab.id, farmId, g2, 92);
    logFight(db, alab.id, farmId, b1, 60);
    logFight(db, alab.id, farmId, b2, 64, "loss");

    const book = flock.formBook(alab.id);
    expect(book.onEdge).toEqual({ fights: 2, avgFigure: 90 });
    expect(book.offEdge).toEqual({ fights: 2, avgFigure: 62 });
  });

  test("a bird that has never fought in its own weather reports no onEdge line", () => {
    const { db, farmId, flock } = freshGame();
    const alab = flock.all().find((b) => b.name === "Alab")!;
    for (const d of daysFavouring(alab.element, 3, false)) logFight(db, alab.id, farmId, d, 75);
    const book = flock.formBook(alab.id);
    expect(book.onEdge).toBeNull();
    expect(book.offEdge?.fights).toBe(3);
  });

  test("the weather is RECOVERED, not stored — nothing but dayIndex is needed", () => {
    // The whole reason this shipped without a schema change: a world seeded
    // before the weather existed still reads back a full form book.
    const { db, farmId, flock } = freshGame();
    const alab = flock.all().find((b) => b.name === "Alab")!;
    logFight(db, alab.id, farmId, 41, 70);
    expect(flock.formBook(alab.id).lines[0].ascendant).toBe(weatherOfDay(41));
  });

  test("the form book is not farm-scoped — claimer fields are read the same way", () => {
    const { db, farmId, flock } = freshGame();
    const alab = flock.all().find((b) => b.name === "Alab")!;
    logFight(db, alab.id, farmId, 3, 70);
    // A rival barn's Flock reads the same bird: byId() would refuse it.
    const rival = new Flock(db, "farm-2");
    expect(rival.formBook(alab.id).lines.length).toBe(1);
    expect(() => rival.byId(alab.id)).toThrow();
    expect(() => rival.formBook("no-such-bird")).toThrow(/No bird/);
  });
});
