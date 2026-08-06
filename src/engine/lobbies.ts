import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db/client";
import {
  battleLog,
  birds,
  claims,
  farms,
  gameState,
  lobbies,
  lobbyEntries,
  tournamentEntries,
  tournaments,
  type BirdRow,
} from "@/db/schema";
import {
  BARN,
  CADENCE,
  CLAIMER,
  ECONOMY,
  FIGHTS_PER_GROUP_BIRD,
  FORMATS,
  FORMAT_NAMES,
  GROUP,
  NW_CAP,
  SCOUT,
  PINTAKASI,
  STAKER_FLOWS,
  cardOfDay,
  isOnCard,
  landForFight,
  stakePerFight,
  weatherOfDay,
  type CardKey,
  type Element,
  type FightFormat,
  type FightMode,
  type Lobby,
  fmtLt,
} from "./config";
import { emit, fmtGp } from "./events";
import { creditCents, payStakers } from "./farms";
import { overallGradeOf } from "./grades";
import { normalizedScoutFigure } from "./scout";
import { simulatePair, type Combatant } from "./fight-sim";
import { Flock } from "./flock";
import { canJuvenile, canRealFight } from "./lifecycle";
import { freshSeed, mulberry32, randInt, type Rng } from "./rng";
import { Tournaments } from "./tournaments";

// Re-exported: FightMode moved to config in round 31 (it is a dial like any
// other, and cardOfDay needs it), but every consumer imports it from here.
export type { FightMode };

const MODE_FEES: Record<FightMode, number> = {
  juvenile: ECONOMY.JUVENILE_ENTRY_FEE,
  real: ECONOMY.REAL_ENTRY_FEE,
};

/** The card line for a lobby — shared by resolutions and the ledger. */
function labelOf(lobby: {
  mode: FightMode;
  classType: Lobby;
  format: FightFormat;
  price: number | null;
}): string {
  // "REAL" is the default and goes unsaid (round 20) — only a juvenile card
  // announces its mode.
  const parts: string[] = [];
  if (lobby.mode !== "real") parts.push(lobby.mode.toUpperCase());
  if (lobby.classType !== "open") parts.push(lobby.classType.toUpperCase());
  if (parts.length === 0) parts.push("OPEN");
  return (
    parts.join("·") +
    (lobby.price ? ` @ ${lobby.price} GP tag` : "") +
    ` · ${FORMATS[lobby.format].label}`
  );
}

export interface LobbySpec {
  mode: FightMode;
  classType: Lobby;
  format: FightFormat;
  price?: number; // claimer tag — required for claimers, forbidden elsewhere
}

/** Career + figure summary per format — the past-performance line. */
export type FormatRecord = {
  fights: number;
  wins: number;
  losses: number;
  avgFigure: number;
  bestFigure: number;
};

/** One blade's line in the scout report: the record plus the shrunk read. */
export interface ScoutBlade extends FormatRecord {
  score: number; // (avgFigure·fights + PRIOR_FIGURE·PRIOR_WEIGHT) / (fights + PRIOR_WEIGHT)
}

/** The whole read on a live bird — the sheet's stand-in while the fog is down. */
export interface ScoutReport {
  blades: Record<FightFormat, ScoutBlade>; // ALL five present; unraced = zeros at the prior score
  bestBlade: FightFormat; //                 highest score — where the evidence points
  bestEvidence: FightFormat | null; //       the most-fought blade — where the read is most trustworthy
  totalFights: number;
}

/**
 * What the board shows about an entered bird. Deliberately fogged twice over:
 * stars and records are public (as in life), the six stats are NOT — and in
 * every class except claimers, WHO is entered is hidden until post time
 * (ruled 2026-08-03: visible fields promote dodging; predicting a lobby's
 * strength is part of the skill). Claimer fields stay visible because a
 * claim is placed on a specific bird before the fight — fighting for a tag
 * IS the exposure.
 */
export interface EntryCard {
  entryId: number;
  farm: { name: string; country: string | null; primaryColor: string; secondaryColor: string };
  bird: {
    name: string;
    sexLabel: "rooster" | "hen" | null;
    age: number;
    stars: string; // e.g. "2.5★ Fire" — visible from birth
    // ONE lifetime record (ruled round 15) — juvenile fights included.
    career: { wins: number; losses: number };
    formatRecords: Partial<Record<FightFormat, FormatRecord>>;
  };
  mine: boolean; // your own entry — you cannot claim it
  // THE DRAW, once the lobby has CLOSED: the bird's GROUP — everyone it
  // fights tonight, up to GROUP.SIZE - 1 of them. Absent while the lobby is
  // open; an EMPTY ARRAY after close means the bird drew nobody and refunds at
  // post. (Round 34: this was a single opponent or null, back when a lobby
  // drew pairs. Consumers that showed "drew: null" should now test length.)
  drew?: { bird: string; farm: string }[];
  // Claims on claimer entries are SEALED — no count shown until post time.
}

export interface LobbyView {
  // null on a PHANTOM — a key today's card posted that nobody has entered yet.
  // Explicitly paired with `offered` rather than left as a bare null, so a
  // consumer branches on intent instead of on the absence of an id.
  lobbyId: number | null;
  offered?: true;
  status: "open" | "closed"; // completed lobbies leave the board
  mode: FightMode;
  classType: Lobby;
  format: FightFormat;
  price: number | null; // claimer tag
  fee: number; // entry fee a side
  filled: number; // ALWAYS public — how many are in, never who. No ceiling (round 31).
  // OPEN: fogged — your own entries, plus the full field in claimer
  // lobbies only. CLOSED: the reveal — every entry, with its draw.
  entries: EntryCard[];
}

export interface FightReport {
  battleLogIds: [number, number];
  farms: [string, string];
  birds: [string, string];
  winner: string; // bird name
  winnerFarm: string;
  figures: [number, number];
  groupNo: number; //  which group in the lobby this fight came out of (round 34)
  stake: number; //    GP a side for THIS fight — a share of the entry, not the whole
  // Always EMPTY from a daily-card fight since round 31 (hardcore left the
  // card). Kept because the Majors still fill it and the shape is public API.
  forcedRetirements: string[];
  playByPlay: string;
  // `landEach` lived here until round 34. Land is no longer a per-fight award
  // — it pays once per entry on the night's total risk, so it belongs to a
  // settlement, not a fight. See EntrySettlement.land.
}

/**
 * HOW ONE BIRD'S NIGHT ADDED UP (round 34). Under the group stage an entry is
 * a night, not a fight: the fee escrows whole, a share is risked per fight,
 * and whatever the bird never got to risk comes home. One of these per entry,
 * always — a full card, a short one and an unmatched bird are the same shape
 * with different numbers, which is deliberate: the interesting case is the
 * SHORT card (a group that held a barn-mate, or a lobby that didn't divide
 * evenly) and it would be invisible if only the extremes were reported.
 */
export interface EntrySettlement {
  farm: string;
  bird: string;
  fights: number; //   0 … FIGHTS_PER_GROUP_BIRD
  staked: number; //   GP actually put at risk
  refunded: number; // the unfought share, handed back
  land: number; //     LT for the night, on the curve, off the total staked
}

