import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/db/client";
import { battleLog, farms, lobbyEntries } from "@/db/schema";
import { seedGame, seedStarterFlock } from "@/db/seed-data";
import { ECONOMY, LOBBY, landForFight } from "./config";
import { Flock } from "./flock";
import { Game } from "./game";
import { Lobbies, type LobbySpec } from "./lobbies";

const REAL: LobbySpec = { mode: "real", classType: "open", format: "shortKnife" };

function world() {
  const db = createDb(":memory:");
  const dev = seedGame(db); // "Bukidnon Farms"
  const game = new Game(db, dev.farmId);
  const { farm: rivalFarm } = game.farms.register({
    name: "Rival Gamefarm",
    primaryColor: "black",
    secondaryColor: "red",
  });
  seedStarterFlock(db, rivalFarm.id, { seed: 42, idPrefix: "rival" });
  return {
    db,
    devId: dev.farmId,
    rivalId: rivalFarm.id,
    game,
    dev: game.lobbies,
    devFlock: game.flock,
    rival: new Lobbies(db, rivalFarm.id),
    rivalFlock: new Flock(db, rivalFarm.id),
  };
}

const gp = (db: DB, id: string) => db.select().from(farms).where(eq(farms.id, id)).get()!.gp;
const land = (db: DB, id: string) =>
  db.select().from(farms).where(eq(farms.id, id)).get()!.landTokens;
const totalGp = (db: DB) =>
  db
    .select()
    .from(farms)
    .all()
    .reduce((s, f) => s + f.gp, 0);
const byName = (flock: Flock, name: string) => flock.all().find((b) => b.name === name)!;

/** Both farms card their same-named starter; the lobby seed decides the night. */
function duel(w: ReturnType<typeof world>, name: string, spec: LobbySpec, seed: number) {
  w.dev.enter(byName(w.devFlock, name).id, spec, seed);
  w.rival.enter(byName(w.rivalFlock, name).id, spec);
  const tick = w.game.tickDay();
  const lobby = tick.card.find((l) => l.fights.length > 0)!;
  return { tick, fight: lobby.fights[0] };
}

