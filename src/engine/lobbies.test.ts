import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/db/client";
import { battleLog, birds, farms, gameState, lobbyEntries } from "@/db/schema";
import { seedGame, seedStarterFlock } from "@/db/seed-data";
import { ECONOMY, FORMAT_NAMES, PINTAKASI, SCOUT, STAKER_FLOWS, landForFight, landForTournamentFight } from "./config";
import { Flock } from "./flock";
import { Game } from "./game";
import { Lobbies, type LobbySpec } from "./lobbies";
import { onCard } from "./testkit";

/**
 * Tonight's adult open key. The blade is no longer the test's to choose — the
 * daily card posts it (round 31), and these tests care about the door, the
 * settle and the fog, never about which blade is running.
 */
const REAL = (db: DB): LobbySpec => onCard(db, { mode: "real", classType: "open" });

function world() {
  const db = createDb(":memory:");
  const dev = seedGame(db, { flock: "legacy" }); // "Bukidnon Farms"
  const game = new Game(db, dev.farmId);
  const { farm: rivalFarm } = game.farms.register({
    name: "Rival Gamefarm",
    primaryColor: "black",
    secondaryColor: "red",
  });
  seedStarterFlock(db, rivalFarm.id, { seed: 42, idPrefix: "rival", shape: "legacy" });
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
/** A farm's wallet to the CENT — the fight rake (round 22) lands fractionally. */
const gpCents = (db: DB, id: string) => {
  const f = db.select().from(farms).where(eq(farms.id, id)).get()!;
  return f.gp * 100 + f.gpCents;
};
const land = (db: DB, id: string) =>
  db.select().from(farms).where(eq(farms.id, id)).get()!.landTokens;
/**
 * Every GP in the world, in cents: wallets PLUS both pools. Since round 22 a
 * fight rakes 2% of the pot to the stakers, so summing wallets alone would
 * read like GP had gone missing — it moved, which is exactly what these
 * conservation assertions exist to prove.
 */
const totalGp = (db: DB) => {
  const state = db.select().from(gameState).where(eq(gameState.id, 1)).get()!;
  return (
    db
      .select()
      .from(farms)
      .all()
      .reduce((s, f) => s + f.gp * 100 + f.gpCents, 0) +
    state.stakerPoolCents +
    state.juicePoolCents
  );
};
const byName = (flock: Flock, name: string) => flock.all().find((b) => b.name === name)!;
/**
 * The lobbies that actually EXIST. Since round 31 `board()` also returns
 * phantoms — posted keys nobody has entered yet, carrying `lobbyId: null` — so
 * a test reading `board()[0]` would be reading the schedule, not a room.
 */
const live = (l: Lobbies) => l.board().filter((v) => v.lobbyId !== null);

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
    expect(() => w.dev.enter(kidlat.id, REAL(w.db))).toThrow(/real stakes open at age 2/);
    expect(() => w.dev.enter("starter-1", REAL(w.db))).toThrow(/not an active fighter/);
    expect(() => w.dev.enter(alab.id, onCard(w.db, { mode: "real", classType: "maiden" }))).toThrow(/never-winners/);
    expect(() => w.dev.enter(sinag.id, onCard(w.db, { mode: "real", classType: "nw3" }))).toThrow(/fewer than 3/);
    expect(() => w.dev.enter(alab.id, onCard(w.db, { mode: "real", classType: "nw3" }))).not.toThrow(); // 1 win < 3
    // The discovery year runs maidens, stakes and claimers (round 23) — but
    // NOT the conditions classes: a one-year-old has no record to sort by.
    expect(() => w.dev.enter(kidlat.id, { mode: "juvenile", classType: "nw3", format: "b2" })).toThrow(
      /open, maiden or claimer/
    );
    expect(() => w.dev.enter(kidlat.id, { mode: "juvenile", classType: "open", format: "b2", price: 200 })).toThrow(
      /only means something in a claimer/
    );
  });

  test("the fee escrows at entry; an empty wallet cannot enter", () => {
    const w = world();
    w.dev.enter(byName(w.devFlock, "Alab").id, REAL(w.db));
    expect(gp(w.db, w.devId)).toBe(ECONOMY.STARTING_GP - ECONOMY.REAL_ENTRY_FEE);
    w.db.update(farms).set({ gp: 10 }).where(eq(farms.id, w.devId)).run();
    expect(() => w.dev.enter(byName(w.devFlock, "Sinag").id, REAL(w.db))).toThrow(/costs/);
  });

  test("entries are binding — the bird's daily fight is spent", () => {
    const w = world();
    const alab = byName(w.devFlock, "Alab");
    w.dev.enter(alab.id, REAL(w.db));
    expect(() => w.dev.enter(alab.id, REAL(w.db))).toThrow(/already on tonight's card/);
  });

  // Round 19: the ladder reads the STAKES record, not the lifetime line.
  // Counting the discovery year made every two-year-old an ex-winner, and
  // the maiden class sat unused for whole sim runs.
  test("a juvenile win does not graduate a maiden — the ladder reads stakes wins", () => {
    const w = world();
    const kidlat = byName(w.devFlock, "Kidlat"); // age 1 — the discovery year
    // Stamp the practice win rather than fighting for one: the old loop ran
    // up to eight days hoping for a victory, which meant the bird could age
    // out of the discovery year before the test got what it came for.
    w.db.update(birds).set({ wins: 1 }).where(eq(birds.id, kidlat.id)).run();
    const afterPractice = byName(w.devFlock, "Kidlat");
    expect(afterPractice.wins).toBeGreaterThan(0); // the lifetime line moved…
    expect(afterPractice.stakesWins).toBe(0); //     …the ladder's line did not
    // …so the bird stays a maiden for GROWN purposes. Inside the discovery
    // year it has graduated its own maiden class, though (round 23): the
    // juvenile ladder reads juvenile wins, since there is no stakes record
    // to read at age one.
    expect(() =>
      w.dev.enter(kidlat.id, { mode: "juvenile", classType: "maiden", format: "b2" })
    ).toThrow(/already won in the discovery year/);
    expect(() =>
      w.dev.enter(kidlat.id, onCard(w.db, { mode: "juvenile", classType: "open" }))
    ).not.toThrow();

    // A seeded stakes record DOES graduate a bird: Sinag (age 3, 4W) is past
    // the maiden class entirely.
    const sinag = byName(w.devFlock, "Sinag");
    expect(sinag.stakesWins).toBe(4);
    expect(() => w.dev.enter(sinag.id, onCard(w.db, { mode: "real", classType: "maiden" }))).toThrow(/won at stakes/);
  });
});

