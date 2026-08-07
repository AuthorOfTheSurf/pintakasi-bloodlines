import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/db/client";
import { replayFight } from "./replay";
import { battleLog, birds, farms, gameState, lobbyEntries } from "@/db/schema";
import { seedGame, seedStarterFlock } from "@/db/seed-data";
import {
  ECONOMY,
  FIGHTS_PER_GROUP_BIRD,
  FORMAT_NAMES,
  GROUP,
  LAND,
  LT_CENTS,
  PINTAKASI,
  SCOUT,
  STAKER_FLOWS,
  landForFight,
  landForTournamentFight,
  stakePerFight,
} from "./config";
import { Flock } from "./flock";
import { Game } from "./game";
import { Lobbies, type LobbySpec } from "./lobbies";
import { expectConserved, makeBird, onCard } from "./testkit";

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
  db.select().from(farms).where(eq(farms.id, id)).get()!.landTokensCents;
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

/**
 * Both farms card the same starter slot; the lobby seed decides the night.
 *
 * TWO BIRDS IS A GROUP OF TWO (round 34), so this is still exactly one fight —
 * which is why every test built on `duel` survived the group stage. What it is
 * NOT any more is a full night: each side risks `stakePerFight(fee)` and gets
 * the other two thirds back, so `lobby.settlements` is now returned alongside
 * the fight and the money assertions read from there.
 */