describe("entry rules (the door)", () => {
  test("age gates, active-only, and class eligibility hold at entry", () => {
    const w = world();
    const kidlat = byName(w.devFlock, "Kidlat"); // 1 — discovery year
    const alab = byName(w.devFlock, "Alab"); // 2 — 1W-1L
    const sinag = byName(w.devFlock, "Sinag"); // 3 — 4W-1L
    expect(() => w.dev.enter(kidlat.id, REAL)).toThrow(/real stakes open at age 2/);
    expect(() => w.dev.enter(kidlat.id, { ...REAL, mode: "hardcore" })).toThrow(/hardcore opens at age 3/);
    expect(() => w.dev.enter("starter-1", REAL)).toThrow(/not an active fighter/);
    expect(() => w.dev.enter(alab.id, { ...REAL, classType: "maiden" })).toThrow(/never-winners/);
    expect(() => w.dev.enter(sinag.id, { ...REAL, classType: "nw2" })).toThrow(/fewer than 2/);
    expect(() => w.dev.enter(sinag.id, { ...REAL, classType: "nw3" })).toThrow(/fewer than 3/);
    expect(() => w.dev.enter(alab.id, { ...REAL, classType: "nw2" })).not.toThrow(); // 1 win < 2
    expect(() => w.dev.enter(sinag.id, { mode: "hardcore", classType: "maiden", format: "shortKnife" })).toThrow(
      /open only/
    );
    expect(() => w.dev.enter(kidlat.id, { mode: "practice", classType: "nw2", format: "shortKnife" })).toThrow(
      /open or maiden/
    );
    expect(() => w.dev.enter(kidlat.id, { mode: "practice", classType: "open", format: "shortKnife", price: 200 })).toThrow(
      /only means something in a claimer/
    );
  });

  test("the fee escrows at entry; an empty wallet cannot enter", () => {
    const w = world();
    w.dev.enter(byName(w.devFlock, "Alab").id, REAL);
    expect(gp(w.db, w.devId)).toBe(ECONOMY.STARTING_GP - ECONOMY.REAL_ENTRY_FEE);
    w.db.update(farms).set({ gp: 10 }).where(eq(farms.id, w.devId)).run();
    expect(() => w.dev.enter(byName(w.devFlock, "Sinag").id, REAL)).toThrow(/costs/);
  });

  test("entries are binding — the bird's daily fight is spent", () => {
    const w = world();
    const alab = byName(w.devFlock, "Alab");
    w.dev.enter(alab.id, REAL);
    expect(() => w.dev.enter(alab.id, REAL)).toThrow(/already on tonight's card/);
  });
});

describe("the 8-cap (lock the lobby even)", () => {
  test("the 9th entrant opens a fresh lobby with the same key", () => {
    const w = world();
    const { farm: third } = w.game.farms.register({
      name: "Talpakan Kings",
      primaryColor: "blue",
      secondaryColor: "white",
    });
    seedStarterFlock(w.db, third.id, { seed: 9, idPrefix: "third" });
    const thirdLobbies = new Lobbies(w.db, third.id);
    const thirdFlock = new Flock(w.db, third.id);
    const spec: LobbySpec = { mode: "practice", classType: "open", format: "shortKnife" };

    // Every active bird can practice — 4 per farm, 12 total.
    for (const [api, flock] of [
      [w.dev, w.devFlock],
      [w.rival, w.rivalFlock],
      [thirdLobbies, thirdFlock],
    ] as const) {
      for (const bird of flock.all().filter((b) => b.status === "active")) {
        api.enter(bird.id, spec);
      }
    }
    const board = w.dev.board();
    expect(board.length).toBe(2);
    expect(board[0].filled).toBe(LOBBY.CAPACITY); // locked full — everyone guaranteed a fight
    expect(board[1].filled).toBe(4); // the overflow lobby
    expect(board.every((l) => l.capacity === LOBBY.CAPACITY)).toBe(true);
    // The board is fogged: stars public, stats hidden.
    const card = board[0].entries[0];
    expect(card.bird.stars).toContain("★");
    expect("agility" in card.bird).toBe(false);
  });
});

describe("the card goes off (pure PvP)", () => {
  test("pooled settle both ways, mirrored logs, superlinear land, records move", () => {
    const w = world();
    const before = totalGp(w.db);
    const { fight } = duel(w, "Alab", REAL, 7001);

    const fee = ECONOMY.REAL_ENTRY_FEE;
    const winnerId = fight.winnerFarm === "Bukidnon Farms" ? w.devId : w.rivalId;
    const loserId = winnerId === w.devId ? w.rivalId : w.devId;
    expect(gp(w.db, winnerId)).toBe(ECONOMY.STARTING_GP + fee);
    expect(gp(w.db, loserId)).toBe(ECONOMY.STARTING_GP - fee);
    // No GP printed, none burned — the pot just moved.
    expect(totalGp(w.db)).toBe(before);
    // Land pays BOTH fighters, scaled superlinearly to the fee.
    expect(fight.landEach).toBe(landForFight(fee));
    expect(land(w.db, w.devId)).toBe(landForFight(fee));
    expect(land(w.db, w.rivalId)).toBe(landForFight(fee));
    // Two mirrored log rows: same fight, opposite results, cross-referenced.
    const rows = w.db.select().from(battleLog).all();
    expect(rows.length).toBe(2);
    expect(rows[0].seed).toBe(rows[1].seed);
    expect(rows[0].playByPlay).toBe(rows[1].playByPlay);
    expect(rows[0].opponentBirdId).toBe(rows[1].birdId);
    expect([rows[0].result, rows[1].result].sort()).toEqual(["loss", "win"]);
    // Career records moved on both sides (Alab seeds at 1W-1L).
    const devAlab = byName(w.devFlock, "Alab");
    expect(devAlab.wins + devAlab.losses).toBe(3);
    // The lobby cleared the board.
    expect(w.dev.board().length).toBe(0);
  });

  test("an odd lobby strands one bird: fee back, no land, no fight", () => {
    const w = world();
    const before = totalGp(w.db);
    w.dev.enter(byName(w.devFlock, "Alab").id, REAL, 555);
    w.rival.enter(byName(w.rivalFlock, "Alab").id, REAL);
    w.rival.enter(byName(w.rivalFlock, "Sinag").id, REAL);
    const tick = w.game.tickDay();
    const lobby = tick.card[0];
    expect(lobby.fights.length).toBe(1);
    expect(lobby.unmatched.length).toBe(1);
    expect(lobby.unmatched[0].refunded).toBe(ECONOMY.REAL_ENTRY_FEE);
    expect(totalGp(w.db)).toBe(before); // refund + pooled pot conserve GP exactly
    const statuses = w.db.select().from(lobbyEntries).all().map((e) => e.status).sort();
    expect(statuses).toEqual(["fought", "fought", "unmatched"]);
  });

  test("practice cards build the amateur record at amateur stakes", () => {
    const w = world();
    const { fight } = duel(w, "Kidlat", { mode: "practice", classType: "open", format: "shortKnife" }, 31);
    expect(fight.landEach).toBe(landForFight(ECONOMY.PRACTICE_ENTRY_FEE));
    const kidlat = byName(w.devFlock, "Kidlat");
    expect(kidlat.wins + kidlat.losses).toBe(0); // career untouched
    expect(kidlat.practiceWins + kidlat.practiceLosses).toBe(1);
  });

  test("hardcore PvP: the losing side force-retires, the winner fights on", () => {
    const w = world();
    const { fight } = duel(w, "Sinag", { mode: "hardcore", classType: "open", format: "shortKnife" }, 99);
    expect(fight.forcedRetirements.length).toBe(1);
    const devSinag = byName(w.devFlock, "Sinag");
    const rivalSinag = byName(w.rivalFlock, "Sinag");
    const loser = fight.winnerFarm === "Bukidnon Farms" ? rivalSinag : devSinag;
    const winner = fight.winnerFarm === "Bukidnon Farms" ? devSinag : rivalSinag;
    expect(loser.status).toBe("retired");
    expect(loser.retiredBy).toBe("hardcore");
    expect(loser.studValue).not.toBeNull(); // the career converts, not evaporates
    expect(winner.status).toBe("active");
    expect(fight.landEach).toBe(landForFight(ECONOMY.HARDCORE_ENTRY_FEE));
  });

  test("same lobby seed → identical night (replayable)", () => {
    const a = duel(world(), "Alab", REAL, 4242);
    const b = duel(world(), "Alab", REAL, 4242);
    expect(a.fight.playByPlay).toBe(b.fight.playByPlay);
    expect(a.fight.winner).toBe(b.fight.winner);
    expect(a.fight.figures).toEqual(b.fight.figures);
  });

  test("the fight cap resets when the day turns", () => {
    const w = world();
    duel(w, "Alab", REAL, 12);
    expect(() => w.dev.enter(byName(w.devFlock, "Alab").id, REAL)).not.toThrow();
  });
});

describe("the land curve (fight up)", () => {
  test("superlinear in the fee: practice 1 · real 7 · hardcore 23", () => {
    expect(landForFight(ECONOMY.PRACTICE_ENTRY_FEE)).toBe(1);
    expect(landForFight(ECONOMY.REAL_ENTRY_FEE)).toBe(7);
    expect(landForFight(ECONOMY.HARDCORE_ENTRY_FEE)).toBe(23);
    // 3× the fee pays MORE than 3× the land — the "fight up" incentive.
    expect(landForFight(120)).toBeGreaterThan(3 * landForFight(40));
  });
});
