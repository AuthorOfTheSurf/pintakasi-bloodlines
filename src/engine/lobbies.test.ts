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

// Rival birds by canonical STARTER slot — names are world-unique now (each
// farm draws its own from the pool), but the seed ids stay deterministic.
const RIVAL_SLOT: Record<string, number> = {
  "Tandang Pula": 1, Dalisay: 2, Bagwis: 3, Perlas: 4,
  Kidlat: 5, Alab: 6, Sinag: 7, "Batong Buhay": 8,
};
const rivalId = (name: string) => `rival-${RIVAL_SLOT[name]}`;

/** Both farms card the same starter slot; the lobby seed decides the night. */
function duel(w: ReturnType<typeof world>, name: string, spec: LobbySpec, seed: number) {
  w.dev.enter(byName(w.devFlock, name).id, spec, seed);
  w.rival.enter(rivalId(name), spec);
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

  test("the FARM's record moves at fight time — practice never touches it", () => {
    const w = world();
    duel(w, "Alab", REAL, 7001);
    const dev = w.db.select().from(farms).where(eq(farms.id, w.devId)).get()!;
    const rival = w.db.select().from(farms).where(eq(farms.id, w.rivalId)).get()!;
    // Stamped on both farms at fight time — one won, one lost.
    expect([dev.wins + dev.losses, rival.wins + rival.losses]).toEqual([1, 1]);
    expect([dev.wins + rival.wins, dev.losses + rival.losses]).toEqual([1, 1]);
    duel(w, "Kidlat", { mode: "practice", classType: "open", format: "shortKnife" }, 31);
    const after = w.db.select().from(farms).where(eq(farms.id, w.devId)).get()!;
    expect(after.wins + after.losses).toBe(1); // the amateur card left it alone
  });

  test("an odd lobby strands one bird: fee back, no land, no fight", () => {
    const w = world();
    const before = totalGp(w.db);
    w.dev.enter(byName(w.devFlock, "Alab").id, REAL, 555);
    w.rival.enter(rivalId("Alab"), REAL);
    w.rival.enter(rivalId("Sinag"), REAL);
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
    const rivalSinag = w.rivalFlock.byId(rivalId("Sinag"));
    const loser = fight.winnerFarm === "Bukidnon Farms" ? rivalSinag : devSinag;
    const winner = fight.winnerFarm === "Bukidnon Farms" ? devSinag : rivalSinag;
    expect(loser.status).toBe("retired");
    expect(loser.retiredBy).toBe("hardcore"); // the career converts, not evaporates
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

describe("the fog and the matchmaker (ruled 2026-08-03)", () => {
  test("the board hides other barns' birds — fill count public, field fogged", () => {
    const w = world();
    w.dev.enter(byName(w.devFlock, "Alab").id, REAL);
    // The rival sees the lobby and how full it is — never who's inside.
    const theirView = w.rival.board()[0];
    expect(theirView.filled).toBe(1);
    expect(theirView.entries.length).toBe(0);
    // You always see your own entries.
    const myView = w.dev.board()[0];
    expect(myView.entries.length).toBe(1);
    expect(myView.entries[0].mine).toBe(true);
  });

  test("claimer fields are the exception — visible so claims can be placed", () => {
    const w = world();
    w.dev.enter(byName(w.devFlock, "Alab").id, {
      mode: "real",
      classType: "claimer",
      format: "shortKnife",
      price: 100,
    });
    const theirView = w.rival.board()[0];
    expect(theirView.entries.length).toBe(1);
    expect(theirView.entries[0].bird.name).toBe("Alab");
    expect(theirView.entries[0].mine).toBe(false);
  });

  test("matchmaking never pairs barn-mates — the excess goes home refunded", () => {
    const w = world();
    const before = totalGp(w.db);
    // Three dev birds against one rival bird: only ONE cross-barn fight is
    // possible; the two leftover dev birds must not meet each other.
    for (const name of ["Alab", "Sinag", "Batong Buhay"]) {
      w.dev.enter(byName(w.devFlock, name).id, REAL, 808);
    }
    w.rival.enter(rivalId("Alab"), REAL);
    const lobby = w.game.tickDay().card[0];
    expect(lobby.fights.length).toBe(1);
    expect(lobby.fights[0].farms.sort()).toEqual(["Bukidnon Farms", "Rival Gamefarm"]);
    expect(lobby.unmatched.length).toBe(2);
    expect(lobby.unmatched.every((u) => u.farm === "Bukidnon Farms")).toBe(true);
    expect(totalGp(w.db)).toBe(before); // both refunds conserve GP exactly
  });

  test("two birds apiece, many seeds — every draw is cross-barn", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const w = world();
      w.dev.enter(byName(w.devFlock, "Alab").id, REAL, seed);
      w.dev.enter(byName(w.devFlock, "Sinag").id, REAL);
      w.rival.enter(rivalId("Alab"), REAL);
      w.rival.enter(rivalId("Sinag"), REAL);
      const lobby = w.game.tickDay().card[0];
      expect(lobby.fights.length).toBe(2);
      for (const f of lobby.fights) {
        expect(f.farms[0]).not.toBe(f.farms[1]);
      }
    }
  });
});

describe("the card's three states (OPEN → CLOSED → COMPLETED)", () => {
  test("close locks entries, draws the matchups, and lifts the fog", () => {
    const w = world();
    w.dev.enter(byName(w.devFlock, "Alab").id, REAL, 909);
    w.rival.enter(rivalId("Alab"), REAL);
    Lobbies.close(w.db, "all");

    // The reveal: the rival now sees the full field and the draw.
    const view = w.rival.board()[0];
    expect(view.status).toBe("closed");
    expect(view.entries.length).toBe(2);
    const mine = view.entries.find((e) => e.mine)!;
    expect(mine.drew).toEqual({ bird: "Alab", farm: "Bukidnon Farms" });

    // Entries are locked — a latecomer opens a FRESH lobby, not this one.
    const late = w.rival.enter(rivalId("Sinag"), REAL);
    expect(late.lobby.lobbyId).not.toBe(view.lobbyId);
    expect(late.lobby.status).toBe("open");
  });

  test("a drawless bird is revealed at close but refunds only at post", () => {
    const w = world();
    w.dev.enter(byName(w.devFlock, "Alab").id, REAL, 313);
    Lobbies.close(w.db, "all");
    expect(w.dev.board()[0].entries[0].drew).toBeNull();
    expect(gp(w.db, w.devId)).toBe(ECONOMY.STARTING_GP - ECONOMY.REAL_ENTRY_FEE); // still escrowed
    Lobbies.complete(w.db);
    expect(gp(w.db, w.devId)).toBe(ECONOMY.STARTING_GP); // fee home at post time
  });

  test("the claiming window: claims land AFTER close, before the fight completes", () => {
    const w = world();
    const spec: LobbySpec = { mode: "real", classType: "claimer", format: "shortKnife", price: 100 };
    const devAlab = byName(w.devFlock, "Alab");
    const { lobby } = w.dev.enter(devAlab.id, spec, 606);
    w.rival.enter(rivalId("Alab"), spec);

    // 6 PM: claimers close early — draw revealed, entries locked, claims OPEN.
    Lobbies.close(w.db, "claimers");
    const closedView = w.rival.board().find((l) => l.classType === "claimer")!;
    expect(closedView.status).toBe("closed");
    expect(closedView.entries.find((e) => !e.mine)!.drew).not.toBeUndefined();
    w.rival.claim(lobby.entries[0].entryId); // an informed, last-hours claim

    // Post time: the fight fires and the claim settles.
    const events = Lobbies.complete(w.db);
    expect(events[0].fights.length).toBe(1);
    expect(events[0].claims.length).toBe(1);
    const owner = w.db.select().from(farms).all().find((f) => f.name === "Rival Gamefarm")!;
    expect(
      w.db.select().from(lobbyEntries).all().find((e) => e.birdId === devAlab.id)!.claimedByFarmId
    ).toBe(owner.id);
  });

  test("a completed card takes no more claims", () => {
    const w = world();
    const spec: LobbySpec = { mode: "real", classType: "claimer", format: "shortKnife", price: 100 };
    const { lobby } = w.dev.enter(byName(w.devFlock, "Alab").id, spec, 77);
    Lobbies.close(w.db, "all");
    Lobbies.complete(w.db);
    expect(() => w.rival.claim(lobby.entries[0].entryId)).toThrow(/No open entry/);
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