/**
 * Every name a lobby view needs, read once (round 36). See `lookupFor` — this
 * exists so rendering a room is two queries rather than one per printed name.
 */
interface LobbyLookup {
  birdName: Map<string, string>;
  farms: Map<string, typeof farms.$inferSelect>;
  flockFor: (farmId: string) => Flock;
}

/** One lobby going off at the tick — a public event. */
export interface LobbyResolution {
  lobbyId: number;
  label: string;
  fights: FightReport[];
  settlements: EntrySettlement[]; // every entry, one line each (round 34)
  // The birds that got no fight at all — settlements with `fights: 0`, kept as
  // its own list because "how many entries drew nobody" is the health number
  // this whole round exists to drive down, and it should stay one `.length`.
  unmatched: { farm: string; bird: string; refunded: number }[];
  claims: { bird: string; from: string; to: string; price: number; losingClaimsRefunded: number }[];
}

/**
 * Lobbies — PURE PvP fight selection (re-ruled 2026-08-03). The house
 * supplies nobody; every fight is between barns. The shape of a fight day:
 *
 *   1. Each game-day PUBLISHES A CARD (round 31): about eleven lobby keys out
 *      of the fifty possible, from config.cardOfDay. A bird may be entered
 *      only into a key the day posted — everything else is refused at the
 *      door. Every CLASS runs every day in both divisions; what rotates is
 *      which BLADES each class runs, so nothing is ever stranded (the classes
 *      nest, and adult open is always up) and the shortage lands on the
 *      discovery axis instead. There is exactly ONE lobby per posted key and
 *      it grows without limit — no capacity, no duplicates, so a late entrant
 *      can never find the door shut. Entries are BINDING (fee escrowed, the
 *      bird's card for the day spent) — and ONE ENTRY BUYS A GROUP OF UP TO
 *      THREE FIGHTS (round 34), not one fight. The fee splits across them and
 *      the unfought share comes home.
 *   2. The board is public but FOGGED — you see every lobby and how full it
 *      is, never whose birds are in it (no dodging; judging a lobby's
 *      likely strength is the skill). The one exception is claimer lobbies:
 *      those fields are visible, because sealed claims (tag escrowed; one
 *      per farm; never your own bird) are placed on specific birds before
 *      post time. Fighting for a tag is choosing to be seen.
 *   3. The card runs PFL's three states (ruled 2026-08-03). CLOSE locks the
 *      entries and DEALS THE GROUPS — the field is cut into fours, barn-mates
 *      spread apart, and everyone fights everyone inside their own group
 *      (still NEVER two from the same barn) — and the fog lifts: the full
 *      field and each bird's group go public. Claimers
 *      close hours before post (6 PM PH) so claiming happens informed;
 *      normal lobbies close minutes before. Claims keep flowing until the
 *      lobby COMPLETES — a last-second claim either makes it or it's too
 *      late.
 *   4. COMPLETE fires every fight in every group, then SETTLES UP one bird at
 *      a time: the winner of each fight takes that fight's pooled pot, and
 *      then each entry gets back whatever share of its fee it never risked,
 *      plus land scaled superlinearly to the total it DID risk (fighting up
 *      pays extra; a short card pays less). A bird alone in its room fights
 *      nothing, gets everything back and earns no land — land is for
 *      fighting. Nothing on the daily card can force-retire a bird any more
 *      — hardcore lives only in the Majors.
 *      Then claims settle: one wins per entry (RNG), the owner banks the
 *      tag, the bird transfers, losers refund in full. NO FIGHT, NO CLAIM
 *      (re-ruled round 23 — this used to let a sale go through on an
 *      unmatched bird; see refundClaims): if the bird drew no opponent, its
 *      entry fee refunds AND every claim standing on it refunds too — a
 *      sale needs the fight to actually happen.
 *
 * On manual ticks close-all and complete run back-to-back; the real-time
 * clock (issue #1) spreads them across the PH evening.
 */
export class Lobbies {
  private flock: Flock;

  constructor(
    private database: DB,
    private farmId: string
  ) {
    this.flock = new Flock(database, farmId);
  }

  private today(): number {
    return this.database.select().from(gameState).where(eq(gameState.id, 1)).get()!.dayIndex;
  }

  /** Enter a bird on tonight's card. Binding — no cancellation. */
  enter(birdId: string, spec: LobbySpec, seed?: number): { entryId: number; lobby: LobbyView } {
    const bird = this.flock.byId(birdId);
    if (bird.status !== "active") throw new Error(`${bird.name} is not an active fighter`);
    // The naming law (round 14): no bird fights under an auto-name.
    if (!bird.named)
      throw new Error(
        `${bird.name} hasn't been given a real name — name a bird before its first fight`
      );
    const today = this.today();
    this.checkEligible(bird, spec);
    // THE CARD IS THE DOOR (round 31). A lobby key exists tonight only if the
    // day posted it — see cardOfDay. This throw is a BACKSTOP, not the
    // mechanism: both entry paths wrap `enter` in `quietly()`, so if the
    // choosers were allowed to propose off-card specs and be refused here, the
    // fill rate would collapse without one error surfacing anywhere. The
    // choosers pick FROM the card; this is what stops a hand-written call (a
    // player, an agent, a test) opening a lobby nobody else can find.
    if (!isOnCard(today, spec))
      throw new Error(
        `That fight isn't on tonight's card — ${labelOf({ ...spec, price: spec.price ?? null })}. ` +
          `Check the board (or get_state's card) for what's running today and tomorrow.`
      );

    this.checkCardCap(bird.id, bird.name, today);

    // A championship registrant fights normal cards all week — except on ITS
    // OWN crown day, when the championship IS its card (round 18; Thursday
    // since 20).
    //
    // ⚠ FIXED ROUND 31, and it had been letting birds fight twice in a day.
    // This gated on isCrownDay alone — Thursday — but queried pending entries
    // WITHOUT filtering by division. Two bugs in one:
    //   · Wednesday's Juvenile Championship registrants were never blocked, so
    //     a juvenile entered a normal lobby AND its crown on the same day. The
    //     cap at checkCardCap could not see it: the tournament writes its
    //     battleLog rows at THURSDAY's day index (tournaments.ts), and the
    //     lobby card resolves before resolveCrownDay in Game.tick, so both
    //     fights really happened and nothing counted them together.
    //   · On Thursday a JUVENILE registrant — whose crown had already run the
    //     day before — was blocked from the daily card for nothing.
    // The division lives on `tournaments`, not on the entry, which is why the
    // original query could not tell the two apart without this join.
    const crownDivision = Tournaments.isCrownDay(today)
      ? "major"
      : Tournaments.isJuvenileCrownDay(today)
        ? "juvenile"
        : null;
    if (crownDivision !== null) {
      const registered = this.database
        .select({ id: tournamentEntries.id })
        .from(tournamentEntries)
        .innerJoin(tournaments, eq(tournaments.id, tournamentEntries.tournamentId))
        .where(
          and(
            eq(tournamentEntries.birdId, bird.id),
            eq(tournamentEntries.status, "pending"),
            eq(tournaments.division, crownDivision)
          )
        )
        .all();
      if (registered.length > 0)
        throw new Error(`${bird.name} is registered for the Pintakasi — tonight's crown is its card`);
    }

    const fee = MODE_FEES[spec.mode];
    const farm = this.database.select().from(farms).where(eq(farms.id, this.farmId)).get()!;
    if (farm.gp < fee) throw new Error(`The ${spec.mode} entry costs ${fee} GP (escrowed) — you have ${farm.gp}`);
    this.database.update(farms).set({ gp: farm.gp - fee }).where(eq(farms.id, this.farmId)).run();

    const lobby = this.findOrOpenLobby(spec, today, seed);
    const inserted = this.database
      .insert(lobbyEntries)
      .values({ lobbyId: lobby.id, birdId: bird.id, farmId: this.farmId, fee, dayEntered: today })
      .returning({ id: lobbyEntries.id })
      .get();
    emit(this.database, {
      type: "entry",
      farmId: this.farmId,
      birdId: bird.id,
      gpCents: -fee * 100,
      message: `entered ${bird.name} — ${labelOf(lobby)} (lobby #${lobby.id}, ${fee} GP escrowed)`,
    });
    return { entryId: inserted.id, lobby: this.viewLobby(lobby.id) };
  }