describe("unbounded lobbies (round 31 — one room per posted key, no ceiling)", () => {
  test("the 9th entrant opens a fresh lobby with the same key", () => {
    const w = world();
    const { farm: third } = w.game.farms.register({
      name: "Talpakan Kings",
      primaryColor: "blue",
      secondaryColor: "white",
    });
    seedStarterFlock(w.db, third.id, { seed: 9, idPrefix: "third", shape: "legacy" });
    const thirdLobbies = new Lobbies(w.db, third.id);
    const thirdFlock = new Flock(w.db, third.id);
    const spec = REAL(w.db);

    // Round 20: the juvenile division is age 1 only, so the pile-up test
    // runs at real stakes — 3 age-2+ birds per farm, 9 total.
    for (const [api, flock] of [
      [w.dev, w.devFlock],
      [w.rival, w.rivalFlock],
      [thirdLobbies, thirdFlock],
    ] as const) {
      for (const bird of flock.all().filter((b) => b.status === "active" && b.age >= 2)) {
        api.enter(bird.id, spec);
      }
    }
    // ⚠ REWRITTEN IN ROUND 31, and the contract inverted.
    //
    // This used to assert the OPPOSITE: that the 9th entrant was pushed into a
    // second lobby because the first had filled to LOBBY.CAPACITY, and that no
    // farm could hold more than half a room. Both rules are gone. Lobbies are
    // unbounded and there is exactly ONE per posted key per day, because the
    // daily card exists to make entries collide and capacity-8 duplication was
    // splitting a hot key straight back into two half-empty rooms.
    //
    // What must hold now is simpler and stronger: ENTRY NEVER BLOCKS. Nine
    // birds from three barns all land in the same room, and a tenth would too.
    // That is also what removes any reason to camp — you can never arrive to
    // find the door shut, so the fill count you see only ever grows.
    const real = w.dev.board().filter((l) => l.lobbyId !== null);
    expect(real.length).toBe(1);
    expect(real[0].filled).toBe(9);
    // The rest of the board is the CARD: keys posted today that nobody has
    // entered yet, carrying no lobby id and an empty field.
    const phantoms = w.dev.board().filter((l) => l.lobbyId === null);
    expect(phantoms.length).toBeGreaterThan(0);
    expect(phantoms.every((l) => l.filled === 0 && l.entries.length === 0)).toBe(true);
    expect(phantoms.every((l) => l.offered === true)).toBe(true);
    // The board is fogged: stars public, stats hidden.
    const card = real[0].entries[0];
    expect(card.bird.stars).toContain("★");
    expect("agility" in card.bird).toBe(false);
  });

  test("a lobby keeps growing — there is no ceiling to arrive after", () => {
    const w = world();
    // Three more waves into the same key. Under the old capacity this would
    // have opened four separate lobbies of eight; the point of the card is
    // that it does not.
    seedStarterFlock(w.db, w.devId, { seed: 77, idPrefix: "dev2", shape: "legacy" });
    seedStarterFlock(w.db, w.rivalId, { seed: 78, idPrefix: "rival2", shape: "legacy" });
    const spec = REAL(w.db);
    const stakesBirds = (flock: Flock) =>
      flock.all().filter((b) => b.status === "active" && b.age >= 2);
    for (const bird of stakesBirds(w.devFlock)) w.dev.enter(bird.id, spec);
    for (const bird of stakesBirds(w.rivalFlock)) w.rival.enter(bird.id, spec);
    const real = w.dev.board().filter((l) => l.lobbyId !== null);
    expect(real.length).toBe(1); // ONE room, however many turn up
    expect(real[0].filled).toBeGreaterThan(8); // past the old cap, and still open
    // And it pairs: an even, well-mixed room sends everybody out to fight.
    const resolved = w.game.tickDay().card;
    expect(resolved.reduce((s, l) => s + l.unmatched.length, 0)).toBe(0);
  });
});