function duel(w: ReturnType<typeof world>, name: string, spec: LobbySpec, seed: number) {
  w.dev.enter(byName(w.devFlock, name).id, spec, seed);
  w.rival.enter(rivalId(name), spec);
  const tick = w.game.tickDay();
  const lobby = tick.card.find((l) => l.fights.length > 0)!;
  return { tick, lobby, fight: lobby.fights[0] };
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
    const { lobby, fight } = duel(w, "Alab", REAL(w.db), 7001);

    const fee = ECONOMY.REAL_ENTRY_FEE;
    // ⚠ ROUND 34: a two-bird lobby is a group of two, so this is still one
    // fight — but the fee no longer IS the wager. A third of it is (the night
    // was three fights long and only one of them existed), and the other two
    // thirds come home at settle-up.
    const stake = stakePerFight(fee);
    expect(fight.stake).toBe(stake);
    expect(fight.groupNo).toBe(0);
    const winnerId = fight.winnerFarm === "Bukidnon Farms" ? w.devId : w.rivalId;
    const loserId = winnerId === w.devId ? w.rivalId : w.devId;
    // Win +stake, lose −stake — the pot is pooled and pure again (round 23).
    const rakeCents = Math.round(stake * 200 * STAKER_FLOWS.FIGHT_RAKE);
    expect(gpCents(w.db, winnerId)).toBe(ECONOMY.STARTING_GP * 100 + stake * 100 - rakeCents);
    expect(gp(w.db, loserId)).toBe(ECONOMY.STARTING_GP - stake);
    // No GP printed, none burned — the pot just moved.
    expect(totalGp(w.db)).toBe(before);
    // Every entry settles, whatever happened to it: one fight of three, a
    // third risked, two thirds refunded.
    expect(lobby.settlements.length).toBe(2);
    for (const s of lobby.settlements) {
      expect(s.fights).toBe(1);
      expect(s.staked).toBe(stake);
      expect(s.refunded).toBe(fee - stake);
    }
    // Land pays BOTH fighters, ONCE, on what the night actually risked —
    // not on the fee the bird only partly got to use.
    expect(land(w.db, w.devId)).toBe(landForFight(stake));
    expect(land(w.db, w.rivalId)).toBe(landForFight(stake));
    // Two mirrored log rows: same fight, opposite results, cross-referenced.
    const rows = w.db.select().from(battleLog).all();
    expect(rows.length).toBe(2);
    expect(rows[0].seed).toBe(rows[1].seed);
    // Round 38 stopped STORING the narration, so this used to compare two
    // stored strings and now compares two REPLAYS. It is the stronger claim:
    // both rows are the same fight, so replaying either from its seed must
    // rebuild the identical transcript — and neither may have drifted.
    const rA = replayFight(w.db, rows[0].id)!;
    const rB = replayFight(w.db, rows[1].id)!;
    expect(rA.playByPlay).toBe(rB.playByPlay);
    expect(rA.drifted).toBe(false);
    expect(rB.drifted).toBe(false);
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

  /**
   * ⚠ RE-POINTED IN ROUND 37, not deleted. This used to assert that a real win
   * banked PINTAKASI.POINTS_FOR.real qualification points toward a crown, and
   * that counter no longer exists — Thursday is open on age alone.
   *
   * But the DISTINCTION the test was defending survives the deletion intact:
   * a win in the discovery year is PRACTICE and a win on a real card is a
   * STAKES win, and the game has to keep the two apart. It is what the maiden
   * and nw3 ladders sort on (round 19), and since round 37 it is also the line
   * the bots' own crown appetite draws (CROWN_CHASE.CROWN_MIN_REAL_WINS). So
   * the subject moves from `crownPoints` to `stakesWins`; the claim is the
   * same claim.
   */
  test("a REAL win banks a stakes win — a discovery-year win is practice and banks none", () => {
    const w = world();
    const stakesOf = (db: DB, id: string) =>
      db.select().from(birds).where(eq(birds.id, id)).get()!.stakesWins;
    const winsOf = (db: DB, id: string) =>
      db.select().from(birds).where(eq(birds.id, id)).get()!.wins;
    // The legacy starters arrive with seeded records, so this is a DELTA test
    // against what each bird already held.
    const before = new Map(w.db.select().from(birds).all().map((b) => [b.id, b.stakesWins]));
    const { fight } = duel(w, "Alab", REAL(w.db), 7001);
    const rows = w.db.select().from(battleLog).all();
    const winner = rows.find((r) => r.result === "win")!;
    const loser = rows.find((r) => r.result === "loss")!;
    expect(stakesOf(w.db, winner.birdId)).toBe(before.get(winner.birdId)! + 1);
    expect(fight.farms.length).toBe(2);
    // The loser banks nothing — a stakes win is WON, never granted for showing up.
    expect(stakesOf(w.db, loser.birdId)).toBe(before.get(loser.birdId)!);

    // The same fight one year younger banks nothing at all. Kidlat is the
    // legacy flock's age-1 chick, in both barns, with no record either side.
    const j = world();
    const juvenile = onCard(j.db, { mode: "juvenile", classType: "open" });
    duel(j, "Kidlat", juvenile, 7001);
    const juvWinner = j.db.select().from(battleLog).all().find((r) => r.result === "win")!;
    expect(winsOf(j.db, juvWinner.birdId)).toBe(1); //       the lifetime record moves…
    expect(stakesOf(j.db, juvWinner.birdId)).toBe(0); //     …the stakes record does not
  });

  test("an ODD lobby strands nobody any more — the odd bird is a group-mate", () => {
    // ⚠ THE CONTRACT INVERTED IN ROUND 34, and this test is the reason the
    // round exists. It used to assert "an odd lobby strands one bird: fee
    // back, no land, no fight" — three entries meant one pair and a leftover.
    // Groups have no leftover: three birds in one room are one group of
    // three, and the two rivals simply never meet each other.
    const w = world();
    const before = totalGp(w.db);
    w.dev.enter(byName(w.devFlock, "Alab").id, REAL(w.db), 555);
    w.rival.enter(rivalId("Alab"), REAL(w.db));
    w.rival.enter(rivalId("Sinag"), REAL(w.db));
    const tick = w.game.tickDay();
    const lobby = tick.card[0];
    // Two of the three possible pairings happen; the rival pair is barred.
    expect(lobby.fights.length).toBe(2);
    expect(lobby.unmatched.length).toBe(0);
    const dev = lobby.settlements.find((s) => s.farm === "Bukidnon Farms")!;
    expect(dev.fights).toBe(2); // the only bird everyone can fight
    expect(dev.refunded).toBe(stakePerFight(ECONOMY.REAL_ENTRY_FEE)); // one unfought third
    for (const s of lobby.settlements.filter((s) => s.farm === "Rival Gamefarm"))
      expect(s.fights).toBe(1);
    expect(totalGp(w.db)).toBe(before); // refunds + pooled pots conserve GP exactly
    const statuses = w.db.select().from(lobbyEntries).all().map((e) => e.status).sort();
    expect(statuses).toEqual(["fought", "fought", "fought"]);
  });

  test("juvenile cards count toward the ONE lifetime record, at juvenile stakes", () => {
    const w = world();
    const { lobby, fight } = duel(w, "Kidlat", onCard(w.db, { mode: "juvenile", classType: "open" }), 31);
    expect(fight.stake).toBe(stakePerFight(ECONOMY.JUVENILE_ENTRY_FEE));
    // One fight of a possible three, so the land is on that one stake.
    expect(lobby.settlements[0].land).toBe(
      landForFight(stakePerFight(ECONOMY.JUVENILE_ENTRY_FEE))
    );
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
    const { lobby, fight } = duel(w, "Sinag", REAL(w.db), 99);
    expect(fight.forcedRetirements).toEqual([]);
    const devSinag = byName(w.devFlock, "Sinag");
    const rivalSinag = w.rivalFlock.byId(rivalId("Sinag"));
    expect(devSinag.status).toBe("active");
    expect(rivalSinag.status).toBe("active"); // both walk away, win or lose
    // …and both are paid for turning up, on the one stake they risked.
    for (const s of lobby.settlements)
      expect(s.land).toBe(landForFight(stakePerFight(ECONOMY.REAL_ENTRY_FEE)));
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

  test("matchmaking never pairs barn-mates — the lone visitor fights all three", () => {
    const w = world();
    const before = totalGp(w.db);
    // Three dev birds against one rival bird. Under PAIRS that was one fight
    // and two stranded barn-mates; under GROUPS (round 34) it is one group of
    // four, and the rival's bird is the only opponent any of them has — so it
    // takes all three fights and the dev birds take one each. The barn-mate
    // rule is unchanged: no dev bird ever meets another.
    for (const name of ["Alab", "Sinag", "Batong Buhay"]) {
      w.dev.enter(byName(w.devFlock, name).id, REAL(w.db), 808);
    }
    w.rival.enter(rivalId("Alab"), REAL(w.db));
    const lobby = w.game.tickDay().card[0];
    expect(lobby.fights.length).toBe(3);
    for (const f of lobby.fights) expect(f.farms.sort()).toEqual(["Bukidnon Farms", "Rival Gamefarm"]);
    expect(lobby.unmatched.length).toBe(0); // nobody goes home empty any more
    const rival = lobby.settlements.find((s) => s.farm === "Rival Gamefarm")!;
    expect(rival.fights).toBe(FIGHTS_PER_GROUP_BIRD); // a full night
    expect(rival.refunded).toBe(0);
    expect(rival.staked).toBe(ECONOMY.REAL_ENTRY_FEE);
    for (const s of lobby.settlements.filter((s) => s.farm === "Bukidnon Farms"))
      expect(s.fights).toBe(1); // one apiece — the visitor is their only door
    expect(totalGp(w.db)).toBe(before); // every refund and pot conserves GP exactly
  });

  test("two birds apiece, many seeds — every draw is cross-barn", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const w = world();
      w.dev.enter(byName(w.devFlock, "Alab").id, REAL(w.db), seed);
      w.dev.enter(byName(w.devFlock, "Sinag").id, REAL(w.db));
      w.rival.enter(rivalId("Alab"), REAL(w.db));
      w.rival.enter(rivalId("Sinag"), REAL(w.db));
      const lobby = w.game.tickDay().card[0];
      // A group of four, less the two same-barn pairings it refuses: four
      // fights, two apiece. (Under pairs this was two fights, one apiece.)
      expect(lobby.fights.length).toBe(4);
      for (const f of lobby.fights) {
        expect(f.farms[0]).not.toBe(f.farms[1]);
      }
      for (const s of lobby.settlements) expect(s.fights).toBe(2);
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
    // The draw is a LIST since round 34 — the bird's whole group, which here
    // is the one other bird in the room.
    expect(mine.drew).toEqual([{ bird: "Alab", farm: "Bukidnon Farms" }]);

    // Entries are locked — a latecomer opens a FRESH lobby, not this one.
    const late = w.rival.enter(rivalId("Sinag"), REAL(w.db));
    expect(late.lobby.lobbyId).not.toBe(view.lobbyId);
    expect(late.lobby.status).toBe("open");
  });

  test("a drawless bird is revealed at close but refunds only at post", () => {
    const w = world();
    w.dev.enter(byName(w.devFlock, "Alab").id, REAL(w.db), 313);
    Lobbies.close(w.db, "all");
    // Drew NOBODY is an empty list now, not a null (round 34).
    expect(live(w.dev)[0].entries[0].drew).toEqual([]);
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
        side: 0,
        result: "win",
        pitFigure,
        gpDeltaCents: 0,
        seed: 1,
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
    //
    // ⚠ ROUND 34 CHANGED WHAT THE ARGUMENT MEANS. It used to be the entry fee
    // of a single fight; it is now the TOTAL a bird risked across its group,
    // which for a full night is the whole fee and for a short one is less. The
    // rungs below are therefore the FULL-NIGHT rungs.
    //
    // ⚠ ROUND 36 CHANGED THE UNIT. landForFight returns HUNDREDTHS now, so a
    // juvenile night is 115 (1.15 LT) and a real night 673 (6.73 LT). Both
    // rungs are written against LT_CENTS rather than as bare integers, so the
    // reader can see which unit they are in without going to look.
    expect(landForFight(ECONOMY.JUVENILE_ENTRY_FEE) / LT_CENTS).toBeCloseTo(1.15, 2);
    expect(landForFight(ECONOMY.REAL_ENTRY_FEE) / LT_CENTS).toBeCloseTo(6.73, 2);
    expect(landForTournamentFight(PINTAKASI.LAND_BASIS)).toBeGreaterThan(
      landForFight(ECONOMY.REAL_ENTRY_FEE)
    );

    // THE DIRECTION OF THE WHOLE RULING, and round 34 nearly lost it. Dearer
    // company must pay MORE LAND PER GP RISKED, not just more land. Moving the
    // juvenile night to 9 GP first pushed it to 2 LT (0.222/GP against a real
    // card's 0.167) — the cheapest fight in the game paying the best land in
    // it — which is why LAND.FEE_PER_TOKEN moved with it. Pin the ratio, not
    // the rungs: the rungs above will drift, this must not.
    const perGp = (fee: number) => landForFight(fee) / fee;
    expect(perGp(ECONOMY.REAL_ENTRY_FEE)).toBeGreaterThan(perGp(ECONOMY.JUVENILE_ENTRY_FEE));

    // WHY LAND PAYS ONCE ON THE NIGHT rather than once per fight.
    //
    // ⚠ THE REASON CHANGED IN ROUND 36, and the assertions with it. Under
    // whole tokens the argument was about the FLOOR: a 3 GP stake sat on
    // `max(1, …)` where the exponent did nothing, so three juvenile fights
    // each floored to 1 LT and minted 3 for a night worth 1 — per-fight
    // payment rewarded being cheap, not fighting. Hundredths dissolved that
    // floor (a 3 GP stake is 0.32 LT now, on the curve like everything else),
    // so the ordering FLIPPED: the night now pays MORE than the sum of its
    // fights, and that is the correct direction, not a regression. It is just
    // superlinearity doing its job — f(a+b+c) > f(a)+f(b)+f(c) — which is the
    // same property as "fighting up pays extra", read on one bird's night
    // instead of across two cards. Paying per fight would have SHRUNK the
    // reward for taking a full night, which is precisely backwards.
    const stake = stakePerFight(ECONOMY.REAL_ENTRY_FEE);
    expect(landForFight(ECONOMY.REAL_ENTRY_FEE)).toBeGreaterThan(
      FIGHTS_PER_GROUP_BIRD * landForFight(stake)
    );
    const juvStake = stakePerFight(ECONOMY.JUVENILE_ENTRY_FEE);
    expect(landForFight(ECONOMY.JUVENILE_ENTRY_FEE)).toBeGreaterThan(
      FIGHTS_PER_GROUP_BIRD * landForFight(juvStake)
    );
    // …and a bird that fought a SHORT card is still honestly paid short: the
    // curve is fed what it actually risked, so two fights of three pay less
    // than the full night. (That is the half of the round-34 ruling that did
    // not change.)
    expect(landForFight(2 * stake)).toBeLessThan(landForFight(ECONOMY.REAL_ENTRY_FEE));
    expect(landForFight(stake)).toBeLessThan(landForFight(2 * stake));
    // 3× the fee pays MORE than 3× the land — the "fight up" incentive, which
    // is the property the whole curve exists for.
    expect(landForFight(3 * ECONOMY.REAL_ENTRY_FEE)).toBeGreaterThan(
      3 * landForFight(ECONOMY.REAL_ENTRY_FEE)
    );
  });

  /**
   * ⚠ THE GUARD. THIS IS THE TEST THAT SHOULD HAVE EXISTED BEFORE ROUND 34.
   *
   * The ruling the land curve exists to express is one sentence: FIGHTING UP
   * INTO DEARER COMPANY PAYS EXTRA. Every test above pins that at the rungs
   * the game happens to use today — a juvenile night, a real night, a Major.
   * Rungs are not the ruling. The ruling is a property of the whole curve,
   * and round 34 broke it at a rung nobody had written down.
   *
   * WHAT HAPPENED. Round 34 moved the juvenile entry fee 8 GP → 9. The curve
   * was `max(1, ceil((fee/8)^1.15))` in WHOLE TOKENS, and (9/8)^1.15 = 1.145,
   * which `ceil` turned into 2 tokens. So the discovery year began minting
   * 2/9 = 0.222 LT per GP risked while a real card paid 6/36 = 0.167 — the
   * CHEAPEST fight in the game paying the BEST land in it, exactly backwards.
   * Nothing caught it. Every invariant passed, every number was internally
   * consistent, and the rule it violated lived in a comment.
   *
   * WHY IT WAS INVISIBLE. Whole tokens made `ceil` LOAD-BEARING. At the cheap
   * end of a superlinear curve the rounding is worth more than the exponent —
   * rounding 1.145 up to 2 is a 75% overpayment, while the same rounding on a
   * real night is worth 4% — so the distortion was always largest exactly
   * where the curve is shallowest. Round 34's answer was to move the base to
   * 9 until the numbers landed on friendly integers; that worked once and
   * would have broken again on the next fee change.
   *
   * WHAT THIS PINS INSTEAD. LT per GP risked must be NON-DECREASING in the
   * fee, at every fee, not just at the rungs. That is the ruling stated as
   * arithmetic, and it fails the moment somebody moves a fee the wrong way —
   * which is the whole point, because a fee moves for reasons that have
   * nothing to do with land.
   *
   * ⚠ AND IT IS IMPOSSIBLE TO GUARANTEE WITH INTEGER TOKENS. This assertion
   * could not have been written before round 36: with whole-token output the
   * curve is a staircase, and per-GP yield sawtooths DOWN across every flat
   * tread (at base 8 and `ceil`, 1 LT covers 1–8 GP, so 8 GP pays 0.125/GP
   * against 1 GP's 1.0). No amount of choosing a base fixes that; only
   * resolution does. Hundredths make the rounding error two orders of
   * magnitude smaller than the gaps it was corrupting, so the exponent — not
   * the rounding — decides the ordering, and the property becomes testable.
   * If a future round ever returns land to whole tokens, THIS TEST IS THE
   * THING IT BREAKS, and that is the correct alarm.
   */
  test("GUARD: LT per GP risked never decreases as the fee rises (1–300 GP)", () => {
    // The realistic range with room over the top: 1 GP is below any real fee,
    // 300 GP is well past the Majors' 200 GP basis.
    //
    // Collected rather than asserted in the loop so a failure NAMES THE FEE.
    // "expected 0.222 to be >= 0.167" three hundred times over tells the next
    // person nothing; "inverted at 9 GP" tells them which knob they moved.
    const inversions: string[] = [];
    let prev = landForFight(1) / 1;
    for (let fee = 1; fee <= 300; fee++) {
      const perGp = landForFight(fee) / fee;
      // Non-DECREASING, not strictly increasing: rounding to a hundredth can
      // legitimately leave two adjacent fees on the same per-GP yield. What it
      // must never do is go BACKWARDS, because backwards is the inversion.
      if (perGp < prev)
        inversions.push(`${fee} GP pays ${perGp.toFixed(4)} LT/GP after ${prev.toFixed(4)}`);
      prev = perGp;
    }
    expect(inversions).toEqual([]);
    // A fight ALWAYS mints something. The floor is a hundredth, not a token,
    // but it is a floor: no fee, however small, buys a night of fighting for
    // nothing.
    for (let fee = 1; fee <= 300; fee++) expect(landForFight(fee)).toBeGreaterThan(0);
  });

  test("GUARD: the ordering the ruling actually names, rung by rung", () => {
    const perGp = (lt: number, fee: number) => lt / fee;
    const juv = perGp(landForFight(ECONOMY.JUVENILE_ENTRY_FEE), ECONOMY.JUVENILE_ENTRY_FEE);
    const real = perGp(landForFight(ECONOMY.REAL_ENTRY_FEE), ECONOMY.REAL_ENTRY_FEE);
    // The exact pair round 34 inverted: the discovery year must pay WORSE land
    // per GP than a real card, because it is the cheaper, safer company.
    expect(real).toBeGreaterThan(juv);

    // And the Majors sit above the daily card on the same measure — a steeper
    // exponent on a dearer basis. This is the second half of "fight up": it is
    // not only about the size of the fee but about which card you took it on.
    const major = perGp(landForTournamentFight(PINTAKASI.LAND_BASIS), PINTAKASI.LAND_BASIS);
    expect(major).toBeGreaterThan(real);
    // …and the two curves agree at their shared base — the Majors are the same
    // shape pulled steeper, not a different deal bolted on.
    expect(landForTournamentFight(LAND.FEE_PER_TOKEN)).toBe(landForFight(LAND.FEE_PER_TOKEN));
    expect(landForFight(LAND.FEE_PER_TOKEN)).toBe(LT_CENTS); // one fee-per-token = 1.00 LT
  });
});