  /**
   * The public board — every OPEN lobby (fogged) and every CLOSED one
   * (revealed: full field + the draw). Completed lobbies are history.
   */
  /**
   * THE BOARD IS THE CARD (round 31). Every lobby that exists, plus a PHANTOM
   * row for every key today posted that nobody has entered yet.
   *
   * Before the card, an unopened key was invisible — a lobby only existed once
   * someone conjured it by entering, so the board could never answer "what can
   * I run tonight?". Now the card is published in advance, and an empty room on
   * it is real information: it is a fight you could be the first into. A
   * phantom carries `lobbyId: null` and `offered: true`; consumers that act on
   * a lobby must skip it, and the two that iterate the board (the bots'
   * liquidity pass and the claim shoppers) do — a phantom has no entries and an
   * even fill of zero.
   */
  board(): LobbyView[] {
    const real = this.database
      .select()
      .from(lobbies)
      .all()
      .filter((l) => l.status === "open" || l.status === "closed")
      .map((l) => this.viewLobby(l.id));
    const sameKey = (a: LobbyView, b: CardKey) =>
      a.mode === b.mode &&
      a.classType === b.classType &&
      a.format === b.format &&
      a.price === (b.price ?? null);
    const phantoms: LobbyView[] = cardOfDay(this.today())
      .filter((k) => !real.some((l) => l.status === "open" && sameKey(l, k)))
      .map((k) => ({
        lobbyId: null,
        offered: true,
        status: "open" as const,
        mode: k.mode,
        classType: k.classType,
        format: k.format,
        price: k.price ?? null,
        fee: MODE_FEES[k.mode],
        filled: 0,
        entries: [],
      }));
    return [...real, ...phantoms];
  }

  /**
   * Place a sealed claim on a pending CLAIMER entry — the tag escrows now
   * and settles when the card goes off at the day tick.
   */
  claim(entryId: number): { entryId: number; escrowed: number; note: string } {
    const entry = this.database.select().from(lobbyEntries).where(eq(lobbyEntries.id, entryId)).get();
    if (!entry || entry.status !== "pending") throw new Error(`No open entry #${entryId} on the board`);
    const lobby = this.database.select().from(lobbies).where(eq(lobbies.id, entry.lobbyId)).get()!;
    if (lobby.classType !== "claimer") throw new Error("Only claimer entries take claims");
    if (entry.farmId === this.farmId) throw new Error("You cannot claim your own bird");
    const existing = this.database
      .select()
      .from(claims)
      .where(and(eq(claims.entryId, entryId), eq(claims.farmId, this.farmId)))
      .all();
    if (existing.length > 0) throw new Error("You already have a claim in on that bird");
    if (this.flock.barnCount() >= BARN.CAPACITY) throw new Error(`The barn is full (${BARN.CAPACITY})`);

    const price = lobby.price!;
    const farm = this.database.select().from(farms).where(eq(farms.id, this.farmId)).get()!;
    if (farm.gp < price) throw new Error(`The claiming tag is ${price} GP (escrowed) — you have ${farm.gp}`);
    this.database.update(farms).set({ gp: farm.gp - price }).where(eq(farms.id, this.farmId)).run();
    this.database
      .insert(claims)
      .values({ entryId, farmId: this.farmId, price, dayPlaced: this.today() })
      .run();
    const target = this.database.select().from(birds).where(eq(birds.id, entry.birdId)).get()!;
    emit(this.database, {
      type: "claim",
      farmId: this.farmId,
      birdId: entry.birdId,
      gpCents: -price * 100,
      message: `sealed a ${price} GP claim on ${target.name} (entry #${entryId})`,
    });
    return {
      entryId,
      escrowed: price,
      note: "Claim sealed. If several farms claim, the RNG decides at post time — losers refund in full.",
    };
  }

  /**
   * The past-performance lines: record + figures per format, from the battle
   * log. Comparing avgFigure ACROSS formats is how a bird gets typed.
   */
  formatRecords(birdId: string): Partial<Record<FightFormat, FormatRecord>> {
    const rows = this.database.select().from(battleLog).where(eq(battleLog.birdId, birdId)).all();
    const out: Partial<Record<FightFormat, FormatRecord>> = {};
    for (const row of rows) {
      const rec = (out[row.format] ??= { fights: 0, wins: 0, losses: 0, avgFigure: 0, bestFigure: 0 });
      rec.fights += 1;
      if (row.result === "win") rec.wins += 1;
      else rec.losses += 1;
      rec.avgFigure += row.pitFigure; // sum for now, divided below
      rec.bestFigure = Math.max(rec.bestFigure, row.pitFigure);
    }
    for (const rec of Object.values(out)) rec.avgFigure = Math.round(rec.avgFigure / rec.fights);
    return out;
  }

