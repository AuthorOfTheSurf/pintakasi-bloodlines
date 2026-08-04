import { expect } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/db/client";
import { birds, farms, gameState, type NewBird } from "@/db/schema";
import { DEV_FARM_ID, seedGame, seedStarterFlock } from "@/db/seed-data";
import { Breeding } from "./breeding";
import { CALENDAR, PINTAKASI, type FarmColor } from "./config";
import { Farms } from "./farms";
import { Flock, type BirdView } from "./flock";
import { Game } from "./game";
import { GameClock } from "./game-clock";
import { Lobbies } from "./lobbies";
import { gpFromFaucetsCents, gpInWorldCents } from "./snapshots";
import { Tournaments } from "./tournaments";

/**
 * THE TESTKIT (round 24) — one fixture, one bird factory, one conservation
 * proof.
 *
 * Six test files had grown byte-identical copies of the same two-farm world,
 * nine sites hand-wrote a full `birds` row (so a new column meant nine edits,
 * and a column added in round 23 got missed in two of them), and FOUR
 * different "is GP conserved" helpers had drifted apart — the one in
 * bots.test.ts checked wallets only, in whole GP, as an inequality, which is
 * blind to precisely the two burns this game has actually shipped.
 *
 * Nothing here changes what any test proves. It changes how much has to be
 * rewritten when a rule moves.
 */

// ── the world ───────────────────────────────────────────────────────────────

export interface WorldOptions {
  /**
   * Give the rival barn its own legacy flock. Only the staking fixture opened
   * without one; it never touches rival birds, so this defaults on.
   */
  rivalFlock?: boolean;
  rivalFlockSeed?: number;
  /**
   * Stamp every bird already in the world with enough qualification points to
   * stand in a championship.
   *
   * ⚠ OPT-IN, and it must stay that way. Tests that assert a fresh win banks
   * exactly POINTS_FOR.real would still PASS with pre-stamped birds while
   * testing nothing at all. It also deliberately does NOT reach birds a test
   * inserts afterwards — the Selection Committee's bump test depends on that
   * asymmetry to build a field weaker than its newcomer.
   */
  qualified?: boolean;
  /** Extra registered barns, in order. */
  extra?: {
    name: string;
    primaryColor: FarmColor;
    secondaryColor: FarmColor;
    flock?: boolean;
    flockSeed?: number;
    idPrefix?: string;
  }[];
}

/** One barn's full set of APIs — all thin (db, farmId) wrappers, so free. */
export interface Barn {
  id: string;
  lobbies: Lobbies;
  flock: Flock;
  tournaments: Tournaments;
  breeding: Breeding;
}

export interface World {
  db: DB;
  game: Game; // scoped to the dev farm
  farms: Farms;
  devId: string;
  rivalId: string;
  dev: Barn;
  rival: Barn;
  /** A dev-barn bird by starter name — names are world-unique. */
  bird(name: string): BirdView;
  /** The rival's copy of a canonical starter slot: rivalSlot("Alab") → "rival-6". */
  rivalSlot(name: string): string;
  /** An extra barn, by the name it registered under. */
  barn(name: string): Barn;
}

/**
 * Rival birds by canonical STARTER slot. Names are world-unique (each farm
 * draws its own from the pool) but the seeded ids stay deterministic, so this
 * map is how a test says "the rival's Alab".
 */
export const RIVAL_SLOT: Record<string, number> = {
  "Tandang Pula": 1,
  Dalisay: 2,
  Bagwis: 3,
  Perlas: 4,
  Kidlat: 5,
  Alab: 6,
  Sinag: 7,
  "Batong Buhay": 8,
};

export function world(opts: WorldOptions = {}): World {
  const db = createDb(":memory:");
  const dev = seedGame(db, { flock: "legacy" }); // "Bukidnon Farms"
  const game = new Game(db, dev.farmId);

  const barnOf = (id: string): Barn => ({
    id,
    lobbies: new Lobbies(db, id),
    flock: new Flock(db, id),
    tournaments: new Tournaments(db, id),
    breeding: new Breeding(db, id),
  });

  const { farm: rivalFarm } = game.farms.register({
    name: "Rival Gamefarm",
    primaryColor: "black",
    secondaryColor: "red",
  });
  if (opts.rivalFlock !== false)
    seedStarterFlock(db, rivalFarm.id, {
      seed: opts.rivalFlockSeed ?? 42,
      idPrefix: "rival",
      shape: "legacy",
    });

  const extras = new Map<string, Barn>();
  for (const spec of opts.extra ?? []) {
    const { farm } = game.farms.register({
      name: spec.name,
      primaryColor: spec.primaryColor,
      secondaryColor: spec.secondaryColor,
    });
    if (spec.flock)
      seedStarterFlock(db, farm.id, {
        seed: spec.flockSeed ?? 99,
        idPrefix: spec.idPrefix ?? farm.id,
        shape: "legacy",
      });
    extras.set(spec.name, barnOf(farm.id));
  }

  // After every flock is seeded, before anything a test inserts — see the
  // warning on the option itself.
  if (opts.qualified)
    db.update(birds).set({ crownPoints: PINTAKASI.QUALIFYING_POINTS }).run();

  const devFlock = new Flock(db, dev.farmId);
  return {
    db,
    game,
    farms: game.farms,
    devId: dev.farmId,
    rivalId: rivalFarm.id,
    dev: { ...barnOf(dev.farmId), lobbies: game.lobbies, flock: game.flock },
    rival: barnOf(rivalFarm.id),
    bird: (name) => devFlock.all().find((b) => b.name === name)!,
    rivalSlot: (name) => `rival-${RIVAL_SLOT[name]}`,
    barn: (name) => {
      const found = extras.get(name);
      if (!found) throw new Error(`no extra barn named "${name}" — register it in world({extra})`);
      return found;
    },
  };
}

