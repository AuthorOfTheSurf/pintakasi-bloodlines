import { and, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { birds, claimerEntries, claims, farms, gameState } from "@/db/schema";
import { BARN, CLAIMER, ECONOMY, type FightFormat } from "./config";
import { Battle, type FormatRecord } from "./battle";
import { Flock } from "./flock";
import { canRealFight } from "./lifecycle";
import { freshSeed, mulberry32, randInt } from "./rng";

/**
 * What the board shows about an entered bird — the PUBLIC card. Deliberately
 * fogged: stars and records are public (as in life), the six stats are NOT.
 * Reading figures well is what makes a claiming farm good at this.
 */
export interface BoardEntry {
  entryId: number;
  farm: { name: string; country: string | null; primaryColor: string; secondaryColor: string };
  bird: {
    name: string;
    sexLabel: "rooster" | "hen" | null;
    age: number;
    stars: string; // e.g. "2.5★ Fire" — visible from birth
    career: { wins: number; losses: number };
    amateur: { wins: number; losses: number };
    formatRecords: Partial<Record<FightFormat, FormatRecord>>;
  };
  format: FightFormat;
  price: number; // the claiming tag
  dayEntered: number;
  mine: boolean; // your own entry — you cannot claim it
  // Claims are SEALED — nobody sees how many are in until the fight goes off.
}

/** One resolved entry, reported from the day tick — a public event. */
export interface ClaimerResolution {
  entryId: number;
  battleLogId: number;
  ownerFarm: string;
  birdName: string;
  format: FightFormat;
  price: number;
  result: "win" | "loss";
  pitFigure: number;
  gpDeltaOwner: number; // pooled fight net + tag if the bird was claimed away
  claimedBy: string | null; // the claiming farm's name, if a claim won
  claimsRefunded: number; // losing claims returned to their farms
  playByPlay: string;
}

/**
 * Claimers — farm-to-farm claiming, escrowed, PRE-FIGHT (re-ruled
 * 2026-08-03). The shape of a claimer's day:
 *
 *   1. During the game-day, an owner ENTERS a bird at a tag price. The
 *      entry fee is escrowed; the entry is binding and uses the bird's
 *      fight for the day.
 *   2. Other farms see the card on the BOARD and place sealed CLAIMS —
 *      the tag price is escrowed per claim. One claim per farm per entry.
 *   3. The fight GOES OFF on the day tick. The bird fights for its
 *      ORIGINAL owner, who keeps the pooled prize either way. Then claims
 *      settle: one wins (RNG among several), the owner receives the tag,
 *      the bird transfers, and every losing claim refunds in full.
 *
 * The house never claims. Claiming is a full playstyle: manage the barn at
 * pace, read the meta, claim undervalued birds and race them UP — farming
 * Land Tokens the whole time, without breeding at all.
 */
export class Claimers {
  private flock: Flock;
  private battle: Battle;

  constructor(
    private database: DB,
    private farmId: string
  ) {
    this.flock = new Flock(database, farmId);
    this.battle = new Battle(database, farmId);
  }

  private today(): number {
    return this.database.select().from(gameState).where(eq(gameState.id, 1)).get()!.dayIndex;
  }

  /** Enter a bird on today's claiming card. Binding — no cancellation. */
  enter(birdId: string, format: FightFormat, price: number, seed: number = freshSeed()): BoardEntry {
    const bird = this.flock.byId(birdId);
    if (bird.status !== "active") throw new Error(`${bird.name} is not an active fighter`);
    if (!canRealFight(bird.age))
      throw new Error(`${bird.name} is ${bird.age} — claimers are real fights, age 2+`);
    if (!(CLAIMER.PRICES as readonly number[]).includes(price))
      throw new Error(`Pick a claiming tag: ${CLAIMER.PRICES.join(" / ")} GP`);

    const today = this.today();
    this.battle.checkFightCap(bird.id, bird.name, today);

    const farm = this.database.select().from(farms).where(eq(farms.id, this.farmId)).get()!;
    const fee = ECONOMY.REAL_ENTRY_FEE;
    if (farm.gp < fee) throw new Error(`The entry costs ${fee} GP (escrowed) — you have ${farm.gp}`);
    this.database.update(farms).set({ gp: farm.gp - fee }).where(eq(farms.id, this.farmId)).run();

    const inserted = this.database
      .insert(claimerEntries)
      .values({
        birdId: bird.id,
        farmId: this.farmId,
        format,
        price,
        entryFee: fee,
        dayEntered: today,
        seed,
      })
      .returning({ id: claimerEntries.id })
      .get();
    return this.card(inserted.id);
  }

  /** The public claiming board — every pending entry, fogged. */
  board(): BoardEntry[] {
    return this.database
      .select()
      .from(claimerEntries)
      .where(eq(claimerEntries.status, "pending"))
      .all()
      .map((row) => this.card(row.id));
  }

  /**
   * Place a sealed claim on a pending entry — the tag price goes to escrow
   * now; the claim settles when the fight goes off at the day tick.
   */
  claim(entryId: number): { entryId: number; escrowed: number; note: string } {
    const entry = this.database
      .select()
      .from(claimerEntries)
      .where(eq(claimerEntries.id, entryId))
      .get();
    if (!entry || entry.status !== "pending") throw new Error(`No open entry #${entryId} on the board`);
    if (entry.farmId === this.farmId) throw new Error("You cannot claim your own bird");
    const existing = this.database
      .select()
      .from(claims)
      .where(and(eq(claims.entryId, entryId), eq(claims.farmId, this.farmId)))
      .all();
    if (existing.length > 0) throw new Error("You already have a claim in on that bird");
    if (this.flock.barnCount() >= BARN.CAPACITY) throw new Error(`The barn is full (${BARN.CAPACITY})`);

    const farm = this.database.select().from(farms).where(eq(farms.id, this.farmId)).get()!;
    if (farm.gp < entry.price)
      throw new Error(`The claiming tag is ${entry.price} GP (escrowed) — you have ${farm.gp}`);
    this.database.update(farms).set({ gp: farm.gp - entry.price }).where(eq(farms.id, this.farmId)).run();
    this.database
      .insert(claims)
      .values({ entryId, farmId: this.farmId, price: entry.price, dayPlaced: this.today() })
      .run();
    return {
      entryId,
      escrowed: entry.price,
      note: "Claim sealed. If several farms claim, the RNG decides when the fight goes off — losers refund in full.",
    };
  }

  /**
   * The day tick's sweep — every pending entry fights and settles. Called
   * AFTER the clock advances, so entries carded on day D go off as day D
   * ends. Order per entry: fight (owner keeps the pooled prize) → claims
   * (one wins, owner gets the tag, the bird transfers, losers refund).
   */
  static resolve(database: DB): ClaimerResolution[] {
    const events: ClaimerResolution[] = [];
    const today = database.select().from(gameState).where(eq(gameState.id, 1)).get()!.dayIndex;
    const pending = database
      .select()
      .from(claimerEntries)
      .where(eq(claimerEntries.status, "pending"))
      .all()
      .filter((e) => e.dayEntered < today);

    for (const entry of pending) {
      // The bird fights for its ORIGINAL owner — a Battle scoped to them.
      const ownerBattle = new Battle(database, entry.farmId);
      const fight = ownerBattle.runClaimerFight(entry);
      const owner = database.select().from(farms).where(eq(farms.id, entry.farmId)).get()!;

      const entryClaims = database
        .select()
        .from(claims)
        .where(and(eq(claims.entryId, entry.id), eq(claims.status, "pending")))
        .all();

      let claimedByName: string | null = null;
      let claimedByFarmId: string | null = null;
      let tagToOwner = 0;
      if (entryClaims.length > 0) {
        // The RNG decides among several — seeded off the entry, replayable.
        const pick = mulberry32(entry.seed ^ 0x9e3779b9);
        const winner = entryClaims[randInt(pick, 0, entryClaims.length - 1)];
        for (const c of entryClaims) {
          if (c.id === winner.id) {
            database.update(claims).set({ status: "won" }).where(eq(claims.id, c.id)).run();
          } else {
            // Losing claims refund in full.
            const claimant = database.select().from(farms).where(eq(farms.id, c.farmId)).get()!;
            database.update(farms).set({ gp: claimant.gp + c.price }).where(eq(farms.id, c.farmId)).run();
            database.update(claims).set({ status: "refunded" }).where(eq(claims.id, c.id)).run();
          }
        }
        // The transfer happens AFTER the fight: owner receives the tag,
        // the claimant receives the bird.
        tagToOwner = entry.price;
        database.update(farms).set({ gp: owner.gp + entry.price }).where(eq(farms.id, entry.farmId)).run();
        database.update(birds).set({ farmId: winner.farmId }).where(eq(birds.id, entry.birdId)).run();
        claimedByFarmId = winner.farmId;
        claimedByName = database.select().from(farms).where(eq(farms.id, winner.farmId)).get()!.name;
      }

      database
        .update(claimerEntries)
        .set({ status: "resolved", battleLogId: fight.battleLogId, claimedByFarmId })
        .where(eq(claimerEntries.id, entry.id))
        .run();

      events.push({
        entryId: entry.id,
        battleLogId: fight.battleLogId,
        ownerFarm: owner.name,
        birdName: fight.bird.name,
        format: entry.format,
        price: entry.price,
        result: fight.won ? "win" : "loss",
        pitFigure: fight.pitFigure,
        gpDeltaOwner: fight.gpDelta + tagToOwner,
        claimedBy: claimedByName,
        claimsRefunded: claimedByName ? entryClaims.length - 1 : 0,
        playByPlay: fight.playByPlay,
      });
    }
    return events;
  }

  /** Build the fogged public card for one entry. */
  private card(entryId: number): BoardEntry {
    const entry = this.database
      .select()
      .from(claimerEntries)
      .where(eq(claimerEntries.id, entryId))
      .get()!;
    const ownerFlock = new Flock(this.database, entry.farmId);
    const bird = ownerFlock.byId(entry.birdId);
    const farm = this.database.select().from(farms).where(eq(farms.id, entry.farmId)).get()!;
    return {
      entryId: entry.id,
      farm: {
        name: farm.name,
        country: farm.country,
        primaryColor: farm.primaryColor,
        secondaryColor: farm.secondaryColor,
      },
      bird: {
        name: bird.name,
        sexLabel: bird.sexLabel,
        age: bird.age,
        stars: bird.stars,
        career: { wins: bird.wins, losses: bird.losses },
        amateur: { wins: bird.practiceWins, losses: bird.practiceLosses },
        formatRecords: this.battle.formatRecords(bird.id),
      },
      format: entry.format,
      price: entry.price,
      dayEntered: entry.dayEntered,
      mine: entry.farmId === this.farmId,
    };
  }
}