describe("the card goes off (pure PvP)", () => {
  test("pooled settle both ways, mirrored logs, superlinear land, records move", () => {
    const w = world();
    const before = totalGp(w.db);
    const { fight } = duel(w, "Alab", REAL(w.db), 7001);

    const fee = ECONOMY.REAL_ENTRY_FEE;
    const winnerId = fight.winnerFarm === "Bukidnon Farms" ? w.devId : w.rivalId;
    const loserId = winnerId === w.devId ? w.rivalId : w.devId;
    // Win +entry, lose −entry — the pot is pooled and pure again (round 23).
    const rakeCents = Math.round(fee * 200 * STAKER_FLOWS.FIGHT_RAKE);
    expect(gpCents(w.db, winnerId)).toBe(ECONOMY.STARTING_GP * 100 + fee * 100 - rakeCents);
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
    // The lobby cleared the board — what's left is tomorrow's card as
    // phantoms (posted keys nobody has entered), never a live lobby.
    expect(w.dev.board().filter((l) => l.lobbyId !== null).length).toBe(0);
  });

  test("the FARM's record moves at fight time — juvenile counts too (one record)", () => {
    const w = world();
    duel(w, "Alab", REAL(w.db), 7001);
    const dev = w.db.select().from(farms).where(eq(farms.id, w.devId)).get()!;
    const rival = w.db.select().from(farms).where(eq(farms.id, w.rivalId)).get()!;
    // Stamped on both farms at fight time — one won, one lost.
    expect([dev.wins + dev.losses, rival.wins + rival.losses]).toEqual([1, 1]);
    expect([dev.wins + rival.wins, dev.losses + rival.losses]).toEqual([1, 1]);
    duel(w, "Kidlat", onCard(w.db, { mode: "juvenile", classType: "open" }), 31);
    const after = w.db.select().from(farms).where(eq(farms.id, w.devId)).get()!;
    expect(after.wins + after.losses).toBe(2); // juvenile counts — ONE record (round 15)
  });

  // ── Round 23: the pot is PURE again — the round-22 rake went back to 0 ──
  test("no rake: the winner takes the whole pot, and the staker pool is untouched", () => {
    const w = world();
    const before = totalGp(w.db);
    const poolBefore = w.db.select().from(gameState).where(eq(gameState.id, 1)).get()!.stakerPoolCents;
    duel(w, "Alab", REAL(w.db), 7001);
    // Zane pulled the fight rake after round 22 proved the LT yield was
    // already strong enough. The daily card is a pooled pot and nothing else.
    expect(STAKER_FLOWS.FIGHT_RAKE).toBe(0);
    const state = w.db.select().from(gameState).where(eq(gameState.id, 1)).get()!;
    expect(state.stakerPoolCents).toBe(poolBefore);
    expect(totalGp(w.db)).toBe(before); // still conserved, to the cent
  });

  test("a win banks QUALIFICATION POINTS toward a crown — but not in the discovery year", () => {
    const w = world();
    const { fight } = duel(w, "Alab", REAL(w.db), 7001);
    const winner = w.db
      .select()
      .from(battleLog)
      .all()
      .find((r) => r.result === "win")!;
    expect(w.db.select().from(birds).where(eq(birds.id, winner.birdId)).get()!.crownPoints).toBe(
      PINTAKASI.POINTS_FOR.real
    );
    expect(fight.farms.length).toBe(2);
    // The loser banks nothing — points are won, never granted for showing up.
    const loser = w.db
      .select()
      .from(battleLog)
      .all()
      .find((r) => r.result === "loss")!;
    expect(w.db.select().from(birds).where(eq(birds.id, loser.birdId)).get()!.crownPoints).toBe(0);
  });

  test("an odd lobby strands one bird: fee back, no land, no fight", () => {
    const w = world();
    const before = totalGp(w.db);
    w.dev.enter(byName(w.devFlock, "Alab").id, REAL(w.db), 555);
    w.rival.enter(rivalId("Alab"), REAL(w.db));
    w.rival.enter(rivalId("Sinag"), REAL(w.db));
    const tick = w.game.tickDay();
    const lobby = tick.card[0];
    expect(lobby.fights.length).toBe(1);
    expect(lobby.unmatched.length).toBe(1);
    expect(lobby.unmatched[0].refunded).toBe(ECONOMY.REAL_ENTRY_FEE);
    expect(totalGp(w.db)).toBe(before); // refund + pooled pot conserve GP exactly
    const statuses = w.db.select().from(lobbyEntries).all().map((e) => e.status).sort();
    expect(statuses).toEqual(["fought", "fought", "unmatched"]);
  });

  test("juvenile cards count toward the ONE lifetime record, at juvenile stakes", () => {
    const w = world();
    const { fight } = duel(w, "Kidlat", onCard(w.db, { mode: "juvenile", classType: "open" }), 31);
    expect(fight.landEach).toBe(landForFight(ECONOMY.JUVENILE_ENTRY_FEE));
    const kidlat = byName(w.devFlock, "Kidlat");
    expect(kidlat.wins + kidlat.losses).toBe(1); // one record, ruled round 15
  });

  test("NO lobby force-retires any more — hardcore left the daily card", () => {
    // ⚠ REPLACES the round-20 "hardcore PvP: the losing side force-retires"
    // test. Round 31 took hardcore off the daily card entirely (Zane: "There
    // should be 0 hardcore fights outside the Finals"), so no lobby fight can
    // end a career. It measured its own case for removal first: 201 entries
    // across a 91-day world producing 55 fights, a 45.3% unmatched rate — the
    // worst of any mode, for under one fight a day.
    //
    // The mechanic is not gone, it MOVED: the Pintakasi Majors are hardcore
    // throughout, and juvenile.test.ts / tournaments.test.ts cover that path.
    const w = world();
    const { fight } = duel(w, "Sinag", REAL(w.db), 99);
    expect(fight.forcedRetirements).toEqual([]);
    const devSinag = byName(w.devFlock, "Sinag");
    const rivalSinag = w.rivalFlock.byId(rivalId("Sinag"));
    expect(devSinag.status).toBe("active");
    expect(rivalSinag.status).toBe("active"); // both walk away, win or lose
    expect(fight.landEach).toBe(landForFight(ECONOMY.REAL_ENTRY_FEE));
  });

  test("same lobby seed → identical night (replayable)", () => {
    const w1 = world();
    const w2 = world();
    const a = duel(w1, "Alab", REAL(w1.db), 4242);
    const b = duel(w2, "Alab", REAL(w2.db), 4242);
    expect(a.fight.playByPlay).toBe(b.fight.playByPlay);
    expect(a.fight.winner).toBe(b.fight.winner);
    expect(a.fight.figures).toEqual(b.fight.figures);
  });

  test("the fight cap resets when the day turns", () => {
    const w = world();
    duel(w, "Alab", REAL(w.db), 12);
    expect(() => w.dev.enter(byName(w.devFlock, "Alab").id, REAL(w.db))).not.toThrow();
  });
});