// ── birds ───────────────────────────────────────────────────────────────────

/**
 * Deliberately not derived from the starter band's midpoint: six of the nine
 * hand-written fixtures this replaces used 300, and the fight sim is fully
 * deterministic in the stats — moving this re-rolls every fixture fight in
 * the acceptance test. It's pinned, and that's the reason.
 */
const TEST_STAT = 300;

let counter = 0;

/**
 * Insert a bird with every column filled in, and return the row.
 *
 * The defaults are deliberately boring — a named, active, two-year-old
 * 300-across Fire rooster in the dev barn — so a test that cares about a
 * column says so, and every other column stays out of the way. A new NOT NULL
 * column becomes ONE edit here instead of nine across the suite.
 *
 * `age` resolves against the world's CURRENT week, which is the bug it
 * replaces: the nine hand-written sites each paired `birthWeek` and
 * `birthDay` by hand (−3/−21, −5/−35, week−1/(week−1)×7) and nothing ever
 * checked the two agreed. An explicit `birthWeek` still wins, because a
 * couple of tests deliberately place a bird relative to the live clock.
 */
export function makeBird(db: DB, overrides: Partial<NewBird> & { age?: number } = {}) {
  const { age, ...rest } = overrides;
  const today = db.select().from(gameState).where(eq(gameState.id, 1)).get()!.dayIndex;
  const week = GameClock.weekOf(today);
  const born = week - (age ?? 2);
  const n = ++counter;

  const row: NewBird = {
    id: `test-${n}`,
    farmId: DEV_FARM_ID,
    name: `Test Bird ${n}`,
    sex: "male",
    status: "active",
    agility: TEST_STAT,
    sight: TEST_STAT,
    stamina: TEST_STAT,
    gameness: TEST_STAT,
    station: TEST_STAT,
    condition: TEST_STAT,
    element: "Fire",
    halfStars: 2,
    birthWeek: born,
    birthDay: born * CALENDAR.DAYS_PER_WEEK,
    named: 1, // the naming law refuses an unnamed bird at every door
    ...rest,
  };

  // A retired bird with no retiredWeek keeps AGEING — lifecycle only freezes
  // the clock once that's set. Every hand-written retired fixture remembered
  // this; a factory that forgot it would drift silently.
  if (row.status === "retired" && row.retiredWeek === undefined) {
    row.retiredBy = row.retiredBy ?? "manual";
    row.retiredWeek = week - 1;
  }

  db.insert(birds).values(row).run();
  return db.select().from(birds).where(eq(birds.id, row.id)).get()!;
}

/** n birds, with a per-index override — for the 64-dummy and 14-hen loops. */
export function makeBirds(
  db: DB,
  n: number,
  overrides: (i: number) => Partial<NewBird> & { age?: number } = () => ({})
) {
  return Array.from({ length: n }, (_, i) => makeBird(db, overrides(i)));
}

// ── money ───────────────────────────────────────────────────────────────────

/** One farm's wallet to the CENT — fractional flows land here. */
export function walletCents(db: DB, farmId: string): number {
  const f = db.select().from(farms).where(eq(farms.id, farmId)).get()!;
  return f.gp * 100 + f.gpCents;
}

/**
 * The whole conservation proof, in one call — the same two functions the
 * doctor runs against a 35-day sim, so an invariant proved in a unit test and
 * one proved on a simulated world are literally the same code.
 *
 * ABSOLUTE, never a before/after delta. A delta comparison passes when both
 * sides fall together, which is exactly the shape of a burn.
 */
export function expectConserved(db: DB): void {
  const state = db.select().from(gameState).where(eq(gameState.id, 1)).get()!;
  expect(state.stakerPoolCents).toBeGreaterThanOrEqual(0);
  expect(state.juicePoolCents).toBeGreaterThanOrEqual(0);
  expect(gpInWorldCents(db)).toBe(gpFromFaucetsCents(db));
}
