import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/db/client";
import { birds, claims, farms } from "@/db/schema";
import { seedGame, seedStarterFlock } from "@/db/seed-data";
import { CLAIMER, ECONOMY } from "./config";
import { Flock } from "./flock";
import { Game } from "./game";
import { Lobbies, type LobbySpec } from "./lobbies";

const FEE = ECONOMY.REAL_ENTRY_FEE;
const TAG = CLAIMER.PRICES[2]; // 200 GP — $2.50, first rung above the breed floor
const SPEC: LobbySpec = { mode: "real", classType: "claimer", format: "shortKnife", price: TAG };

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
const byName = (flock: Flock, name: string) => flock.all().find((b) => b.name === name)!;
const owner = (db: DB, birdId: string) =>
  db.select().from(birds).where(eq(birds.id, birdId)).get()!.farmId;

describe("carding a claimer", () => {
  test("tags come off the ladder; claims only land on claimer entries", () => {
    const w = world();
    const alab = byName(w.devFlock, "Alab");
    expect(() => w.dev.enter(alab.id, { ...SPEC, price: 123 })).toThrow(/claiming tag/);
    expect(() => w.dev.enter(alab.id, { ...SPEC, mode: "practice" as never })).toThrow(/open or maiden/);
    // An open entry takes no claims.
    const open = w.dev.enter(alab.id, { mode: "real", classType: "open", format: "shortKnife" });
    const openEntry = open.lobby.entries[0].entryId;
    expect(() => w.rival.claim(openEntry)).toThrow(/Only claimer entries/);
  });

  test("not your own bird, one claim per farm, tag escrowed now", () => {
    const w = world();
    const { lobby } = w.dev.enter(byName(w.devFlock, "Alab").id, SPEC);
    const entryId = lobby.entries[0].entryId;
    expect(() => w.dev.claim(entryId)).toThrow(/your own bird/);
    const placed = w.rival.claim(entryId);
    expect(placed.escrowed).toBe(TAG);
    expect(gp(w.db, w.rivalId)).toBe(ECONOMY.STARTING_GP - TAG);
    expect(() => w.rival.claim(entryId)).toThrow(/already have a claim/);
    expect(() => w.rival.claim(999)).toThrow(/No open entry/);
  });
});

describe("post time (claims settle after the fights)", () => {
  test("a claimed bird fights for its owner, then transfers — prize AND tag to the owner", () => {
    const w = world();
    const devAlab = byName(w.devFlock, "Alab");
    const { lobby } = w.dev.enter(devAlab.id, SPEC, 606);
    w.rival.enter(byName(w.rivalFlock, "Alab").id, SPEC); // the opponent, same tag
    w.rival.claim(lobby.entries[0].entryId);

    const tick = w.game.tickDay();
    const card = tick.card[0];
    expect(card.fights.length).toBe(1);
    expect(card.claims).toEqual([
      { bird: "Alab", from: "Bukidnon Farms", to: "Rival Gamefarm", price: TAG, losingClaimsRefunded: 0 },
    ]);
    // The bird now lives in the rival barn — with the record it just earned.
    expect(owner(w.db, devAlab.id)).toBe(w.rivalId);
    // Owner economics: entry ± pot, plus the tag — regardless of result.
    const devWon = card.fights[0].winnerFarm === "Bukidnon Farms";
    expect(gp(w.db, w.devId)).toBe(ECONOMY.STARTING_GP + (devWon ? FEE : -FEE) + TAG);
    // Claimant economics: own entry ± pot, minus the tag (the bird is the value).
    expect(gp(w.db, w.rivalId)).toBe(ECONOMY.STARTING_GP + (devWon ? -FEE : FEE) - TAG);
  });

  test("an unmatched claimer still transfers — the sale doesn't need the fight", () => {
    const w = world();
    const devAlab = byName(w.devFlock, "Alab");
    const { lobby } = w.dev.enter(devAlab.id, SPEC, 33); // alone on the card — odd bird out
    w.rival.claim(lobby.entries[0].entryId);
    const tick = w.game.tickDay();
    expect(tick.card[0].fights.length).toBe(0);
    expect(tick.card[0].unmatched.length).toBe(1);
    expect(tick.card[0].claims.length).toBe(1);
    expect(owner(w.db, devAlab.id)).toBe(w.rivalId);
    // Fee refunded (no fight), tag banked.
    expect(gp(w.db, w.devId)).toBe(ECONOMY.STARTING_GP + TAG);
    expect(gp(w.db, w.rivalId)).toBe(ECONOMY.STARTING_GP - TAG);
  });

  test("several claims: the RNG picks one winner, every loser refunds in full", () => {
    const w = world();
    const { farm: third } = w.game.farms.register({
      name: "Talpakan Kings",
      primaryColor: "blue",
      secondaryColor: "white",
    });
    const thirdLobbies = new Lobbies(w.db, third.id);
    const devAlab = byName(w.devFlock, "Alab");
    const { lobby } = w.dev.enter(devAlab.id, SPEC, 77);
    const entryId = lobby.entries[0].entryId;
    w.rival.claim(entryId);
    thirdLobbies.claim(entryId);

    const tick = w.game.tickDay();
    const settled = tick.card[0].claims[0];
    expect(settled.losingClaimsRefunded).toBe(1);
    expect([w.rivalId, third.id]).toContain(owner(w.db, devAlab.id));
    const winnerId = owner(w.db, devAlab.id);
    const loserId = winnerId === w.rivalId ? third.id : w.rivalId;
    expect(gp(w.db, winnerId)).toBe(ECONOMY.STARTING_GP - TAG); // paid
    expect(gp(w.db, loserId)).toBe(ECONOMY.STARTING_GP); // refunded in full
    const statuses = w.db
      .select()
      .from(claims)
      .where(eq(claims.entryId, entryId))
      .all()
      .map((c) => c.status)
      .sort();
    expect(statuses).toEqual(["refunded", "won"]);
  });
});
