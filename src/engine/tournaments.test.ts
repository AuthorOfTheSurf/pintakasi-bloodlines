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
import {
  ECONOMY,
  JUVENILE_MAJOR,
  PINTAKASI,
  SCOUT,
  landPotShare,
  purseShareOf,
  type FightFormat,
} from "./config";
import { Flock } from "./flock";
import { mulberry32 } from "./rng";
import { computeTopline } from "./snapshots";
import { Game } from "./game";
import { Lobbies } from "./lobbies";
import { expectConserved, makeBird, onCard } from "./testkit";
import { DIVISION_RULES, Tournaments } from "./tournaments";

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

/** One barn's wallet, in whole GP — the unit an entry fee is charged in. */
const gpOf = (db: DB, farmId: string) =>
  db.select().from(farms).where(eq(farms.id, farmId)).get()!.gp;

/**
 * Seat a bird in a championship the way `enter` would — WITH THE MONEY.
 *
 * Several fixtures below build fields far larger than `enter` will allow: the
 * committee's bump line needs 64 birds already standing, and the purse tests
 * need 32 or 64 stat-identical dummies under a pinned seed. Those insert entry
 * rows directly, which was free bookkeeping while an entry cost 0 GP.
 *
 * ⚠ AT 80 GP IT IS PHANTOM ESCROW. `computeTopline` counts every pending
 * entry's fee as GP the world is holding, so a row nobody paid for invents
 * money — and then the crown pays it out to a champion, at which point it is
 * real money in a real wallet that no faucet ever minted. The conservation
 * proof would fail on the FIXTURE while the engine was innocent, which is the
 * worst kind of red test: it teaches you to distrust the invariant.
 *
 * So the fee comes out of a real wallet here, exactly as `enter` takes it.
 */
