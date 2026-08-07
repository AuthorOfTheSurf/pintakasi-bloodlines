import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/db/client";
import {
  battleLog,
  birds,
  farms,
  gameState,
  tournamentEntries,
  tournaments,
  type NewBird,
} from "@/db/schema";
import { seedGame, seedStarterFlock } from "@/db/seed-data";
import { chaseCrowns, chaseJuvenileCrowns } from "./bots";
import { CROWN_CHASE } from "./bot-config";
import { ECONOMY, JUVENILE_MAJOR, PINTAKASI, SCOUT, type FightFormat } from "./config";
import { Flock } from "./flock";
import { mulberry32 } from "./rng";
import { Game } from "./game";
import { Lobbies } from "./lobbies";
import { makeBird, onCard } from "./testkit";
import { Tournaments } from "./tournaments";

/**
 * Two legacy farms — each carries two age-3+ birds (Sinag 3, Batong Buhay 5).
 *
 * ⚠ ROUND 37 DELETED A LINE THAT USED TO STAND HERE. Every fixture bird was
 * stamped with PINTAKASI.QUALIFYING_POINTS, because a Major demanded three of
 * them and otherwise every test would have had to campaign its way in. That
 * gate is gone: age is the only hard door, and where a bird SITS is the
 * Selection Committee's call on career earnings.
 *
 * Usefully, the legacy veterans arrive with real WIN records and ZERO
 * earnings — nothing in the seed writes a battle-log row — which is exactly
 * what makes the earnings tests below buildable: a fixture only has the
 * earnings a test gives it, on purpose.
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

const byName = (db: DB, flock: Flock, name: string) =>
  flock.all().find((b) => b.name === name)!;

/**
 * Bank CAREER EARNINGS on a bird — the number the Selection Committee has
 * ranked on since round 37, and therefore the number that decides who stands
 * in a full field.
 *
 * `Tournaments.committeeCards` reads earnings as the sum of positive
 * `gpDeltaCents` on the battle log plus banked purse shares, so a raw row is
 * the honest fixture. Deliberately NOT a real fight through Lobbies: who won
 * is the lobby seed's business, and a ranking test that depends on it is a
 * ranking test you have to re-roll every time the sim changes.
 */
function earned(db: DB, birdId: string, farmId: string, cents: number): void {
  db.insert(battleLog)
    .values({
      dayIndex: 0,
      lobbyId: 1,
      farmId,
      birdId,
      mode: "real",
      format: "b1",
      opponentBirdId: "ghost",
      opponentFarmId: "house",
      opponentName: "Sparring Ghost",
      side: 0,
      result: "win",
      pitFigure: 50,
      gpDeltaCents: cents,
      seed: 1,
    })
    .run();
}

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
    // escrow held by open tournaments
    db
      .select()
      .from(tournamentEntries)
      .all()
      .filter((e) => e.status === "pending")
      .reduce((s, e) => s + e.fee * 100, 0)
  );
};

/** Tick from Friday day 0 through crown day — Thursday, day 6 (round 20). */
function tickThroughCrownDay(game: Game) {
  let last;
  for (let i = 0; i < 7; i++) last = game.tickDay();
  return last!;
}

describe("the week's blades & the calendar", () => {
  test("the same three crowns every week — B1/B3/B5, the ends and the middle (round 27)", () => {
    expect(Tournaments.bladesOfWeek(0)).toEqual(["b1", "b3", "b5"]);
    expect(Tournaments.bladesOfWeek(1)).toEqual(["b1", "b3", "b5"]); // the rotation is dead
    expect(Tournaments.bladesOfWeek(2)).toEqual(["b1", "b3", "b5"]);
  });

  test("crown day is the week's last day — every entry belongs to its own week", () => {
    expect(Tournaments.targetWeek(0)).toBe(0); // Friday, the week opens
    expect(Tournaments.targetWeek(5)).toBe(0); // Wednesday — one card left first
    expect(Tournaments.targetWeek(6)).toBe(0); // Thursday — crown day, last call
    expect(Tournaments.targetWeek(7)).toBe(1); // Friday again — a new week
    expect(Tournaments.isCrownDay(6)).toBe(true);
    expect(Tournaments.isCrownDay(5)).toBe(false);
    expect(Tournaments.isCrownDay(13)).toBe(true); // next week's Thursday
  });
});

