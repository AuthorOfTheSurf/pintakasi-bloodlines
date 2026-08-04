import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/db/client";
import { birds, farms, gameState, tournamentEntries, tournaments } from "@/db/schema";
import { seedGame, seedStarterFlock } from "@/db/seed-data";
import { JUVENILE_MAJOR, PINTAKASI } from "./config";
import { Flock } from "./flock";
import { Game } from "./game";
import { Tournaments, type Division } from "./tournaments";

/**
 * Round 23 shipped the Juvenile Championship with zero test references — this
 * file closes that gap. Two farms, each carrying the legacy 8-bird shape
 * (one age-1 chick — Kidlat — plus the age-3+ veterans the Majors fixtures
 * already use), so a single world can run a juvenile bracket AND a Major
 * bracket side by side for the hardcore contrast that's the whole point of
 * the division.
 */
function world() {
  const db = createDb(":memory:");
  const dev = seedGame(db, { flock: "legacy" });
  const game = new Game(db, dev.farmId);
  const { farm: rivalFarm } = game.farms.register({
    name: "Rival Gamefarm",
    primaryColor: "black",
    secondaryColor: "red",
  });
  seedStarterFlock(db, rivalFarm.id, { seed: 42, idPrefix: "rival", shape: "legacy" });
  // The Majors' gate (fully covered in tournaments.test.ts) is qualification
  // points, not age — stamp the veterans qualified so the contrast test
  // below doesn't have to campaign its way in too.
  db.update(birds).set({ crownPoints: PINTAKASI.QUALIFYING_POINTS }).run();
  return {
    db,
    devId: dev.farmId,
    rivalId: rivalFarm.id,
    game,
    dev: game.tournaments,
    rival: new Tournaments(db, rivalFarm.id),
    devFlock: game.flock,
  };
}

const byName = (flock: Flock, name: string) => flock.all().find((b) => b.name === name)!;

/** Bump a bird onto (or past) the juvenile qualifying-wins ladder. */
function qualifyJuvenile(db: DB, birdId: string, wins: number = JUVENILE_MAJOR.QUALIFYING_WINS) {
  db.update(birds).set({ wins }).where(eq(birds.id, birdId)).run();
}

/** Which division a resolution's tournament row belongs to — resolutions
 *  themselves don't carry the division, so look it up. */
const divisionOf = (db: DB, tournamentId: number): Division =>
  (db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).get()!.division as Division) ??
  "major";

const totalCents = (db: DB) => {
  const state = db.select().from(gameState).where(eq(gameState.id, 1)).get()!;
  return (
    db
      .select()
      .from(farms)
      .all()
      .reduce((s, f) => s + f.gp * 100 + f.gpCents, 0) +
    state.stakerPoolCents +
    state.juicePoolCents +
    db
      .select()
      .from(tournamentEntries)
      .all()
      .filter((e) => e.status === "pending")
      .reduce((s, e) => s + e.fee * 100, 0)
  );
};

/**
 * Tick from Friday day 0 through the Majors' crown day — Thursday, day 6 —
 * crossing the Juvenile Championship's Wednesday along the way. Unlike
 * tournaments.test.ts's Major-only version, this can't just return the LAST
 * tick: the juvenile crown resolves on the day-4→day-5 transition (the 6th
 * `tickDay()` call), the Majors on day-5→day-6 (the 7th) — two different
 * ticks — so every tick's `pintakasi` entries are pooled together.
 */
function tickThroughCrownDay(game: Game) {
  const pintakasi: ReturnType<Game["tickDay"]>["pintakasi"] = [];
  let last;
  for (let i = 0; i < 7; i++) {
    last = game.tickDay();
    pintakasi.push(...last.pintakasi);
  }
  return { ...last!, pintakasi };
}