describe("the fog and the matchmaker (ruled 2026-08-03)", () => {
  test("the board hides other barns' birds — fill count public, field fogged", () => {
    const w = world();
    w.dev.enter(byName(w.devFlock, "Alab").id, REAL(w.db));
    // The rival sees the lobby and how full it is — never who's inside.
    const theirView = live(w.rival)[0];
    expect(theirView.filled).toBe(1);
    expect(theirView.entries.length).toBe(0);
    // You always see your own entries.
    const myView = live(w.dev)[0];
    expect(myView.entries.length).toBe(1);
    expect(myView.entries[0].mine).toBe(true);
  });

  test("claimer fields are the exception — visible so claims can be placed", () => {
    const w = world();
    w.dev.enter(byName(w.devFlock, "Alab").id, onCard(w.db, { mode: "real", classType: "claimer" }));
    const theirView = live(w.rival)[0];
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
      w.dev.enter(byName(w.devFlock, name).id, REAL(w.db), 808);
    }
    w.rival.enter(rivalId("Alab"), REAL(w.db));
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
      w.dev.enter(byName(w.devFlock, "Alab").id, REAL(w.db), seed);
      w.dev.enter(byName(w.devFlock, "Sinag").id, REAL(w.db));
      w.rival.enter(rivalId("Alab"), REAL(w.db));
      w.rival.enter(rivalId("Sinag"), REAL(w.db));
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
    w.dev.enter(byName(w.devFlock, "Alab").id, REAL(w.db), 909);
    w.rival.enter(rivalId("Alab"), REAL(w.db));
    Lobbies.close(w.db, "all");

    // The reveal: the rival now sees the full field and the draw.
    const view = live(w.rival)[0];
    expect(view.status).toBe("closed");
    expect(view.entries.length).toBe(2);
    const mine = view.entries.find((e) => e.mine)!;
    expect(mine.drew).toEqual({ bird: "Alab", farm: "Bukidnon Farms" });

    // Entries are locked — a latecomer opens a FRESH lobby, not this one.
    const late = w.rival.enter(rivalId("Sinag"), REAL(w.db));
    expect(late.lobby.lobbyId).not.toBe(view.lobbyId);
    expect(late.lobby.status).toBe("open");
  });

  test("a drawless bird is revealed at close but refunds only at post", () => {
    const w = world();
    w.dev.enter(byName(w.devFlock, "Alab").id, REAL(w.db), 313);
    Lobbies.close(w.db, "all");
    expect(live(w.dev)[0].entries[0].drew).toBeNull();
    expect(gp(w.db, w.devId)).toBe(ECONOMY.STARTING_GP - ECONOMY.REAL_ENTRY_FEE); // still escrowed
    Lobbies.complete(w.db);
    expect(gp(w.db, w.devId)).toBe(ECONOMY.STARTING_GP); // fee home at post time
  });

  test("the claiming window: claims land AFTER close, before the fight completes", () => {
    const w = world();
    const spec = onCard(w.db, { mode: "real", classType: "claimer" }); // tag comes off the card now
    const devAlab = byName(w.devFlock, "Alab");
    const { lobby } = w.dev.enter(devAlab.id, spec, 606);
    w.rival.enter(rivalId("Alab"), spec);

    // 6 PM: claimers close early — draw revealed, entries locked, claims OPEN.
    Lobbies.close(w.db, "claimers");
    const closedView = live(w.rival).find((l) => l.classType === "claimer")!;
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
    const spec = onCard(w.db, { mode: "real", classType: "claimer" }); // tag comes off the card now
    const { lobby } = w.dev.enter(byName(w.devFlock, "Alab").id, spec, 77);
    Lobbies.close(w.db, "all");
    Lobbies.complete(w.db);
    expect(() => w.rival.claim(lobby.entries[0].entryId)).toThrow(/No open entry/);
  });
});

