import { afterAll, describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { asc, eq, max } from "drizzle-orm";
import { createDb, type DB } from "@/db/client";
import { actorSpans, birds, events, farmNotes, gameState } from "@/db/schema";
import { currentActor, withActor, type Actor } from "./actor";
import { playMyDay } from "./auto-play";
import { STUD_MARKET } from "./bot-config";
import { Bots } from "./bots";
import { STUD_PRICE } from "./config";
import { diagnose } from "./doctor";
import { emit, withBufferedEvents } from "./events";
import { eventActors, farmLogPage } from "./farm-log";
import type { FarmLogEntry } from "./log-labels";
import { FarmNotes } from "./farm-notes";
import { Gacha } from "./gacha";
import { mulberry32 } from "./rng";
import { makeBird, onCard, world } from "./testkit";

/**
 * The farm log's promise is "here is who made this move". These tests drive
 * the real boundaries (the tick, the bots' turns, Play my day, the engine's
 * own doors inside a player's frame) and read the answer back through the
 * same reader the farm page and the farm_log tool use.
 */

const HOUSE_BOT = "bot-10";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const tmp = mkdtempSync(path.join(tmpdir(), "pintakasi-farm-log-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const asPlayer = (farmId: string, via: "web" | "api" | "mcp" = "web"): Actor => ({
  kind: "player",
  via,
  farmId,
});
const logOf = (db: DB, farmId: string): FarmLogEntry[] =>
  farmLogPage(db, farmId, { limit: 200 }).entries;
const newestEventId = (db: DB) =>
  db
    .select({ id: max(events.id) })
    .from(events)
    .get()?.id ?? 0;
const eventIdOf = (db: DB, message: string) => {
  const row = db.select().from(events).where(eq(events.message, message)).get();
  if (!row) throw new Error(`no event "${message}"`);
  return row.id;
};
const spans = (db: DB) => db.select().from(actorSpans).orderBy(asc(actorSpans.firstEventId)).all();
const farmLogInvariant = (db: DB) => {
  const found = diagnose(db, ":memory:").invariants.find(
    (i) => i.name === "every move on the farm log has an actor"
  );
  if (!found) throw new Error("the doctor no longer runs the farm log invariant");
  return found;
};

describe("actor frames", () => {
  test("inside a buffered tick, each event is credited to the frame it was emitted under", () => {
    const w = world();
    const day = w.db.select().from(gameState).get()?.dayIndex ?? 0;
    const bot: Actor = { kind: "bot", via: "scripted", farmId: w.rivalId };
    // The same nesting Game.tick uses: transaction, then the game's frame,
    // then the buffer, with a barn's turn and a player's move inside.
    w.db.transaction(() =>
      withActor(w.db, { kind: "game" }, () =>
        withBufferedEvents(w.db, day, () => {
          emit(w.db, { type: "check_in", farmId: w.devId, message: "g1" });
          withActor(w.db, bot, () => {
            emit(w.db, { type: "check_in", farmId: w.rivalId, message: "b1" });
            emit(w.db, { type: "check_in", farmId: w.devId, message: "b2" });
          });
          emit(w.db, { type: "check_in", farmId: w.devId, message: "g2" });
          withActor(w.db, asPlayer(w.devId), () =>
            emit(w.db, { type: "check_in", farmId: w.devId, message: "p1" })
          );
          emit(w.db, { type: "check_in", farmId: w.devId, message: "g3" });
        })
      )
    );
    const ids = ["g1", "b1", "b2", "g2", "p1", "g3"].map((m) => eventIdOf(w.db, m));
    const actors = eventActors(w.db, ids);
    const who = ids.map((id) => {
      const a = actors.get(id);
      return a ? `${a.kind}:${a.farmId ?? "-"}` : "none";
    });
    expect(who).toEqual([
      "game:-",
      `bot:${w.rivalId}`,
      `bot:${w.rivalId}`,
      "game:-",
      `player:${w.devId}`,
      "game:-",
    ]);
    // One span per run of one actor, laid end to end over exactly these ids.
    expect(
      spans(w.db)
        .filter((s) => s.firstEventId >= ids[0])
        .map((s) => [s.firstEventId, s.lastEventId, s.actorKind])
    ).toEqual([
      [ids[0], ids[0], "game"],
      [ids[1], ids[2], "bot"],
      [ids[3], ids[3], "game"],
      [ids[4], ids[4], "player"],
      [ids[5], ids[5], "game"],
    ]);
  });

  test("a note made mid-tick lands between the two events around it", () => {
    const w = world();
    const day = w.db.select().from(gameState).get()?.dayIndex ?? 0;
    const note = (message: string) =>
      FarmNotes.write(w.db, { farmId: w.devId, kind: "named", message, visibility: "owner" });
    w.db.transaction(() =>
      withActor(w.db, { kind: "game" }, () =>
        withBufferedEvents(w.db, day, () => {
          note("before any event");
          emit(w.db, { type: "check_in", farmId: w.devId, message: "first" });
          note("between");
          emit(w.db, { type: "check_in", farmId: w.devId, message: "second" });
        })
      )
    );
    expect(
      logOf(w.db, w.devId)
        .slice(0, 4)
        .map((e) => e.message)
    ).toEqual(["Second.", "between", "First.", "before any event"]);
    const placed = w.db.select().from(farmNotes).all();
    const first = eventIdOf(w.db, "first");
    expect(placed.find((n) => n.message === "between")?.afterEventId).toBe(first);
    expect(placed.find((n) => n.message === "before any event")?.afterEventId).toBe(first - 1);
  });

  test("a frame whose work returns a promise is refused, and leaves no frame behind", () => {
    const w = world();
    expect(() => withActor(w.db, asPlayer(w.devId), async () => 1)).toThrow(/synchronous/);
    expect(currentActor(w.db)).toBeNull();
  });

  test("a frame on one handle does not credit writes made through another handle on the same file", () => {
    const file = path.join(tmp, "two-handles.db");
    const w = world({ file });
    const other = createDb(file);
    withActor(w.db, asPlayer(w.devId), () => {
      expect(currentActor(other)).toBeNull();
      emit(other, { type: "check_in", farmId: w.devId, message: "through the other handle" });
      emit(w.db, { type: "check_in", farmId: w.devId, message: "through the framed handle" });
    });
    const otherId = eventIdOf(w.db, "through the other handle");
    const framedId = eventIdOf(w.db, "through the framed handle");
    expect(framedId).toBe(otherId + 1);
    const actors = eventActors(w.db, [otherId, framedId]);
    expect(actors.has(otherId)).toBe(false);
    expect(actors.get(framedId)).toEqual({
      kind: "player",
      via: "web",
      farmId: w.devId,
      runId: null,
    });
  });

  test("a tick that throws leaves no spans or notes behind, and the next move is credited cleanly", () => {
    const w = world();
    Bots.seed(w.db, { only: [HOUSE_BOT] });
    w.game.tickDay();
    const spansBefore = spans(w.db);
    const notesBefore = w.db.select().from(farmNotes).all();
    const eventsBefore = newestEventId(w.db);
    // The tick's last phase throws, after the bots played and the card settled.
    const sweep = spyOn(Bots, "sweepStakes").mockImplementation(() => {
      FarmNotes.write(w.db, {
        farmId: w.devId,
        kind: "named",
        message: "written by a tick that dies",
        visibility: "owner",
      });
      throw new Error("the tick broke");
    });
    try {
      expect(() => w.game.tickDay()).toThrow("the tick broke");
    } finally {
      sweep.mockRestore();
    }
    expect(newestEventId(w.db)).toBe(eventsBefore);
    expect(spans(w.db)).toEqual(spansBefore);
    expect(w.db.select().from(farmNotes).all()).toEqual(notesBefore);
    expect(currentActor(w.db)).toBeNull();

    withActor(w.db, asPlayer(w.devId), () => w.farms.checkIn(w.devId));
    const [checkIn] = logOf(w.db, w.devId);
    expect([checkIn.kind, checkIn.who, checkIn.via]).toEqual(["check_in", "you", "web"]);
    expect(farmLogInvariant(w.db).passed).toBe(true);
  });

  test("framing a move does not change one row of the ledger", () => {
    const play = (framed: boolean) => {
      const w = world();
      const as = <T>(fn: () => T): T => (framed ? withActor(w.db, asPlayer(w.devId), fn) : fn());
      as(() => w.farms.checkIn(w.devId));
      as(() => new Gacha(w.db, w.devId, mulberry32(7)).roll());
      as(() => w.farms.buyLand(w.devId, 2));
      as(() => w.farms.stake(w.devId, 1));
      as(() => w.dev.flock.rename(w.bird("Sinag").id, "Bagong Sinag"));
      const open = onCard(w.db, { mode: "real", classType: "open" });
      as(() => w.dev.lobbies.enter(w.bird("Alab").id, open));
      as(() => w.rival.lobbies.enter(w.rivalSlot("Alab"), open));
      // The rival farm's id is a fresh UUID per world (and so is every bird
      // the gacha hatches), so ids are named by role before comparing. No
      // tick: its fights draw from those ids.
      const role = new Map([
        [w.devId, "dev"],
        [w.rivalId, "rival"],
      ]);
      const rows = w.db
        .select()
        .from(events)
        .orderBy(asc(events.id))
        .all()
        .map((r) => ({
          ...r,
          farmId: r.farmId === null ? null : (role.get(r.farmId) ?? r.farmId),
          birdId: r.birdId !== null && UUID.test(r.birdId) ? "hatched" : r.birdId,
        }));
      return { rows, spans: spans(w.db) };
    };
    const bare = play(false);
    const framed = play(true);
    expect(framed.rows.length).toBeGreaterThan(10);
    expect(framed.rows).toEqual(bare.rows);
    // …and the framing did record something, so the equality is not vacuous.
    expect(framed.spans.filter((s) => s.actorKind === "player").length).toBeGreaterThan(0);
    expect(bare.spans.filter((s) => s.actorKind === "player")).toEqual([]);
  });

  // A LATENT DEFECT, not reachable through today's callers (every engine
  // transaction opens its own frame inside itself). withActor writes its span
  // in `finally`, AFTER a transaction inside the frame has rolled back, so the
  // span outlives the event it covered. The events id is then reused (the
  // AUTOINCREMENT counter rolls back with the transaction), and the next span
  // starting on that id collides with the ghost on actor_spans' primary key:
  // the next move throws "UNIQUE constraint failed: actor_spans.first_event_id".
  test("a transaction that rolls back inside a frame leaves no span behind", () => {
    const w = world();
    expect(() =>
      withActor(w.db, asPlayer(w.devId), () =>
        w.db.transaction(() => {
          emit(w.db, { type: "check_in", farmId: w.devId, message: "rolled back" });
          throw new Error("boom");
        })
      )
    ).toThrow("boom");
    const before = spans(w.db);
    expect(before.every((s) => s.lastEventId <= newestEventId(w.db))).toBe(true);
    expect(() =>
      withActor(w.db, { kind: "game" }, () =>
        emit(w.db, { type: "check_in", farmId: w.devId, message: "next move" })
      )
    ).not.toThrow();
  });
});

describe("who each boundary credits", () => {
  test("a tick: settlement is the game, a barn's own day is the house, its cover on my stud is another farm", () => {
    const w = world();
    Bots.seed(w.db, { only: [HOUSE_BOT] });
    const stud = makeBird(w.db, {
      status: "retired",
      sex: "male",
      name: "Hari ng Bukid",
      agility: 900,
      sight: 900,
      stamina: 900,
      gameness: 900,
      station: 900,
      condition: 900,
      listedStud: 1,
      studPrice: STUD_PRICE.FLOOR,
    });
    for (let i = 0; i < 3; i++)
      makeBird(w.db, { farmId: HOUSE_BOT, status: "retired", sex: "female", name: `Inahin ${i}` });
    const open = onCard(w.db, { mode: "real", classType: "open" });
    withActor(w.db, asPlayer(w.devId), () => w.dev.lobbies.enter(w.bird("Alab").id, open));
    withActor(w.db, asPlayer(w.rivalId), () => w.rival.lobbies.enter(w.rivalSlot("Alab"), open));
    w.game.tickDay();

    const mine = logOf(w.db, w.devId);
    const covers = mine.filter((e) => e.kind === "stud_income");
    expect(covers.length).toBeGreaterThan(0);
    // The span knows the buyer is a scripted house barn; my log does not say
    // so, because whether another barn is a bot or a person is not mine to
    // read.
    const actors = eventActors(
      w.db,
      covers.map((c) => Number(c.cursor.split(".")[0]))
    );
    for (const c of covers) {
      expect(c.message).toContain(stud.name);
      expect([c.who, c.via]).toEqual(["another_farm", null]);
      expect(actors.get(Number(c.cursor.split(".")[0]))?.via).toBe("scripted");
    }
    // A fight row names no farm; the bird's settlement line is the farm's.
    const settled = mine.filter((e) => e.kind === "card_settled" || e.kind === "refund");
    expect(settled.length).toBeGreaterThan(0);
    for (const s of settled) expect([s.who, s.via]).toEqual(["game", null]);
    const entry = mine.find((e) => e.kind === "entry");
    expect([entry?.who, entry?.via]).toEqual(["you", "web"]);

    const house = logOf(w.db, HOUSE_BOT).filter((e) => e.kind === "check_in" || e.kind === "stake");
    expect(house.length).toBeGreaterThan(0);
    for (const h of house) expect([h.who, h.via]).toEqual(["house", "scripted"]);
  });

  test("every move after the first span has an actor on a ticked world, and the doctor names one that does not", () => {
    const w = world();
    Bots.seed(w.db, { only: [HOUSE_BOT] });
    for (let d = 0; d < 3; d++) w.game.tickDay();
    withActor(w.db, asPlayer(w.devId), () => w.farms.checkIn(w.devId));
    const healthy = farmLogInvariant(w.db);
    expect(healthy.passed).toBe(true);
    expect(healthy.offenders).toEqual([]);
    // Spans tile the ledger: none overlaps the one before it.
    const all = spans(w.db);
    for (let i = 1; i < all.length; i++)
      expect(all[i].firstEventId).toBeGreaterThan(all[i - 1].lastEventId);

    // A door with no frame: an engine move made bare, as a route that forgot
    // `act` would make it.
    const bare = newestEventId(w.db) + 1;
    w.farms.buyLand(w.devId, 1);
    const broken = farmLogInvariant(w.db);
    expect(broken.passed).toBe(false);
    expect(broken.offenders).toContain(`event ${bare} (buy_land) has no actor`);
  });

  test("a press the process died in is a FARM LOG warning, not an invariant failure", () => {
    const w = world();
    withActor(w.db, asPlayer(w.devId), () => w.farms.checkIn(w.devId));
    // What a death mid-press leaves: FarmNotes.run's opener, and a move of
    // the run pointing at it, with no summary ever written.
    const opener = w.db
      .insert(farmNotes)
      .values({
        farmId: w.devId,
        dayIndex: 0,
        afterEventId: newestEventId(w.db),
        kind: "play_my_day",
        message: "",
        visibility: "owner",
        actorKind: "autoplay",
        via: "button",
        actorFarmId: w.devId,
      })
      .returning({ id: farmNotes.id })
      .get().id;
    withActor(w.db, { kind: "autoplay", via: "button", farmId: w.devId, runId: opener }, () =>
      w.farms.buyLand(w.devId, 1)
    );
    const report = diagnose(w.db, ":memory:");
    const inv = report.invariants.find((i) => i.name === "every move on the farm log has an actor");
    expect(inv?.passed).toBe(true);
    const health = report.health.find((h) => h.title === "FARM LOG");
    expect(health?.warn).toContain(`#${opener} (play_my_day, ${w.devId}, day 0)`);
    // The log shows no empty line for it.
    expect(logOf(w.db, w.devId).some((e) => e.kind === "play_my_day")).toBe(false);
  });

  test("a finished press leaves one summary, no opener, and no FARM LOG warning", () => {
    const w = world();
    playMyDay(w.db, w.devId);
    const presses = w.db.select().from(farmNotes).where(eq(farmNotes.kind, "play_my_day")).all();
    expect(presses).toHaveLength(1);
    expect(presses[0].message).toMatch(/^Played the day\./);
    expect(presses[0].runId).not.toBe(presses[0].id);
    const report = diagnose(w.db, ":memory:");
    expect(report.health.find((h) => h.title === "FARM LOG")?.warn).toBeUndefined();
    expect(farmLogInvariant(w.db).passed).toBe(true);
  });
});

describe("the lines the ledger does not carry", () => {
  test("a rename leaves a named line with the old and the new name", () => {
    const w = world();
    const bird = w.bird("Alab");
    withActor(w.db, asPlayer(w.devId), () => w.dev.flock.rename(bird.id, "Bagong Alab"));
    const [line] = logOf(w.db, w.devId);
    expect(line).toMatchObject({
      kind: "named",
      who: "you",
      via: "web",
      message: "Named a bird Bagong Alab. It was called Alab.",
    });
    const row = w.db.select().from(farmNotes).where(eq(farmNotes.kind, "named")).get();
    expect(JSON.parse(row?.data ?? "null")).toEqual({ from: "Alab", to: "Bagong Alab" });
    expect(row?.birdId).toBe(bird.id);
  });

  test("a stud price set by hand: pending on a listed stud, posted at once on an unlisted one", () => {
    const w = world();
    const listed = makeBird(w.db, {
      status: "retired",
      sex: "male",
      name: "Nakatayo",
      listedStud: 1,
      studPrice: STUD_PRICE.FLOOR,
    });
    const unlisted = makeBird(w.db, {
      status: "retired",
      sex: "male",
      name: "Bago",
      studPrice: null,
    });
    const up = STUD_PRICE.FLOOR * 2;
    withActor(w.db, asPlayer(w.devId, "api"), () => {
      w.dev.breeding.setStudPrice(unlisted.id, up);
      w.dev.breeding.setStudPrice(listed.id, up);
    });
    const [onListed, onUnlisted] = logOf(w.db, w.devId);
    expect(onListed).toMatchObject({
      kind: "stud_price",
      who: "you",
      via: "api",
      message: `Changed Nakatayo's stud price from ${STUD_PRICE.FLOOR} GP to ${up} GP a cover. The new price starts at the next day tick.`,
    });
    // A never-priced rooster's first price is a first price, not a change from
    // the floor, and an unlisted rooster's price posts at once.
    expect(onUnlisted).toMatchObject({
      kind: "stud_price",
      who: "you",
      message: `Set Bago's first stud price: ${up} GP a cover.`,
    });
  });

  // DEFECT: the two doors word the same state differently. noteStudPrice says
  // a price "reads the same whoever set it", but Breeding.setStudPrice passes
  // `from` through pricesOf (which reads a null stud_price as the floor), while
  // priceStuds passes the raw column. A never-priced rooster therefore reads
  // "Set X's first stud price" when a bot or Play my day prices it and
  // "Changed X's stud price from <floor> GP" when its owner does.
  test("a never-priced rooster's first price reads the same from the owner as from the house", () => {
    const w = world();
    const bird = makeBird(w.db, {
      status: "retired",
      sex: "male",
      name: "Bago",
      studPrice: null,
    });
    withActor(w.db, asPlayer(w.devId), () =>
      w.dev.breeding.setStudPrice(bird.id, STUD_PRICE.FLOOR * 2)
    );
    expect(logOf(w.db, w.devId)[0].message).toBe(
      `Set Bago's first stud price: ${STUD_PRICE.FLOOR * 2} GP a cover.`
    );
  });

  test("a house barn pricing its own stud writes the same sentence, credited to the house", () => {
    const w = world();
    Bots.seed(w.db, { only: [HOUSE_BOT] });
    makeBird(w.db, { farmId: HOUSE_BOT, status: "retired", sex: "male", name: "Bagong Tandang" });
    w.game.tickDay();
    const priced = logOf(w.db, HOUSE_BOT).filter(
      (e) => e.kind === "stud_price" && e.message.includes("Bagong Tandang")
    );
    expect(priced.length).toBeGreaterThan(0);
    for (const p of priced) {
      expect([p.who, p.via]).toEqual(["house", "scripted"]);
      expect(p.message).toMatch(/^Set Bagong Tandang's first stud price: \d+ GP a cover\.$/);
    }
  });

  test("on Hatch Friday, Play my day's reprice is its own line and replaces the hand-set price", () => {
    const w = world();
    w.db.update(gameState).set({ dayIndex: 7 }).where(eq(gameState.id, 1)).run();
    const handSet = 600;
    const stud = makeBird(w.db, {
      status: "retired",
      sex: "male",
      name: "Hand Priced",
      listedStud: 1,
      studPrice: 400,
      studPriceNext: handSet,
    });
    const report = playMyDay(w.db, w.devId);
    const cut = 400 - (400 - STUD_PRICE.FLOOR) * STUD_MARKET.CUT_COLD;
    const to = Math.floor(cut / STUD_MARKET.PRICE_STEP) * STUD_MARKET.PRICE_STEP;
    expect(report.studsRepriced).toEqual([
      { birdId: stud.id, name: "Hand Priced", from: handSet, to },
    ]);

    const log = logOf(w.db, w.devId);
    const summary = log.find((e) => e.kind === "play_my_day");
    const reprice = log.find((e) => e.kind === "stud_price");
    expect(reprice).toMatchObject({
      who: "play_my_day",
      via: "button",
      runId: summary?.runId,
      message: `Changed Hand Priced's stud price from ${handSet} GP to ${to} GP a cover. The new price starts at the next day tick.`,
    });
    expect(w.db.select().from(birds).where(eq(birds.id, stud.id)).get()?.studPriceNext).toBe(to);
  });
});

describe("the fog", () => {
  test("a claim another farm places on my bird never shows on my log", () => {
    const w = world();
    const spec = onCard(w.db, { mode: "real", classType: "claimer" });
    const alab = w.bird("Alab");
    const { lobby } = withActor(w.db, asPlayer(w.devId), () => w.dev.lobbies.enter(alab.id, spec));
    withActor(w.db, asPlayer(w.rivalId), () => w.rival.lobbies.claim(lobby.entries[0].entryId));
    const claim = w.db.select().from(events).where(eq(events.type, "claim")).get();
    // The row carries MY bird under THEIR farm: the shape a bird-id join leaks.
    expect(claim?.birdId).toBe(alab.id);
    expect(claim?.farmId).toBe(w.rivalId);

    const theirs = logOf(w.db, w.rivalId).filter((e) => e.kind === "claim");
    expect(theirs.map((e) => e.who)).toEqual(["you"]);
    const mine = logOf(w.db, w.devId);
    expect(mine.filter((e) => e.kind === "claim")).toEqual([]);
    expect(mine.map((e) => e.message)).not.toContain(theirs[0].message);
  });
});
