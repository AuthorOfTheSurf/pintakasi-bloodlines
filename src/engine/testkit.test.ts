import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { birds, farms } from "@/db/schema";
import { STARS } from "./config";
import { ageOf } from "./lifecycle";
import { GameClock } from "./game-clock";
import { expectConserved, makeBird, makeBirds, walletCents, world } from "./testkit";

/**
 * The fixture has to be trustworthy before anything is migrated onto it —
 * a shared `world()` that quietly differs from the six it replaces would
 * turn a green suite into a lie.
 */

describe("world()", () => {
  test("opens with two barns, both flocked, and conserves", () => {
    const w = world();
    expect(w.db.select().from(farms).all().length).toBe(2);
    expect(w.dev.flock.all().length).toBeGreaterThan(0);
    expect(w.rival.flock.all().length).toBeGreaterThan(0);
    expectConserved(w.db);
  });

  test("names resolve both ways — own birds by name, the rival's by slot", () => {
    const w = world();
    expect(w.bird("Sinag").name).toBe("Sinag");
    // The rival draws different NAMES from the pool but keeps the same seeded
    // ids, which is the whole reason the slot map exists.
    expect(w.rivalSlot("Alab")).toBe("rival-6");
    expect(w.db.select().from(birds).where(eq(birds.id, "rival-6")).get()).toBeTruthy();
  });

  test("rivalFlock: false leaves the rival barn empty", () => {
    const w = world({ rivalFlock: false });
    expect(w.rival.flock.all().length).toBe(0);
    expectConserved(w.db);
  });

  // ⚠ RE-POINTED IN ROUND 37, with the flag itself. `qualified` used to stamp
  // PINTAKASI.QUALIFYING_POINTS, because a Major had a points gate. That gate
  // is deleted — Thursday is open on age — so the flag now stamps a real WIN,
  // which is what the bots' own crown appetite asks for
  // (CROWN_CHASE.CROWN_MIN_REAL_WINS) and what lifts a bird off the bottom of
  // the committee's list. The claim being pinned is unchanged: it stamps the
  // world it opens, and stops there.
  test("qualified: true gives every standing bird a real win — and NOTHING inserted afterwards", () => {
    const w = world({ qualified: true });
    for (const b of w.db.select().from(birds).all()) {
      expect(b.wins).toBe(1);
      expect(b.stakesWins).toBe(1);
    }
    // ⚠ It FLATTENS the legacy records rather than topping them up — Batong
    // Buhay's seeded 7 wins come out the far side as 1. That is fine for what
    // the flag is for (clearing an appetite floor) and would be wrong for a
    // test about seeding depth, which should set its own records.
    // The asymmetry the Selection Committee's bump test depends on: a bird
    // added later is un-stamped, so a test can build a field weaker than its
    // newcomer on purpose.
    const late = makeBird(w.db, { age: 3 });
    expect(late.wins).toBe(0);
    expect(late.stakesWins).toBe(0);
  });

  test("qualified defaults OFF — or a first-win test would prove nothing", () => {
    // The legacy flock arrives with real seeded records (Sinag 4W, Batong
    // Buhay 7W), so "off" cannot mean "everything is zero". What it means is
    // that nothing has been stamped: the birds with no career — Kidlat, the
    // discovery-year chick — still have none.
    const rows = world().db.select().from(birds).all();
    expect(rows.some((b) => b.stakesWins === 0)).toBe(true);
    expect(rows.find((b) => b.name === "Kidlat")!.stakesWins).toBe(0);
  });

  test("extra barns register and are reachable by name", () => {
    const w = world({
      extra: [{ name: "Talpakan Kings", primaryColor: "blue", secondaryColor: "white" }],
    });
    expect(w.db.select().from(farms).all().length).toBe(3);
    expect(w.barn("Talpakan Kings").id).toBeTruthy();
    expect(() => w.barn("Nobody")).toThrow(/no extra barn/);
    expectConserved(w.db);
  });
});

describe("makeBird()", () => {
  test("fills every column, so a new one is a single edit", () => {
    const w = world();
    const b = makeBird(w.db);
    // Round trip through the DB: any NOT NULL column the factory forgot would
    // have thrown on insert rather than reaching this line.
    expect(b.named).toBe(1);
    expect(b.status).toBe("active");
    expect(b.halfStars).toBeLessThanOrEqual(STARS.MAX_HALF_STARS);
    expect(b.carriage).toBeTruthy(); // round 23's column, defaulted by the DDL
  });

  test("age resolves against the live clock", () => {
    const w = world();
    const week = GameClock.weekOf(0);
    for (const age of [0, 1, 3, 5]) expect(ageOf(makeBird(w.db, { age }), week)).toBe(age);
  });

  test("an explicit birthWeek still wins over age", () => {
    // Two tests deliberately place a bird relative to the live clock; the
    // factory must not quietly override them.
    const w = world();
    expect(makeBird(w.db, { age: 4, birthWeek: 0, birthDay: 0 }).birthWeek).toBe(0);
  });

  test("a retired bird gets a retiredWeek, or it would keep ageing", () => {
    const w = world();
    const r = makeBird(w.db, { status: "retired", age: 6 });
    expect(r.retiredWeek).not.toBeNull();
    expect(r.retiredBy).toBe("manual");
  });

  test("makeBirds indexes its overrides", () => {
    const w = world();
    const made = makeBirds(w.db, 5, (i) => ({ id: `dummy-${i}`, name: `Dummy ${i}` }));
    expect(made.length).toBe(5);
    expect(made.map((b) => b.id)).toEqual(["dummy-0", "dummy-1", "dummy-2", "dummy-3", "dummy-4"]);
  });
});

describe("expectConserved()", () => {
  test("holds across real play", () => {
    const w = world();
    for (let i = 0; i < 3; i++) w.game.tickDay();
    expectConserved(w.db);
  });

  test("and it actually FAILS on a burn — absolute, not a delta", () => {
    const w = world();
    const victim = w.db.select().from(farms).all()[0];
    w.db.update(farms).set({ gp: victim.gp - 1 }).where(eq(farms.id, victim.id)).run();
    // The bug the four old helpers could miss: a before/after comparison
    // passes when both sides fall together.
    expect(() => expectConserved(w.db)).toThrow();
  });

  test("walletCents reads to the cent", () => {
    const w = world();
    w.db.update(farms).set({ gpCents: 42 }).where(eq(farms.id, w.devId)).run();
    expect(walletCents(w.db, w.devId) % 100).toBe(42);
  });
});