function escrowEntry(db: DB, tournamentId: number, birdId: string, farmId: string, fee: number) {
  const farm = db.select().from(farms).where(eq(farms.id, farmId)).get()!;
  if (farm.gp < fee)
    throw new Error(
      `fixture overdraft: ${farmId} holds ${farm.gp} GP and the entry costs ${fee} — ` +
        `give the barn more money rather than skipping the debit`
    );
  db.update(farms).set({ gp: farm.gp - fee }).where(eq(farms.id, farmId)).run();
  db.insert(tournamentEntries)
    .values({ tournamentId, birdId, farmId, fee, dayEntered: 0 })
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
  test("an unraced, un-earning age-3 bird may stand — the door has a PRICE, not a record", () => {
    const w = world();
    // A bird with no record whatsoever: no wins, no earnings, nothing the old
    // counter would have taken. Under the round-22 rule this was the exact
    // shape of a bird that could not enter at all.
    //
    // ⚠ ROUND 41 PUT 80 GP ON THIS DOOR and this test is what keeps the two
    // ideas apart. A fee is not a qualification: it asks the BARN for money,
    // never the bird for a career. If somebody ever re-reads "the crowns cost
    // something again" as licence to put a wins floor back beside the price,
    // this line is what says no.
    const rookie = makeBird(w.db, { name: "Bagong Salta", age: 3 });
    expect(rookie.wins).toBe(0);
    expect(rookie.stakesWins).toBe(0);
    const before = gpOf(w.db, w.devId);
    expect(() => w.dev.enter(rookie.id, "b1")).not.toThrow();
    // …and the price is exactly the ruled one, taken once.
    expect(gpOf(w.db, w.devId)).toBe(before - PINTAKASI.ENTRY_FEE);
  });

  /**
   * ── THE 80 GP DOOR (round 41) ─────────────────────────────────────────────
   *
   * Entry was 200 GP until round 22 made it free, which left the biggest stage
   * in the game bankrolled entirely by whoever happened to be rolling the
   * gacha. A fee makes the crowns partly entrant-funded — the round-16 fight
   * economy the daily card has always followed.
   *
   * The thing that has to be true of a fee in THIS codebase is not that it is
   * charged, but that it is charged and still ACCOUNTED FOR. GP is never
   * printed and never burned; an escrowed fee is money that has left a wallet
   * and not yet arrived anywhere, and the only reason that isn't a burn is
   * that `computeTopline` counts pending entries as part of the world's GP.
   */
  test("a Major entry debits exactly 80 GP, escrows it, and the world's total never moves", () => {
    const w = world();
    const before = gpOf(w.db, w.devId);
    const beforeCents = totalCents(w.db);
    w.dev.enter(byName(w.db, w.devFlock, "Sinag").id, "b1");

    expect(gpOf(w.db, w.devId)).toBe(before - PINTAKASI.ENTRY_FEE);
    // The fee is stamped on the ENTRY, not read back off the knob — a
    // mid-season reprice refunds what a barn actually paid (see the config
    // note). This is the row that makes that possible.
    const entry = w.db.select().from(tournamentEntries).all()[0];
    expect(entry.status).toBe("pending");
    expect(entry.fee).toBe(PINTAKASI.ENTRY_FEE);
    // Left the wallet, arrived nowhere, still in the world. Both halves of the
    // proof — what IS, and what the faucets ALLOWED — agree.
    expect(totalCents(w.db)).toBe(beforeCents);
    expectConserved(w.db);
  });

  test("…and a barn that cannot cover the fee is turned away, wallet untouched", () => {
    // The one genuinely new way to be refused since round 41. Worth pinning
    // separately from the gates above because it is the only refusal that has
    // nothing to do with the bird: the same rooster walks in tomorrow if the
    // barn has 80 GP tomorrow.
    const w = world();
    w.db.update(farms).set({ gp: PINTAKASI.ENTRY_FEE - 1 }).where(eq(farms.id, w.devId)).run();
    const sinag = byName(w.db, w.devFlock, "Sinag");
    expect(() => w.dev.enter(sinag.id, "b1")).toThrow(/escrowed/);
    expect(gpOf(w.db, w.devId)).toBe(PINTAKASI.ENTRY_FEE - 1); // refused ≠ charged
    expect(w.db.select().from(tournamentEntries).all().length).toBe(0);
    // (No `expectConserved` here on purpose: emptying a wallet by hand is
    // itself a conservation violation, and the faucet-side proof would fail on
    // the fixture. The claim under test is the refusal, and the door is the
    // only thing that touched money after it.)
  });

  /**
   * ⚠ THE PRICE IS PER DIVISION, AND THAT IS THE WHOLE POINT OF ROUND 41.
   *
   * Until round 41 one knob — `PINTAKASI.ENTRY_FEE` — was stamped on every
   * tournament row `findOrOpen` created, juveniles included. Nobody noticed
   * while it was 0. The moment the Majors started charging, the Majors' toll
   * would have landed on age-1 chicks: a whole week of card entries to stand in
   * the one crown that exists BECAUSE the discovery year is supposed to be
   * open, and the bots' bare `catch` would have swallowed every refusal.
   *
   * ⚠ ROUND 42 MADE THIS TEST SHARPER, NOT OBSOLETE. The juvenile crown stopped
   * being free (Zane: "We wont do freeroll like PFL. We want a cost here"), so
   * both divisions charge now — which is exactly the state in which a single
   * shared knob would go unnoticed again, because both numbers would look
   * plausible. The claim is therefore no longer "one charges and one doesn't"
   * but "each is billed its OWN price, in one world, side by side".
   */
  test("both crowns charge, each from its own knob — same world, two prices", () => {
    const w = world();
    const before = gpOf(w.db, w.devId);
    w.dev.enter(byName(w.db, w.devFlock, "Sinag").id, "b1"); //           age 3, a Major
    const chick = makeBird(w.db, {
      name: "Munting Kidlat",
      age: 1,
      wins: JUVENILE_MAJOR.QUALIFYING_WINS,
    });
    w.dev.enter(chick.id, "b2", "juvenile"); //                           age 1, the crown

    const rows = w.db.select().from(tournaments).all();
    const major = rows.find((t) => t.division === "major")!;
    const juvenile = rows.find((t) => t.division === "juvenile")!;
    expect(major.entryFee).toBe(PINTAKASI.ENTRY_FEE);
    expect(juvenile.entryFee).toBe(JUVENILE_MAJOR.ENTRY_FEE);
    // …and they must be DIFFERENT numbers, or a shared knob would pass this
    // test. The discovery year is the cheap seat: that ordering is the ruling
    // (a chick's crown is not hardcore and its purse is a fifth of a Major's),
    // and it is what a single knob would silently erase.
    const majorFee: number = PINTAKASI.ENTRY_FEE;
    const juvFee: number = JUVENILE_MAJOR.ENTRY_FEE;
    expect(juvFee).toBeGreaterThan(0); // no longer free (round 42)
    expect(juvFee).toBeLessThan(majorFee);
    // Two entries, two bills, both taken once.
    expect(gpOf(w.db, w.devId)).toBe(before - majorFee - juvFee);
    expect(
      w.db.select().from(tournamentEntries).all().map((e) => e.fee).sort((a, b) => a - b)
    ).toEqual([juvFee, majorFee]);
    expectConserved(w.db);
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

  test("the purse is ENTRIES PLUS JUICE — the fighters put money in the pot again", () => {
    // Round 22 made this pot pure juice, and traced over a 91-day world that
    // meant 99% of every crown purse came from gacha spend and breed fees: a
    // barn that never entered a Major still paid for its purse, and the
    // entrants paid nothing. Round 41 puts the entrants back in the pot.
    //
    // Both terms are pinned because either one going missing is a silent
    // failure. Drop the fees and the crowns are back to being funded by
    // bystanders; drop the juice and 80 GP a head is the entire prize.
    const w = world();
    w.dev.enter(byName(w.db, w.devFlock, "Sinag").id, "b1");
    w.rival.enter("rival-8", "b1");
    const before = totalCents(w.db);
    const tick = tickThroughCrownDay(w.game);
    const lk = tick.pintakasi.find((t) => t.format === "b1")!;
    expect(lk.cancelled).toBe(false);

    const entriesIn = w.db
      .select()
      .from(tournamentEntries)
      .all()
      .reduce((s, e) => s + e.fee, 0);
    expect(entriesIn).toBe(2 * PINTAKASI.ENTRY_FEE);
    // The world seeds a genesis juice pool (round 20) and this lone running
    // crown takes it in full, so the purse is exactly the two terms and
    // nothing else — no rake, no house cut. Fees take NO staker rake on
    // purpose: the pot the fighters built is the pot they fight over.
    expect(lk.purseCents).toBe(entriesIn * 100 + ECONOMY.SEED_JUICE * 100);
    expect(totalCents(w.db)).toBe(before); // still redistribution, never printing
    expectConserved(w.db);
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

  /**
   * ── A BARN CHASES CROWNS IT CAN PAY FOR (round 41) ────────────────────────
   *
   * `chaseCrowns` carried a wallet check from round 22 onward that HAD NEVER
   * RUN: it was written `PINTAKASI.ENTRY_FEE > 0 && …`, and the fee was 0, so
   * the wallet was never read. Round 41 is the first time it executes, and it
   * now decides how three crowns a week × MAX_PER_BARN birds are rationed off
   * the top of a barn's money.
   *
   * ⚠ These fixtures set a wallet by hand, which is itself a conservation
   * violation — so no `expectConserved` here. What is being proved is the
   * BOT's restraint, and the engine's own money handling is proved above.
   */
  describe("the crown chase pays its way", () => {
    /** A deep barn — a second legacy wave gives four age-3+ birds. */
    const deepBarn = (w: ReturnType<typeof world>, gp: number) => {
      seedStarterFlock(w.db, w.devId, { seed: 55, idPrefix: "dev2", shape: "legacy" });
      w.db.update(farms).set({ gp }).where(eq(farms.id, w.devId)).run();
      return w.devFlock.all().filter((b) => b.status === "active" && b.age >= 3).length;
    };

    test("a barn that can afford two seats buys two — and stops, rather than overdrawing", () => {
      const w = world();
      expect(deepBarn(w, 2 * PINTAKASI.ENTRY_FEE)).toBe(4); // four birds, two seats' worth of money
      const entered = chaseCrowns(w.db, w.devId, 0, mulberry32(11));
      expect(entered.length).toBe(2);
      // Paid for, to the GP, and nothing on credit: the barn is empty and the
      // world holds its money as escrow rather than as a negative balance.
      expect(gpOf(w.db, w.devId)).toBe(0);
      const pending = w.db
        .select()
        .from(tournamentEntries)
        .all()
        .filter((e) => e.status === "pending");
      expect(pending.length).toBe(2);
      expect(pending.every((e) => e.fee === PINTAKASI.ENTRY_FEE)).toBe(true);
    });

    test("…and a barn with no money enters nothing at all, without throwing", () => {
      // The failure mode this guards is not a wrong number, it is a THROWN
      // one: `chaseCrowns` runs inside `Bots.playDay` and inside auto-play's
      // `quietly`, so an unguarded overdraft would either crash a tick or be
      // swallowed whole and read as twenty barns choosing not to enter.
      const w = world();
      deepBarn(w, 0);
      let entered: string[] = ["not run"];
      expect(() => {
        entered = chaseCrowns(w.db, w.devId, 0, mulberry32(11));
      }).not.toThrow();
      expect(entered).toEqual([]);
      expect(w.db.select().from(tournamentEntries).all()).toEqual([]);
      expect(gpOf(w.db, w.devId)).toBe(0); // …and it did not go negative
    });

    test("the RESERVE is money the chase may not touch — auto-play's round-41 fix", () => {
      // `auto-play.ts` passed no options at all, so `reserve` defaulted to 0
      // and an honest stable would have spent down to its last 80 GP on crowns
      // — which run BEFORE the daily card, so it would then have had nothing
      // to card its ordinary birds with. The reserve is the floor under that.
      const w = world();
      // ⚠ THE RESERVE IS ONE SEAT'S WORTH, expressed in seats rather than as a
      // round 100 GP (which it was until round 42 doubled the fee out from under
      // it and the second leg of this test started asking a 260 GP barn to buy
      // 320 GP of crowns). Two seats' money, one seat held back: the fixture
      // stays the same shape whatever the door costs.
      const reserve = PINTAKASI.ENTRY_FEE;
      deepBarn(w, 2 * PINTAKASI.ENTRY_FEE);
      // Exactly one seat is affordable without breaking the floor: after it,
      // the wallet holds the reserve and not a GP more.
      expect(chaseCrowns(w.db, w.devId, 0, mulberry32(11), { reserve }).length).toBe(1);
      expect(gpOf(w.db, w.devId)).toBe(reserve);
      // …and with the same money and no reserve, it would have bought two.
      const w2 = world();
      deepBarn(w2, 2 * PINTAKASI.ENTRY_FEE);
      expect(chaseCrowns(w2.db, w2.devId, 0, mulberry32(11)).length).toBe(2);
    });
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
    const before = gpOf(w.db, w.devId);
    w.dev.enter(byName(w.db, w.devFlock, "Sinag").id, "b1");
    expect(gpOf(w.db, w.devId)).toBe(before - PINTAKASI.ENTRY_FEE);
    w.rival.enter("rival-8", "b1"); // rival Batong Buhay, 7 career wins
    const board = w.dev.board();
    const lk = board.find((c) => c.format === "b1")!;
    // The board quotes the door price off the ROW, so a player reads what this
    // championship charges rather than what the knob says today.
    expect(lk.fee).toBe(PINTAKASI.ENTRY_FEE);
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
      .values({ weekIndex: 0, format: "b1", seed: 7, entryFee: DIVISION_RULES.major.entryFee })
      .returning()
      .get();
    // A full 64-bird field, laddered by career earnings: dummy 0 has banked
    // 1.00 GP, dummy 63 has banked 64.00. The POOREST half stands under the
    // rival's banner, so the bump below refunds into a wallet this test watches.
    //
    // ⚠ AND THE FIELD PAYS FOR ITSELF (round 41). Sixty-four seats used to be
    // 5,120 GP, inside one barn's 8,000 GP starting purse — round 42 doubled the
    // door to 160 GP and 10,240 GP no longer fits in a single wallet. The fix is
    // a SECOND REGISTERED BARN, not a hand-set wallet: registering is a real
    // faucet the conservation proof knows about, while topping a wallet up by
    // hand mints GP and would fail `expectConserved` at the bottom of this test
    // on the FIXTURE rather than on anything the engine did.
    const { farm: overflow } = w.game.farms.register({
      name: "Overflow Gamefarm",
      primaryColor: "green",
      secondaryColor: "gold",
    });
    const stake = (i: number) => (i + 1) * 100;
    const half = PINTAKASI.MAX_BRACKET / 2;
    for (let i = 0; i < PINTAKASI.MAX_BRACKET; i++) {
      // Not the DEV barn: it has to be free to enter Sinag below, and
      // MAX_PER_BARN would refuse a barn that already held thirty-two seats.
      const farmId = i < half ? w.rivalId : overflow.id;
      const dummy = makeBird(w.db, { farmId, name: `Dummy ${i}`, age: 3 });
      earned(w.db, dummy.id, farmId, stake(i));
      escrowEntry(w.db, t.id, dummy.id, farmId, t.entryFee);
    }
    const worldBefore = totalCents(w.db);
    const rivalGpBefore = gpOf(w.db, w.rivalId);
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
    // ⚠ REFUND PATH 1 OF 3: THE COMMITTEE BUMP. Vacuous while entry was free —
    // it compared 0 against 0 — and now the real thing: a barn shoved out of a
    // full field gets back exactly what it put in, to the GP, at the moment it
    // is bumped rather than at crown day. (The other two refunds — a bird that
    // stops standing, and a field too small to run — are pinned in "the
    // crown-day resolution" below.)
    expect(gpOf(w.db, w.rivalId)).toBe(rivalGpBefore + PINTAKASI.ENTRY_FEE);
    expect(bumped[0].fee).toBe(PINTAKASI.ENTRY_FEE); // refunded what was PAID
    // A newcomer that has earned LESS than the field's new weakest (Sinag
    // itself, at 1.50) is refused at the door. Note what does NOT save it: it
    // is a perfectly legal entrant, age 3, active and named. The committee is
    // the only thing standing in its way.
    const pauper = makeBird(w.db, { name: "Palpak", age: 3 });
    earned(w.db, pauper.id, w.devId, 50);
    const devGpBefore = gpOf(w.db, w.devId);
    expect(() => w.dev.enter(pauper.id, "b1")).toThrow(/weakest/);
    // ⚠ A REFUSAL IS NOT A CHARGE. `enter` takes the fee AFTER the committee
    // has ruled, and this is the assertion that keeps it in that order — a
    // door that debited first would take 80 GP off a bird it then sends home,
    // and the refund path for that case does not exist because there is no
    // entry row to refund against.
    expect(gpOf(w.db, w.devId)).toBe(devGpBefore);
    expect(
      w.db.select().from(tournamentEntries).where(eq(tournamentEntries.tournamentId, t.id)).all()
        .filter((e) => e.status === "pending").length
    ).toBe(PINTAKASI.MAX_BRACKET); // a refusal costs the field nothing
    // Sixty-four seats bought, one refunded, one sold, one refused — and the
    // world holds precisely the GP it held before any of it, because every
    // centavo is either in a wallet or in escrow.
    expect(totalCents(w.db)).toBe(worldBefore);
    expectConserved(w.db);
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

    // GP to the top: purse = four 80 GP entries (round 41 — the fighters fund
    // the pot again) + the juice pool, which the world seeds at genesis
    // (round 20) and this lone running crown takes in full. In a 4-bracket the
    // SF losers lost their only fight, so under the round-40 purse they have
    // no win weight and no bonus — two payouts, and the champion (weight 2.5
    // of 3.5, plus the trophy) takes most of it. The exact split is pinned in
    // "the worked bracket, to the cent" below.
    expect(result.purseCents).toBe(4 * PINTAKASI.ENTRY_FEE * 100 + ECONOMY.SEED_JUICE * 100);
    const paid = result.payouts.reduce((s, p) => s + p.gpCents, 0);
    expect(paid).toBe(result.purseCents); // dust included, nothing stranded
    expect(result.payouts.length).toBe(2); // champion + runner-up only
    const champPay = result.payouts.find((p) => p.stage === "champion")!;
    expect(champPay.gpCents).toBeGreaterThan(result.purseCents / 2);
    expect(totalCents(w.db)).toBe(before); // conservation to the cent

    // ── LAND: ONE POT, DIVIDED BY FIGHTS FOUGHT (round 42) ──────────────────
    //
    // ⚠ THIS ASSERTION USED TO SAY THE OPPOSITE, and the reversal is the round.
    // It read "land to the fallen: first-round dead out-grant the runner-up, who
    // out-grants the champion" — an elimination GRANT ladder, paid on top of a
    // per-fight mint on a second curve. The two scales were never priced against
    // each other and had inverted at the juvenile crown (champion 6.75 LT against
    // a first-round loser's 10.15). One pot, divided by fights actually fought,
    // makes that class of bug unreachable rather than fixed.
    //
    // A 4-bracket runs 3 fights = 6 fighter-slots. The champion fought twice, the
    // runner-up twice, the two SF losers once each — so the pot divides 2/6, 2/6,
    // 1/6, 1/6, and the champion takes the flooring dust on top.
    const entries = w.db.select().from(tournamentEntries).all();
    const granted = entries.map((e) => e.landGranted).sort((a, b) => a - b);
    const slots = 2 * 3;
    const one = landPotShare(PINTAKASI.LAND_POT, slots, 1);
    const two = landPotShare(PINTAKASI.LAND_POT, slots, 2);
    expect(granted.slice(0, 3)).toEqual([one, one, two]); // …and the fourth is the champion's
    // THE POT PAYS OUT EXACTLY. Land is minted here, so a hundredth lost to
    // `Math.floor` is a silent gap between what config says a crown pays and what
    // the ledger records — which is why the champion settles last with the dust.
    expect(granted.reduce((s, n) => s + n, 0)).toBe(PINTAKASI.LAND_POT);
    // Monotone in fights fought: the deep runs bank more than the early exits.
    // (The bug this replaces was exactly an inversion of this line.)
    expect(granted[3]).toBeGreaterThanOrEqual(two);
    expect(two).toBeGreaterThan(one);

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
    // ⚠ REFUND PATH 3 OF 3: THE FIELD THAT NEVER RAN. A crown below MIN_FIELD
    // has no fights, so there is no purse to pay the fee into — and a fee paid
    // into a championship that never happened is a burn unless it goes home.
    // The wallet check is the load-bearing line here; it was worth exactly
    // nothing while entry was free.
    const w = world();
    const sinag = byName(w.db, w.devFlock, "Sinag");
    const before = totalCents(w.db);
    const walletBefore = gpOf(w.db, w.devId);
    w.dev.enter(sinag.id, "b1");
    expect(gpOf(w.db, w.devId)).toBe(walletBefore - PINTAKASI.ENTRY_FEE); // …paid
    const tick = tickThroughCrownDay(w.game);
    const result = tick.pintakasi[0];
    expect(result.cancelled).toBe(true);
    expect(gpOf(w.db, w.devId)).toBe(walletBefore); //                       …and back
    expect(w.db.select().from(tournamentEntries).all()[0].status).toBe("refunded");
    expect(totalCents(w.db)).toBe(before);
    expectConserved(w.db);
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
    // ⚠ REFUND PATH 2 OF 3: THE BIRD THAT STOPPED STANDING. Registration is
    // binding, and a week is long enough for a registrant to fall in an
    // ordinary hardcore or be retired by its owner. It never fights the crown,
    // so it never contributes to the purse — the fee has to come home, and now
    // it is 80 GP rather than a formality.
    const w = world();
    const sinag = byName(w.db, w.devFlock, "Sinag");
    const walletBefore = gpOf(w.db, w.devId);
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
    expect(entry.fee).toBe(PINTAKASI.ENTRY_FEE);
    // Exactly what was paid, and the dev barn won nothing else all week — so
    // this equality is the refund and nothing but the refund.
    expect(gpOf(w.db, w.devId)).toBe(walletBefore);
    // …and a scratched entry's money does NOT swell the purse it left: only
    // the two birds that actually stood paid in.
    expect(result.purseCents).toBe(2 * PINTAKASI.ENTRY_FEE * 100 + ECONOMY.SEED_JUICE * 100);
    expectConserved(w.db);
  });

  /**
   * ⚠ NO ENTRY MAY OUTLIVE ITS CHAMPIONSHIP.
   *
   * A `pending` entry is ESCROW: `computeTopline` counts its fee as GP the
   * world is holding, and the conservation proof balances only because that
   * money is expected to come back out — into a purse, into a refund, or into
   * a bump. An entry still sitting `pending` after its crown has resolved is
   * therefore money that has left a wallet and can never arrive anywhere: a
   * permanent phantom in the invariant, growing by 80 GP a week forever.
   *
   * Nothing in the project asserted this could not happen, because at a fee of
   * 0 a stranded entry cost nothing and looked like tidy-up. It is a real leak
   * now, so it gets a real test: every terminal status is accounted for, and
   * `pending` is not among them.
   */
  test("every entry reaches a terminal status — a resolved crown strands no escrow", () => {
    const w = world();
    // A field with all four ways out of a bracket in it: a champion, a
    // runner-up, first-round losers, and a scratch that never stood.
    w.dev.enter(byName(w.db, w.devFlock, "Sinag").id, "b1");
    w.dev.enter(byName(w.db, w.devFlock, "Batong Buhay").id, "b1");
    w.rival.enter("rival-7", "b1");
    w.rival.enter("rival-8", "b1");
    const scratch = makeBird(w.db, { name: "Sablay", age: 3 });
    w.dev.enter(scratch.id, "b3");
    w.db.update(birds).set({ status: "retired", retiredBy: "manual", retiredWeek: 0 })
      .where(eq(birds.id, scratch.id)).run();
    const before = totalCents(w.db);

    tickThroughCrownDay(w.game);
    const entries = w.db.select().from(tournamentEntries).all();
    expect(entries.length).toBe(5);
    expect(entries.filter((e) => e.status === "pending")).toEqual([]);
    // Named individually rather than "not pending" so a NEW status can't be
    // invented that silently holds money either.
    expect(new Set(entries.map((e) => e.status))).toEqual(
      new Set(["champion", "eliminated", "refunded"])
    );
    // The escrow line itself, read the way the office reads it: zero.
    expect(computeTopline(w.db).tournamentEscrowCents).toBe(0);
    expect(totalCents(w.db)).toBe(before);
    expectConserved(w.db);
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
      /**
       * What each seat costs. DEFAULTS TO 0, and that is a fixture choice
       * rather than a claim about the game: with no fees the purse is exactly
       * the juice number this helper set, so every share below can be worked
       * out on paper. (It read "free since round 22" until round 41 put 80 GP
       * on a Major's door — the zero survives because the arithmetic wants a
       * known pot, not because entry is free.)
       *
       * ⚠ ANY NON-ZERO VALUE IS DEBITED FROM A REAL WALLET. See `escrowEntry`.
       */
      feeEach?: number;
      /** Per-bird overrides — used only to build the two bye cases below. */
      each?: (i: number) => Partial<NewBird>;
    }
  ) {
    const division = opts.division ?? "major";
    const feeEach = opts.feeEach ?? 0;
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
        entryFee: feeEach,
      })
      .returning()
      .get();
    // The seats alternate between two barns, so the biggest paid fixture here
    // (64 × 80 GP) asks 2,560 GP of each — well inside a starting purse of
    // 8,000. Nothing is minted to make a fixture affordable; that would be
    // printing GP to prove GP isn't printed.
    for (let i = 0; i < opts.size; i++) {
      // Alternating barns: matchmaking inside a bracket is seeding, not
      // pairing, so this changes nothing — it just keeps the fixture honest
      // about a championship being a contest between stables.
      const bird = makeBird(w.db, {
        farmId: i % 2 === 0 ? w.devId : w.rivalId,
        age: division === "juvenile" ? 1 : 3,
        ...(opts.each?.(i) ?? {}),
      });
      escrowEntry(w.db, t.id, bird.id, bird.farmId, feeEach);
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
    //
    // ⚠ AND THE WEIGHTS ARE FRACTIONAL SINCE ROUND 41 (×1.5, so a fourth-round
    // win scores 3.375). The floor is the one place the purse does integer
    // arithmetic on a fractional share, which makes this the test most likely
    // to be broken by a multiplier change and least likely to say so — a
    // rounding slip here still settles exactly, because the champion absorbs
    // the remainder.
    const w = world();
    expect(Number.isInteger(PINTAKASI.PURSE.ROUND_MULTIPLIER)).toBe(false);
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
    // A win in round r scores ROUND_MULTIPLIER^(r-1) — ×2 until round 41, ×1.5
    // now that entry costs 80 GP (the doubling left a first-round win net
    // NEGATIVE against the door). The visible consequence, and the one a player
    // would notice if it broke, is that the stage ladder never flattens or
    // inverts: two more wins is always worth more than one more win, whatever
    // the knobs are set to. Written as a property precisely so that softening
    // the curve is a balance decision and not a test rewrite.
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
    // total weight is 1 + 1.5 = 2.5 (one first-round win, one final win) and
    // NOT 1 + 1 + 1.5.
    //
    // ⚠ THE MULTIPLIER IS 1.5 SINCE ROUND 41, so the weights are FRACTIONS. A
    // final win is worth 1.5^1 = 1.5, not the 2 it was worth at the old
    // doubling. Nothing downstream may assume whole numbers.
    //
    // The arithmetic is worked out here because it is the number that would
    // change — quietly, and in the champion's favour — if the bye branches in
    // `runChampionship` ever started crediting weight. At round 42's shares
    // (0.70 / 0.20 / 0.10, moved to cover a doubled entry fee):
    //
    //   champion:  0.70 × 1.5/2.5 + 0.20 = 0.62  → 62,000 of 100,000 cents
    //   finalist:  0.70 × 1.0/2.5 + 0.10 = 0.38  → 38,000
    //
    // If the bye counted as a win the champion would take 0.70 × 2.5/3.5 + 0.20
    // = 0.70 — 80 GP moved between two barns for a fight nobody had. (It read
    // 65,000/35,000 at round 41's 0.50/0.35/0.15, and 68,334/31,666 before the
    // multiplier softened; the SPLIT moves with the knobs, the bye rule does not.)
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
    expect(paidTo(result, topSeed.name)).toBe(62_000);
    expect(result.payouts.find((p) => p.stage === "runner-up")!.gpCents).toBe(38_000);
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

  test("the worked bracket, to the cent: four birds, a 1,000 GP purse, 700/300", () => {
    // THE ONE PINNED ARITHMETIC IN THE FILE. Four birds is the smallest
    // bracket with a round to be deeper than, so both terms of the formula are
    // live and neither cancels:
    //
    //   champion:  0.70 × 2.5/3.5 + 0.20 = 0.70  → 70,000 of 100,000 cents
    //   runner-up: 0.70 × 1.0/3.5 + 0.10 = 0.30  → 30,000
    //
    // (Weights: the champion won a semifinal worth 1.5^0 = 1 and a final worth
    // 1.5^1 = 1.5; the runner-up won a semifinal worth 1; the two first-round
    // losers won nothing. Total 3.5.) The knobs sum to 1 and every seat is
    // filled, so the normalization is the identity here — which is exactly why
    // this is the case worth pinning: any difference is the formula being
    // wrong, not the renormalizer covering for it.
    //
    // ⚠ THE HISTORY OF THIS ONE PAIR IS THE HISTORY OF THE PURSE: 72,500/27,500
    // until round 41 (weight total 4, a final worth double a semifinal),
    // 70,715/29,285 at round 41's softened ×1.5, and 70,000/30,000 now that round
    // 42 moved the shares to 0.70/0.20/0.10 to cover a doubled entry fee. The
    // champion still takes the DUST (100,000 − 30,000); at these shares the
    // arithmetic happens to come out on whole cents, which it will not always.
    const w = world();
    pinnedBracket(w, { size: 4, juiceCents: 100_000 });
    const before = totalCents(w.db);
    const result = tickThroughCrownDay(w.game).pintakasi[0];
    expect(result.purseCents).toBe(100_000);
    expect(result.payouts.length).toBe(2); // the SF losers lost their only fight
    expect(result.payouts.find((p) => p.stage === "champion")!.gpCents).toBe(70_000);
    expect(result.payouts.find((p) => p.stage === "runner-up")!.gpCents).toBe(30_000);
    expect(totalCents(w.db)).toBe(before);
  });

  /**
   * ⚠ THE ROUND'S PROMISE, AND THE ONE NUMBER ZANE RULED ON.
   *
   * Round 40 said every fight-winner is paid SOMETHING. A priced door turns that
   * into a different and much sharper claim: paid ENOUGH TO BE WORTH TURNING UP.
   * Round 41 closed it by softening ROUND_MULTIPLIER 2 → 1.5; round 42 doubled
   * the door to 160 GP and closed it again by moving the SHARES (0.50 → 0.70
   * advancement), because at ×1.5 the first round already holds a third of the
   * advancement pool, so the share is the lever the round-41 comment said it
   * wasn't. Read the two knobs together — they are not independent.
   *
   * So: a full 32-bird bracket, everybody paying the real fee, on the juice the
   * ruling was measured against. Every bird that won a blade fight must end the
   * night up on the deal — and now BOTH divisions have a door to clear.
   */
  test("in a 32-bird bracket, EVERY Major fight-winner clears the door", () => {
    const w = world();
    const fee = PINTAKASI.ENTRY_FEE;
    // ⚠ THE PURSE THIS IS MEASURED ON, AND HOW THIN THE MARGIN IS. Round 41 ran
    // this test on 5,931 GP of juice — the per-crown share traced over a 91-day
    // world at the time — and cleared an 80 GP door by +7. Round 42 doubled the
    // door to 160 GP, which moves the BREAK-EVEN purse to
    //
    //   fee / purseShareOf(32, …, 1 win) = 160 / 0.014341 ≈ 11,157 GP
    //
    // and at the old juice figure the same seat lands at −1.52 GP. So the shares
    // moved (0.50 → 0.70 advancement) and the juice this fixture assumes moved
    // with the measurement: 6,940 GP a crown is where the round-42 ruling's "+13"
    // in PINTAKASI.PURSE comes from.
    //
    // ⚠ WATCH ITEM, recorded here because this is where somebody will look: a
    // fresh round-42 sim's 32-bird Majors averaged a 10,564 GP purse, BELOW the
    // 11,157 GP break-even. The rule holds by construction at the purse it was
    // ruled on and is marginal at the purse the world currently produces — which
    // is a balance conversation (juice inflow, field sizes), not an arithmetic
    // bug. The break-even is asserted below so the margin is visible rather than
    // implied.
    const breakEvenCents = fee * 100 / purseShareOf(32, PINTAKASI.PURSE, 1);
    expect(breakEvenCents / 100).toBeCloseTo(11_157, 0);
    pinnedBracket(w, { size: 32, juiceCents: 694_000, feeEach: fee });
    const before = totalCents(w.db);
    const result = tickThroughCrownDay(w.game).pintakasi[0];

    expect(result.bracketSize).toBe(32);
    // Entries genuinely grow the pot — that is what makes the door survivable.
    expect(result.purseCents).toBe(32 * fee * 100 + 694_000);
    expect(result.purseCents).toBeGreaterThan(breakEvenCents);

    const winners = fightWinners(result);
    expect(winners.size).toBe(16); // half the field wins at least once
    for (const name of winners) {
      // NET of the fee, not gross. The shallowest winner is the binding case:
      // one win, the smallest weight in the bracket.
      expect(paidTo(result, name)).toBeGreaterThan(fee * 100);
    }
    // The exact edge, pinned so a knob change that re-opens the trapdoor by a
    // few GP fails loudly instead of drifting: one win pays 17,294 cents
    // (172.94 GP) — a net +12.94 GP on a 160 GP entry, the thinnest margin in
    // the ladder, and the figure PINTAKASI.PURSE quotes as the reason the shares
    // moved. Cross-checked against the closed form rather than trusted: the
    // engine accumulates weight fight by fight, `purseShareOf` computes it for a
    // full bracket, and a full bracket is where the two must agree.
    const oneWin = result.payouts.filter((p) => p.stage === "round of 16");
    expect(oneWin.length).toBe(8);
    expect(new Set(oneWin.map((p) => p.gpCents)).size).toBe(1); // one win is one win
    expect(oneWin[0].gpCents).toBe(17_294);
    expect(oneWin[0].gpCents).toBe(
      Math.floor(result.purseCents * purseShareOf(32, PINTAKASI.PURSE, 1))
    );
    // …and the champion is not the one paying for it: it still takes the trophy
    // share the closed form promises, plus the rounding dust off the other
    // fifteen seats (which is why this is ≥ and not ==).
    const champion = result.payouts.find((p) => p.stage === "champion")!.gpCents;
    expect(champion).toBeGreaterThanOrEqual(
      Math.floor(result.purseCents * purseShareOf(32, PINTAKASI.PURSE, 5, "champion"))
    );
    expect(champion).toBeGreaterThan(result.purseCents / 3);

    // Still strictly increasing, every rung, at fractional weights — the
    // ladder is the reason a deeper win is worth chasing at all.
    const ladder = ["round of 16", "quarterfinal", "semifinal", "runner-up", "champion"];
    const paid = ladder.map((s) => result.payouts.find((p) => p.stage === s)!.gpCents);
    for (let i = 1; i < paid.length; i++) expect(paid[i]).toBeGreaterThan(paid[i - 1]);
    // …and the champion still takes the biggest single share by a wide margin.
    expect(champion).toBe(Math.max(...result.payouts.map((p) => p.gpCents)));

    expect(result.payouts.reduce((s, p) => s + p.gpCents, 0)).toBe(result.purseCents);
    // `pinnedBracket` sets the juice pool by hand, so the faucet-side proof
    // doesn't apply here — this delta is the whole conservation claim: the
    // purse only ever REDISTRIBUTES what entries and juice put in it.
    expect(totalCents(w.db)).toBe(before);
  });

  test("…and so does every JUVENILE crown win — the crown stopped being free too", () => {
    // ⚠ NEW IN ROUND 42, and it is the half of the standing rule that had no test
    // because it had no door: the juvenile crown was free from round 41, so "a
    // win must clear the entry fee" was vacuously true there. It costs 48 GP now
    // (Zane: "We wont do freeroll like PFL. We want a cost here"), which is what
    // pushed JUVENILE_MAJOR.PURSE.ADVANCEMENT to 0.80 — a first-round win in a
    // 32-bracket is structurally ~1% of the purse, so the advancement share is
    // the only lever big enough to cover a real fee.
    //
    // The juice figure is the discovery year's own thin slice (JUICE_SHARE 0.2 of
    // the pool, and this fixture's crown is the only one running so it takes all
    // of it), sized to the ~3,700 GP purse a measured round-42 sim's 32-bird
    // juvenile crowns actually produce. Break-even there is ~2,929 GP, so unlike
    // the Majors this division clears the door with real room to spare.
    const w = world();
    const fee = JUVENILE_MAJOR.ENTRY_FEE;
    expect(fee).toBeGreaterThan(0); // …or this test proves nothing at all
    const breakEvenCents = (fee * 100) / purseShareOf(32, JUVENILE_MAJOR.PURSE, 1);
    pinnedBracket(w, {
      size: 32,
      juiceCents: 1_200_000,
      feeEach: fee,
      division: "juvenile",
    });
    const before = totalCents(w.db);
    const result = crownResults(w.game)[0];
    expect(result.bracketSize).toBe(32);
    expect(result.purseCents).toBe(
      32 * fee * 100 + Math.floor(1_200_000 * JUVENILE_MAJOR.JUICE_SHARE)
    );
    expect(result.purseCents).toBeGreaterThan(breakEvenCents);

    const winners = fightWinners(result);
    expect(winners.size).toBe(16);
    for (const name of winners) expect(paidTo(result, name)).toBeGreaterThan(fee * 100);
    // The shallowest seat, against the closed form — the same cross-check the
    // Majors get, because the two divisions run the same code on different knobs.
    const oneWin = result.payouts.filter((p) => p.stage === "round of 16");
    expect(oneWin.length).toBe(8);
    expect(oneWin[0].gpCents).toBe(
      Math.floor(result.purseCents * purseShareOf(32, JUVENILE_MAJOR.PURSE, 1))
    );
    // …and NOBODY died for it: the discovery year's crown is the one stage in the
    // game that charges a fee without putting a career on the line.
    expect(w.db.select().from(birds).all().every((b) => b.retiredBy !== "hardcore")).toBe(true);
    expect(result.payouts.reduce((s, p) => s + p.gpCents, 0)).toBe(result.purseCents);
    expect(totalCents(w.db)).toBe(before);
  });

  test("⚠ …and a 64-bird field does NOT — accepted, not solved", () => {
    // Twice the birds share one pot, so a single win in a 64-bracket is still
    // net negative against the fee. Zane accepted that explicitly: fields
    // average around 22, so 32 is the ordinary bracket and 64 is the busy-week
    // exception. It is pinned HERE rather than left unsaid because a known
    // exception nobody wrote down reads as a bug to the next person, who
    // "fixes" it by moving the multiplier and quietly guts the trophy.
    const w = world();
    const fee = PINTAKASI.ENTRY_FEE;
    pinnedBracket(w, { size: 64, juiceCents: 593_100, feeEach: fee });
    const result = tickThroughCrownDay(w.game).pintakasi[0];
    expect(result.bracketSize).toBe(64);
    const shallowest = Math.min(...result.payouts.map((p) => p.gpCents));
    expect(shallowest).toBeGreaterThan(0); //          round 40's promise still holds…
    expect(shallowest).toBeLessThan(fee * 100); //     …round 41's does not, at this size
    expect(result.payouts.reduce((s, p) => s + p.gpCents, 0)).toBe(result.purseCents);
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

/**
 * ── THE CROWN LAND POT, AS THE BRACKET PAYS IT (round 42) ───────────────────
 *
 * A crown used to pay land TWICE — a per-fight mint on its own steeper curve,
 * plus an elimination GRANT ladder that paid the earliest-eliminated the most —
 * and the two scales had drifted into an inversion at the juvenile crown, where
 * a champion banked 6.75 LT against a first-round loser's 10.15. One fixed pot,
 * divided across every fight actually fought, replaces both.
 *
 * `lobbies.test.ts` pins `landPotShare` as arithmetic. These pin what the
 * BRACKET does with it, which is the half that can leak: the champion absorbs
 * the flooring dust, and land is MINTED here, so a hundredth dropped is a real
 * gap between what config says a crown pays and what the ledger records.
 */
describe("the crown land pot pays out exactly", () => {
  /** Every entry's land award in a resolved crown, biggest last. */
  const grants = (db: DB) =>
    db.select().from(tournamentEntries).all().map((e) => e.landGranted).sort((a, b) => a - b);

  test("a 32-bird bracket mints the pot and not a hundredth more", () => {
    const w = world();
    pinnedBracket(w, { size: 32, juiceCents: 500_000 });
    const result = tickThroughCrownDay(w.game).pintakasi[0];
    expect(result.bracketSize).toBe(32);

    const paid = grants(w.db);
    expect(paid.length).toBe(32);
    // THE CONSERVATION CLAIM. 31 fights = 62 fighter-slots, and every hundredth
    // of the pot reaches a farm: the sixteen first-round losers take 1/62 each,
    // the champion takes 5/62 plus whatever the floors left behind.
    expect(paid.reduce((s, n) => s + n, 0)).toBe(PINTAKASI.LAND_POT);
    const slots = 2 * 31;
    expect(paid[0]).toBe(landPotShare(PINTAKASI.LAND_POT, slots, 1));
    expect(paid.filter((n) => n === paid[0]).length).toBe(16); // one win, one share
    // MONOTONE IN FIGHTS FOUGHT — the property the deleted grant ladder broke.
    // The champion fought the most, so it banks the most; nothing about the
    // FINISH enters into it, only the count of blades thrown.
    expect(paid[31]).toBeGreaterThanOrEqual(landPotShare(PINTAKASI.LAND_POT, slots, 5));
    expect(paid[31]).toBe(Math.max(...paid));
    // …and the farm piles agree with the entry rows: the pot arrived somewhere.
    // (No `expectConserved` here: `pinnedBracket` sets the juice pool by hand, so
    // the faucet-side GP proof would fail on the fixture. Land has its own
    // conservation claim and it is the one above — the pot, to the hundredth.)
    const held = w.db.select().from(farms).all().reduce((s, f) => s + f.landTokensCents, 0);
    expect(held).toBeGreaterThanOrEqual(PINTAKASI.LAND_POT);
  });

  test("A BYE BUYS NO LAND — a champion that byed in banks less than the bird it beat", () => {
    // ⚠ THE SHARPEST FORM OF THE RULE, and the one a reader will want to argue
    // with. A 3-bird field seeds the top bird straight into the final: it fights
    // ONCE and wins the crown, while the bird that came up through the bracket
    // fought TWICE. Land pays FIGHTS, so the runner-up banks the bigger pile —
    // and that is correct, because the champion never threw a blade in round one.
    // (The PURSE goes the other way, and pins that separately: the trophy is what
    // pays for finishing, land is what pays for fighting.)
    const w = world();
    const across = (v: number) => ({
      agility: v, sight: v, stamina: v, gameness: v, station: v, condition: v,
    });
    const { field } = pinnedBracket(w, {
      size: 3,
      juiceCents: 100_000,
      each: (i) => across(i === 0 ? 900 : 300), // the top seed is overwhelming
    });
    earned(w.db, field[0].id, field[0].farmId, 10_000); // → committee rank 1 → the bye
    const result = tickThroughCrownDay(w.game).pintakasi[0];
    expect(result.rounds[0].byes).toEqual([field[0].name]);
    expect(result.champion!.bird).toBe(field[0].name);

    const rows = w.db.select().from(tournamentEntries).all();
    const landOf = (birdId: string) => rows.find((e) => e.birdId === birdId)!.landGranted;
    const runnerUp = result.payouts.find((p) => p.stage === "runner-up")!.bird;
    const runnerUpId = w.db.select().from(birds).all().find((b) => b.name === runnerUp)!.id;
    // Two fights happened, so four fighter-slots: 1/4 to the champion (plus dust),
    // 2/4 to the bird that fought twice, 1/4 to the bird it beat first.
    const slots = 2 * 2;
    expect(landOf(runnerUpId)).toBe(landPotShare(PINTAKASI.LAND_POT, slots, 2));
    expect(landOf(field[0].id)).toBeLessThan(landOf(runnerUpId));
    // …and the pot still pays out whole: a bye takes nothing OUT of the divisor
    // either, which is what keeps a short bracket's arithmetic exact.
    expect(rows.reduce((s, e) => s + e.landGranted, 0)).toBe(PINTAKASI.LAND_POT);
  });

  test("A THIN FIELD PAYS MORE PER BIRD — same pot, fewer fights to divide it by", () => {
    // Zane: "if there's just a few participants, they should see a big LT pot,
    // this is good because it encourages participation and maxed out finals
    // brackets." The deleted per-fight mint did the OPPOSITE — it paid by the
    // fight, so a bigger bracket simply minted more — and that inversion of the
    // incentive is one of the reasons a pot was preferred.
    const thin = world();
    pinnedBracket(thin, { size: 2, juiceCents: 100_000 });
    const thinResult = tickThroughCrownDay(thin.game).pintakasi[0];
    expect(thinResult.bracketSize).toBe(2);

    const full = world();
    pinnedBracket(full, { size: 32, juiceCents: 100_000 });
    tickThroughCrownDay(full.game);

    // The straight final's two birds split the whole pot between them; a
    // 32-bracket's champion — five fights deep — takes a twelfth of it.
    const thinGrants = grants(thin.db);
    const fullGrants = grants(full.db);
    expect(thinGrants.reduce((s, n) => s + n, 0)).toBe(PINTAKASI.LAND_POT);
    expect(fullGrants.reduce((s, n) => s + n, 0)).toBe(PINTAKASI.LAND_POT);
    expect(Math.min(...thinGrants)).toBeGreaterThan(Math.max(...fullGrants));
  });

  test("the juvenile crown has its own, smaller pot — and pays it out just as exactly", () => {
    // The two pots are separate knobs for the same reason the two purses are:
    // one stage is the discovery year and one is the top of the game. A shared
    // number is how the deleted grant ladder came to pay a juvenile champion less
    // than its first-round losers — nobody was pricing the stages against each
    // other, because nothing made them look at both at once.
    const w = world();
    pinnedBracket(w, { size: 8, juiceCents: 400_000, division: "juvenile" });
    const result = crownResults(w.game)[0];
    expect(result.bracketSize).toBe(8);
    const paid = grants(w.db);
    expect(paid.reduce((s, n) => s + n, 0)).toBe(JUVENILE_MAJOR.LAND_POT);
    expect(JUVENILE_MAJOR.LAND_POT).toBeLessThan(PINTAKASI.LAND_POT);
    // 7 fights = 14 slots; the champion fought three of them, the first-round
    // losers one each — and the ordering never inverts.
    const slots = 2 * 7;
    expect(paid[0]).toBe(landPotShare(JUVENILE_MAJOR.LAND_POT, slots, 1));
    expect(Math.max(...paid)).toBeGreaterThanOrEqual(
      landPotShare(JUVENILE_MAJOR.LAND_POT, slots, 3)
    );
  });
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
