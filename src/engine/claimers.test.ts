import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/db/client";
import { birds, claims, farms, gameState } from "@/db/schema";
import { seedGame, seedStarterFlock } from "@/db/seed-data";
import { CLAIMER, ECONOMY, STAKER_FLOWS, stakePerFight } from "./config";
import { Flock } from "./flock";
import { Game } from "./game";
import { Lobbies, type LobbySpec } from "./lobbies";
import { onCard } from "./testkit";

const FEE = ECONOMY.REAL_ENTRY_FEE;
/**
 * Tonight's grown claimer — blade AND tag. Since round 31 the tag is part of
 * what the day POSTS (one cheap rung, one dear), so a test can no longer pick
 * a rung off the ladder and expect a lobby to exist for it. Everything these
 * tests assert about money is derived from `spec.price`, never from a literal.
 */
const SPEC = (db: DB): LobbySpec => onCard(db, { mode: "real", classType: "claimer" });

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
/** A wallet to the CENT — the round-22 rakes land fractionally. */
const gpCents = (db: DB, id: string) => {
  const f = db.select().from(farms).where(eq(farms.id, id)).get()!;
  return f.gp * 100 + f.gpCents;
};
const byName = (flock: Flock, name: string) => flock.all().find((b) => b.name === name)!;
// Rival slot 6 = the Alab-slot starter (names are world-unique now; ids are stable).
const owner = (db: DB, birdId: string) =>
  db.select().from(birds).where(eq(birds.id, birdId)).get()!.farmId;

describe("carding a claimer", () => {
  test("tags come off the ladder; claims only land on claimer entries", () => {
    const w = world();
    const alab = byName(w.devFlock, "Alab");
    const spec = SPEC(w.db);
    expect(() => w.dev.enter(alab.id, { ...spec, price: 123 })).toThrow(/claiming tag/);
    // Round 20: the juvenile door now checks the age first — Alab is 2, so
    // it never reaches the class rule. Kidlat (1) does.
    expect(() => w.dev.enter(alab.id, { ...spec, mode: "juvenile" as never })).toThrow(/discovery year only/);
    // Juveniles CAN card a claimer since round 23 — on their own, cheaper
    // ladder. A grown tag isn't one of their rungs.
    expect(() =>
      w.dev.enter(byName(w.devFlock, "Kidlat").id, { ...spec, mode: "juvenile" as never })
    ).toThrow(new RegExp(CLAIMER.JUVENILE_PRICES.join(" / ")));
    expect(() =>
      w.dev.enter(byName(w.devFlock, "Kidlat").id, onCard(w.db, { mode: "juvenile", classType: "claimer" }))
    ).not.toThrow();
    // An open entry takes no claims.
    const open = w.dev.enter(alab.id, onCard(w.db, { mode: "real", classType: "open" }));
    const openEntry = open.lobby.entries[0].entryId;
    expect(() => w.rival.claim(openEntry)).toThrow(/Only claimer entries/);
  });

  test("not your own bird, one claim per farm, tag escrowed now", () => {
    const w = world();
    const tag = SPEC(w.db).price!;
    const { lobby } = w.dev.enter(byName(w.devFlock, "Alab").id, SPEC(w.db));
    const entryId = lobby.entries[0].entryId;
    expect(() => w.dev.claim(entryId)).toThrow(/your own bird/);
    const placed = w.rival.claim(entryId);
    expect(placed.escrowed).toBe(tag);
    expect(gp(w.db, w.rivalId)).toBe(ECONOMY.STARTING_GP - tag);
    expect(() => w.rival.claim(entryId)).toThrow(/already have a claim/);
    expect(() => w.rival.claim(999)).toThrow(/No open entry/);
  });
});