describe("registration & the Selection Committee", () => {
  test("the gates hold: age 3+, this week's blades only, one bird per week", () => {
    const w = world();
    const kidlat = byName(w.db, w.devFlock, "Kidlat"); // age 1
    expect(() => w.dev.enter(kidlat.id, "b1")).toThrow(/age 3/);
    const sinag = byName(w.db, w.devFlock, "Sinag"); // age 3
    expect(() => w.dev.enter(sinag.id, "b2")).toThrow(/doesn't run week 0/); // B2 belongs to the juveniles now
    w.dev.enter(sinag.id, "b1");
    expect(() => w.dev.enter(sinag.id, "b3")).toThrow(/already registered/);
  });

  // ── Round 37: THURSDAY IS OPEN ────────────────────────────────────────────
  // These two cases used to be the qualification ladder — zero points refused,
  // one short refused, at the threshold accepted. There is no threshold any
  // more, so the ladder becomes the OPEN FIELD: the same door, asked the
  // opposite question.
  test("an unraced, un-earning age-3 bird may stand — and it still costs nothing", () => {
    const w = world();
    expect(PINTAKASI.ENTRY_FEE).toBe(0);
    // A bird with no record whatsoever: no wins, no earnings, nothing the old
    // counter would have taken. Under the round-22 rule this was the exact
    // shape of a bird that could not enter at all.
    const rookie = makeBird(w.db, { name: "Bagong Salta", age: 3 });
    expect(rookie.wins).toBe(0);
    expect(rookie.stakesWins).toBe(0);
    const before = w.db.select().from(farms).where(eq(farms.id, w.devId)).get()!.gp;
    expect(() => w.dev.enter(rookie.id, "b1")).not.toThrow();
    // Free since round 22 — the wallet does not move.
    expect(w.db.select().from(farms).where(eq(farms.id, w.devId)).get()!.gp).toBe(before);
  });

  test("…but AGE is still a wall — the fork is what a Major is gated on now", () => {
    const w = world();
    // Age 2 is a real fighter on the daily card and nowhere near the crowns:
    // the Majors are hardcore, and the fork that opens hardcore AND manual
    // retirement together is age 3. Opening the field did not open that.
    const yearling = makeBird(w.db, { name: "Bagitong Tandang", age: 2 });
    expect(() => w.dev.enter(yearling.id, "b1")).toThrow(/age 3/);
    // An age-3 bird alongside it, identical in every other respect, walks in.
    const grown = makeBird(w.db, { name: "Sapat na Gulang", age: 3 });
    expect(() => w.dev.enter(grown.id, "b1")).not.toThrow();
  });

  test("the committee ranks on EARNINGS first — the purse beats the record", () => {
    const w = world();
    const sinag = byName(w.db, w.devFlock, "Sinag"); // 4 career wins
    earned(w.db, sinag.id, w.devId, 5_000); //          …and 50.00 GP banked
    w.dev.enter(sinag.id, "b1");
    w.rival.enter("rival-8", "b1"); // Batong Buhay: 7 career wins, never earned
    const lk = w.dev.board().find((c) => c.format === "b1")!;
    // Earnings lead the key since round 37. The reason it is the right lead:
    // it is the one number that already aggregates everything the game pays —
    // pot money, claim tags, purse shares — and a player can read it off a
    // bird's own card, which the old points counter never allowed.
    expect(lk.field[0].bird).toBe("Sinag");
    expect(lk.field[0].rank).toBe(1);
  });

  // The restraint that USED to be an engine rule and is now a bot's appetite.
  // Keeping this pinned matters because the obvious "fix" if crown fields ever
  // look reckless is to put a wins floor back into `enter` — which would undo
  // round 37 without anybody noticing they had.
  test("the bots' crown appetite is a KNOB, not a rule — the door is looser than they are", () => {
    const w = world();
    expect(CROWN_CHASE.CROWN_MIN_REAL_WINS).toBeGreaterThan(0); // …or this proves nothing
    // Strip every stakes record in the world: no bird now clears the bots' own
    // floor, so no bot sends anybody.
    w.db.update(birds).set({ stakesWins: 0 }).run();
    expect(chaseCrowns(w.db, w.devId, 0, mulberry32(11))).toEqual([]);
    // …and the ENGINE opens the door to exactly those birds. A human (or an
    // agent) may take the hardcore gamble a bot declines.
    const sinag = byName(w.db, w.devFlock, "Sinag");
    expect(() => w.dev.enter(sinag.id, "b1")).not.toThrow();
  });

  test("the purse is pure JUICE now that entries are free", () => {
    const w = world();
    w.dev.enter(byName(w.db, w.devFlock, "Sinag").id, "b1");
    w.rival.enter("rival-8", "b1");
    const before = totalCents(w.db);
    const tick = tickThroughCrownDay(w.game);
    const lk = tick.pintakasi.find((t) => t.format === "b1")!;
    expect(lk.cancelled).toBe(false);
    // No entry money in the pot at all — the champion is paid by the juice
    // pool, which gacha spend and breed fees fill.
    const entriesIn = w.db
      .select()
      .from(tournamentEntries)
      .all()
      .reduce((s, e) => s + e.fee, 0);
    expect(entriesIn).toBe(0);
    expect(lk.purseCents).toBeGreaterThan(0);
    expect(totalCents(w.db)).toBe(before); // still redistribution, never printing
  });

  // Round 19: one bird per CROWN, not one per stable. The old callers
  // stopped after a single entry a week, so three championships shared one
  // field of seven across the whole world and two of them cancelled.
  test("a stable chases every crown its barn can staff — one specialist per blade", () => {
    const w = world();
    const entered = chaseCrowns(w.db, w.devId, 0, mulberry32(11));
    // Two age-3+ birds in a legacy barn — so two crowns, two different birds.
    expect(entered.length).toBe(2);
    expect(new Set(entered).size).toBe(2);
    const pending = w.db
      .select()
      .from(tournamentEntries)
      .all()
      .filter((e) => e.farmId === w.devId && e.status === "pending");
    expect(pending.length).toBe(2);
    expect(new Set(pending.map((e) => e.tournamentId)).size).toBe(2); // different championships
    expect(new Set(pending.map((e) => e.birdId)).size).toBe(2); //      different bodies
    // Idempotent within the week: a second pass adds nothing.
    expect(chaseCrowns(w.db, w.devId, 0, mulberry32(12)).length).toBe(0);
  });

  // Round 20: three per barn per crown — load the blade with specialists,
  // but no barn owns a bracket.
  test("a barn may load one championship with three birds — and no more", () => {
    const w = world();
    // A deep barn: a second legacy wave gives four age-3+ birds.
    seedStarterFlock(w.db, w.devId, { seed: 55, idPrefix: "dev2", shape: "legacy" });
    const eligible = w.devFlock.all().filter((b) => b.status === "active" && b.age >= 3);
    expect(eligible.length).toBe(4);
    for (const bird of eligible.slice(0, PINTAKASI.MAX_PER_BARN)) w.dev.enter(bird.id, "b1");
    expect(() => w.dev.enter(eligible[3].id, "b1")).toThrow(/limit per championship/);
    // The fourth bird is welcome in a DIFFERENT crown.
    expect(() => w.dev.enter(eligible[3].id, "b5")).not.toThrow();
  });

  test("the fee escrows at entry; the board ranks the public field", () => {
    const w = world();
    const before = w.db.select().from(farms).where(eq(farms.id, w.devId)).get()!.gp;
    w.dev.enter(byName(w.db, w.devFlock, "Sinag").id, "b1");
    expect(w.db.select().from(farms).where(eq(farms.id, w.devId)).get()!.gp).toBe(
      before - PINTAKASI.ENTRY_FEE
    );
    w.rival.enter("rival-8", "b1"); // rival Batong Buhay, 7 career wins
    const board = w.dev.board();
    const lk = board.find((c) => c.format === "b1")!;
    expect(lk.field.length).toBe(2);
    expect(lk.field[0].rank).toBe(1); // BB outranks Sinag on wins
    expect(lk.field[0].farm).toBe("Rival Gamefarm");
    expect(lk.field.find((f) => f.mine)!.bird).toBe("Sinag");
  });

  /**
   * ⚠ THE BUMP LINE IS NOW THE WHOLE GATE (round 37).
   *
   * While a Major had a points threshold, this test was about an edge case:
   * what happens once 64 qualified birds are already standing. With Thursday
   * open to every age-3 bird in the world, the committee's seating list is the
   * ONLY thing deciding who fights — so this is the test that decides whether
   * the biggest stage in the game is a contest or a queue.
   */
  test("a full field bumps its weakest for a HIGHER-EARNING newcomer — and refuses a poorer one", () => {
    const w = world();
    const t = w.db
      .insert(tournaments)
      .values({ weekIndex: 0, format: "b1", seed: 7, entryFee: PINTAKASI.ENTRY_FEE })
      .returning()
      .get();
    // A full 64-bird field under the rival's banner, laddered by career
    // earnings: dummy 0 has banked 1.00 GP, dummy 63 has banked 64.00.
    const stake = (i: number) => (i + 1) * 100;
    for (let i = 0; i < PINTAKASI.MAX_BRACKET; i++) {
      const dummy = makeBird(w.db, { farmId: w.rivalId, name: `Dummy ${i}`, age: 3 });
      earned(w.db, dummy.id, w.rivalId, stake(i));
      w.db
        .insert(tournamentEntries)
        .values({
          tournamentId: t.id,
          birdId: dummy.id,
          farmId: w.rivalId,
          fee: PINTAKASI.ENTRY_FEE,
          dayEntered: 0,
        })
        .run();
    }
    const rivalGpBefore = w.db.select().from(farms).where(eq(farms.id, w.rivalId)).get()!.gp;
    // Sinag has out-EARNED the weakest of them — by fifty centavos, which is
    // all it takes. Its four career wins are irrelevant while any earnings
    // separate the two birds; that ordering is the round-37 ruling.
    const sinagId = byName(w.db, w.devFlock, "Sinag").id;
    earned(w.db, sinagId, w.devId, stake(0) + 50);
    w.dev.enter(sinagId, "b1");
    const entries = w.db
      .select()
      .from(tournamentEntries)
      .where(eq(tournamentEntries.tournamentId, t.id))
      .all();
    expect(entries.filter((e) => e.status === "pending").length).toBe(PINTAKASI.MAX_BRACKET);
    const bumped = entries.filter((e) => e.status === "bumped");
    expect(bumped.length).toBe(1);
    // …and it is the POOREST bird that went home, not an arbitrary one.
    expect(w.db.select().from(birds).where(eq(birds.id, bumped[0].birdId)).get()!.name).toBe("Dummy 0");
    expect(w.db.select().from(farms).where(eq(farms.id, w.rivalId)).get()!.gp).toBe(
      rivalGpBefore + PINTAKASI.ENTRY_FEE // the bumped entry refunds
    );
    // A newcomer that has earned LESS than the field's new weakest (Sinag
    // itself, at 1.50) is refused at the door. Note what does NOT save it: it
    // is a perfectly legal entrant, age 3, active and named. The committee is
    // the only thing standing in its way.
    const pauper = makeBird(w.db, { name: "Palpak", age: 3 });
    earned(w.db, pauper.id, w.devId, 50);
    expect(() => w.dev.enter(pauper.id, "b1")).toThrow(/weakest/);
    expect(
      w.db.select().from(tournamentEntries).where(eq(tournamentEntries.tournamentId, t.id)).all()
        .filter((e) => e.status === "pending").length
    ).toBe(PINTAKASI.MAX_BRACKET); // a refusal costs the field nothing
  });
});

/**
 * The ranking key itself, in isolation. The bump test above proves the
 * committee USES it; this proves the key is total — that two birds can never
 * tie their way into an order that depends on which one the query happened to
 * return first. A bracket that reseeded itself between two reads of the same
 * public field would make the bump line unreadable, which is the one thing
 * round 37 needed it to be.
 */
describe("the Selection Committee's ranking key", () => {
  const card = (earningsCents: number, wins: number, avgFigure: number) => ({
    earningsCents,
    wins,
    avgFigure,
  });
  const above = (a: ReturnType<typeof card>, b: ReturnType<typeof card>, aId = "a", bId = "b") =>
    Tournaments.compareRank(a, b, aId, bId) < 0;

  test("earnings → wins → figure → id, in that order", () => {
    // Earnings outrank everything: a rich newcomer beats a bird with a longer
    // record and better figures than it will ever have.
    expect(above(card(500, 0, 0), card(100, 99, 99))).toBe(true);
    // Equal earnings fall to career wins…
    expect(above(card(100, 5, 0), card(100, 4, 99))).toBe(true);
    // …then to the average pit figure…
    expect(above(card(0, 0, 80), card(0, 0, 79))).toBe(true);
    // …and finally to the id, so two birds with no career at all still order
    // the same way every time they are read.
    expect(above(card(0, 0, 0), card(0, 0, 0), "aaa", "bbb")).toBe(true);
    expect(above(card(0, 0, 0), card(0, 0, 0), "bbb", "aaa")).toBe(false);
  });

  test("a full field sorted twice comes out identical", () => {
    // Sixteen identical unraced birds — the degenerate case the id tiebreak
    // exists for. Sorting is stable in bun, so this can only fail if the
    // comparator returns 0 somewhere and the ARRAY order changes underneath.
    const ids = Array.from({ length: 16 }, (_, i) => `bird-${i}`);
    const sort = (list: string[]) =>
      [...list].sort((a, b) => Tournaments.compareRank(card(0, 0, 0), card(0, 0, 0), a, b));
    expect(sort(ids)).toEqual(sort([...ids].reverse()));
  });
});

describe("the crown-day resolution", () => {
  test("a 4-bird bracket runs start to finish: crowns, retirements, purse, land — GP exact", () => {
    const w = world();
    w.dev.enter(byName(w.db, w.devFlock, "Sinag").id, "b1");
    w.dev.enter(byName(w.db, w.devFlock, "Batong Buhay").id, "b1");
    w.rival.enter("rival-7", "b1");
    w.rival.enter("rival-8", "b1");
    const before = totalCents(w.db);

    const tick = tickThroughCrownDay(w.game);
    expect(tick.pintakasi.length).toBe(1);
    const result = tick.pintakasi[0];
    expect(result.cancelled).toBe(false);
    expect(result.bracketSize).toBe(4);
    expect(result.rounds.map((r) => r.name)).toEqual(["Semifinals", "Final"]);
    expect(result.rounds[0].fights.length).toBe(2);
    expect(result.rounds[1].fights.length).toBe(1);
    expect(result.champion).not.toBeNull();

    // Hardcore throughout: three fell and retired, the champion fights on.
    const all = w.db.select().from(birds).all();
    const retiredHc = all.filter((b) => b.retiredBy === "hardcore");
    expect(retiredHc.length).toBe(3);
    const champ = all.find((b) => b.name === result.champion!.bird)!;
    expect(champ.status).toBe("active");

    // GP to the top: purse = 800 GP of entries + the juice pool, which the
    // world seeds at genesis (round 20) and this lone running crown takes in
    // full. In a 4-bracket the SF losers lost their only fight, so under the
    // round-40 purse they have no win weight and no bonus — two payouts, and
    // the champion (weight 3 of 4, plus the trophy) takes most of it. The
    // exact split is pinned in "the worked bracket, to the cent" below.
    expect(result.purseCents).toBe(4 * PINTAKASI.ENTRY_FEE * 100 + ECONOMY.SEED_JUICE * 100);
    const paid = result.payouts.reduce((s, p) => s + p.gpCents, 0);
    expect(paid).toBe(result.purseCents); // dust included, nothing stranded
    expect(result.payouts.length).toBe(2); // champion + runner-up only
    const champPay = result.payouts.find((p) => p.stage === "champion")!;
    expect(champPay.gpCents).toBeGreaterThan(result.purseCents / 2);
    expect(totalCents(w.db)).toBe(before); // conservation to the cent

    // Land to the fallen: first-round dead (sf stage in a 4-bracket) out-grant
    // the runner-up, who out-grants the champion.
    const entries = w.db.select().from(tournamentEntries).all();
    const grants = entries.map((e) => e.landGranted).sort((a, b) => a - b);
    expect(grants).toEqual([
      PINTAKASI.LAND_GRANTS.champion,
      PINTAKASI.LAND_GRANTS.runnerUp,
      PINTAKASI.LAND_GRANTS.sf,
      PINTAKASI.LAND_GRANTS.sf,
    ]);

    // The log: two mirrored hardcore rows per fight, tournament-tagged.
    const rows = w.db.select().from(battleLog).all().filter((r) => r.tournamentId !== null);
    expect(rows.length).toBe(6);
    expect(rows.every((r) => r.lobbyId === null && r.mode === "hardcore" && r.gpDeltaCents === 0)).toBe(
      true
    );
  });

  test("byes go to the top seeds; a 3-bird field fights twice", () => {
    const w = world();
    w.dev.enter(byName(w.db, w.devFlock, "Sinag").id, "b5");
    w.dev.enter(byName(w.db, w.devFlock, "Batong Buhay").id, "b5");
    w.rival.enter("rival-7", "b5");
    const result = tickThroughCrownDay(w.game).pintakasi[0];
    expect(result.bracketSize).toBe(4);
    expect(result.rounds[0].byes.length).toBe(1);
    expect(result.rounds[0].fights.length).toBe(1);
    expect(result.rounds[1].fights.length).toBe(1);
    // The bye went to the committee's top seed — Batong Buhay (7 wins).
    expect(result.rounds[0].byes[0]).toBe("Batong Buhay");
  });

  test("a field of one cancels: refund, bird unharmed, championship marked", () => {
    const w = world();
    const sinag = byName(w.db, w.devFlock, "Sinag");
    const before = totalCents(w.db);
    w.dev.enter(sinag.id, "b1");
    const tick = tickThroughCrownDay(w.game);
    const result = tick.pintakasi[0];
    expect(result.cancelled).toBe(true);
    expect(totalCents(w.db)).toBe(before);
    expect(w.db.select().from(birds).where(eq(birds.id, sinag.id)).get()!.status).toBe("active");
    expect(
      w.db.select().from(tournaments).all().find((t) => t.format === "b1")!.status
    ).toBe("cancelled");
  });

  test("the juice pool drains into the purse — champion takes all in a straight final", () => {
    const w = world();
    w.db.update(gameState).set({ juicePoolCents: 30_000 }).where(eq(gameState.id, 1)).run();
    w.dev.enter(byName(w.db, w.devFlock, "Sinag").id, "b1");
    w.rival.enter("rival-7", "b1");
    const before = totalCents(w.db);
    const result = tickThroughCrownDay(w.game).pintakasi[0];
    // One championship ran — it takes the WHOLE week's juice.
    expect(result.purseCents).toBe(2 * PINTAKASI.ENTRY_FEE * 100 + 30_000);
    // A 2-bracket's runner-up is a first-round loser: zero GP, champion sweeps.
    expect(result.payouts.length).toBe(1);
    expect(result.payouts[0].gpCents).toBe(result.purseCents);
    expect(
      w.db.select().from(gameState).where(eq(gameState.id, 1)).get()!.juicePoolCents
    ).toBe(0);
    expect(totalCents(w.db)).toBe(before);
  });

  test("a registrant that died before crown day is refunded at close", () => {
    const w = world();
    const sinag = byName(w.db, w.devFlock, "Sinag");
    w.dev.enter(sinag.id, "b1");
    w.rival.enter("rival-7", "b1");
    w.rival.enter("rival-8", "b1");
    // Sinag falls in a Monday hardcore — the crown never comes.
    w.db
      .update(birds)
      .set({ status: "retired", retiredBy: "hardcore", retiredWeek: 0 })
      .where(eq(birds.id, sinag.id))
      .run();
    const result = tickThroughCrownDay(w.game).pintakasi[0];
    expect(result.field).toBe(2); // the two rivals fought it out
    const entry = w.db
      .select()
      .from(tournamentEntries)
      .all()
      .find((e) => e.birdId === sinag.id)!;
    expect(entry.status).toBe("refunded");
  });

  test("a week jump (Fri → Fri) crosses crown day and resolves exactly once", () => {
    const w = world();
    w.dev.enter(byName(w.db, w.devFlock, "Sinag").id, "b1");
    w.rival.enter("rival-7", "b1");
    const tick = w.game.tickWeek();
    expect(tick.pintakasi.length).toBe(1);
    expect(tick.pintakasi[0].champion).not.toBeNull();
    expect(
      w.db.select().from(tournaments).all().filter((t) => t.status === "completed").length
    ).toBe(1);
  });

  test("crown day's lobby door refuses a Pintakasi registrant — its crown is its card", () => {
    const w = world();
    const bb = byName(w.db, w.devFlock, "Batong Buhay");
    w.dev.enter(bb.id, "b1");
    const lobbies = new Lobbies(w.db, w.devId);
    // Monday: the registrant fights normal cards freely (entry succeeds).
    for (let i = 0; i < 3; i++) w.game.tickDay(); // → day 3 (Monday)
    lobbies.enter(bb.id, onCard(w.db, { mode: "real", classType: "open" }));
    for (let i = 0; i < 3; i++) w.game.tickDay(); // → day 6 (Thursday, crown day)
    expect(() =>
      lobbies.enter(bb.id, onCard(w.db, { mode: "real", classType: "open" }))
    ).toThrow(/Pintakasi/);
  });
});

/**
 * THE PURSE PAYS FOR FIGHTS WON (round 40).
 *
 * Zane: "Every round should pay the winners something, even if the winners get
 * to continue on towards championship contention."
 *
 * What these tests are guarding against is a REVERSION, and the shape of the
 * reversion is specific: the old purse was a table of shares by finishing
 * stage, and it paid 8 birds out of 31 in a 32-bracket. A bird could win a
 * hardcore Major fight — the hardest fight in the game, its own career on the
 * line — and be paid nothing for it. Everything below is written so that the
 * OLD table and the new rule disagree, because a purse test that both versions
 * pass is a purse test that proves nothing.
 *
 * Properties over figures wherever possible: the three knobs are balance dials
 * and moving one should not rewrite this file. Exactly one bracket is pinned
 * to the cent (the 4-bird case), and it is pinned because SOMETHING has to
 * catch an arithmetic slip that keeps every property true — a purse that
 * settles exactly, orders correctly, and is simply the wrong size.
 */
describe("the purse is paid on fights won", () => {
  /**
   * A championship with a PINNED SEED and a field of identical dummies.
   *
   * Two reasons this doesn't go through `enter`. The seed a tournament opens
   * with is `freshSeed()` — wall-clock random on a world nobody called
   * `seedWorld` on — so who wins which bracket fight is genuinely different
   * every run, and a purse test has to know the bracket's SHAPE to say
   * anything about it. And `enter` enforces MAX_PER_BARN, which caps a
   * two-barn fixture at six birds; the interesting cases here are 8 and 32.
   *
   * The birds are stat-identical on purpose: the winner of each fight is then
   * purely the seeded rng's business, so these tests never depend on the fight
   * model and don't have to be re-rolled when it changes.
   */
  function pinnedBracket(
    w: ReturnType<typeof world>,
    opts: {
      size: number;
      juiceCents: number;
      format?: FightFormat;
      division?: "major" | "juvenile";
      seed?: number;
      /** Per-bird overrides — used only to build the two bye cases below. */
      each?: (i: number) => Partial<NewBird>;
    }
  ) {
    const division = opts.division ?? "major";
    w.db
      .update(gameState)
      .set({ juicePoolCents: opts.juiceCents })
      .where(eq(gameState.id, 1))
      .run();
    const field: ReturnType<typeof makeBird>[] = [];
    const t = w.db
      .insert(tournaments)
      .values({
        weekIndex: 0,
        format: opts.format ?? (division === "juvenile" ? "b2" : "b1"),
        division,
        seed: opts.seed ?? 4242,
        entryFee: 0, // free since round 22 — so the purse is pure juice, and known
      })
      .returning()
      .get();
    for (let i = 0; i < opts.size; i++) {
      // Alternating barns: matchmaking inside a bracket is seeding, not
      // pairing, so this changes nothing — it just keeps the fixture honest
      // about a championship being a contest between stables.
      const bird = makeBird(w.db, {
        farmId: i % 2 === 0 ? w.devId : w.rivalId,
        age: division === "juvenile" ? 1 : 3,
        ...(opts.each?.(i) ?? {}),
      });
      w.db
        .insert(tournamentEntries)
        .values({
          tournamentId: t.id,
          birdId: bird.id,
          farmId: bird.farmId,
          fee: 0,
          dayEntered: 0,
        })
        .run();
      field.push(bird);
    }
    return { t, field };
  }

  /**
   * Tick the whole week and collect EVERY championship it resolved.
   *
   * `tickThroughCrownDay` returns the last tick's view, which is fine for the
   * Majors (Thursday is the last day of the week) and drops the Juvenile
   * Championship on the floor — it runs on Wednesday, one tick earlier.
   */
  function crownResults(game: Game) {
    const all = [];
    for (let i = 0; i < 7; i++) all.push(...game.tickDay().pintakasi);
    return all;
  }

  /** Every bird that won at least one fight, by name. */
  const fightWinners = (r: ReturnType<typeof tickThroughCrownDay>["pintakasi"][number]) =>
    new Set(r.rounds.flatMap((round) => round.fights.map((f) => f.winner)));

  const paidTo = (r: ReturnType<typeof tickThroughCrownDay>["pintakasi"][number], bird: string) =>
    r.payouts.find((p) => p.bird === bird)?.gpCents ?? 0;

  test("NOBODY who won a fight goes home with nothing — and nobody who didn't is paid", () => {
    const w = world();
    pinnedBracket(w, { size: 32, juiceCents: 500_000 });
    const before = totalCents(w.db);
    const result = tickThroughCrownDay(w.game).pintakasi[0];
    expect(result.bracketSize).toBe(32);

    // 31 fights across five rounds, won between 16 birds — half the field wins
    // at least once, and every one of those sixteen is owed money. That is the
    // round, in one loop.
    const winners = fightWinners(result);
    expect(result.rounds.reduce((s, r) => s + r.fights.length, 0)).toBe(31);
    expect(winners.size).toBe(16);
    for (const name of winners) expect(paidTo(result, name)).toBeGreaterThan(0);
    // …and the converse, which is the rule the old `round > 1` clause used to
    // spell out by hand: a bird that lost its only fight is paid nothing.
    expect(result.payouts.length).toBe(winners.size);

    // THE ASSERTION THE OLD TABLE FAILS. A bird eliminated in the round of 16
    // won its round-of-32 fight; the stage table stopped paying below the
    // quarterfinal, so all eight of these were zeroes. They are equal to each
    // other, too — one win in one round is one win in one round, whoever it
    // belonged to.
    const r16 = result.payouts.filter((p) => p.stage === "round of 16");
    expect(r16.length).toBe(8);
    expect(new Set(r16.map((p) => p.gpCents)).size).toBe(1);
    expect(r16[0].gpCents).toBeGreaterThan(0);

    // Settles to the cent, with the dust on the champion (the doctor's
    // "purses settle" invariant, pinned here at unit level too).
    expect(result.payouts.reduce((s, p) => s + p.gpCents, 0)).toBe(result.purseCents);
    expect(totalCents(w.db)).toBe(before);
  });

  test("…even on a purse thin enough that the shares round to nothing", () => {
    // ⚠ THE PROMISE HAD A TRAPDOOR, found by the round's own test pass rather
    // than by anything failing. A shallow win in a big bracket is a very small
    // FRACTION, and `Math.floor` of a very small fraction of a very small
    // purse is zero — at which point `payPurse` skips the row entirely and the
    // bird that won a hardcore championship fight is back to going home with
    // nothing. Nothing else in the project would notice: the purse still
    // settles exactly, because the champion absorbs the remainder, so the
    // conservation proof stays green while the rule quietly stops being true.
    //
    // 3.00 GP over a 64-bracket is far below anything a real world produces
    // (a Major purse runs a thousand times this) and that is the point — the
    // rule has to hold where it is inconvenient, not only where it is easy.
    const w = world();
    pinnedBracket(w, { size: 64, juiceCents: 300 });
    const before = totalCents(w.db);
    const result = tickThroughCrownDay(w.game).pintakasi[0];
    expect(result.bracketSize).toBe(64);

    const winners = fightWinners(result);
    expect(winners.size).toBe(32);
    for (const name of winners) expect(paidTo(result, name)).toBeGreaterThan(0);
    expect(result.payouts.length).toBe(winners.size);
    // A cent is the floor, so the smallest take is exactly that — and the
    // books still balance to it.
    expect(Math.min(...result.payouts.map((p) => p.gpCents))).toBe(1);
    expect(result.payouts.reduce((s, p) => s + p.gpCents, 0)).toBe(result.purseCents);
    expect(totalCents(w.db)).toBe(before);
  });

  test("…and below even that, it degrades honestly instead of overdrawing", () => {
    // A purse smaller than one cent per winner. There is no arithmetic that
    // keeps the promise here, so the floor stands down rather than paying out
    // money the purse does not hold: the deepest winners take what there is,
    // the champion still settles the remainder, and the books still balance.
    // Pinned because the tempting "fix" — floor everyone regardless — prints
    // GP, which is the one thing this codebase never does.
    const w = world();
    pinnedBracket(w, { size: 64, juiceCents: 5 });
    const before = totalCents(w.db);
    const result = tickThroughCrownDay(w.game).pintakasi[0];
    expect(result.purseCents).toBe(5);
    expect(result.payouts.length).toBeGreaterThan(0);
    expect(result.payouts.reduce((s, p) => s + p.gpCents, 0)).toBe(5);
    expect(totalCents(w.db)).toBe(before);
  });

  test("a deeper win is worth more — the ladder is strictly increasing, every rung", () => {
    // The doubling (a win in round r scores 2^(r-1)) exists so that each round
    // hands out the SAME total across half as many birds. The visible
    // consequence, and the one a player would notice if it broke, is that the
    // stage ladder never flattens or inverts: two more wins is always worth
    // more than one more win, whatever the knobs are set to.
    const w = world();
    pinnedBracket(w, { size: 32, juiceCents: 500_000 });
    const result = tickThroughCrownDay(w.game).pintakasi[0];
    const at = (stage: string) => result.payouts.find((p) => p.stage === stage)!.gpCents;
    const ladder = ["round of 16", "quarterfinal", "semifinal", "runner-up", "champion"];
    const paid = ladder.map(at);
    for (let i = 1; i < paid.length; i++) expect(paid[i]).toBeGreaterThan(paid[i - 1]);
    // The champion still takes the biggest single share by a wide margin — the
    // point of the round was to stop paying the deep field ZERO, not to turn
    // the Pintakasi into a participation prize.
    expect(at("champion")).toBeGreaterThan(result.purseCents / 3);
  });

  /**
   * A 3-bird field is the smallest bracket with a bye in it: the committee's
   * top seed walks into the final while the other two fight for the right to
   * meet it. Both cases below build that field the same way — bird 0 is given
   * career earnings so the committee seeds it first and the bye is HIS, not
   * whichever id happened to sort lowest — and then differ only in whether he
   * can fight when he finally has to.
   */
  const byeField = (w: ReturnType<typeof world>, topSeedStat: number, restStat: number) => {
    const across = (v: number) => ({
      agility: v, sight: v, stamina: v, gameness: v, station: v, condition: v,
    });
    const { field } = pinnedBracket(w, {
      size: 3,
      juiceCents: 100_000,
      each: (i) => across(i === 0 ? topSeedStat : restStat),
    });
    earned(w.db, field[0].id, field[0].farmId, 10_000); // → committee rank 1 → the bye
    return field[0];
  };

  test("A BYE IS NOT A WIN — the top seed is paid for the final, never for the round it skipped", () => {
    // Weight accrues only where a blade was actually thrown, so this bracket's
    // total weight is 3 (one first-round win, one final win) and NOT 4.
    //
    // The arithmetic is worked out here because it is the number that would
    // change — quietly, and in the champion's favour — if the bye branches in
    // `runChampionship` ever started crediting weight:
    //
    //   champion:  0.5 × 2/3 + 0.35 = 0.6833…  → 68,334 of 100,000 cents
    //   finalist:  0.5 × 1/3 + 0.15 = 0.3166…  → 31,666
    //
    // If the bye counted as a win it would be 72,500 / 27,500 — over 40 GP
    // moved between two barns for a fight nobody had.
    const w = world();
    // ⚠ THE GAP HAS TO BE BIG, and the first draft learned it the hard way. A
    // 300-vs-5 mismatch is not a certainty at B1 — the weak bird takes it
    // about 2% of the time — and the pinned seed landed on exactly one of
    // those, so the "top seed wins the final" branch failed on a fixture that
    // looked overwhelming. 900 against 300 measures zero upsets in 2,000
    // seeds at every blade, which is the standard a bracket test needs: it
    // must not be the fight model's opinion that decides whether a PURSE test
    // passes.
    const topSeed = byeField(w, 900, 300); // …and strong enough to finish the job
    const result = tickThroughCrownDay(w.game).pintakasi[0];
    expect(result.bracketSize).toBe(4);
    expect(result.rounds[0].byes).toEqual([topSeed.name]);
    expect(result.champion!.bird).toBe(topSeed.name);

    expect(result.purseCents).toBe(100_000);
    expect(paidTo(result, topSeed.name)).toBe(68_334);
    expect(result.payouts.find((p) => p.stage === "runner-up")!.gpCents).toBe(31_666);
    expect(result.payouts.reduce((s, p) => s + p.gpCents, 0)).toBe(result.purseCents);
  });

  test("…and a bye into a LOST final is worth nothing at all — no win, no money", () => {
    // The sharper leg of the same rule, and the one most likely to be "fixed"
    // by somebody who finds it harsh. The same top seed, now overmatched: it
    // takes its bye, loses the final, and has therefore won nothing all night
    // — so it is paid nothing, RUNNER-UP BONUS INCLUDED.
    //
    // That is deliberate and it is round 18's ruling still standing: a
    // placement bonus rides on top of what a bird won, never instead of it.
    // The alternative pays a bird that never fought a soul for finishing
    // second in a field of three. With its share gone, the remaining shares
    // renormalize and the champion takes the whole purse — the same arithmetic
    // that makes a straight final a clean sweep.
    const w = world();
    const topSeed = byeField(w, 5, 900); // a bye, and no chance in the final
    const result = tickThroughCrownDay(w.game).pintakasi[0];
    expect(result.rounds[0].byes).toEqual([topSeed.name]);
    expect(result.champion!.bird).not.toBe(topSeed.name);
    expect(paidTo(result, topSeed.name)).toBe(0);
    expect(result.payouts.length).toBe(1);
    expect(result.payouts[0].stage).toBe("champion");
    expect(result.payouts[0].gpCents).toBe(100_000);
  });

  test("the worked bracket, to the cent: four birds, a 1,000 GP purse, 725/275", () => {
    // THE ONE PINNED ARITHMETIC IN THE FILE. Four birds is the smallest
    // bracket with a round to be deeper than, so both terms of the formula are
    // live and neither cancels:
    //
    //   champion:  0.5 × 3/4 + 0.35 = 0.7250  → 72,500 of 100,000 cents
    //   runner-up: 0.5 × 1/4 + 0.15 = 0.2750  → 27,500
    //
    // (Weights: the champion won a semifinal worth 1 and a final worth 2; the
    // runner-up won a semifinal worth 1; the two first-round losers won
    // nothing. Total 4.) The knobs sum to 1 and every seat is filled, so the
    // normalization is the identity here — which is exactly why this is the
    // case worth pinning: any difference is the formula being wrong, not the
    // renormalizer covering for it.
    const w = world();
    pinnedBracket(w, { size: 4, juiceCents: 100_000 });
    const before = totalCents(w.db);
    const result = tickThroughCrownDay(w.game).pintakasi[0];
    expect(result.purseCents).toBe(100_000);
    expect(result.payouts.length).toBe(2); // the SF losers lost their only fight
    expect(result.payouts.find((p) => p.stage === "champion")!.gpCents).toBe(72_500);
    expect(result.payouts.find((p) => p.stage === "runner-up")!.gpCents).toBe(27_500);
    expect(totalCents(w.db)).toBe(before);
  });

  test("the juvenile split is FLATTER — the same bracket pays the early rounds better", () => {
    // The discovery year is trying to buy a different behaviour from the
    // Majors: showing up with a live one and winning a fight should pay a
    // juvenile barn, because that is the whole point of a discovery stage. So
    // JUVENILE_MAJOR.PURSE puts more on ADVANCEMENT (0.65 vs 0.5) and less on
    // the trophy — and the two divisions must not be able to drift back into
    // each other unnoticed.
    //
    // Compared as FRACTIONS of each division's own purse, because the two
    // pools are different sizes by design (the juveniles take JUICE_SHARE and
    // the Majors take the rest). Same bracket size, same seed: only the
    // charter differs.
    const majorWorld = world();
    pinnedBracket(majorWorld, { size: 8, juiceCents: 400_000 });
    const major = tickThroughCrownDay(majorWorld.game).pintakasi[0];

    const juvWorld = world();
    pinnedBracket(juvWorld, { size: 8, juiceCents: 400_000, division: "juvenile" });
    const juvenile = crownResults(juvWorld.game)[0];

    expect(major.bracketSize).toBe(8);
    expect(juvenile.bracketSize).toBe(8);
    expect(juvenile.purseCents).toBe(Math.floor(400_000 * JUVENILE_MAJOR.JUICE_SHARE));

    const shareAt = (r: typeof major, stage: string) =>
      r.payouts.find((p) => p.stage === stage)!.gpCents / r.purseCents;
    // A semifinalist in an 8-bracket won exactly one fight — the early-round
    // winner the flatter split is FOR. It takes a bigger slice of the juvenile
    // purse than of the Major one…
    expect(shareAt(juvenile, "semifinal")).toBeGreaterThan(shareAt(major, "semifinal"));
    // …and the juvenile champion, correspondingly, a smaller one.
    expect(shareAt(juvenile, "champion")).toBeLessThan(shareAt(major, "champion"));
    // Both still settle exactly, and both still crown the biggest earner.
    for (const r of [major, juvenile]) {
      expect(r.payouts.reduce((s, p) => s + p.gpCents, 0)).toBe(r.purseCents);
      expect(shareAt(r, "champion")).toBeGreaterThan(shareAt(r, "runner-up"));
    }
    // The juvenile crown is NOT hardcore — nobody's career ended tonight. It
    // sits here because it is the other half of "the discovery year pays
    // early": paying a chick for a first-round win would mean very little if
    // the win could still cost it everything.
    expect(juvWorld.db.select().from(birds).all().every((b) => b.retiredBy !== "hardcore")).toBe(true);
  });
});

/**
 * THE JUVENILE CROWN CHASE (round 32) — every chick declares for one crown
 * BEFORE anybody is sent anywhere.
 *
 * The bug this replaces was invisible in the code and glaring in the data.
 * `chaseJuvenileCrowns` looped the week's blades on the OUTSIDE and sent up to
 * MAX_PER_BARN birds to each in turn; because a bird may hold only one
 * championship entry a week (`enter` above), whichever blade sat first in
 * JUVENILE_MAJOR.BLADES took every barn's best juveniles and the other one got
 * the leftovers. Measured across the round-31 sim: fields of 16-27 at the first
 * blade against 1-8 at the second, with nothing about the birds causing it.
 *
 * So these tests are about ITERATION ORDER, not about birds. Each one is built
 * so that the OLD loop and the new one disagree on where a barn's chicks end
 * up, which is the only way to pin a fix whose output is otherwise identical.
 */
describe("the juvenile crown chase declares before it sends", () => {
  // The order the old loop walked — `first` is the blade that used to win
  // every argument simply by being checked first.
  const [first, second] = Tournaments.juvenileBladesOfWeek(0);

  /** A named, qualified age-1 chick in the dev barn — nothing else. */
  const chick = (db: DB, name: string) =>
    makeBird(db, { name, age: 1, wins: JUVENILE_MAJOR.QUALIFYING_WINS });

  /**
   * Teach the scout that this bird is good at one blade. Figures are the ONLY
   * thing a stable may read since the fog came down (round 28), so a battle-log
   * history at a blade is the whole of "reads better there". Both grades are
   * pinned to the scout's own reference so `normalizedScoutFigure` is the
   * identity and the arithmetic stays legible: MIN_READS figures of `figure`
   * against a prior of PRIOR_FIGURE.
   */
  function readsWellAt(db: DB, farmId: string, birdId: string, format: FightFormat, figure = 90) {
    for (let i = 0; i < SCOUT.MIN_READS; i++) {
      db.insert(battleLog)
        .values({
          dayIndex: i, lobbyId: 1, farmId, birdId,
          mode: "juvenile", format,
          opponentBirdId: "ghost", opponentFarmId: "house", opponentName: "Sparring Ghost",
          selfGrade: SCOUT.REFERENCE_GRADE, opponentGrade: SCOUT.REFERENCE_GRADE,
          side: 0, result: "win", pitFigure: figure, gpDeltaCents: 0, seed: i,
        })
        .run();
    }
  }

  /** How many of this barn's birds are standing in one juvenile crown. */
  const fieldAt = (db: DB, farmId: string, format: FightFormat) => {
    const ids = db
      .select()
      .from(tournaments)
      .all()
      .filter((t) => t.division === "juvenile" && t.format === format)
      .map((t) => t.id);
    return db
      .select()
      .from(tournamentEntries)
      .all()
      .filter((e) => e.status === "pending" && e.farmId === farmId && ids.includes(e.tournamentId))
      .length;
  };

  test("a barn whose chicks read better at the SECOND blade sends them there", () => {
    const w = world();
    // Three qualified juveniles, every one of them a clear read at the blade
    // the old loop checked LAST. Three rather than two so the barn also has to
    // overflow: MAX_PER_BARN seats two, and the third has nowhere to go at its
    // declared crown.
    for (const name of ["Alon", "Bagyo", "Sigwa"]) {
      const row = chick(w.db, name);
      readsWellAt(w.db, w.devId, row.id, second);
    }
    const entered = chaseJuvenileCrowns(w.db, w.devId, 0);
    expect(entered.length).toBe(3);

    // THE ASSERTION THAT FAILS AGAINST THE OLD LOOP: the crown they read best
    // at gets the barn's full allowance, and the leftover — not the best two —
    // is what lands in the other bracket. The old code returned exactly the
    // mirror image of this, and for no reason except array order.
    expect(fieldAt(w.db, w.devId, second)).toBe(JUVENILE_MAJOR.MAX_PER_BARN);
    expect(fieldAt(w.db, w.devId, first)).toBe(3 - JUVENILE_MAJOR.MAX_PER_BARN);
  });

  test("…and the overflow really is the WEAKEST read, not whoever was first in the list", () => {
    // The same shape as above, but the three chicks are separable: the second
    // pass must be seating the bird with the poorest figures at that blade.
    const w = world();
    const ranked = [
      ["Tanikala", 95],
      ["Balaraw", 85],
      ["Pungdol", 60],
    ] as const;
    for (const [name, figure] of ranked) {
      const row = chick(w.db, name);
      readsWellAt(w.db, w.devId, row.id, second, figure);
    }
    chaseJuvenileCrowns(w.db, w.devId, 0);
    const secondIds = w.db
      .select()
      .from(tournaments)
      .all()
      .filter((t) => t.division === "juvenile" && t.format === second)
      .map((t) => t.id);
    const seatedAtSecond = w.db
      .select()
      .from(tournamentEntries)
      .all()
      .filter((e) => e.status === "pending" && secondIds.includes(e.tournamentId))
      .map((e) => w.db.select().from(birds).where(eq(birds.id, e.birdId)).get()!.name);
    expect(seatedAtSecond.sort()).toEqual(["Balaraw", "Tanikala"]);
  });

  test("chicks that read the two crowns DEAD EVEN split across both", () => {
    // A true B3 bird reads B2 and B4 identically and there is no crown at B3 to
    // send it to — Zane called that a won't-solve and ruled the chick simply
    // opts into one of the two on the data it has. So the tie-break spreads
    // round-robin by index instead of falling to the first blade, which would
    // rebuild the very imbalance this round removed.
    //
    // Two unraced chicks read EVERY blade at the prior, so this is the tie in
    // its purest form — and the old loop would have put both of them in the
    // first crown, since MAX_PER_BARN has room for two.
    const w = world();
    chick(w.db, "Ulap");
    chick(w.db, "Hangin");
    expect(JUVENILE_MAJOR.MAX_PER_BARN).toBeGreaterThanOrEqual(2); // …or the split proves nothing

    const entered = chaseJuvenileCrowns(w.db, w.devId, 0);
    expect(entered.length).toBe(2);
    expect(fieldAt(w.db, w.devId, first)).toBe(1);
    expect(fieldAt(w.db, w.devId, second)).toBe(1);
  });

  test("a chick short of its qualifying wins never declares at all", () => {
    // The declaration pass runs before any entry is attempted, so it is now
    // possible to declare a bird the door would refuse and then quietly lose
    // it in a catch. Pin that the gate is still checked up front: an unqualified
    // chick is not merely unseated, it does not consume a declaration slot that
    // a qualified barn-mate could have used.
    const w = world();
    const short = makeBird(w.db, {
      name: "Mumunti",
      age: 1,
      wins: JUVENILE_MAJOR.QUALIFYING_WINS - 1,
    });
    readsWellAt(w.db, w.devId, short.id, second);
    for (const name of ["Liwayway", "Tala", "Bituin"]) {
      const row = chick(w.db, name);
      readsWellAt(w.db, w.devId, row.id, second);
    }
    const entered = chaseJuvenileCrowns(w.db, w.devId, 0);
    expect(entered).not.toContain("Mumunti");
    expect(entered.length).toBe(3);
    expect(fieldAt(w.db, w.devId, second)).toBe(JUVENILE_MAJOR.MAX_PER_BARN);
  });
});
