import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/db/client";
import { battleLog, birds, farms, gameState, tournamentEntries, tournaments } from "@/db/schema";
import { seedGame, seedStarterFlock } from "@/db/seed-data";
import { PINTAKASI } from "./config";
import { Flock } from "./flock";
import { Game } from "./game";
import { Lobbies } from "./lobbies";
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

/** Tick from Friday day 0 through the Wednesday resolution (day 5 → 6). */
function tickThroughWednesday(game: Game) {
  let last;
  for (let i = 0; i < 6; i++) last = game.tickDay();
  return last!;
}

describe("the week's blades & the calendar", () => {
  test("anchors always run; the middle blade rotates by week parity", () => {
    expect(Tournaments.bladesOfWeek(0)).toEqual(["longKnife", "shortGaff", "shortKnife"]);
    expect(Tournaments.bladesOfWeek(1)).toEqual(["longKnife", "shortGaff", "longGaff"]);
    expect(Tournaments.bladesOfWeek(2)).toEqual(["longKnife", "shortGaff", "shortKnife"]);
  });

  test("entries target this Wednesday — Thursday's roll to next week", () => {
    expect(Tournaments.targetWeek(0)).toBe(0); // Friday
    expect(Tournaments.targetWeek(5)).toBe(0); // Wednesday itself — last call
    expect(Tournaments.targetWeek(6)).toBe(1); // Thursday — the crowns are gone
  });
});

describe("registration & the Selection Committee", () => {
  test("the gates hold: age 3+, this week's blades only, one bird per week", () => {
    const w = world();
    const kidlat = byName(w.db, w.devFlock, "Kidlat"); // age 1
    expect(() => w.dev.enter(kidlat.id, "longKnife")).toThrow(/age 3/);
    const sinag = byName(w.db, w.devFlock, "Sinag"); // age 3
    expect(() => w.dev.enter(sinag.id, "longGaff")).toThrow(/doesn't run week 0/);
    w.dev.enter(sinag.id, "longKnife");
    expect(() => w.dev.enter(sinag.id, "shortGaff")).toThrow(/already registered/);
  });

  test("the fee escrows at entry; the board ranks the public field", () => {
    const w = world();
    const before = w.db.select().from(farms).where(eq(farms.id, w.devId)).get()!.gp;
    w.dev.enter(byName(w.db, w.devFlock, "Sinag").id, "longKnife");
    expect(w.db.select().from(farms).where(eq(farms.id, w.devId)).get()!.gp).toBe(
      before - PINTAKASI.ENTRY_FEE
    );
    w.rival.enter("rival-8", "longKnife"); // rival Batong Buhay, 7 career wins
    const board = w.dev.board();
    const lk = board.find((c) => c.format === "longKnife")!;
    expect(lk.field.length).toBe(2);
    expect(lk.field[0].rank).toBe(1); // BB outranks Sinag on wins
    expect(lk.field[0].farm).toBe("Rival Gamefarm");
    expect(lk.field.find((f) => f.mine)!.bird).toBe("Sinag");
  });

  test("a full field bumps its weakest for a stronger newcomer — and refuses a weaker one", () => {
    const w = world();
    const t = w.db
      .insert(tournaments)
      .values({ weekIndex: 0, format: "longKnife", seed: 7, entryFee: PINTAKASI.ENTRY_FEE })
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
    // Sinag (4 career wins) outranks every dummy — the weakest goes home.
    w.dev.enter(byName(w.db, w.devFlock, "Sinag").id, "longKnife");
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
      })
      .run();
    expect(() => w.dev.enter("zzz-weak", "longKnife")).toThrow(/weakest/);
  });
});