  /**
   * THE SCOUT REPORT (round 28 — the fog comes down). With stats hidden
   * until retirement, a live bird IS its figure history, and this is that
   * history turned into a ranked read: every blade gets a `score`, the
   * average figure SHRUNK toward SCOUT.PRIOR_FIGURE by PRIOR_WEIGHT
   * pseudo-fights. Shrinkage is the whole trick — one lucky 80 at B1 must
   * not out-rank three honest 60s at B3, and an unraced blade must read as
   * "average, unknown", never as "bad".
   *
   * Players (get_bird), auto-play and the bots all read THIS — identical
   * evidence, no side channel. Like formBook, deliberately NOT farm-scoped:
   * a claimer target is exactly the bird you most need to scout.
   */
  scoutReport(birdId: string): ScoutReport {
    const records = this.formatRecords(birdId);
    const normalizedTotals = Object.fromEntries(FORMAT_NAMES.map((f) => [f, 0])) as Record<FightFormat, number>;
    for (const row of this.database.select().from(battleLog).where(eq(battleLog.birdId, birdId)).all())
      normalizedTotals[row.format] += normalizedScoutFigure(
        row.pitFigure,
        row.selfGrade as import("./grades").Grade,
        row.opponentGrade as import("./grades").Grade
      );
    const blades = {} as Record<FightFormat, ScoutBlade>;
    let totalFights = 0;
    for (const f of FORMAT_NAMES) {
      const rec = records[f] ?? { fights: 0, wins: 0, losses: 0, avgFigure: 0, bestFigure: 0 };
      totalFights += rec.fights;
      const score =
        (normalizedTotals[f] + SCOUT.PRIOR_FIGURE * SCOUT.PRIOR_WEIGHT) /
        (rec.fights + SCOUT.PRIOR_WEIGHT);
      blades[f] = { ...rec, score: Math.round(score * 10) / 10 };
    }
    // Ties break in dial order (FORMAT_NAMES) — stable, and it means a
    // fresh bird "prefers" the sprint only in the sense that somebody has
    // to be first alphabetically.
    const bestBlade = FORMAT_NAMES.reduce((best, f) =>
      blades[f].score > blades[best].score ? f : best
    );
    const mostFought = FORMAT_NAMES.reduce((best, f) =>
      blades[f].fights > blades[best].fights ? f : best
    );
    return {
      blades,
      bestBlade,
      bestEvidence: blades[mostFought].fights > 0 ? mostFought : null,
      totalFights,
    };
  }

  /**
   * The daily CARD cap — a hard count, not a cooldown. A PENDING entry
   * counts: the bird is committed to tonight's card.
   *
   * ⚠ REWRITTEN ROUND 34, and the old shape would have been wrong rather than
   * merely stale. It summed today's battleLog rows with the bird's pending
   * entries and compared the total to a cap of 1 — which read as "one fight a
   * day" only because one entry meant one fight. Under the group stage a
   * settled card leaves THREE battleLog rows, so the sum stopped meaning
   * anything countable. What the rule was always about is CARDS: a bird may be
   * on one lobby card a day, and it may not also have been in a bracket that
   * day. Those are two different questions, so they are asked separately now.
   */
  checkCardCap(birdId: string, name: string, today: number): void {
    const carded = this.database
      .select()
      .from(lobbyEntries)
      .where(and(eq(lobbyEntries.birdId, birdId), eq(lobbyEntries.dayEntered, today)))
      .all().length;
    if (carded >= CADENCE.ENTRIES_PER_BIRD_PER_DAY)
      throw new Error(`${name} is already on tonight's card — entries are binding until the day turns`);
    // A bracket fight also spends the day. Tournament rows are the ones with
    // no lobbyId (see Tournaments.runFight); lobby rows are already counted
    // above, by their entry, so counting them here again would double.
    const bracketed = this.database
      .select()
      .from(battleLog)
      .where(and(eq(battleLog.birdId, birdId), eq(battleLog.dayIndex, today)))
      .all()
      .filter((r) => r.lobbyId === null).length;
    if (bracketed > 0)
      throw new Error(`${name} already fought today — one card per bird per game-day (tick a day)`);
  }

  /**
   * CLOSE — entries lock, THE GROUPS ARE DEALT, the fog lifts. Claimers
   * close early (6 PM PH) for the claiming window; "all" is the pre-post
   * sweep. The deal is seeded by the lobby, so a replayed close replays.
   */
  static close(database: DB, which: "claimers" | "all"): number {
    let closedCount = 0;
    for (const lobby of database.select().from(lobbies).where(eq(lobbies.status, "open")).all()) {
      if (which === "claimers" && lobby.classType !== "claimer") continue;
      const rng = mulberry32(lobby.seed);
      const entries = database
        .select()
        .from(lobbyEntries)
        .where(and(eq(lobbyEntries.lobbyId, lobby.id), eq(lobbyEntries.status, "pending")))
        .all();
      Lobbies.dealGroups(entries, rng).forEach((group, groupNo) => {
        for (const e of group)
          database.update(lobbyEntries).set({ groupNo }).where(eq(lobbyEntries.id, e.id)).run();
      });
      database.update(lobbies).set({ status: "closed" }).where(eq(lobbies.id, lobby.id)).run();
      closedCount++;
    }
    return closedCount;
  }