describe("the discovery-year calendar & blade rotation", () => {
  test("one knife and one gaff, lengths alternating by week", () => {
    expect(Tournaments.juvenileBladesOfWeek(0)).toEqual(["longKnife", "longGaff"]);
    expect(Tournaments.juvenileBladesOfWeek(1)).toEqual(["shortKnife", "shortGaff"]);
    expect(Tournaments.juvenileBladesOfWeek(2)).toEqual(["longKnife", "longGaff"]); // back to long
  });

  test("the Juvenile Championship falls the day before the Majors", () => {
    expect(JUVENILE_MAJOR.DAY_OF_WEEK as number).toBe(PINTAKASI.DAY_OF_WEEK - 1);
    expect(Tournaments.isJuvenileCrownDay(5)).toBe(true); // Wednesday
    expect(Tournaments.isJuvenileCrownDay(6)).toBe(false); // Thursday is the Majors'
    expect(Tournaments.isCrownDay(6)).toBe(true);
    expect(Tournaments.isJuvenileCrownDay(12)).toBe(true); // next week's Wednesday
  });
});

describe("registration gates", () => {
  test("the age gate: only the discovery year (age 1) may stand", () => {
    const w = world();
    const alab = byName(w.devFlock, "Alab"); // age 2 — real stakes, not the discovery year
    expect(() => w.dev.enter(alab.id, "longKnife", "juvenile")).toThrow(/age 1/);
    const kidlat = byName(w.devFlock, "Kidlat"); // age 1
    qualifyJuvenile(w.db, kidlat.id);
    expect(() => w.dev.enter(kidlat.id, "longKnife", "juvenile")).not.toThrow();
  });

  test("the qualification ladder: under QUALIFYING_WINS refused, at threshold accepted — and free", () => {
    const w = world();
    const kidlat = byName(w.devFlock, "Kidlat");
    expect(kidlat.wins).toBe(0); // a fresh legacy chick has no discovery-year record yet
    expect(() => w.dev.enter(kidlat.id, "longKnife", "juvenile")).toThrow(/discovery ladder/);
    // One win short still isn't enough…
    qualifyJuvenile(w.db, kidlat.id, JUVENILE_MAJOR.QUALIFYING_WINS - 1);
    expect(() => w.dev.enter(kidlat.id, "longKnife", "juvenile")).toThrow(/discovery ladder/);
    // …and the wallet is untouched either way, because the crown is free.
    const before = w.db.select().from(farms).where(eq(farms.id, w.devId)).get()!.gp;
    qualifyJuvenile(w.db, kidlat.id); // exactly at the threshold
    w.dev.enter(kidlat.id, "longKnife", "juvenile");
    expect(w.db.select().from(farms).where(eq(farms.id, w.devId)).get()!.gp).toBe(before);
  });
});