describe("the Wednesday resolution", () => {
  test("a 4-bird bracket runs start to finish: crowns, retirements, purse, land — GP exact", () => {
    const w = world();
    w.dev.enter(byName(w.db, w.devFlock, "Sinag").id, "longKnife");
    w.dev.enter(byName(w.db, w.devFlock, "Batong Buhay").id, "longKnife");
    w.rival.enter("rival-7", "longKnife");
    w.rival.enter("rival-8", "longKnife");
    const before = totalCents(w.db);

    const tick = tickThroughWednesday(w.game);
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

    // GP to the top: purse = 800 GP of entries (no juice yet). In a 4-bracket
    // the SF losers fell in round one — zero GP; champion 5/7, runner-up 2/7.
    expect(result.purseCents).toBe(4 * PINTAKASI.ENTRY_FEE * 100);
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
    expect(rows.every((r) => r.lobbyId === null && r.mode === "hardcore" && r.gpDelta === 0)).toBe(true);
  });

  test("byes go to the top seeds; a 3-bird field fights twice", () => {
    const w = world();
    w.dev.enter(byName(w.db, w.devFlock, "Sinag").id, "shortGaff");
    w.dev.enter(byName(w.db, w.devFlock, "Batong Buhay").id, "shortGaff");
    w.rival.enter("rival-7", "shortGaff");
    const result = tickThroughWednesday(w.game).pintakasi[0];
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
    w.dev.enter(sinag.id, "longKnife");
    const tick = tickThroughWednesday(w.game);
    const result = tick.pintakasi[0];
    expect(result.cancelled).toBe(true);
    expect(totalCents(w.db)).toBe(before);
    expect(w.db.select().from(birds).where(eq(birds.id, sinag.id)).get()!.status).toBe("active");
    expect(
      w.db.select().from(tournaments).all().find((t) => t.format === "longKnife")!.status
    ).toBe("cancelled");
  });

  test("the juice pool drains into the purse — champion takes all in a straight final", () => {
    const w = world();
    w.db.update(gameState).set({ juicePoolCents: 30_000 }).where(eq(gameState.id, 1)).run();
    w.dev.enter(byName(w.db, w.devFlock, "Sinag").id, "longKnife");
    w.rival.enter("rival-7", "longKnife");
    const before = totalCents(w.db);
    const result = tickThroughWednesday(w.game).pintakasi[0];
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

  test("a registrant that died before Wednesday is refunded at close", () => {
    const w = world();
    const sinag = byName(w.db, w.devFlock, "Sinag");
    w.dev.enter(sinag.id, "longKnife");
    w.rival.enter("rival-7", "longKnife");
    w.rival.enter("rival-8", "longKnife");
    // Sinag falls in a Monday hardcore — the crown never comes.
    w.db
      .update(birds)
      .set({ status: "retired", retiredBy: "hardcore", retiredWeek: 0 })
      .where(eq(birds.id, sinag.id))
      .run();
    const result = tickThroughWednesday(w.game).pintakasi[0];
    expect(result.field).toBe(2); // the two rivals fought it out
    const entry = w.db
      .select()
      .from(tournamentEntries)
      .all()
      .find((e) => e.birdId === sinag.id)!;
    expect(entry.status).toBe("refunded");
  });

  test("a week jump (Fri → Fri) crosses Wednesday and resolves exactly once", () => {
    const w = world();
    w.dev.enter(byName(w.db, w.devFlock, "Sinag").id, "longKnife");
    w.rival.enter("rival-7", "longKnife");
    const tick = w.game.tickWeek();
    expect(tick.pintakasi.length).toBe(1);
    expect(tick.pintakasi[0].champion).not.toBeNull();
    expect(
      w.db.select().from(tournaments).all().filter((t) => t.status === "completed").length
    ).toBe(1);
  });

  test("Wednesday's lobby door refuses a Pintakasi registrant — its crown is its card", () => {
    const w = world();
    const bb = byName(w.db, w.devFlock, "Batong Buhay");
    w.dev.enter(bb.id, "longKnife");
    const lobbies = new Lobbies(w.db, w.devId);
    // Monday: the registrant fights normal cards freely (entry succeeds).
    for (let i = 0; i < 3; i++) w.game.tickDay(); // → day 3 (Monday)
    lobbies.enter(bb.id, { mode: "real", classType: "open", format: "shortKnife" });
    for (let i = 0; i < 2; i++) w.game.tickDay(); // → day 5 (Wednesday)
    expect(() =>
      lobbies.enter(bb.id, { mode: "real", classType: "open", format: "shortKnife" })
    ).toThrow(/Pintakasi/);
  });
});
