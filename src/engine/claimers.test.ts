import { describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { createDb, type DB } from "@/db/client";
import { battleLog, birds, claimerEntries, claims, farms } from "@/db/schema";
import { seedGame, seedStarterFlock } from "@/db/seed-data";
import { Battle } from "./battle";
import { Claimers } from "./claimers";
import { CLAIMER, ECONOMY, LAND } from "./config";
import { Flock } from "./flock";
import { Game } from "./game";

const FEE = ECONOMY.REAL_ENTRY_FEE;
const TAG = CLAIMER.PRICES[2]; // 200 GP — $2.50, first rung above the breed floor

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
    devClaimers: game.claimers,
    devFlock: game.flock,
    devBattle: game.battle,
    rivalClaimers: new Claimers(db, rivalFarm.id),
    rivalFlock: new Flock(db, rivalFarm.id),
  };
}

const gp = (db: DB, id: string) => db.select().from(farms).where(eq(farms.id, id)).get()!.gp;
const byName = (flock: Flock, name: string) => flock.all().find((b) => b.name === name)!;

/** Hunt seeds until the carded fight lands the wanted result. */
function resolved(want: "win" | "loss", withClaim: boolean) {
  for (let seed = 1; seed < 400; seed++) {
    const w = world();
    const alab = byName(w.devFlock, "Alab");
    w.devClaimers.enter(alab.id, "shortKnife", TAG, seed);
    if (withClaim) w.rivalClaimers.claim(1);
    const tick = w.game.tickDay();
    expect(tick.claimerFights.length).toBe(1);
    if (tick.claimerFights[0].result === want)
      return { ...w, ev: tick.claimerFights[0], alabId: alab.id };
  }
  throw new Error(`no ${want} seed found`);
}

describe("entering the card", () => {
  test("escrows the fee, uses the day's fight, binding — and the board is fogged", () => {
    const w = world();
    const alab = byName(w.devFlock, "Alab");
    const card = w.devClaimers.enter(alab.id, "longGaff", TAG);
    expect(gp(w.db, w.devId)).toBe(ECONOMY.STARTING_GP - FEE);
    expect(card.price).toBe(TAG);
    expect(card.mine).toBe(true);

    // The rival sees the same card, not marked mine, with NO stats leaked
    // and NO claim count (claims are sealed).
    const seen = w.rivalClaimers.board();
    expect(seen.length).toBe(1);
    expect(seen[0].mine).toBe(false);
    expect(seen[0].bird.stars).toContain("★");
    expect("agility" in seen[0].bird).toBe(false);
    expect("claims" in seen[0]).toBe(false);

    // Binding: the bird is committed — no second entry, no other fight today.
    expect(() => w.devClaimers.enter(alab.id, "shortKnife", TAG)).toThrow(/claiming card/);
    expect(() => w.devBattle.fight(alab.id, "real", "shortKnife", 7)).toThrow(/claiming card/);
    // And a bird that already fought today can't be carded.
    const sinag = byName(w.devFlock, "Sinag");
    w.devBattle.fight(sinag.id, "real", "shortKnife", 7);
    expect(() => w.devClaimers.enter(sinag.id, "shortKnife", TAG)).toThrow(/already fought/);
    // Tags come off the ladder only.
    expect(() => w.devClaimers.enter(byName(w.devFlock, "Batong Buhay").id, "shortKnife", 123)).toThrow(
      /claiming tag/
    );
  });
});

describe("placing claims", () => {
  test("not your own bird, one claim per farm, tag escrowed now", () => {
    const w = world();
    w.devClaimers.enter(byName(w.devFlock, "Alab").id, "shortKnife", TAG);
    expect(() => w.devClaimers.claim(1)).toThrow(/your own bird/);
    const placed = w.rivalClaimers.claim(1);
    expect(placed.escrowed).toBe(TAG);
    expect(gp(w.db, w.rivalId)).toBe(ECONOMY.STARTING_GP - TAG);
    expect(() => w.rivalClaimers.claim(1)).toThrow(/already have a claim/);
    expect(() => w.rivalClaimers.claim(99)).toThrow(/No open entry/);
  });
});