  /**
   * COMPLETE — every closed lobby goes off: the drawn pairs fight, the
   * drawless refund, then claims settle. The fight stream is seeded
   * independently of the draw stream so close and complete can happen
   * hours apart without breaking replays.
   */
  static complete(database: DB): LobbyResolution[] {
    const events: LobbyResolution[] = [];
    const week = Math.floor(
      database.select().from(gameState).where(eq(gameState.id, 1)).get()!.dayIndex / 7
    );

    for (const lobby of database.select().from(lobbies).where(eq(lobbies.status, "closed")).all()) {
      const rng = mulberry32((lobby.seed ^ 0x9e3779b9) >>> 0); // the post-time stream
      const entries = database
        .select()
        .from(lobbyEntries)
        .where(and(eq(lobbyEntries.lobbyId, lobby.id), eq(lobbyEntries.status, "pending")))
        .all();

      const label = labelOf(lobby);
      const event: LobbyResolution = {
        lobbyId: lobby.id,
        label,
        fights: [],
        settlements: [],
        unmatched: [],
        claims: [],
      };
      // The card goes off under the day's ascendant element (round 24) —
      // every lobby posted on the same day shares one weather.
      const weather = weatherOfDay(lobby.dayOpened);

      // THE GROUP STAGE (round 34). Inside a group everybody fights everybody
      // — except two birds of the same barn, who are still never matched. That
      // exception is why a group of four does not always mean three fights,
      // and why `fights` is counted rather than assumed.
      const groups = new Map<number, typeof entries>();
      for (const e of entries) {
        const g = e.groupNo ?? 0;
        const bucket = groups.get(g);
        if (bucket) bucket.push(e);
        else groups.set(g, [e]);
      }
      const taken = new Map<number, number>(entries.map((e) => [e.id, 0]));
      for (const [groupNo, group] of [...groups].sort((a, b) => a[0] - b[0])) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const [a, b] = [group[i], group[j]];
            if (a.farmId === b.farmId) continue; // matchmaking never pairs barn-mates
            const stake = stakePerFight(a.fee);
            event.fights.push(
              Lobbies.runFight(database, lobby, a, b, label, rng, week, weather, stake, groupNo)
            );
            taken.set(a.id, taken.get(a.id)! + 1);
            taken.set(b.id, taken.get(b.id)! + 1);
          }
        }
      }

      // SETTLE UP, one line per bird. The fee escrowed whole at the door; the
      // fights above consumed a share each. Whatever was never risked comes
      // home, and land pays once on what was — so a bird alone in its room
      // gets everything back and no land (land is for FIGHTING), and a bird
      // whose group was short gets the difference back and a smaller award.
      for (const entry of entries) {
        const fights = taken.get(entry.id)!;
        const staked = stakePerFight(entry.fee) * fights;
        const refunded = entry.fee - staked;
        const land = fights > 0 ? landForFight(staked) : 0;
        const farm = database.select().from(farms).where(eq(farms.id, entry.farmId)).get()!;
        database
          .update(farms)
          .set({ gp: farm.gp + refunded, landTokensCents: farm.landTokensCents + land })
          .where(eq(farms.id, entry.farmId))
          .run();
        database
          .update(lobbyEntries)
          .set({ status: fights > 0 ? "fought" : "unmatched", fights })
          .where(eq(lobbyEntries.id, entry.id))
          .run();
        const bird = database.select().from(birds).where(eq(birds.id, entry.birdId)).get()!;
        event.settlements.push({ farm: farm.name, bird: bird.name, fights, staked, refunded, land });
        if (fights === 0) {
          emit(database, {
            type: "refund",
            farmId: entry.farmId,
            birdId: entry.birdId,
            gpCents: refunded * 100,
            message: `${bird.name} drew nobody in ${label} — ${refunded} GP refunded`,
          });
          event.unmatched.push({ farm: farm.name, bird: bird.name, refunded });
        } else {
          emit(database, {
            type: "card_settled",
            farmId: entry.farmId,
            birdId: entry.birdId,
            gpCents: refunded * 100,
            lt: land,
            message:
              `${bird.name} finished ${label} — ${fights} of ${FIGHTS_PER_GROUP_BIRD} fights, ` +
              `${staked} GP risked, +${fmtLt(land)} LT` +
              // Say nothing about a refund of nothing: a full card is the
              // normal case and "0 GP back" reads as a bug in the ledger.
              (refunded > 0 ? ` · ${refunded} GP unfought and returned` : ""),
          });
        }
      }

      // Claims settle last — after the fights. Prize money stayed with the
      // original owner above; only NOW does the bird change barns.
      //
      // NO FIGHT, NO CLAIM (ruled round 23). An unmatched bird's entry fee
      // refunds, and every claim standing on it refunds too. The old rule let
      // the sale go through without the fight, which meant a claimant could
      // buy a bird that never had to prove anything that night — and the
      // seller couldn't tell whether the tag was being taken on form or on a
      // technicality. If the card doesn't happen, nothing happens.
      if (lobby.classType === "claimer") {
        for (const entry of entries) {
          // ONE fight is enough to make the sale (round 34). The rule is that
          // a tag needs the bird to have proven something that night, not that
          // it filled its whole group — a short card is the lobby's fault, not
          // the bird's, and voiding a sale over it would punish the seller for
          // the draw.
          if ((taken.get(entry.id) ?? 0) === 0) {
            Lobbies.refundClaims(database, entry.id, "the bird drew no opponent");
            continue;
          }
          const settled = Lobbies.settleClaims(database, entry.id, lobby.price!, rng);
          if (settled) event.claims.push(settled);
        }
      }

      database.update(lobbies).set({ status: "completed" }).where(eq(lobbies.id, lobby.id)).run();
      events.push(event);
    }
    return events;
  }

  /**
   * The manual tick's sweep: close whatever is still open, then the whole
   * card goes off. The real-time clock (issue #1) calls close and complete
   * on their own PH schedule instead.
   */
  static resolve(database: DB): LobbyResolution[] {
    Lobbies.close(database, "all");
    return Lobbies.complete(database);
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /**
   * THE DEAL (round 34) — a lobby's field is cut into GROUPS of at most
   * GROUP.SIZE, and everybody fights everybody inside their own group.
   *
   * This replaced a greedy pair-matcher, and the reason is arithmetic. Pairing
   * an unbounded lobby strands the odd bird whenever the field is odd, and
   * strands EVERYONE when a room holds one entry — no matchmaker can fix that,
   * because odd is odd. Dealing groups strands a bird only when it was alone.
   *
   * Two properties the deal has to have, in this order of importance:
   *
   *   1. NO GROUP OF ONE while the lobby has two or more birds. The sizes are
   *      levelled rather than packed: nine entries become 3+3+3, not 4+4+1.
   *      A group of two or three is a real, if short, night; a group of one is
   *      the failure this round exists to delete.
   *   2. BARN-MATES SPREAD OUT. Matchmaking still never pairs two birds of one
   *      barn, so a group holding two of them yields fewer fights and both
   *      birds get part of their stake back. So the biggest barn in the room
   *      is dealt FIRST, while there is still room to spread it — placing the
   *      easy singletons first would fill the groups and force the collisions.
   *
   * Ties are broken on the rng so the deal is seeded and a replayed close
   * replays exactly.
   */
  private static dealGroups(
    entries: (typeof lobbyEntries.$inferSelect)[],
    rng: Rng
  ): (typeof lobbyEntries.$inferSelect)[][] {
    const n = entries.length;
    if (n === 0) return [];

    const shuffled = [...entries];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randInt(rng, 0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // As few groups as will hold the field, then sizes levelled across them —
    // this is what guarantees property 1. With n < GROUP.MIN_SIZE there is one
    // group and it is a lone bird; it refunds, which is correct and the only
    // case that still can.
    const count = Math.ceil(n / GROUP.SIZE);
    const caps = Array.from(
      { length: count },
      (_, i) => Math.floor(n / count) + (i < n % count ? 1 : 0)
    );
    const groups: (typeof lobbyEntries.$inferSelect)[][] = caps.map(() => []);

    const byFarm = new Map<string, (typeof lobbyEntries.$inferSelect)[]>();
    for (const e of shuffled) {
      const bucket = byFarm.get(e.farmId);
      if (bucket) bucket.push(e);
      else byFarm.set(e.farmId, [e]);
    }
    const biggestBarnFirst = [...byFarm.values()].sort((a, b) => b.length - a.length).flat();

    for (const entry of biggestBarnFirst) {
      let best = -1;
      let bestKey: [number, number, number] | null = null;
      for (let i = 0; i < groups.length; i++) {
        if (groups[i].length >= caps[i]) continue;
        const mates = groups[i].filter((x) => x.farmId === entry.farmId).length;
        // Fewest barn-mates wins, then emptiest, then the coin.
        const key: [number, number, number] = [mates, groups[i].length, randInt(rng, 0, 1 << 20)];
        if (
          bestKey === null ||
          key[0] < bestKey[0] ||
          (key[0] === bestKey[0] && key[1] < bestKey[1]) ||
          (key[0] === bestKey[0] && key[1] === bestKey[1] && key[2] < bestKey[2])
        ) {
          best = i;
          bestKey = key;
        }
      }
      groups[best].push(entry); // caps sum to n, so a seat always exists
    }
    return groups;
  }

  private static runFight(
    database: DB,
    lobby: typeof lobbies.$inferSelect,
    ea: typeof lobbyEntries.$inferSelect,
    eb: typeof lobbyEntries.$inferSelect,
    label: string,
    rng: Rng,
    week: number,
    weather: Element,
    // ROUND 34: what each side is risking on THIS fight — a share of the
    // entry fee, not the fee. Passed in rather than derived here so the split
    // rule lives in exactly one place (config.stakePerFight) and the fight
    // never has to know how many fights the night holds.
    stake: number,
    groupNo: number
  ): FightReport {
    const simSeed = randInt(rng, 1, 2 ** 31 - 1);
    const rowA = database.select().from(birds).where(eq(birds.id, ea.birdId)).get()!;
    const rowB = database.select().from(birds).where(eq(birds.id, eb.birdId)).get()!;
    const sim = simulatePair(
      toCombatant(rowA),
      toCombatant(rowB),
      lobby.format,
      mulberry32(simSeed),
      label,
      weather
    );

    const sides = [
      { entry: ea, row: rowA, won: sim.winner === 0, figure: sim.figures[0] },
      { entry: eb, row: rowB, won: sim.winner === 1, figure: sim.figures[1] },
    ];
    // The staker rake (round 22): a slice off the pooled pot, paid to the Land
    // Token pool before the winner is. Standing at 0 since round 23 — the
    // plumbing stays wired so a future season is one number, not a rebuild.
    // No GP is printed or burned; the rake lands in the pool, not the wallet.
    //
    // ⚠ THE POT IS TWO STAKES, NOT TWO FEES (round 34). It read `ea.fee * 200`
    // until the group stage split the entry across three fights; leaving it
    // would have paid a winner three times over out of escrow that was never
    // put up, and the conservation proof would have caught it — after a sim.
    const potCents = stake * 200;
    const rakeCents = Math.round(potCents * STAKER_FLOWS.FIGHT_RAKE);
    const forcedRetirements: string[] = [];
    const logIds: number[] = [];
    const farmNames: string[] = [];

    for (const [i, side] of sides.entries()) {
      const other = sides[1 - i];
      const farm = database.select().from(farms).where(eq(farms.id, side.entry.farmId)).get()!;
      farmNames.push(farm.name);
      // Escrow settle: winner takes this fight's pooled pot (own stake back +
      // the other side's), the loser's stake is what fed it. Land does NOT
      // pay here any more (round 34) — it settles once per entry, on the
      // night's total risk, back in `complete`.
      // The FARM's record moves here too — it can't be derived from owned
      // birds later, because birds transfer. ONE record (ruled round 15):
      // juvenile fights count toward the lifetime record like any other.
      const farmRecord = side.won ? { wins: farm.wins + 1 } : { losses: farm.losses + 1 };
      database.update(farms).set(farmRecord).where(eq(farms.id, side.entry.farmId)).run();
      // The pot, less the rake — through creditCents because 78.40 GP isn't
      // a whole number and the books are kept to the cent.
      if (side.won) creditCents(database, side.entry.farmId, potCents - rakeCents);
      database
        .update(birds)
        .set(
          side.won
            ? {
                wins: side.row.wins + 1,
                // The ladder's line: practice wins don't graduate a maiden.
                stakesWins: side.row.stakesWins + (lobby.mode === "juvenile" ? 0 : 1),
                // …and the road to a crown (round 22): the championships are
                // free to enter, so a win here is how a bird buys its way in.
                crownPoints: side.row.crownPoints + (PINTAKASI.POINTS_FOR[lobby.mode] ?? 0),
              }
            : { losses: side.row.losses + 1 }
        )
        .where(eq(birds.id, side.row.id))
        .run();
      // The key rule's teeth used to live here. Round 31 took hardcore off the
      // daily card entirely (Zane: "There should be 0 hardcore fights outside
      // the Finals"), so nothing in a lobby force-retires any more — the only
      // hardcore in the game is the Pintakasi Majors, and Tournaments owns that
      // path (see Flock.hardcoreRetire, which both used to share). The
      // `forcedRetirements` field on a FightReport stays, always empty from
      // here, because the resolution shape is public API and the Majors still
      // fill it.
      const inserted = database
        .insert(battleLog)
        .values({
          dayIndex: lobby.dayOpened, // the fight belongs to the day it was carded
          lobbyId: lobby.id,
          farmId: side.entry.farmId,
          birdId: side.row.id,
          mode: lobby.mode,
          format: lobby.format,
          lobby: lobby.classType,
          claimPrice: lobby.price,
          opponentBirdId: other.row.id,
          opponentFarmId: other.entry.farmId,
          opponentName: other.row.name,
          selfGrade: overallGradeOf(side.row.agility + side.row.sight + side.row.stamina + side.row.gameness + side.row.station + side.row.condition),
          opponentGrade: overallGradeOf(other.row.agility + other.row.sight + other.row.stamina + other.row.gameness + other.row.station + other.row.condition),
          result: side.won ? "win" : "loss",
          pitFigure: side.figure,
          // Net to the bird's barn, in cents: the winner keeps the other
          // side's stake less the rake; the loser drops its own. Round 34: the
          // stake, not the entry fee — one fight is a third of the night.
          gpDeltaCents: side.won ? stake * 100 - rakeCents : -stake * 100,
          seed: simSeed,
          playByPlay: sim.playByPlay,
        })
        .returning({ id: battleLog.id })
        .get();
      logIds.push(inserted.id);
      // The entry's status and fight count are set once, at settle-up in
      // `complete` — a bird may be in the middle of its group here.
    }

    const winnerSide = sides[sim.winner];
    const loserSide = sides[1 - sim.winner];
    payStakers(database, rakeCents, "fight_rake", `${label} pot rake`);
    emit(database, {
      type: "fight",
      birdId: winnerSide.row.id,
      message:
        `${winnerSide.row.name} (${farmNames[sim.winner]}) def. ${loserSide.row.name} (${farmNames[1 - sim.winner]}) — ` +
        `${label} · figures ${winnerSide.figure}/${loserSide.figure} · pot ${fmtGp(potCents - rakeCents)} GP` +
        // The rake is 0 since round 23 — say nothing rather than "(0.00 to stakers)".
        (rakeCents > 0 ? ` (${fmtGp(rakeCents)} to stakers)` : "") +
        ` · group ${groupNo + 1}` +
        (forcedRetirements.length ? ` · ${forcedRetirements.join(", ")} force-retired` : ""),
      data: { lobbyId: lobby.id, battleLogIds: logIds, figures: sim.figures, pot: stake * 2, groupNo },
    });
    return {
      battleLogIds: [logIds[0], logIds[1]],
      farms: [farmNames[0], farmNames[1]],
      birds: [rowA.name, rowB.name],
      winner: winnerSide.row.name,
      winnerFarm: farmNames[sim.winner],
      figures: sim.figures,
      groupNo,
      stake,
      forcedRetirements,
      playByPlay: sim.playByPlay,
    };
  }

  /**
   * Hand every claim on an entry back (round 23) — used when the bird never
   * fought. The claimant's escrow returns in full and the bird stays home.
   */
  private static refundClaims(database: DB, entryId: number, why: string): void {
    const standing = database
      .select()
      .from(claims)
      .where(and(eq(claims.entryId, entryId), eq(claims.status, "pending")))
      .all();
    if (standing.length === 0) return;
    const entry = database.select().from(lobbyEntries).where(eq(lobbyEntries.id, entryId)).get()!;
    const bird = database.select().from(birds).where(eq(birds.id, entry.birdId)).get()!;
    for (const c of standing) {
      const claimant = database.select().from(farms).where(eq(farms.id, c.farmId)).get()!;
      database.update(farms).set({ gp: claimant.gp + c.price }).where(eq(farms.id, c.farmId)).run();
      database.update(claims).set({ status: "refunded" }).where(eq(claims.id, c.id)).run();
      emit(database, {
        type: "claim_refund",
        farmId: c.farmId,
        birdId: entry.birdId,
        gpCents: c.price * 100,
        message: `claim on ${bird.name} called off — ${why}, ${c.price} GP refunded`,
      });
    }
  }

  private static settleClaims(
    database: DB,
    entryId: number,
    price: number,
    rng: Rng
  ): LobbyResolution["claims"][number] | null {
    const entryClaims = database
      .select()
      .from(claims)
      .where(and(eq(claims.entryId, entryId), eq(claims.status, "pending")))
      .all();
    if (entryClaims.length === 0) return null;
    const entry = database.select().from(lobbyEntries).where(eq(lobbyEntries.id, entryId)).get()!;

    const preBird = database.select().from(birds).where(eq(birds.id, entry.birdId)).get()!;
    const winner = entryClaims[randInt(rng, 0, entryClaims.length - 1)];
    for (const c of entryClaims) {
      if (c.id === winner.id) {
        database.update(claims).set({ status: "won" }).where(eq(claims.id, c.id)).run();
      } else {
        const claimant = database.select().from(farms).where(eq(farms.id, c.farmId)).get()!;
        database.update(farms).set({ gp: claimant.gp + c.price }).where(eq(farms.id, c.farmId)).run();
        database.update(claims).set({ status: "refunded" }).where(eq(claims.id, c.id)).run();
        emit(database, {
          type: "claim_refund",
          farmId: c.farmId,
          birdId: entry.birdId,
          gpCents: c.price * 100,
          message: `lost the claim draw on ${preBird.name} — ${c.price} GP refunded`,
        });
      }
    }
    // The tag settles 98/2 (round 22): the selling barn banks the tag less
    // the staker rake. Same rule is reserved for the marketplace when it's
    // built — see STAKER_FLOWS.MARKET_RAKE.
    const owner = database.select().from(farms).where(eq(farms.id, entry.farmId)).get()!;
    const tagCents = price * 100;
    const tagRakeCents = Math.round(tagCents * STAKER_FLOWS.CLAIM_RAKE);
    creditCents(database, entry.farmId, tagCents - tagRakeCents);
    payStakers(database, tagRakeCents, "claim_rake", `${preBird.name}'s ${price} GP tag`);
    database.update(birds).set({ farmId: winner.farmId }).where(eq(birds.id, entry.birdId)).run();
    database
      .update(lobbyEntries)
      .set({ claimedByFarmId: winner.farmId })
      .where(eq(lobbyEntries.id, entryId))
      .run();

    const bird = database.select().from(birds).where(eq(birds.id, entry.birdId)).get()!;
    const to = database.select().from(farms).where(eq(farms.id, winner.farmId)).get()!;
    emit(database, {
      type: "claim_won",
      farmId: winner.farmId,
      birdId: bird.id,
      message:
        `claimed ${bird.name} from ${owner.name} for the ${price} GP tag` +
        (entryClaims.length > 1 ? ` (won the draw over ${entryClaims.length - 1})` : ""),
    });
    emit(database, {
      type: "tag_income",
      farmId: entry.farmId,
      birdId: bird.id,
      gpCents: tagCents - tagRakeCents,
      message:
        `${bird.name} claimed away by ${to.name} — banked ` +
        (tagRakeCents > 0
          ? `${fmtGp(tagCents - tagRakeCents)} GP of the ${price} GP tag (${fmtGp(tagRakeCents)} to stakers)`
          : `the ${price} GP tag`),
    });
    return {
      bird: bird.name,
      from: owner.name,
      to: to.name,
      price,
      losingClaimsRefunded: entryClaims.length - 1,
    };
  }

  private findOrOpenLobby(spec: LobbySpec, today: number, seed?: number) {
    const open = this.database
      .select()
      .from(lobbies)
      .where(
        and(
          eq(lobbies.status, "open"),
          eq(lobbies.mode, spec.mode),
          eq(lobbies.classType, spec.classType),
          eq(lobbies.format, spec.format)
        )
      )
      .all()
      .filter((l) => l.price === (spec.price ?? null));
    // EXACTLY ONE LOBBY PER KEY PER DAY (round 31). Two changes from the old
    // find-or-open, and they go together:
    //
    //  · `dayOpened` is now MATCHED, not just written. It was always written
    //    and never read, which was harmless only because `resolve` closes every
    //    open lobby on every tick. The moment anything closes selectively — the
    //    real-time clock closes claimers early — a stale lobby could seat
    //    tomorrow's entrants on a key that is no longer posted. The card has to
    //    be authoritative, so the day is part of the lookup.
    //  · No capacity, so no duplicate. The old code skipped a full lobby and
    //    opened another on the same key, which split a hot key back into two
    //    half-empty rooms — the exact opposite of what the card is for. The
    //    round-17 per-farm seating cap (no farm may hold more than half a
    //    lobby) went with it: it was defined as capacity/2 and has no
    //    denominator any more. A barn that pours its whole roster into one key
    //    now strands its own surplus, refunded in full — self-correcting, and
    //    the doctor watches same-barn stranding so we find out rather than
    //    assume.
    const existing = open.find((l) => l.dayOpened === today);
    if (existing) return existing;
    return this.database
      .insert(lobbies)
      .values({
        mode: spec.mode,
        classType: spec.classType,
        format: spec.format,
        price: spec.price ?? null,
        seed: seed ?? freshSeed(),
        dayOpened: today,
      })
      .returning()
      .get();
  }

  private viewLobby(lobbyId: number): LobbyView {
    const lobby = this.database.select().from(lobbies).where(eq(lobbies.id, lobbyId)).get()!;
    const entries = this.database
      .select()
      .from(lobbyEntries)
      .where(eq(lobbyEntries.lobbyId, lobbyId))
      .all();
    // The fog, while OPEN: fill count is public, the field is not — except
    // claimers (claims are placed on specific birds) and your own entries.
    // CLOSED is the reveal: everyone, and who drew whom.
    const closed = lobby.status === "closed";
    const visible =
      closed || lobby.classType === "claimer"
        ? entries
        : entries.filter((e) => e.farmId === this.farmId);
    return {
      lobbyId: lobby.id,
      status: closed ? "closed" : "open",
      mode: lobby.mode,
      classType: lobby.classType,
      format: lobby.format,
      price: lobby.price,
      fee: MODE_FEES[lobby.mode],
      filled: entries.length,
      entries: visible.map((e) => this.card(e, this.lookupFor(entries), closed ? entries : undefined)),
    };
  }

  /**
   * ONE READ PER TABLE FOR THE WHOLE LOBBY (round 36) — the N+1 fix.
   *
   * `card` used to query for every name it printed: a `farms` row per entry, a
   * fresh `Flock` per entry, and — worst — a `birds` AND a `farms` lookup for
   * every group-mate listed in the draw. Under the group stage a closed lobby
   * of twenty birds reveals roughly sixty group-mate names, so rendering one
   * room cost well over a hundred queries to print about twenty rows.
   *
   * Round 35's indexes made each of those fast, which is exactly why this was
   * worth fixing separately: indexes turn a catastrophe into a papercut, and a
   * papercut per row is still the wrong shape. Two queries now, whatever the
   * lobby holds.
   *
   * The `Flock` cache is per FARM rather than per entry because `byId` returns
   * a BirdView with derived fields (age, stars, sexLabel) that the raw row
   * doesn't carry, and a barn entering five birds should build one Flock.
   */
  private lookupFor(entries: (typeof lobbyEntries.$inferSelect)[]): LobbyLookup {
    const birdIds = [...new Set(entries.map((e) => e.birdId))];
    const farmIds = [...new Set(entries.map((e) => e.farmId))];
    // `inArray` on an empty list is not valid SQL — an empty lobby is a real
    // state (a phantom key nobody entered), so guard rather than let it throw.
    const birdRows = birdIds.length
      ? this.database.select().from(birds).where(inArray(birds.id, birdIds)).all()
      : [];
    const farmRows = farmIds.length
      ? this.database.select().from(farms).where(inArray(farms.id, farmIds)).all()
      : [];
    const flocks = new Map<string, Flock>();
    return {
      birdName: new Map(birdRows.map((b) => [b.id, b.name])),
      farms: new Map(farmRows.map((f) => [f.id, f])),
      flockFor: (farmId: string) => {
        const cached = flocks.get(farmId);
        if (cached) return cached;
        const made = new Flock(this.database, farmId);
        flocks.set(farmId, made);
        return made;
      },
    };
  }

  /** `field` is passed only once the lobby has closed — it carries the draw. */
  private card(
    entry: typeof lobbyEntries.$inferSelect,
    lookup: LobbyLookup,
    field?: (typeof lobbyEntries.$inferSelect)[]
  ): EntryCard {
    const bird = lookup.flockFor(entry.farmId).byId(entry.birdId);
    const farm = lookup.farms.get(entry.farmId)!;
    const view: EntryCard = {
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
        // ONE lifetime record (ruled round 15) — juvenile fights included.
        career: { wins: bird.wins, losses: bird.losses },
        formatRecords: this.formatRecords(bird.id),
      },
      mine: entry.farmId === this.farmId,
    };
    if (field) {
      // THE GROUP IS THE DRAW (round 34). Everyone sharing this entry's group
      // number, minus itself and minus its own barn-mates — matchmaking never
      // makes that fight, so listing a barn-mate here would promise a card
      // that will not happen. An empty list = drew nobody, refunds at post.
      view.drew = field
        .filter(
          (e) =>
            entry.groupNo !== null && // undealt (shouldn't happen once closed) — nulls must not match
            e.id !== entry.id &&
            e.groupNo === entry.groupNo &&
            e.farmId !== entry.farmId
        )
        .map((e) => ({
          bird: lookup.birdName.get(e.birdId)!,
          farm: lookup.farms.get(e.farmId)!.name,
        }));
    }
    return view;
  }

  /** The gate + ladder, as a throw. One rule, shared with `entryRefusal`. */
  private checkEligible(bird: ReturnType<Flock["byId"]>, spec: LobbySpec): void {
    const refusal = entryRefusal(bird, spec);
    if (refusal) throw new Error(refusal);
  }
}

