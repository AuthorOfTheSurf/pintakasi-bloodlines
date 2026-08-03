import { and, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { battleLog, birds, claims, farms, gameState, lobbies, lobbyEntries, tournamentEntries, type BirdRow } from "@/db/schema";
import {
  BARN,
  CADENCE,
  CLAIMER,
  ECONOMY,
  FORMATS,
  LOBBY,
  landForFight,
  type Element,
  type FightFormat,
  type Lobby,
} from "./config";
import { emit } from "./events";
import { simulatePair, type Combatant } from "./fight-sim";
import { Flock } from "./flock";
import { canHardcore, canJuvenile, canRealFight } from "./lifecycle";
import { freshSeed, mulberry32, randInt, type Rng } from "./rng";
import { Tournaments } from "./tournaments";

export type FightMode = "juvenile" | "real" | "hardcore";

const MODE_FEES: Record<FightMode, number> = {
  juvenile: ECONOMY.JUVENILE_ENTRY_FEE,
  real: ECONOMY.REAL_ENTRY_FEE,
  hardcore: ECONOMY.HARDCORE_ENTRY_FEE,
};

/** The card line for a lobby — shared by resolutions and the ledger. */
function labelOf(lobby: {
  mode: FightMode;
  classType: Lobby;
  format: FightFormat;
  price: number | null;
}): string {
  // "REAL" is the default and goes unsaid (round 20) — only juvenile and
  // hardcore cards announce their mode.
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
  // The draw, once the lobby has CLOSED: who this bird fights tonight.
  // Absent while open; null after close = no opponent (refunds at post).
  drew?: { bird: string; farm: string } | null;
  // Claims on claimer entries are SEALED — no count shown until post time.
}

export interface LobbyView {
  lobbyId: number;
  status: "open" | "closed"; // completed lobbies leave the board
  mode: FightMode;
  classType: Lobby;
  format: FightFormat;
  price: number | null; // claimer tag
  fee: number; // entry fee a side
  filled: number; // ALWAYS public — how full, never who
  capacity: number;
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
  landEach: number;
  forcedRetirements: string[]; // hardcore losers, by bird name
  playByPlay: string;
}

/** One lobby going off at the tick — a public event. */
export interface LobbyResolution {
  lobbyId: number;
  label: string;
  fights: FightReport[];
  unmatched: { farm: string; bird: string; refunded: number }[]; // odd birds out
  claims: { bird: string; from: string; to: string; price: number; losingClaimsRefunded: number }[];
}

/**
 * Lobbies — PURE PvP fight selection (re-ruled 2026-08-03). The house
 * supplies nobody; every fight is between barns. The shape of a fight day:
 *
 *   1. During the game-day, owners ENTER birds. An entry joins the open
 *      lobby for its (mode, class, format[, tag]) key — or opens a fresh
 *      one when that lobby is full. Size is LOCKED at 8: even, so a full
 *      lobby guarantees every bird a fight. Entries are BINDING (fee
 *      escrowed, the bird's daily fight spent).
 *   2. The board is public but FOGGED — you see every lobby and how full it
 *      is, never whose birds are in it (no dodging; judging a lobby's
 *      likely strength is the skill). The one exception is claimer lobbies:
 *      those fields are visible, because sealed claims (tag escrowed; one
 *      per farm; never your own bird) are placed on specific birds before
 *      post time. Fighting for a tag is choosing to be seen.
 *   3. The card runs PFL's three states (ruled 2026-08-03). CLOSE locks the
 *      entries and DRAWS THE MATCHUPS — randomly, NEVER two from the same
 *      barn (enter several birds; matchmaking keeps them apart) — and the
 *      fog lifts: the full field and who drew whom go public. Claimers
 *      close hours before post (6 PM PH) so claiming happens informed;
 *      normal lobbies close minutes before. Claims keep flowing until the
 *      lobby COMPLETES — a last-second claim either makes it or it's too
 *      late.
 *   4. COMPLETE fires the fights: birds with no draw (odd bird out, or
 *      barn-mates with nobody else) refund — no fight, no land. Winners
 *      take the pooled pot; both fighters earn land scaled superlinearly
 *      to the fee (fighting up pays extra). Hardcore losers force-retire.
 *      Then claims settle: one wins per entry (RNG), the owner banks the
 *      tag, the bird transfers, losers refund in full — even if the bird
 *      went unmatched (the sale doesn't need the fight).
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
    this.checkGate(bird.name, bird.age, spec.mode);
    this.checkClass(bird, spec);

    const today = this.today();
    this.checkFightCap(bird.id, bird.name, today);

    // A Pintakasi registrant fights normal cards all week — except on crown
    // day, when its championship IS its card (round 18; Thursday since 20).
    if (Tournaments.isCrownDay(today)) {
      const registered = this.database
        .select()
        .from(tournamentEntries)
        .where(and(eq(tournamentEntries.birdId, bird.id), eq(tournamentEntries.status, "pending")))
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
  board(): LobbyView[] {
    return this.database
      .select()
      .from(lobbies)
      .all()
      .filter((l) => l.status === "open" || l.status === "closed")
      .map((l) => this.viewLobby(l.id));
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
   * The daily fight cap — a hard count, not a cooldown. A PENDING entry
   * counts: the bird is committed to tonight's card.
   */
  checkFightCap(birdId: string, name: string, today: number): void {
    const fought = this.database
      .select()
      .from(battleLog)
      .where(and(eq(battleLog.birdId, birdId), eq(battleLog.dayIndex, today)))
      .all().length;
    const committed = this.database
      .select()
      .from(lobbyEntries)
      .where(and(eq(lobbyEntries.birdId, birdId), eq(lobbyEntries.status, "pending")))
      .all().length;
    if (fought + committed >= CADENCE.FIGHTS_PER_BIRD_PER_DAY)
      throw new Error(
        committed > 0
          ? `${name} is already on tonight's card — entries are binding until the day turns`
          : `${name} already fought today — one fight per bird per game-day (tick a day)`
      );
  }

  /**
   * CLOSE — entries lock, matchups are drawn, the fog lifts. Claimers
   * close early (6 PM PH) for the claiming window; "all" is the pre-post
   * sweep. The draw is seeded by the lobby, so a replayed close replays.
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
      const { pairs } = Lobbies.matchmake(entries, rng);
      for (const [a, b] of pairs) {
        database.update(lobbyEntries).set({ opponentEntryId: b.id }).where(eq(lobbyEntries.id, a.id)).run();
        database.update(lobbyEntries).set({ opponentEntryId: a.id }).where(eq(lobbyEntries.id, b.id)).run();
      }
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
      const event: LobbyResolution = { lobbyId: lobby.id, label, fights: [], unmatched: [], claims: [] };

      // The drawn pairs fight, in draw order.
      for (const entry of entries) {
        const other = entries.find((e) => e.id === entry.opponentEntryId);
        if (!other || other.id < entry.id) continue; // fight once per pair
        event.fights.push(Lobbies.runFight(database, lobby, entry, other, label, rng, week));
      }

      // The drawless — the odd bird out, or barn-mates with nobody else
      // to fight. Fee back, no fight, no land.
      for (const odd of entries.filter((e) => e.opponentEntryId === null)) {
        const farm = database.select().from(farms).where(eq(farms.id, odd.farmId)).get()!;
        database.update(farms).set({ gp: farm.gp + odd.fee }).where(eq(farms.id, odd.farmId)).run();
        database.update(lobbyEntries).set({ status: "unmatched" }).where(eq(lobbyEntries.id, odd.id)).run();
        const bird = database.select().from(birds).where(eq(birds.id, odd.birdId)).get()!;
        emit(database, {
          type: "refund",
          farmId: odd.farmId,
          birdId: odd.birdId,
          gpCents: odd.fee * 100,
          message: `${bird.name} drew nobody in ${label} — ${odd.fee} GP refunded`,
        });
        event.unmatched.push({ farm: farm.name, bird: bird.name, refunded: odd.fee });
      }

      // Claims settle last — after every fight, even for the unmatched
      // (the sale doesn't need the fight). Prize money stayed with the
      // original owner above; only NOW does the bird change barns.
      if (lobby.classType === "claimer") {
        for (const entry of entries) {
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
   * Random pairing that NEVER matches barn-mates. Shuffle for randomness,
   * group by farm, then repeatedly pair off the two largest groups (ties
   * broken by the rng) — the classic greedy that maximizes cross-barn
   * matches. Whatever remains is one farm's birds with nobody left to
   * fight (or the plain odd bird out): they go home refunded.
   */
  private static matchmake(
    entries: (typeof lobbyEntries.$inferSelect)[],
    rng: Rng
  ): {
    pairs: [typeof lobbyEntries.$inferSelect, typeof lobbyEntries.$inferSelect][];
    leftovers: (typeof lobbyEntries.$inferSelect)[];
  } {
    const shuffled = [...entries];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randInt(rng, 0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const byFarm = new Map<string, (typeof lobbyEntries.$inferSelect)[]>();
    for (const e of shuffled) {
      const group = byFarm.get(e.farmId);
      if (group) group.push(e);
      else byFarm.set(e.farmId, [e]);
    }

    const pairs: [typeof lobbyEntries.$inferSelect, typeof lobbyEntries.$inferSelect][] = [];
    for (;;) {
      const groups = [...byFarm.values()].filter((g) => g.length > 0);
      if (groups.length < 2) return { pairs, leftovers: groups.flat() };
      groups.sort((a, b) => b.length - a.length);
      const tiedA = groups.filter((g) => g.length === groups[0].length);
      const groupA = tiedA[randInt(rng, 0, tiedA.length - 1)];
      const rest = groups.filter((g) => g !== groupA);
      const tiedB = rest.filter((g) => g.length === rest[0].length);
      const groupB = tiedB[randInt(rng, 0, tiedB.length - 1)];
      pairs.push([groupA.pop()!, groupB.pop()!]);
    }
  }

  private static runFight(
    database: DB,
    lobby: typeof lobbies.$inferSelect,
    ea: typeof lobbyEntries.$inferSelect,
    eb: typeof lobbyEntries.$inferSelect,
    label: string,
    rng: Rng,
    week: number
  ): FightReport {
    const simSeed = randInt(rng, 1, 2 ** 31 - 1);
    const rowA = database.select().from(birds).where(eq(birds.id, ea.birdId)).get()!;
    const rowB = database.select().from(birds).where(eq(birds.id, eb.birdId)).get()!;
    const sim = simulatePair(toCombatant(rowA), toCombatant(rowB), lobby.format, mulberry32(simSeed), label);

    const sides = [
      { entry: ea, row: rowA, won: sim.winner === 0, figure: sim.figures[0] },
      { entry: eb, row: rowB, won: sim.winner === 1, figure: sim.figures[1] },
    ];
    const landEach = landForFight(ea.fee);
    const forcedRetirements: string[] = [];
    const logIds: number[] = [];
    const farmNames: string[] = [];

    for (const [i, side] of sides.entries()) {
      const other = sides[1 - i];
      const farm = database.select().from(farms).where(eq(farms.id, side.entry.farmId)).get()!;
      farmNames.push(farm.name);
      // Escrow settle: winner takes the pooled pot (own stake back + the
      // other side's), loser's escrow is the pot. Land pays both fighters.
      // The FARM's record moves here too — it can't be derived from owned
      // birds later, because birds transfer. ONE record (ruled round 15):
      // juvenile fights count toward the lifetime record like any other.
      const farmRecord = side.won ? { wins: farm.wins + 1 } : { losses: farm.losses + 1 };
      database
        .update(farms)
        .set({
          gp: farm.gp + (side.won ? side.entry.fee * 2 : 0),
          landTokens: farm.landTokens + landEach,
          ...farmRecord,
        })
        .where(eq(farms.id, side.entry.farmId))
        .run();
      database
        .update(birds)
        .set(
          side.won
            ? {
                wins: side.row.wins + 1,
                // The ladder's line: practice wins don't graduate a maiden.
                stakesWins: side.row.stakesWins + (lobby.mode === "juvenile" ? 0 : 1),
              }
            : { losses: side.row.losses + 1 }
        )
        .where(eq(birds.id, side.row.id))
        .run();
      // The key rule's teeth — in PvP both owners signed up for it.
      if (lobby.mode === "hardcore" && !side.won) {
        database
          .update(birds)
          .set({ status: "retired", retiredBy: "hardcore", retiredWeek: week })
          .where(eq(birds.id, side.row.id))
          .run();
        forcedRetirements.push(side.row.name);
        emit(database, {
          type: "retire",
          farmId: side.entry.farmId,
          birdId: side.row.id,
          message: `${side.row.name} lost a hardcore — force-retired (${side.row.wins}–${side.row.losses + 1})`,
          data: { by: "hardcore" },
        });
      }
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
          result: side.won ? "win" : "loss",
          pitFigure: side.figure,
          gpDelta: side.won ? side.entry.fee : -side.entry.fee,
          seed: simSeed,
          playByPlay: sim.playByPlay,
        })
        .returning({ id: battleLog.id })
        .get();
      logIds.push(inserted.id);
      database
        .update(lobbyEntries)
        .set({ status: "fought", battleLogId: inserted.id })
        .where(eq(lobbyEntries.id, side.entry.id))
        .run();
    }

    const winnerSide = sides[sim.winner];
    const loserSide = sides[1 - sim.winner];
    emit(database, {
      type: "fight",
      birdId: winnerSide.row.id,
      message:
        `${winnerSide.row.name} (${farmNames[sim.winner]}) def. ${loserSide.row.name} (${farmNames[1 - sim.winner]}) — ` +
        `${label} · figures ${winnerSide.figure}/${loserSide.figure} · pot ${ea.fee * 2} GP · +${landEach} LT each` +
        (forcedRetirements.length ? ` · ${forcedRetirements.join(", ")} force-retired` : ""),
      data: { lobbyId: lobby.id, battleLogIds: logIds, figures: sim.figures, pot: ea.fee * 2, landEach },
    });
    return {
      battleLogIds: [logIds[0], logIds[1]],
      farms: [farmNames[0], farmNames[1]],
      birds: [rowA.name, rowB.name],
      winner: winnerSide.row.name,
      winnerFarm: farmNames[sim.winner],
      figures: sim.figures,
      landEach,
      forcedRetirements,
      playByPlay: sim.playByPlay,
    };
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
    const owner = database.select().from(farms).where(eq(farms.id, entry.farmId)).get()!;
    database.update(farms).set({ gp: owner.gp + price }).where(eq(farms.id, entry.farmId)).run();
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
      gpCents: price * 100,
      message: `${bird.name} claimed away by ${to.name} — banked the ${price} GP tag`,
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
    for (const lobby of open) {
      const entries = this.database
        .select()
        .from(lobbyEntries)
        .where(eq(lobbyEntries.lobbyId, lobby.id))
        .all();
      if (entries.length >= lobby.capacity) continue;
      // The matchmaker's seating rule (round 17): no farm may hold more than
      // half a lobby. Matchmaking never draws barn-mates, so a lobby that is
      // mostly one farm's birds strands the surplus — capped at half, a FULL
      // lobby always admits a perfect cross-barn matching.
      const mine = entries.filter((e) => e.farmId === this.farmId).length;
      if (mine >= lobby.capacity / 2) continue;
      return lobby;
    }
    return this.database
      .insert(lobbies)
      .values({
        mode: spec.mode,
        classType: spec.classType,
        format: spec.format,
        price: spec.price ?? null,
        capacity: LOBBY.CAPACITY,
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
      capacity: lobby.capacity,
      entries: visible.map((e) => this.card(e, closed ? entries : undefined)),
    };
  }

  /** `field` is passed only once the lobby has closed — it carries the draw. */
  private card(
    entry: typeof lobbyEntries.$inferSelect,
    field?: (typeof lobbyEntries.$inferSelect)[]
  ): EntryCard {
    const ownerFlock = new Flock(this.database, entry.farmId);
    const bird = ownerFlock.byId(entry.birdId);
    const farm = this.database.select().from(farms).where(eq(farms.id, entry.farmId)).get()!;
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
      const opponent = field.find((e) => e.id === entry.opponentEntryId);
      if (!opponent) {
        view.drew = null; // no draw — refunds at post time
      } else {
        const oppBird = this.database.select().from(birds).where(eq(birds.id, opponent.birdId)).get()!;
        const oppFarm = this.database.select().from(farms).where(eq(farms.id, opponent.farmId)).get()!;
        view.drew = { bird: oppBird.name, farm: oppFarm.name };
      }
    }
    return view;
  }

  private checkGate(name: string, age: number, mode: FightMode): void {
    const gates: Record<FightMode, [ok: boolean, rule: string]> = {
      juvenile: [canJuvenile(age), "the juvenile division is the discovery year only — age 1"],
      real: [canRealFight(age), "real stakes open at age 2"],
      hardcore: [canHardcore(age), "hardcore opens at age 3 (and ends at the cap)"],
    };
    const [ok, rule] = gates[mode];
    if (!ok) throw new Error(`${name} is ${age} — ${rule}`);
  }

  /** Class (ladder) eligibility — entry restrictions self-sort the fields. */
  private checkClass(bird: ReturnType<Flock["byId"]>, spec: LobbySpec): void {
    const { mode, classType, price } = spec;
    if (mode === "hardcore" && classType !== "open")
      throw new Error("Hardcore runs in the open only — the key rule needs no ladder");
    if (mode === "juvenile" && classType !== "open" && classType !== "maiden")
      throw new Error("Juvenile lobbies are open or maiden only");

    // The ladder reads the STAKES record (round 19), not the lifetime line:
    // juvenile fights are the discovery year, and counting them made every
    // two-year-old an ex-winner — the maiden class went unused for weeks.
    if (classType === "maiden" && bird.stakesWins > 0)
      throw new Error(`${bird.name} has won at stakes — maidens take never-winners only`);
    if (classType === "nw2" && bird.stakesWins >= 2)
      throw new Error(`${bird.name} has ${bird.stakesWins} stakes wins — nw2 takes fewer than 2`);
    if (classType === "nw3" && bird.stakesWins >= 3)
      throw new Error(`${bird.name} has ${bird.stakesWins} stakes wins — nw3 takes fewer than 3`);
    if (classType === "claimer") {
      if (mode !== "real") throw new Error("Claimers are real fights");
      if (!price || !(CLAIMER.PRICES as readonly number[]).includes(price))
        throw new Error(`Pick a claiming tag: ${CLAIMER.PRICES.join(" / ")} GP`);
    } else if (price) {
      throw new Error("A tag price only means something in a claimer");
    }
  }
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