describe("the scout report (round 28 — reading a bird through the fog)", () => {
  /** One finished fight, reduced to the columns the scout reads. */
  function logFigure(w: ReturnType<typeof world>, birdId: string, format: "b1" | "b2", pitFigure: number) {
    w.db
      .insert(battleLog)
      .values({
        dayIndex: 0,
        lobbyId: 1,
        farmId: w.devId,
        birdId,
        mode: "real",
        format,
        lobby: "open",
        opponentBirdId: "rival-bird",
        opponentFarmId: w.rivalId,
        opponentName: "Rival",
        result: "win",
        pitFigure,
        gpDeltaCents: 0,
        seed: 1,
        playByPlay: "[]",
      })
      .run();
  }

  test("zero career fights: every blade reads exactly the prior — unknown, never bad", () => {
    // WHY (round 28: the fog): with the sheet hidden, the scout report is
    // the ONLY read on a live bird. An unraced blade must score the
    // even-starter prior, not zero — "no evidence" reading as "bad" would
    // teach every stable to never try a second blade.
    const w = world();
    // Starters seed a career RECORD but no battle log — the scout reads figures only.
    const report = w.dev.scoutReport(byName(w.devFlock, "Kidlat").id);
    for (const f of FORMAT_NAMES) {
      expect(report.blades[f].score).toBe(SCOUT.PRIOR_FIGURE);
      expect(report.blades[f].fights).toBe(0);
    }
    expect(report.totalFights).toBe(0);
    expect(report.bestEvidence).toBeNull(); // nothing fought = nothing trusted
    // The all-prior tie breaks in dial order — stable, and honest about it.
    expect(report.bestBlade).toBe(FORMAT_NAMES[0]);
  });

  test("one loud figure is SHRUNK toward the prior — computed from config, not lore", () => {
    // WHY: shrinkage is the whole trick. If one 80 at B1 ranked as a raw 80,
    // a single lucky night would type a bird for its whole career and the
    // exploration the bots pay for would buy nothing.
    const w = world();
    const alab = byName(w.devFlock, "Alab");
    logFigure(w, alab.id, "b1", 80);
    const report = w.dev.scoutReport(alab.id);
    // The published formula, from the SCOUT constants themselves — at today's
    // config (prior 50, weight 2) that is (80 + 100)/3 = 70, but the TEST
    // must move when the knobs do, so it never hard-codes the 70.
    const expected =
      Math.round(
        ((80 * 1 + SCOUT.PRIOR_FIGURE * SCOUT.PRIOR_WEIGHT) / (1 + SCOUT.PRIOR_WEIGHT)) * 10
      ) / 10;
    expect(report.blades.b1.score).toBe(expected);
    expect(report.blades.b1.score).toBeGreaterThan(SCOUT.PRIOR_FIGURE); // evidence counts…
    expect(report.blades.b1.score).toBeLessThan(80); // …but one night is not a destiny
    expect(report.bestBlade).toBe("b1");
    expect(report.bestEvidence).toBe("b1"); // the most-fought blade IS the read
    expect(report.totalFights).toBe(1);
  });

  test("the scout is not farm-scoped — a claimer target can be read from any barn", () => {
    // WHY: like formBook, the bird you are about to claim is exactly the one
    // whose figures you most need. Scoping this to the owner would make
    // claiming blind again — the round-19 dead-mechanic shape.
    const w = world();
    const alab = byName(w.devFlock, "Alab");
    logFigure(w, alab.id, "b2", 60);
    expect(w.rival.scoutReport(alab.id).totalFights).toBe(1);
  });
});

describe("the land curve (fight up)", () => {
  test("superlinear in the fee: the two daily rungs, and the Majors above them", () => {
    // ⚠ ROUND 31 dropped the hardcore rung. There is no hardcore entry fee any
    // more — the daily card runs none, and the Majors are free — so the curve's
    // top end is now exercised against the tournament land basis, which is what
    // actually pays a bird for fighting up.
    expect(landForFight(ECONOMY.JUVENILE_ENTRY_FEE)).toBe(1);
    expect(landForFight(ECONOMY.REAL_ENTRY_FEE)).toBe(7);
    expect(landForTournamentFight(PINTAKASI.LAND_BASIS)).toBeGreaterThan(
      landForFight(ECONOMY.REAL_ENTRY_FEE)
    );
    // 3× the fee pays MORE than 3× the land — the "fight up" incentive, which
    // is the property the whole curve exists for.
    expect(landForFight(3 * ECONOMY.REAL_ENTRY_FEE)).toBeGreaterThan(
      3 * landForFight(ECONOMY.REAL_ENTRY_FEE)
    );
  });
});