/**
 * IS THIS BIRD ALLOWED IN THIS LOBBY? Returns the reason it is not, or null.
 *
 * ⚠ ONE RULE, TWO CALLERS, ON PURPOSE (round 31). `Lobbies.enter` calls this
 * and throws; the bots' chooser calls it and FILTERS, because with a daily card
 * the chooser has to know what a bird is eligible for before it picks. The
 * ladder was already encoded twice — here and in `ladderClass` — and a third
 * copy inside the chooser would have been the drift that kills us: both entry
 * paths wrap `enter` in `quietly()`, so a chooser proposing specs the enforcer
 * rejects would show up as nothing at all except a fill rate that quietly
 * collapsed. Returning a reason rather than a boolean keeps the player-facing
 * error text in one place too.
 */
export function entryRefusal(
  bird: { name: string; age: number; wins: number; stakesWins: number },
  spec: CardKey
): string | null {
  const { mode, classType, price } = spec;

  const gates: Record<FightMode, [ok: boolean, rule: string]> = {
    juvenile: [canJuvenile(bird.age), "the juvenile division is the discovery year only — age 1"],
    real: [canRealFight(bird.age), "real stakes open at age 2"],
  };
  const [ageOk, rule] = gates[mode];
  if (!ageOk) return `${bird.name} is ${bird.age} — ${rule}`;

  // THE DISCOVERY-YEAR LADDER (round 23). The juvenile season used to be one
  // flat open division, which gave a chick nowhere to climb. It now runs
  // maidens, stakes (open) and claimers of its own — the same shape the grown
  // card has, so a bird learns the ladder in the year its results don't count
  // against it. The conditions class stays out: a one-year-old hasn't the
  // record to sort by.
  if (mode === "juvenile" && classType === "nw3")
    return "Juvenile lobbies are open, maiden or claimer";

  // WHICH record the ladder reads depends on the season, and this is the
  // subtle part. Grown classes read the STAKES record (round 19) — juvenile
  // practice wins must not graduate a maiden, or the class never opens. But
  // inside the discovery year a bird has NO stakes record at all, so a
  // juvenile maiden reads its juvenile wins instead. Same rule, measured
  // against the season the bird is actually in.
  const ladderWins = mode === "juvenile" ? bird.wins : bird.stakesWins;
  if (classType === "maiden" && ladderWins > 0)
    return mode === "juvenile"
      ? `${bird.name} has already won in the discovery year — juvenile maidens take never-winners`
      : `${bird.name} has won at stakes — maidens take never-winners only`;
  // nw3 absorbed nw2 in round 31 — see the LOBBIES comment in config.
  if (classType === "nw3" && bird.stakesWins >= NW_CAP)
    return `${bird.name} has ${bird.stakesWins} stakes wins — nw3 takes fewer than ${NW_CAP}`;

  if (classType === "claimer") {
    // Juveniles claim on their own, cheaper ladder — an unproven bird priced
    // against grown stock would never be tagged at all.
    const ladder = (
      mode === "juvenile" ? CLAIMER.JUVENILE_PRICES : CLAIMER.PRICES
    ) as readonly number[];
    if (!price || !ladder.includes(price)) return `Pick a claiming tag: ${ladder.join(" / ")} GP`;
  } else if (price) {
    return "A tag price only means something in a claimer";
  }
  return null;
}

function toCombatant(row: BirdRow): Combatant {
  return {
    name: row.name,
    stats: {
      agility: row.agility,
      sight: row.sight,
      stamina: row.stamina,
      gameness: row.gameness,
      station: row.station,
      condition: row.condition,
    },
    element: row.element as Element,
    halfStars: row.halfStars,
  };
}
