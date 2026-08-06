import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/db/client";
import { battleLog, birds, farms, gameState, tournamentEntries, tournaments } from "@/db/schema";
import { seedGame, seedStarterFlock } from "@/db/seed-data";
import { chaseCrowns, chaseJuvenileCrowns } from "./bots";
import { ECONOMY, JUVENILE_MAJOR, PINTAKASI, SCOUT, type FightFormat } from "./config";
import { Flock } from "./flock";
import { mulberry32 } from "./rng";
import { Game } from "./game";
import { Lobbies } from "./lobbies";
import { makeBird, onCard } from "./testkit";
import { Tournaments } from "./tournaments";

/** Two legacy farms — each carries two age-3+ birds (Sinag 3, Batong Buhay 5). */
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
  // The crowns are free since round 22 but NOT open — a bird qualifies by
  // campaigning on the daily card. These legacy veterans are meant to have
  // done exactly that, so stamp them qualified rather than making every
  // fixture fight its way in. (The gate itself is tested separately.)
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

const byName = (db: DB, flock: Flock, name: string) =>
  flock.all().find((b) => b.name === name)!;

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

  // ── Round 22: the crowns are FREE, and you qualify by fighting ───────────
  test("the crowns cost nothing — and an unqualified bird is turned away at the door", () => {
    const w = world();
    expect(PINTAKASI.ENTRY_FEE).toBe(0);
    const sinag = byName(w.db, w.devFlock, "Sinag");
    // Strip its campaign: a veteran that never won a real fight can't stand.
    w.db.update(birds).set({ crownPoints: 0 }).where(eq(birds.id, sinag.id)).run();
    expect(() => w.dev.enter(sinag.id, "b1")).toThrow(/qualification points/);
    // One point short still isn't enough…
    w.db
      .update(birds)
      .set({ crownPoints: PINTAKASI.QUALIFYING_POINTS - 1 })
      .where(eq(birds.id, sinag.id))
      .run();
    expect(() => w.dev.enter(sinag.id, "b1")).toThrow(/qualification points/);
    // …and the wallet is untouched either way, because entry is free.
    const before = w.db.select().from(farms).where(eq(farms.id, w.devId)).get()!.gp;
    w.db
      .update(birds)
      .set({ crownPoints: PINTAKASI.QUALIFYING_POINTS })
      .where(eq(birds.id, sinag.id))
      .run();
    w.dev.enter(sinag.id, "b1");
    expect(w.db.select().from(farms).where(eq(farms.id, w.devId)).get()!.gp).toBe(before);
  });

  test("the committee ranks on POINTS first — campaigning beats a fat wallet", () => {
    const w = world();
    const sinag = byName(w.db, w.devFlock, "Sinag");
    w.db.update(birds).set({ crownPoints: 99 }).where(eq(birds.id, sinag.id)).run();
    w.dev.enter(sinag.id, "b1");
    w.rival.enter("rival-8", "b1"); // more career wins, fewer points
    const lk = w.dev.board().find((c) => c.format === "b1")!;
    expect(lk.field[0].bird).toBe("Sinag"); // points lead the ranking now
    expect(lk.field[0].rank).toBe(1);
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
    w.db.update(birds).set({ crownPoints: PINTAKASI.QUALIFYING_POINTS }).run(); // campaigned veterans
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

  test("a full field bumps its weakest for a stronger newcomer — and refuses a weaker one", () => {
    const w = world();
    const t = w.db
      .insert(tournaments)
      .values({ weekIndex: 0, format: "b1", seed: 7, entryFee: PINTAKASI.ENTRY_FEE })
      .returning()
      .get();
    // A full 64-bird field of zero-record dummies under the rival's banner.
    for (let i = 0; i < PINTAKASI.MAX_BRACKET; i++) {
      w.db
        .insert(birds)
        .values({
          id: `dummy-${String(i).padStart(2, "0")}`,
          farmId: w.rivalId,
          name: `Dummy ${i}`,
          sex: "male",
          status: "active",
          agility: 300, sight: 300, stamina: 300, gameness: 300, station: 300, condition: 300,
          element: "Fire",
          halfStars: 2,
          birthWeek: -3,
          birthDay: -21,
          named: 1,
          // Round 22: QUALIFICATION POINTS lead the committee's ranking, so
          // the dummies campaigned one point harder than the newcomer below.
          crownPoints: PINTAKASI.QUALIFYING_POINTS + 1,
        })
        .run();
      w.db
        .insert(tournamentEntries)
        .values({
          tournamentId: t.id,
          birdId: `dummy-${String(i).padStart(2, "0")}`,
          farmId: w.rivalId,
          fee: PINTAKASI.ENTRY_FEE,
          dayEntered: 0,
        })
        .run();
    }
    const rivalGpBefore = w.db.select().from(farms).where(eq(farms.id, w.rivalId)).get()!.gp;
    // Sinag campaigned harder than the dummies did — and points lead the
    // committee's ranking since round 22, so it outranks every one of them
    // and the weakest goes home.
    const sinagId = byName(w.db, w.devFlock, "Sinag").id;
    w.db
      .update(birds)
      .set({ crownPoints: PINTAKASI.QUALIFYING_POINTS + 5 })
      .where(eq(birds.id, sinagId))
      .run();
    w.dev.enter(sinagId, "b1");
    const entries = w.db
      .select()
      .from(tournamentEntries)
      .where(eq(tournamentEntries.tournamentId, t.id))
      .all();
    expect(entries.filter((e) => e.status === "pending").length).toBe(PINTAKASI.MAX_BRACKET);
    expect(entries.filter((e) => e.status === "bumped").length).toBe(1);
    expect(w.db.select().from(farms).where(eq(farms.id, w.rivalId)).get()!.gp).toBe(
      rivalGpBefore + PINTAKASI.ENTRY_FEE // the bumped entry refunds
    );
    // A zero-record newcomer is itself the weakest — refused at the door.
    w.db
      .insert(birds)
      .values({
        id: "zzz-weak", farmId: w.devId, name: "Palpak", sex: "male", status: "active",
        agility: 300, sight: 300, stamina: 300, gameness: 300, station: 300, condition: 300,
        element: "Fire", halfStars: 2, birthWeek: -3, birthDay: -21, named: 1,
        // Qualified on points, so the COMMITTEE is what turns it away — not
        // the round-22 door. Zero earnings is what makes it the weakest.
        crownPoints: PINTAKASI.QUALIFYING_POINTS,
      })
      .run();
    expect(() => w.dev.enter("zzz-weak", "b1")).toThrow(/weakest/);
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
    // full. In a 4-bracket the SF losers fell in round one — zero GP;
    // champion 5/7, runner-up 2/7.
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
          result: "win", pitFigure: figure, gpDeltaCents: 0, seed: i, playByPlay: "[]",
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
