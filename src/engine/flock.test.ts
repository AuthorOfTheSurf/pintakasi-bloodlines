import { describe, expect, test } from "bun:test";
import { createDb } from "@/db/client";
import { birds } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { Flock } from "./flock";
import { GameClock } from "./game-clock";
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