describe("post time (claims settle after the fights)", () => {
  test("a claimed bird fights for its owner, then transfers — prize AND tag to the owner", () => {
    const w = world();
    const devAlab = byName(w.devFlock, "Alab");
    const spec = SPEC(w.db);
    const TAG = spec.price!;
    const { lobby } = w.dev.enter(devAlab.id, spec, 606);
    w.rival.enter("rival-6", spec); // the opponent, same tag
    w.rival.claim(lobby.entries[0].entryId);

    const tick = w.game.tickDay();
    const card = tick.card.find((l) => l.fights.length > 0)!;
    expect(card.fights.length).toBe(1);
    expect(card.claims).toEqual([
      { bird: "Alab", from: "Bukidnon Farms", to: "Rival Gamefarm", price: TAG, losingClaimsRefunded: 0 },
    ]);
    // The bird now lives in the rival barn — with the record it just earned.
    expect(owner(w.db, devAlab.id)).toBe(w.rivalId);
    // Owner economics: entry ± pot, plus the tag — regardless of result.
    // Both take a 2% staker rake since round 22, so the books only balance to
    // the CENT.
    const devWon = card.fights[0].winnerFarm === "Bukidnon Farms";
    // ROUND 34: two birds are a group of two, so it is still one fight — but
    // the wager is a SHARE of the entry, not the entry, and the other two
    // thirds are refunded at settle-up. So the swing is the stake, not the fee.
    const STAKE = stakePerFight(FEE);
    const potRake = Math.round(STAKE * 200 * STAKER_FLOWS.FIGHT_RAKE);
    const tagNet = TAG * 100 - Math.round(TAG * 100 * STAKER_FLOWS.CLAIM_RAKE);
    expect(gpCents(w.db, w.devId)).toBe(
      ECONOMY.STARTING_GP * 100 + (devWon ? STAKE * 100 - potRake : -STAKE * 100) + tagNet
    );
    // Claimant economics: own entry ± pot, minus the tag (the bird is the value).
    expect(gpCents(w.db, w.rivalId)).toBe(
      ECONOMY.STARTING_GP * 100 + (devWon ? -STAKE * 100 : STAKE * 100 - potRake) - TAG * 100
    );
  });

  // RULED ROUND 23, reversing the old behaviour: no fight, no claiming.
  test("an unmatched claimer does NOT sell — the fee and every claim refund", () => {
    const w = world();
    const devAlab = byName(w.devFlock, "Alab");
    const { lobby } = w.dev.enter(devAlab.id, SPEC(w.db), 33); // alone on the card — odd bird out
    w.rival.claim(lobby.entries[0].entryId);
    const tick = w.game.tickDay();
    expect(tick.card[0].fights.length).toBe(0);
    expect(tick.card[0].unmatched.length).toBe(1);
    // The sale used to go through without the fight. It doesn't any more:
    // a claimant shouldn't be able to take a bird on a night it never had to
    // prove anything, and the seller shouldn't lose one on a technicality.
    expect(tick.card[0].claims.length).toBe(0);
    expect(owner(w.db, devAlab.id)).toBe(w.devId); // stays home
    // Everybody is made whole: the entry fee AND the tag come back.
    expect(gp(w.db, w.devId)).toBe(ECONOMY.STARTING_GP);
    expect(gp(w.db, w.rivalId)).toBe(ECONOMY.STARTING_GP);
  });

  // The claim rake SURVIVED round 23. Zane pulled the rake off fight pots
  // only ("return fight pots back to 0%") — a sale is a different thing from
  // a fight, and the tag still pays the landholders their 2%.
  test("the claim rake: the selling barn banks 98% of the tag, the stakers 2%", () => {
    const w = world();
    const devAlab = byName(w.devFlock, "Alab");
    const spec = SPEC(w.db);
    const TAG = spec.price!;
    const { lobby } = w.dev.enter(devAlab.id, spec, 33);
    w.rival.enter("rival-6", spec); // an opponent, so the fight actually runs
    const poolBefore = w.db.select().from(gameState).where(eq(gameState.id, 1)).get()!.stakerPoolCents;
    w.rival.claim(lobby.entries[0].entryId);
    w.game.tickDay();
    const rake = Math.round(TAG * 100 * STAKER_FLOWS.CLAIM_RAKE);
    // The published share, stated two ways so neither can drift alone: 2% of
    // the tag, which in cents is exactly twice the tag in GP.
    expect(STAKER_FLOWS.CLAIM_RAKE).toBe(0.02);
    expect(rake).toBe(TAG * 2);
    const state = w.db.select().from(gameState).where(eq(gameState.id, 1)).get()!;
    expect(state.stakerPoolCents - poolBefore).toBe(rake);
  });

  test("several claims: the RNG picks one winner, every loser refunds in full", () => {
    const w = world();
    const { farm: third } = w.game.farms.register({
      name: "Talpakan Kings",
      primaryColor: "blue",
      secondaryColor: "white",
    });
    const thirdLobbies = new Lobbies(w.db, third.id);
    // Since round 23 a claim only settles if the bird actually fought, so a
    // FOURTH barn supplies the opponent — that keeps the two claimants'
    // wallets clean of entry fees, which is what this test is measuring.
    const { farm: opponentFarm } = w.game.farms.register({
      name: "Batangas Bladeworks",
      primaryColor: "orange",
      secondaryColor: "black",
    });
    seedStarterFlock(w.db, opponentFarm.id, { seed: 99, idPrefix: "opp", shape: "legacy" });
    const devAlab = byName(w.devFlock, "Alab");
    const spec = SPEC(w.db);
    const TAG = spec.price!;
    const { lobby } = w.dev.enter(devAlab.id, spec, 77);
    new Lobbies(w.db, opponentFarm.id).enter("opp-6", spec);
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