/**
 * THE GROUP STAGE (round 34). One entry buys a night of up to
 * FIGHTS_PER_GROUP_BIRD fights, not one fight.
 *
 * These pin the four things the round is actually made of, in the order they
 * matter: the arithmetic (the fee must divide), the DEAL (sizes levelled so
 * nobody sits out), the SPLIT (you risk a share per fight and the rest comes
 * home), and the fact that land moved from the fight to the night.
 */
describe("the group stage (round 34 — one entry, a group of fights)", () => {
  /**
   * n barns, one fresh two-year-old apiece — the clean case where nothing but
   * the deal decides who fights whom. Every existing fixture in this file has
   * two barns with eight birds each, which is exactly the wrong shape for
   * testing a matchmaker: barn-mate collisions dominate.
   */
  function soloBarns(w: ReturnType<typeof world>, n: number) {
    return Array.from({ length: n }, (_, i) => {
      const { farm } = w.game.farms.register({
        name: `Group Barn ${i + 1}`,
        primaryColor: "blue",
        secondaryColor: "white",
      });
      const bird = makeBird(w.db, { farmId: farm.id, name: `Grouper ${i + 1}` });
      return { farmId: farm.id, name: farm.name, lobbies: new Lobbies(w.db, farm.id), birdId: bird.id };
    });
  }

  /** Every solo barn cards its bird into one room; the first fixes the seed. */
  function cardThemAll(w: ReturnType<typeof world>, barns: ReturnType<typeof soloBarns>, seed = 4242) {
    const spec = REAL(w.db);
    barns.forEach((b, i) => b.lobbies.enter(b.birdId, spec, i === 0 ? seed : undefined));
    return spec;
  }

  test("THE ARITHMETIC: both entry fees divide evenly by the fights in a group", () => {
    // ⚠ THE LOAD-BEARING CONSTRAINT OF THE WHOLE ROUND, which is why it is
    // asserted against config and not against 42 and 9. The fee is escrowed
    // whole and spent a share at a time; if the share were fractional the
    // refund would be too, and GP is kept to the cent by an invariant that
    // does not bend. Change GROUP.SIZE and this is what breaks first.
    for (const fee of [ECONOMY.REAL_ENTRY_FEE, ECONOMY.JUVENILE_ENTRY_FEE]) {
      expect(fee % FIGHTS_PER_GROUP_BIRD).toBe(0);
      expect(stakePerFight(fee)).toBe(fee / FIGHTS_PER_GROUP_BIRD);
      expect(Number.isInteger(stakePerFight(fee))).toBe(true);
      expect(stakePerFight(fee) * FIGHTS_PER_GROUP_BIRD).toBe(fee);
    }
  });

  test("a full group: four barns, six fights, three apiece", () => {
    const w = world();
    const barns = soloBarns(w, GROUP.SIZE);
    cardThemAll(w, barns);
    const lobby = w.game.tickDay().card.find((l) => l.settlements.length === GROUP.SIZE)!;
    // Everyone fights everyone: C(4,2) = 6.
    expect(lobby.fights.length).toBe((GROUP.SIZE * (GROUP.SIZE - 1)) / 2);
    expect(lobby.fights.every((f) => f.groupNo === 0)).toBe(true);
    expect(lobby.unmatched.length).toBe(0);
    for (const s of lobby.settlements) {
      expect(s.fights).toBe(FIGHTS_PER_GROUP_BIRD);
      expect(s.staked).toBe(ECONOMY.REAL_ENTRY_FEE); // the whole entry got used
      expect(s.refunded).toBe(0);
    }
    expectConserved(w.db);
  });

  test("THE LEVELLING: nine birds deal 3+3+3, and nobody sits out", () => {
    // ⚠ THIS IS THE PROPERTY, not the fight count. Naive packing would deal
    // 4+4+1 and strand the ninth bird alone in a room — the exact failure the
    // group stage exists to delete. So the assertion that matters is that NO
    // entry ends the night with zero fights.
    const w = world();
    const barns = soloBarns(w, 9);
    cardThemAll(w, barns, 777);
    const lobby = w.game.tickDay().card.find((l) => l.settlements.length === 9)!;
    expect(lobby.unmatched.length).toBe(0);
    expect(lobby.settlements.every((s) => s.fights > 0)).toBe(true);
    // Three groups of three: three fights each, nine in all, two a bird.
    expect(lobby.fights.length).toBe(9);
    expect(new Set(lobby.fights.map((f) => f.groupNo)).size).toBe(3);
    for (const s of lobby.settlements) {
      expect(s.fights).toBe(2);
      expect(s.staked).toBe(2 * stakePerFight(ECONOMY.REAL_ENTRY_FEE));
      expect(s.refunded).toBe(stakePerFight(ECONOMY.REAL_ENTRY_FEE));
    }
    expectConserved(w.db);
  });

  test("a lobby of ONE still strands its bird — full refund, no land", () => {
    // The only case groups cannot fix, and it is the honest one: a bird alone
    // in a room has nobody to fight. Land is for FIGHTING, so it earns none.
    const w = world();
    const [only] = soloBarns(w, 1);
    const before = totalGp(w.db); // AFTER the barn registers — a new farm is a faucet
    cardThemAll(w, [only]);
    const lobby = w.game.tickDay().card.find((l) => l.settlements.length === 1)!;
    expect(lobby.fights.length).toBe(0);
    expect(lobby.unmatched.length).toBe(1);
    expect(lobby.settlements[0]).toEqual({
      farm: only.name,
      bird: "Grouper 1",
      fights: 0,
      staked: 0,
      refunded: ECONOMY.REAL_ENTRY_FEE,
      land: 0,
    });
    expect(land(w.db, only.farmId)).toBe(0);
    expect(gp(w.db, only.farmId)).toBe(ECONOMY.STARTING_GP);
    expect(totalGp(w.db)).toBe(before);
    expectConserved(w.db);
  });

  test("THE STAKE SPLIT: two fights of three refunds exactly one stake", () => {
    // Zane's ruling, in its original words: "If the bird is the odd bird out
    // and only gets two fights, then I'd expect them to get refunded 20." The
    // shape that produces a short card is a SAME-BARN COLLISION inside a
    // group — two birds of one farm never meet, so each loses one pairing.
    const w = world();
    const [a, b, c] = soloBarns(w, 3);
    const second = makeBird(w.db, { farmId: a.farmId, name: "Grouper 1B" });
    const before = totalGp(w.db); // AFTER the barns register — a new farm is a faucet
    const spec = REAL(w.db);
    a.lobbies.enter(a.birdId, spec, 31337);
    a.lobbies.enter(second.id, spec);
    b.lobbies.enter(b.birdId, spec);
    c.lobbies.enter(c.birdId, spec);

    const lobby = w.game.tickDay().card.find((l) => l.settlements.length === GROUP.SIZE)!;
    const stake = stakePerFight(ECONOMY.REAL_ENTRY_FEE);
    // Six pairings less the one barn-mate pairing that is never made.
    expect(lobby.fights.length).toBe(5);
    expect(lobby.fights.every((f) => f.stake === stake)).toBe(true);
    for (const s of lobby.settlements.filter((s) => s.farm === a.name)) {
      expect(s.fights).toBe(2);
      expect(s.staked).toBe(2 * stake);
      expect(s.refunded).toBe(stake); // the fight that could not be made
    }
    // …while the two singletons got everyone, and nothing came home.
    for (const s of lobby.settlements.filter((s) => s.farm !== a.name)) {
      expect(s.fights).toBe(FIGHTS_PER_GROUP_BIRD);
      expect(s.refunded).toBe(0);
    }
    expect(totalGp(w.db)).toBe(before); // the pots and the refunds both balance
    expectConserved(w.db);
  });

  test("LAND PAYS ONCE, on the night's total risk — not per fight, not on the fee", () => {
    // Three ways to get this wrong, all of them tempting, all of them here:
    // paying per fight (3× the LT), paying on the fee when the card was short
    // (over-paying a bird that never risked it), and paying on the per-fight
    // stake (which flattens the curve into its floor).
    const w = world();
    const [a, b, c] = soloBarns(w, 3);
    const second = makeBird(w.db, { farmId: a.farmId, name: "Grouper 1B" });
    const spec = REAL(w.db);
    a.lobbies.enter(a.birdId, spec, 31337);
    a.lobbies.enter(second.id, spec);
    b.lobbies.enter(b.birdId, spec);
    c.lobbies.enter(c.birdId, spec);
    const lobby = w.game.tickDay().card.find((l) => l.settlements.length === GROUP.SIZE)!;
    const stake = stakePerFight(ECONOMY.REAL_ENTRY_FEE);

    for (const s of lobby.settlements) {
      expect(s.land).toBe(landForFight(s.staked));
      expect(s.land).toBeLessThan(s.fights * landForFight(stake) + landForFight(stake)); // not per-fight
    }
    const short = lobby.settlements.find((s) => s.farm === a.name)!;
    const full = lobby.settlements.find((s) => s.farm !== a.name)!;
    expect(short.land).toBe(landForFight(2 * stake));
    expect(short.land).toBeLessThan(full.land); // a short card is paid less…
    expect(full.land).toBe(landForFight(ECONOMY.REAL_ENTRY_FEE)); // …and a full one on the whole fee
    // The wallet agrees with the report: barn A holds both of its birds' awards.
    expect(land(w.db, a.farmId)).toBe(2 * short.land);
    expect(land(w.db, b.farmId)).toBe(full.land);
  });

  test("the draw is the GROUP: every group-mate, never a barn-mate", () => {
    const w = world();
    const [a, b, c] = soloBarns(w, 3);
    const second = makeBird(w.db, { farmId: a.farmId, name: "Grouper 1B" });
    const spec = REAL(w.db);
    a.lobbies.enter(a.birdId, spec, 31337);
    a.lobbies.enter(second.id, spec);
    b.lobbies.enter(b.birdId, spec);
    c.lobbies.enter(c.birdId, spec);
    Lobbies.close(w.db, "all");

    const view = live(a.lobbies).find((l) => l.filled === GROUP.SIZE)!;
    expect(view.status).toBe("closed");
    const mine = view.entries.filter((e) => e.mine);
    expect(mine.length).toBe(2);
    for (const e of mine) {
      // Its two opponents, and NOT the barn-mate it will never be matched
      // with — listing that would promise a fight the matchmaker refuses.
      expect(e.drew!.map((d) => d.farm).sort()).toEqual([b.name, c.name]);
      expect(e.drew!.every((d) => d.farm !== a.name)).toBe(true);
    }
    // And the singletons see all three of theirs, barn-mates being irrelevant.
    const theirs = view.entries.find((e) => e.farm.name === b.name)!;
    expect(theirs.drew!.length).toBe(FIGHTS_PER_GROUP_BIRD);
  });
});