describe("the card goes off (day tick)", () => {
  test("no claims: pooled settle to the owner, bird stays, log carries the carded day", () => {
    const w = resolved("win", false);
    expect(w.ev.claimedBy).toBeNull();
    expect(w.ev.gpDeltaOwner).toBe(FEE);
    // Escrow math: entered at −FEE, win credits 2×FEE → net +FEE.
    expect(gp(w.db, w.devId)).toBe(ECONOMY.STARTING_GP + FEE);
    // The bird never left, the record moved, land was paid.
    expect(w.devFlock.byId(w.alabId).wins).toBe(2); // Alab seeds at 1W
    const farm = w.db.select().from(farms).where(eq(farms.id, w.devId)).get()!;
    expect(farm.landTokens).toBe(LAND.PER_FIGHT);
    // The fight belongs to the day it was carded (day 0), logged as a claimer.
    const log = w.db
      .select()
      .from(battleLog)
      .where(and(eq(battleLog.birdId, w.alabId), eq(battleLog.lobby, "claimer")))
      .get()!;
    expect(log.dayIndex).toBe(0);
    expect(log.claimPrice).toBe(TAG);
    // Entry resolved; the board is clear.
    expect(w.devClaimers.board().length).toBe(0);
    expect(
      w.db.select().from(claimerEntries).where(eq(claimerEntries.id, w.ev.entryId)).get()!.status
    ).toBe("resolved");
  });

  test("claimed on a WIN: owner keeps the prize AND banks the tag; the bird transfers after the fight", () => {
    const w = resolved("win", true);
    expect(w.ev.claimedBy).toBe("Rival Gamefarm");
    expect(w.ev.gpDeltaOwner).toBe(FEE + TAG);
    expect(gp(w.db, w.devId)).toBe(ECONOMY.STARTING_GP + FEE + TAG);
    expect(gp(w.db, w.rivalId)).toBe(ECONOMY.STARTING_GP - TAG); // escrow spent, bird received
    // The bird now fights out of the rival barn — WITH the win it just earned.
    expect(w.db.select().from(birds).where(eq(birds.id, w.alabId)).get()!.farmId).toBe(w.rivalId);
    expect(w.rivalFlock.byId(w.alabId).wins).toBe(2);
    expect(() => w.devFlock.byId(w.alabId)).toThrow(/in your barn/);
    expect(w.db.select().from(claims).where(eq(claims.entryId, 1)).get()!.status).toBe("won");
  });

  test("claimed on a LOSS: the claim doesn't care about the result", () => {
    const w = resolved("loss", true);
    expect(w.ev.claimedBy).toBe("Rival Gamefarm");
    expect(w.ev.gpDeltaOwner).toBe(-FEE + TAG);
    expect(gp(w.db, w.devId)).toBe(ECONOMY.STARTING_GP - FEE + TAG);
    expect(w.db.select().from(birds).where(eq(birds.id, w.alabId)).get()!.farmId).toBe(w.rivalId);
    expect(w.rivalFlock.byId(w.alabId).losses).toBe(2); // Alab seeds at 1L
  });

  test("several claims: the RNG picks one winner, every loser refunds in full", () => {
    const w = world();
    const { farm: third } = w.game.farms.register({
      name: "Talpakan Kings",
      primaryColor: "blue",
      secondaryColor: "white",
    });
    const thirdClaimers = new Claimers(w.db, third.id);
    w.devClaimers.enter(byName(w.devFlock, "Alab").id, "shortKnife", TAG, 7);
    w.rivalClaimers.claim(1);
    thirdClaimers.claim(1);
    const tick = w.game.tickDay();
    const ev = tick.claimerFights[0];
    expect(ev.claimedBy).not.toBeNull();
    expect(ev.claimsRefunded).toBe(1);
    const owner = w.db.select().from(birds).where(eq(birds.id, byNameId(w))).get()!.farmId;
    const winnerId = owner === w.rivalId ? w.rivalId : third.id;
    const loserId = winnerId === w.rivalId ? third.id : w.rivalId;
    expect([w.rivalId, third.id]).toContain(owner);
    expect(gp(w.db, winnerId)).toBe(ECONOMY.STARTING_GP - TAG); // paid
    expect(gp(w.db, loserId)).toBe(ECONOMY.STARTING_GP); // refunded in full
    const statuses = w.db
      .select()
      .from(claims)
      .where(eq(claims.entryId, 1))
      .all()
      .map((c) => c.status)
      .sort();
    expect(statuses).toEqual(["refunded", "won"]);
  });
});

// The entered bird's id, without re-reading the flock (it may have moved barns).
function byNameId(w: { db: DB }): string {
  return w.db.select().from(birds).all().find((b) => b.name === "Alab" && !b.id.startsWith("rival"))!.id;
}

describe("claimer opponent quality", () => {
  test("the house field keys to the TAG, not to your bird", () => {
    const cheap = world();
    const dear = world();
    cheap.devClaimers.enter(byName(cheap.devFlock, "Alab").id, "shortKnife", CLAIMER.PRICES[0], 77);
    dear.devClaimers.enter(byName(dear.devFlock, "Alab").id, "shortKnife", CLAIMER.PRICES[4], 77);
    const opp = (w: ReturnType<typeof world>) => {
      const battle = new Battle(w.db, w.devId);
      const entry = w.db.select().from(claimerEntries).all()[0];
      return battle.runClaimerFight(entry).opponent.stats;
    };
    const avg = (s: Record<string, number>) => Object.values(s).reduce((x, y) => x + y, 0) / 6;
    expect(avg(opp(dear))).toBeGreaterThan(avg(opp(cheap)));
  });
});