describe("purse & record accounting", () => {
  test("the purse takes only JUICE_SHARE of the pool, banking the rest for the Majors", () => {
    const w = world();
    w.db.update(gameState).set({ juicePoolCents: 100_000 }).where(eq(gameState.id, 1)).run();
    const kidlat = byName(w.devFlock, "Kidlat");
    qualifyJuvenile(w.db, kidlat.id);
    qualifyJuvenile(w.db, "rival-5"); // the rival's own Kidlat-slot chick
    w.dev.enter(kidlat.id, "longKnife", "juvenile");
    w.rival.enter("rival-5", "longKnife", "juvenile");
    // No qualified Major entrants this week, so the Majors' own crowns
    // cancel for want of a field — the juvenile slice is the only spend.
    const tick = tickThroughCrownDay(w.game);
    const juv = tick.pintakasi.find((r) => divisionOf(w.db, r.tournamentId) === "juvenile")!;
    expect(juv.cancelled).toBe(false);
    const expectedPurse = Math.floor(100_000 * JUVENILE_MAJOR.JUICE_SHARE);
    expect(juv.purseCents).toBe(expectedPurse);
    const state = w.db.select().from(gameState).where(eq(gameState.id, 1)).get()!;
    expect(state.juicePoolCents).toBe(100_000 - expectedPurse); // the 80% left for Thursday
  });

  test("a juvenile crown does not bank STAKES wins — the discovery year never graduates a maiden", () => {
    const w = world();
    const kidlat = byName(w.devFlock, "Kidlat");
    qualifyJuvenile(w.db, kidlat.id);
    qualifyJuvenile(w.db, "rival-5");
    expect(w.db.select().from(birds).where(eq(birds.id, kidlat.id)).get()!.stakesWins).toBe(0);
    w.dev.enter(kidlat.id, "longKnife", "juvenile");
    w.rival.enter("rival-5", "longKnife", "juvenile");
    tickThroughCrownDay(w.game);
    // Whether Kidlat won or lost the single fight, its stakesWins column
    // must not have moved — only a hardcore (real/Major) win banks one.
    const after = w.db.select().from(birds).where(eq(birds.id, kidlat.id)).get()!;
    expect(after.stakesWins).toBe(0);
    expect(after.wins + after.losses).toBe(JUVENILE_MAJOR.QUALIFYING_WINS + 1); // the qualifying wins + this fight
  });

  test("GP conserves across a juvenile resolution", () => {
    const w = world();
    const kidlat = byName(w.devFlock, "Kidlat");
    qualifyJuvenile(w.db, kidlat.id);
    qualifyJuvenile(w.db, "rival-5");
    w.dev.enter(kidlat.id, "longKnife", "juvenile");
    w.rival.enter("rival-5", "longKnife", "juvenile");
    const before = totalCents(w.db);
    tickThroughCrownDay(w.game);
    expect(totalCents(w.db)).toBe(before); // redistribution, never printing
  });
});

describe("it is NOT hardcore — the discovery-year contrast with the Majors", () => {
  test("every juvenile loser stays active; a Major loser force-retires, same tick", () => {
    const w = world();
    // The juvenile bracket: one qualified chick per farm.
    const kidlat = byName(w.devFlock, "Kidlat");
    qualifyJuvenile(w.db, kidlat.id);
    qualifyJuvenile(w.db, "rival-5");
    w.dev.enter(kidlat.id, "longKnife", "juvenile");
    w.rival.enter("rival-5", "longKnife", "juvenile");
    // The Major bracket: one qualified veteran per farm (already stamped
    // crownPoints in world()).
    const sinag = byName(w.devFlock, "Sinag");
    w.dev.enter(sinag.id, "longKnife");
    w.rival.enter("rival-8", "longKnife");

    const tick = tickThroughCrownDay(w.game);
    expect(tick.pintakasi.length).toBe(2); // one juvenile crown, one Major crown
    const juv = tick.pintakasi.find((r) => divisionOf(w.db, r.tournamentId) === "juvenile")!;
    const maj = tick.pintakasi.find((r) => divisionOf(w.db, r.tournamentId) === "major")!;
    expect(juv.champion).not.toBeNull();
    expect(maj.champion).not.toBeNull();

    // The discovery year: BOTH bodies are still standing, win or lose.
    const juvenileFighters = w.db
      .select()
      .from(birds)
      .all()
      .filter((b) => b.id === kidlat.id || b.id === "rival-5");
    expect(juvenileFighters.length).toBe(2);
    expect(juvenileFighters.every((b) => b.status === "active")).toBe(true);
    expect(juvenileFighters.every((b) => b.retiredBy === null)).toBe(true);

    // The Majors: hardcore throughout — exactly one of the two force-retires.
    const majorFighters = w.db
      .select()
      .from(birds)
      .all()
      .filter((b) => b.id === sinag.id || b.id === "rival-8");
    expect(majorFighters.length).toBe(2);
    expect(majorFighters.filter((b) => b.status === "retired" && b.retiredBy === "hardcore").length).toBe(
      1
    );
    expect(majorFighters.filter((b) => b.status === "active").length).toBe(1); // the champion fights on
  });
});
