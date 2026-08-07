import { and, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { battleLog, birds, farms, gameState, tournamentEntries, tournaments } from "@/db/schema";
import {
  DAY_NAMES,
  FORMATS,
  JUVENILE_MAJOR,
  PINTAKASI,
  landForFight,
  landForTournamentFight,
  weatherOfDay,
  ECONOMY,
  type Element,
  type FightFormat,
  fmtLt,
} from "./config";
import { emit, fmtGp } from "./events";
import { simulatePair, toCombatant } from "./fight-sim";
import { Flock } from "./flock";
import { canHardcore, canJuvenile } from "./lifecycle";
import { overallGradeOf } from "./grades";
import { freshSeed, mulberry32, randInt, type Rng } from "./rng";

/**
 * Which championship: the Thursday MAJORS (age 3+, hardcore, the crowns) or
 * the Wednesday JUVENILE Championship (age 1, NOT hardcore — round 23).
 * They share every piece of bracket machinery and differ only in their gates,
 * their purse shares, and whether losing ends a career.
 */
export type Division = "major" | "juvenile";

/** The per-division charter — everything that differs, in one lookup. */
export const DIVISION_RULES = {
  major: {
    label: "Pintakasi Major",
    hardcore: true,
    maxPerBarn: PINTAKASI.MAX_PER_BARN,
    maxBracket: PINTAKASI.MAX_BRACKET,
    minField: PINTAKASI.MIN_FIELD,
    // ⚠ THE FEE IS PER DIVISION SINCE ROUND 41. `findOrOpen` used to stamp
    // `PINTAKASI.ENTRY_FEE` on EVERY tournament row in the game, juveniles
    // included — which nobody noticed while it was 0, and which would have put
    // an 80 GP toll on age-1 chicks the moment the Majors started charging.
    entryFee: PINTAKASI.ENTRY_FEE,
    purse: PINTAKASI.PURSE,
    landGrants: PINTAKASI.LAND_GRANTS as Record<string, number>,
    landBasis: PINTAKASI.LAND_BASIS,
    dayOfWeek: PINTAKASI.DAY_OF_WEEK,
  },
  juvenile: {
    label: "Juvenile Championship",
    hardcore: false, //  the discovery year never ends a career
    maxPerBarn: JUVENILE_MAJOR.MAX_PER_BARN,
    maxBracket: JUVENILE_MAJOR.MAX_BRACKET,
    minField: JUVENILE_MAJOR.MIN_FIELD,
    entryFee: JUVENILE_MAJOR.ENTRY_FEE, // free, and see the config comment for why
    purse: JUVENILE_MAJOR.PURSE,
    landGrants: JUVENILE_MAJOR.LAND_GRANTS as Record<string, number>,
    landBasis: ECONOMY.JUVENILE_ENTRY_FEE,
    dayOfWeek: JUVENILE_MAJOR.DAY_OF_WEEK,
  },
} as const;

type TournamentRow = typeof tournaments.$inferSelect;
type EntryRow = typeof tournamentEntries.$inferSelect;

/**
 * THE PINTAKASI (ruled 2026-08-03 round 18) — the weekly blade Majors.
 * Three championships on the week's LAST DAY (Thursday since round 20 —
 * anchors + the rotating middle blade), hardcore throughout, one day,
 * committee-seeded. See config.PINTAKASI for the full charter. The rhythm:
 *
 *   - Any day, owners REGISTER age-3+ birds into the week's three blades
 *     (fee escrowed, binding) — up to PINTAKASI.MAX_PER_BARN per crown, so
 *     a deep barn loads a blade with specialists. Crown day is the last day
 *     of the game week, so registration simply closes with the week.
 *   - The FIELD IS PUBLIC all week (unlike the fogged daily card): entering
 *     the biggest stage is choosing to be seen, and the Selection
 *     Committee's bump line only works if you can see who you'd bump.
 *   - At 64 entrants the Committee LIVE-BUMPS: a newcomer either outranks
 *     the current weakest (who goes home refunded) or is itself refused.
 *     Ranking: career earnings → career wins → average pit figure.
 *   - At the tick that ends crown day, each championship runs START TO
 *     FINISH: bracket = next power of two (byes to the top seeds), classic
 *     seeding (1v16, 8v9…), winners heal to full between rounds. Every
 *     loser force-retires. GP to the top, land to the fallen.
 */

export interface TournamentFightReport {
  round: number;
  winner: string;
  winnerFarm: string;
  loser: string;
  loserFarm: string;
  figures: [number, number];
  landEach: number;
  playByPlay: string;
}

export interface TournamentResolution {
  tournamentId: number;
  weekIndex: number;
  format: FightFormat;
  label: string; // e.g. "Long Knife Championship"
  cancelled: boolean;
  field: number;
  bracketSize: number;
  rounds: { name: string; fights: TournamentFightReport[]; byes: string[] }[];
  champion: { bird: string; farm: string } | null;
  purseCents: number;
  payouts: { bird: string; farm: string; gpCents: number; stage: string }[];
}

export interface ChampionshipView {
  tournamentId: number;
  weekIndex: number;
  format: FightFormat;
  label: string;
  fee: number;
  field: {
    bird: string;
    farm: string;
    rank: number; // committee rank TODAY (1 = top seed) — the bump line is the bottom
    mine: boolean;
  }[];
  projectedPurseGp: number; // entries so far + this blade's juice share estimate
}

/** Committee ranking key — bigger is stronger. */
interface CommitteeCard {
  // `crownPoints` led this key from round 22 until 37, when the concept was
  // deleted. Earnings leads now — see compareRank.
  earningsCents: number; // battle_log deltas + banked purse shares
  wins: number;
  avgFigure: number;
}

const label = (format: FightFormat) => `${FORMATS[format].label} Championship`;

/**
 * Classic single-elimination seed placement: [1] → [1,2] → [1,4,2,3] →
 * [1,8,4,5,2,7,3,6]… — index i (0-indexed) is the SEED NUMBER standing in
 * bracket seat i (1-indexed by convention: 1 = top seed). Byes fall out
 * naturally: a seed beyond the real field is a "ghost" that the caller maps
 * to `null`, and ghosts always land opposite a real seed in round one — never
 * opposite each other — because the field only has ghosts when it's MORE
 * than half of `bracketSize` (the next power of two ≥ field length).
 * Exported so the admin bracket view can rebuild the exact tree the sim ran,
 * from nothing but each entry's stored `seedRank`.
 */
export function seedPlacement(bracketSize: number): number[] {
  let placement = [1];
  while (placement.length < bracketSize)
    placement = placement.flatMap((s) => [s, placement.length * 2 + 1 - s]);
  return placement;
}

/**
 * The stage name for round `round` of `totalRounds` — Final, Semifinals,
 * Quarterfinals, else "Round of N". Exported alongside `seedPlacement` so
 * the admin bracket view names its columns exactly the way a resolution's
 * own `rounds[].name` would.
 */
export function roundName(round: number, totalRounds: number, bracketSize: number): string {
  const fromFinal = totalRounds - round;
  if (fromFinal === 0) return "Final";
  if (fromFinal === 1) return "Semifinals";
  if (fromFinal === 2) return "Quarterfinals";
  return `Round of ${bracketSize / Math.pow(2, round - 1)}`;
}

export class Tournaments {
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

  /**
   * The week's three blades — fixed at B1/B3/B5 since round 27 (the dial's
   * ends and its true middle). weekIndex survives in the signature because
   * every caller passes it and a future rotation could return; today it is
   * deliberately unused.
   */
  static bladesOfWeek(_weekIndex: number): FightFormat[] {
    return [...PINTAKASI.BLADES] as FightFormat[];
  }

  /**
   * The Juvenile Championship's two blades — fixed at B2/B4 since round 27,
   * the two blades the Majors don't run. No parity, no rotation.
   */
  static juvenileBladesOfWeek(_weekIndex: number): FightFormat[] {
    return [...JUVENILE_MAJOR.BLADES] as FightFormat[];
  }

  /** Which blades run for a division in a given week. */
  static bladesFor(division: Division, weekIndex: number): FightFormat[] {
    return division === "juvenile"
      ? Tournaments.juvenileBladesOfWeek(weekIndex)
      : Tournaments.bladesOfWeek(weekIndex);
  }

  /** Is this day the Juvenile Championship's day? (Wednesday — round 23.) */
  static isJuvenileCrownDay(dayIndex: number): boolean {
    return dayIndex % 7 === JUVENILE_MAJOR.DAY_OF_WEEK;
  }

  /**
   * The crown day an entry made TODAY fights on. Since round 20 the crowns
   * run on the week's LAST day, so today's entry always belongs to today's
   * week — no roll-forward case left (registering on crown day itself is
   * last call, and the fields resolve at that day's tick).
   */
  static targetWeek(dayIndex: number): number {
    return Math.floor(dayIndex / 7);
  }

  /** Is this day index a crown day? */
  static isCrownDay(dayIndex: number): boolean {
    return dayIndex % 7 === PINTAKASI.DAY_OF_WEEK;
  }

  /** Register a bird for one of the week's championships. Binding. */
  enter(
    birdId: string,
    format: FightFormat,
    division: Division = "major"
  ): { entryId: number; note: string } {
    const bird = this.flock.byId(birdId);
    if (bird.status !== "active") throw new Error(`${bird.name} is not an active fighter`);
    if (!bird.named)
      throw new Error(`${bird.name} hasn't been given a real name — name a bird before its first fight`);
    const birdRow = this.database.select().from(birds).where(eq(birds.id, birdId)).get()!;
    if (division === "juvenile") {
      // The discovery-year stage: age 1 only, and you ladder your way in on
      // juvenile wins (round 23). Not hardcore — see JUVENILE_MAJOR.
      if (!canJuvenile(bird.age))
        throw new Error(
          `${bird.name} is ${bird.age} — the Juvenile Championship is the discovery year only, age 1`
        );
      if (birdRow.wins < JUVENILE_MAJOR.QUALIFYING_WINS)
        throw new Error(
          `${bird.name} has ${birdRow.wins} juvenile win${birdRow.wins === 1 ? "" : "s"} — ` +
            `the Juvenile Championship asks for ${JUVENILE_MAJOR.QUALIFYING_WINS}. Climb the discovery ladder first.`
        );
    } else {
      if (!canHardcore(bird.age))
        throw new Error(`${bird.name} is ${bird.age} — the Pintakasi is hardcore, which opens at age 3`);
      // ROUND 37 — THURSDAY IS OPEN. A qualification-points threshold stood
      // here from round 22: 3 points, banked one per real win on the daily
      // card. It is gone. Age is now the only hard gate on a Major, and the
      // Selection Committee's bump line below — which ranks on CAREER
      // EARNINGS — is what actually decides who stands once the field fills.
      // The contest moved from a threshold nobody could see to a seating list
      // anybody can read off the board.
    }

    const today = this.today();
    const week = Tournaments.targetWeek(today);
    const blades = Tournaments.bladesFor(division, week);
    if (!blades.includes(format))
      throw new Error(
        `The ${FORMATS[format].label} crown doesn't run week ${week} — this week's blades: ${blades
          .map((b) => FORMATS[b].label)
          .join(" / ")}`
      );

    // One bird, one championship per week — one body, one crown day.
    const weekTournamentIds = this.database
      .select()
      .from(tournaments)
      .where(eq(tournaments.weekIndex, week))
      .all()
      .map((t) => t.id);
    const existing = this.database
      .select()
      .from(tournamentEntries)
      .where(and(eq(tournamentEntries.birdId, birdId), eq(tournamentEntries.status, "pending")))
      .all()
      .filter((e) => weekTournamentIds.includes(e.tournamentId));
    if (existing.length > 0)
      throw new Error(`${bird.name} is already registered for this week's Pintakasi`);

    const tournament = this.findOrOpen(week, format, division);
    // …and at most MAX_PER_BARN birds from one barn in one championship
    // (ruled round 20 — load the blade with specialists, but no barn owns
    // a bracket).
    const rules = DIVISION_RULES[division];
    const mine = this.pendingEntries(tournament.id).filter((e) => e.farmId === this.farmId);
    if (mine.length >= rules.maxPerBarn)
      throw new Error(
        `Your barn already has ${mine.length} in the ${label(tournament.format)} — ${rules.maxPerBarn} is the limit per championship`
      );
    // ⚠ THE FEE COMES OFF THE ROW, NOT OFF CONFIG, and that is what makes a
    // reprice safe: an entry refunds what it actually PAID, not what the knob
    // says today. Free from round 22 to 40; 80 GP on a Major since round 41,
    // still 0 on the juvenile crown (DIVISION_RULES carries them separately).
    const fee = tournament.entryFee;
    const farm = this.database.select().from(farms).where(eq(farms.id, this.farmId)).get()!;
    if (fee > 0 && farm.gp < fee)
      throw new Error(`The Pintakasi entry is ${fee} GP (escrowed) — you have ${farm.gp}`);

    // The Selection Committee's live bump: a full field takes a newcomer
    // only over the body of its current weakest.
    const field = this.pendingEntries(tournament.id);
    if (field.length >= rules.maxBracket) {
      const cards = Tournaments.committeeCards(this.database, [
        ...field.map((e) => e.birdId),
        birdId,
      ]);
      const weakest = [...field].sort((a, b) =>
        Tournaments.compareRank(cards.get(a.birdId)!, cards.get(b.birdId)!, a.birdId, b.birdId)
      )[field.length - 1];
      if (Tournaments.compareRank(cards.get(birdId)!, cards.get(weakest.birdId)!, birdId, weakest.birdId) >= 0)
        throw new Error(
          `The Selection Committee finds ${bird.name} the weakest in a full field — entry refused`
        );
      // The weakest goes home, refunded, in public.
      const bumpedFarm = this.database.select().from(farms).where(eq(farms.id, weakest.farmId)).get()!;
      const bumpedBird = this.database.select().from(birds).where(eq(birds.id, weakest.birdId)).get()!;
      this.database
        .update(farms)
        .set({ gp: bumpedFarm.gp + weakest.fee })
        .where(eq(farms.id, weakest.farmId))
        .run();
      this.database
        .update(tournamentEntries)
        .set({ status: "bumped" })
        .where(eq(tournamentEntries.id, weakest.id))
        .run();
      emit(this.database, {
        type: "tournament_bump",
        farmId: weakest.farmId,
        birdId: weakest.birdId,
        gpCents: weakest.fee * 100,
        message: `${bumpedBird.name} bumped from the ${label(tournament.format)} by ${bird.name} — ${weakest.fee} GP refunded`,
      });
    }

    // Re-read: the bump above may have refunded THIS farm (own bird bumped).
    const wallet = this.database.select().from(farms).where(eq(farms.id, this.farmId)).get()!;
    this.database.update(farms).set({ gp: wallet.gp - fee }).where(eq(farms.id, this.farmId)).run();
    const inserted = this.database
      .insert(tournamentEntries)
      .values({ tournamentId: tournament.id, birdId, farmId: this.farmId, fee, dayEntered: today })
      .returning({ id: tournamentEntries.id })
      .get();
    // ⚠ ROUND 37 — BOTH OF THESE USED TO SAY "hardcore" UNCONDITIONALLY, and
    // had since the juvenile division arrived in round 23. For a juvenile
    // registrant all three claims were false: it runs Wednesday, not Thursday,
    // and it is the one crown in the game that does NOT end a career. This is
    // the exact prose an agent reads back to a player before asking them to
    // confirm risking a bird's life, so a wrong word here is a correctness
    // problem, not a typo. Both lines now branch on the division's charter.
    const charter = DIVISION_RULES[division];
    const risk = charter.hardcore
      ? "hardcore: lose and the career ends"
      : "not hardcore — a beaten chick is out of the bracket, not out of the game";
    emit(this.database, {
      type: "tournament_entry",
      farmId: this.farmId,
      birdId,
      gpCents: -fee * 100,
      message:
        `registered ${bird.name} for the ${label(tournament.format)} (week ${week}, ` +
        (fee > 0
          ? `${fee} GP escrowed`
          : charter.hardcore
            ? `free to enter — the committee seats on earnings`
            : `free to enter`) +
        `) — ${risk}`,
    });
    return {
      entryId: inserted.id,
      note:
        `Registered. The ${label(tournament.format)} runs ${DAY_NAMES[charter.dayOfWeek]} — ` +
        (charter.hardcore
          ? "every loser force-retires; the champion takes the purse."
          : "losing costs nothing but the bracket; the champion takes the purse."),
    };
  }

  /**
   * How many of this barn's birds are standing in this week's championships
   * — all of them, or one blade's if a format is named. The rule is one bird
   * per CROWN with up to MAX_PER_BARN birds per barn per crown (rounds
   * 19–20), so this is what the callers check before sending another.
   */
  myEntriesThisWeek(format?: FightFormat): number {
    const week = Tournaments.targetWeek(this.today());
    const ids = this.database
      .select()
      .from(tournaments)
      .where(eq(tournaments.weekIndex, week))
      .all()
      .filter((t) => !format || t.format === format)
      .map((t) => t.id);
    return this.database
      .select()
      .from(tournamentEntries)
      .where(and(eq(tournamentEntries.farmId, this.farmId), eq(tournamentEntries.status, "pending")))
      .all()
      .filter((e) => ids.includes(e.tournamentId)).length;
  }

  /** The week's championships — fields PUBLIC, ranked as the committee sees them today. */
  board(division: Division = "major"): ChampionshipView[] {
    const today = this.today();
    const week = Tournaments.targetWeek(today);
    const juice = this.database.select().from(gameState).where(eq(gameState.id, 1)).get()!
      .juicePoolCents;
    return Tournaments.bladesFor(division, week).map((format) => {
      const tournament = this.findOrOpen(week, format, division);
      const field = this.pendingEntries(tournament.id);
      const cards = Tournaments.committeeCards(this.database, field.map((e) => e.birdId));
      const ranked = [...field].sort((a, b) =>
        Tournaments.compareRank(cards.get(a.birdId)!, cards.get(b.birdId)!, a.birdId, b.birdId)
      );
      return {
        tournamentId: tournament.id,
        weekIndex: week,
        format,
        label: label(format),
        fee: tournament.entryFee,
        field: ranked.map((e, i) => {
          const bird = this.database.select().from(birds).where(eq(birds.id, e.birdId)).get()!;
          const farm = this.database.select().from(farms).where(eq(farms.id, e.farmId)).get()!;
          return { bird: bird.name, farm: farm.name, rank: i + 1, mine: e.farmId === this.farmId };
        }),
        projectedPurseGp:
          field.reduce((s, e) => s + e.fee, 0) + Math.floor(juice / 3 / 100), // rough juice share
      };
    });
  }

  /**
   * The crown-day resolution — every open championship of `dayIndex`'s week
   * runs start to finish. Called by Game.tick for each departed crown day.
   */
  static resolveCrownDay(
    database: DB,
    dayIndex: number,
    division: Division = "major"
  ): TournamentResolution[] {
    const week = Math.floor(dayIndex / 7);
    const open = database
      .select()
      .from(tournaments)
      .where(
        and(
          eq(tournaments.weekIndex, week),
          eq(tournaments.division, division),
          eq(tournaments.status, "open")
        )
      )
      .all();
    if (open.length === 0) return [];

    // Registrants that died or retired since entering go home refunded.
    for (const t of open) {
      for (const entry of Tournaments.pending(database, t.id)) {
        const bird = database.select().from(birds).where(eq(birds.id, entry.birdId)).get()!;
        if (bird.status !== "active") Tournaments.refundEntry(database, entry, bird.name, "no longer stands");
      }
    }

    // A field below the minimum cancels; its juice share stays for the rest.
    const runnable: TournamentRow[] = [];
    const results: TournamentResolution[] = [];
    for (const t of open) {
      const field = Tournaments.pending(database, t.id);
      // The DIVISION's minimum, not the Majors' (fixed round 24). Both happen
      // to be 2 today, which is the only reason this read correctly — the
      // juvenile stage would have been cancelled on the Majors' threshold the
      // moment either number moved.
      if (field.length < DIVISION_RULES[division].minField) {
        for (const entry of field) {
          const bird = database.select().from(birds).where(eq(birds.id, entry.birdId)).get()!;
          Tournaments.refundEntry(database, entry, bird.name, "the field was too small");
        }
        database
          .update(tournaments)
          .set({ status: "cancelled", dayResolved: dayIndex })
          .where(eq(tournaments.id, t.id))
          .run();
        results.push({
          tournamentId: t.id,
          weekIndex: week,
          format: t.format,
          label: label(t.format),
          cancelled: true,
          field: field.length,
          bracketSize: 0,
          rounds: [],
          champion: null,
          purseCents: 0,
          payouts: [],
        });
      } else {
        runnable.push(t);
      }
    }

    // The juice split. The Majors take the WHOLE remaining pool between them
    // (they run last, on Thursday). The Juvenile Championship runs the day
    // before and takes only its ruled slice — JUVENILE_MAJOR.JUICE_SHARE —
    // so the discovery year is funded without gutting the main stage.
    const state = database.select().from(gameState).where(eq(gameState.id, 1)).get()!;
    const divisionPot =
      division === "juvenile"
        ? Math.floor(state.juicePoolCents * JUVENILE_MAJOR.JUICE_SHARE)
        : state.juicePoolCents;
    const juiceShare = runnable.length > 0 ? Math.floor(divisionPot / runnable.length) : 0;
    let juiceSpent = 0;
    for (const t of runnable) {
      results.push(Tournaments.runChampionship(database, t, dayIndex, juiceShare));
      juiceSpent += juiceShare;
    }
    if (juiceSpent > 0) {
      database
        .update(gameState)
        .set({ juicePoolCents: state.juicePoolCents - juiceSpent })
        .where(eq(gameState.id, 1))
        .run();
    }
    return results;
  }

  // ── the bracket itself ────────────────────────────────────────────────────

  private static runChampionship(
    database: DB,
    t: TournamentRow,
    dayIndex: number,
    juiceShare: number
  ): TournamentResolution {
    const week = Math.floor(dayIndex / 7);
    const rng = mulberry32(t.seed);
    // The crown day's ascendant element (round 24) — every fight in the
    // bracket runs under the same weather.
    const weather = weatherOfDay(dayIndex);
    const field = Tournaments.pending(database, t.id);
    // THE PURSE IS TWO THINGS ADDED: what the field paid at the door, and this
    // blade's cut of the juice pool. From round 22 to 40 the first term was
    // always zero and this comment said so; round 41 put 80 GP back on a Major
    // and the term is live again, funding ~20% of a Major purse. The rest is
    // still juice — which is to say gacha spend and breed fees, paid by people
    // who may not be standing in the bracket at all. That imbalance is the
    // whole argument for the fee; see PINTAKASI.ENTRY_FEE for the measurement.
    //
    // A busy crown therefore pays better BECAUSE it was busy, which is the one
    // piece of this the juice alone could never do.
    const entriesCents = field.reduce((s, e) => s + e.fee, 0) * 100;
    const purseCents = entriesCents + juiceShare;

    // Committee seeding: 1 = strongest. Byes fall out of the classic
    // placement naturally — ghost seeds (past the field) pair against the
    // top seeds in round one and simply aren't there.
    const cards = Tournaments.committeeCards(database, field.map((e) => e.birdId));
    const seeded = [...field].sort((a, b) =>
      Tournaments.compareRank(cards.get(a.birdId)!, cards.get(b.birdId)!, a.birdId, b.birdId)
    );
    seeded.forEach((e, i) =>
      database
        .update(tournamentEntries)
        .set({ seedRank: i + 1 })
        .where(eq(tournamentEntries.id, e.id))
        .run()
    );
    let bracketSize = 2;
    while (bracketSize < seeded.length) bracketSize *= 2;
    const totalRounds = Math.log2(bracketSize);

    const placement = seedPlacement(bracketSize);
    let alive: (EntryRow | null)[] = placement.map((seat) => seeded[seat - 1] ?? null);

    const nameOf = new Map(
      field.map((e) => [e.id, database.select().from(birds).where(eq(birds.id, e.birdId)).get()!.name])
    );
    const farmNameOf = (farmId: string) =>
      database.select().from(farms).where(eq(farms.id, farmId)).get()!.name;

    const purseRules = DIVISION_RULES[(t.division ?? "major") as Division].purse;
    const rounds: TournamentResolution["rounds"] = [];
    const eliminatedIn = new Map<number, number>(); // entry.id → round
    // ROUND 40 — what the purse is actually paid on. A win in round r is worth
    // ROUND_MULTIPLIER^(r-1), so a deeper win is worth more; round 41 softened
    // that multiplier from 2 to 1.5 when entry stopped being free, so a
    // first-round win clears the 80 GP door instead of falling short of it
    // (the arithmetic is in the PINTAKASI.PURSE comment). Accumulated HERE, as
    // the fights happen, because that is the only place a bye can be told from
    // a win: the bye branches below push a bird through without adding weight,
    // which is the ruling — a bird that never threw a blade is not paid for it.
    //
    // ⚠ THE WEIGHTS ARE NOT INTEGERS ANY MORE. At ×1.5 a fourth-round win
    // scores 3.375, so nothing downstream may assume whole numbers — the
    // payout divides by the total and the champion takes the dust, which is
    // exactly why that shape was worth keeping.
    const winWeight = new Map<number, number>(); // entry.id → weight
    for (let round = 1; round <= totalRounds; round++) {
      const roundName = Tournaments.roundName(round, totalRounds, bracketSize);
      const fights: TournamentFightReport[] = [];
      const byes: string[] = [];
      const next: (EntryRow | null)[] = [];
      for (let i = 0; i < alive.length; i += 2) {
        const a = alive[i];
        const b = alive[i + 1];
        if (a && !b) {
          next.push(a);
          if (round === 1) byes.push(nameOf.get(a.id)!);
          continue;
        }
        if (b && !a) {
          next.push(b);
          if (round === 1) byes.push(nameOf.get(b.id)!);
          continue;
        }
        if (!a || !b) {
          next.push(null);
          continue;
        }
        const report = Tournaments.runFight(database, t, a, b, round, roundName, rng, week, weather, dayIndex);
        fights.push(report);
        const winner = report.winner === nameOf.get(a.id) ? a : b;
        const loser = winner === a ? b : a;
        winWeight.set(
        winner.id,
        (winWeight.get(winner.id) ?? 0) + purseRules.ROUND_MULTIPLIER ** (round - 1)
      );
        eliminatedIn.set(loser.id, round);
        next.push(winner);
      }
      rounds.push({ name: roundName, fights, byes });
      alive = next;
    }
    const championEntry = alive[0]!;
    const championBird = database.select().from(birds).where(eq(birds.id, championEntry.birdId)).get()!;
    const championFarm = farmNameOf(championEntry.farmId);

    // ── GP: EVERY WIN PAYS (round 40) ────────────────────────────────────────
    //
    // A bird's share is what its FIGHTS earned plus what its FINISH earned:
    //
    //   ADVANCEMENT × (this bird's win weight / the bracket's total weight)
    //   + CHAMPION or RUNNER_UP, if it is one of those two
    //
    // The three knobs sum to 1, so when every seat is filled and both bonuses
    // land, the raw shares sum to 1 too and the normalization below is the
    // identity. It stops being the identity exactly where it should: a bird
    // that never won a fight has no weight and no bonus, so a straight final
    // (whose runner-up won nothing) renormalizes the champion back up to the
    // whole purse. That is the round-18 ruling — first-round losers take
    // nothing — surviving as arithmetic rather than as the `round > 1` clause
    // that used to sit here.
    //
    // The stage string is still worked out per bird, because it is what the
    // ledger line and the office read. It is now DESCRIPTION, not the thing
    // being paid on: moving a bird between stages no longer moves its money.
    const rules = DIVISION_RULES[(t.division ?? "major") as Division];
    const purse = rules.purse;
    const totalWeight = [...winWeight.values()].reduce((s, w) => s + w, 0);
    const shares = new Map<number, { share: number; stage: string }>(); // entry.id →
    for (const e of field) {
      const round = eliminatedIn.get(e.id);
      const weight = winWeight.get(e.id) ?? 0;
      // ⚠ NO WIN, NO MONEY — INCLUDING THE PLACEMENT BONUSES. This is the one
      // place the two parts of the purse are not independent, and it is what
      // keeps round 18's ruling intact: in a STRAIGHT FINAL the runner-up is
      // also a first-round loser, and paying it a placement bonus for losing
      // the only fight of the night would quietly reverse a rule nobody asked
      // to reverse. A bird is paid for what it won; placing is a bonus on top
      // of that, never instead of it.
      if (weight === 0) continue;
      const advancement = totalWeight > 0 ? (purse.ADVANCEMENT * weight) / totalWeight : 0;
      const bonus =
        e.id === championEntry.id
          ? purse.CHAMPION
          : round !== undefined && totalRounds - round === 0
            ? purse.RUNNER_UP
            : 0;
      shares.set(e.id, {
        share: advancement + bonus,
        stage: Tournaments.stageOf(e.id === championEntry.id, round, totalRounds, bracketSize),
      });
    }
    const totalShare = [...shares.values()].reduce((s, v) => s + v.share, 0);
    const payouts: TournamentResolution["payouts"] = [];
    let paid = 0;
    // ⚠ A CENT IS THE FLOOR, NOT ZERO — and this is the round's own promise
    // being kept at the edge. `Math.floor` on a shallow win in a big bracket
    // rounds to nothing on a thin purse: measured, a 64-bracket paying out of
    // a 3.00 GP purse left 16 of its 32 fight-winners with a row that
    // `payPurse` skips entirely, and NOTHING would have said so — the purse
    // still settles, because the champion absorbs the remainder, so the
    // conservation proof stays green while "every win pays" quietly stops
    // being true. The break-even is tiny (a 64-bracket needs 3.84 GP, a
    // 32-bracket 1.60) and a real Major purse is a thousand times that — but
    // a rule that holds only in the healthy case is a rule with a trapdoor,
    // and an early world with a split juice pool is exactly where a big field
    // meets a thin purse.
    //
    // The fallback is honest rather than clever: if the purse cannot cover a
    // cent for every winner AND leave one for the champion, there is no
    // arithmetic that keeps the promise, so it pays the plain shares and the
    // deepest winners take what there is.
    const others = [...shares.keys()].filter((id) => id !== championEntry.id).length;
    const canFloor = purseCents >= others + 1;
    for (const [entryId, { share, stage }] of shares) {
      if (entryId === championEntry.id) continue; // champion settles last, with the dust
      const exact = Math.floor((purseCents * share) / totalShare);
      const cents = canFloor ? Math.max(1, exact) : exact;
      const entry = field.find((e) => e.id === entryId)!;
      Tournaments.payPurse(database, t, entry, cents, stage, nameOf.get(entryId)!, payouts, farmNameOf);
      paid += cents;
    }
    Tournaments.payPurse(
      database, t, championEntry, purseCents - paid, "champion",
      championBird.name, payouts, farmNameOf
    );

    // Land to the fallen: elimination grants, earliest-out paid the most.
    for (const e of field) {
      const round = eliminatedIn.get(e.id);
      const grant =
        e.id === championEntry.id
          ? rules.landGrants.champion
          : Tournaments.grantFor(totalRounds - (round ?? totalRounds), rules.landGrants);
      const farm = database.select().from(farms).where(eq(farms.id, e.farmId)).get()!;
      database.update(farms).set({ landTokensCents: farm.landTokensCents + grant }).where(eq(farms.id, e.farmId)).run();
      database.update(tournamentEntries).set({ landGranted: grant }).where(eq(tournamentEntries.id, e.id)).run();
      emit(database, {
        type: "purse_payout",
        farmId: e.farmId,
        birdId: e.birdId,
        lt: grant,
        message: `${nameOf.get(e.id)} — ${label(t.format)} land grant: +${fmtLt(grant)} LT (${
          e.id === championEntry.id ? "champion" : `out in the ${Tournaments.roundName(round!, totalRounds, bracketSize)}`
        })`,
      });
    }

    database
      .update(tournamentEntries)
      .set({ status: "champion" })
      .where(eq(tournamentEntries.id, championEntry.id))
      .run();
    database
      .update(tournaments)
      .set({ status: "completed", bracketSize, purseCents, dayResolved: dayIndex })
      .where(eq(tournaments.id, t.id))
      .run();
    emit(database, {
      type: "champion",
      birdId: championEntry.birdId,
      message:
        `🏆 ${championBird.name} (${championFarm}) is the Week ${week} ${label(t.format)} winner — ` +
        `${totalRounds} straight hardcore wins, ${fmtGp(purseCents)} GP purse`,
      data: { tournamentId: t.id, bracketSize, purseCents },
    });

    return {
      tournamentId: t.id,
      weekIndex: week,
      format: t.format,
      label: label(t.format),
      cancelled: false,
      field: field.length,
      bracketSize,
      rounds,
      champion: { bird: championBird.name, farm: championFarm },
      purseCents,
      payouts,
    };
  }

  private static runFight(
    database: DB,
    t: TournamentRow,
    ea: EntryRow,
    eb: EntryRow,
    round: number,
    roundName: string,
    rng: Rng,
    week: number,
    weather: Element,
    dayIndex: number
  ): TournamentFightReport {
    const divisionRules = DIVISION_RULES[(t.division ?? "major") as Division];
    const hardcore = divisionRules.hardcore;
    const simSeed = randInt(rng, 1, 2 ** 31 - 1);
    const rowA = database.select().from(birds).where(eq(birds.id, ea.birdId)).get()!;
    const rowB = database.select().from(birds).where(eq(birds.id, eb.birdId)).get()!;
    const header = `${label(t.format)} · ${roundName}`;
    const sim = simulatePair(
      toCombatant(rowA),
      toCombatant(rowB),
      t.format,
      mulberry32(simSeed),
      header,
      weather
    );

    const sides = [
      { entry: ea, row: rowA, won: sim.winner === 0, figure: sim.figures[0] },
      { entry: eb, row: rowB, won: sim.winner === 1, figure: sim.figures[1] },
    ];
    // The Majors mint on the steep curve; the juvenile stage mints off its
    // own (much smaller) basis — a discovery-year fight isn't worth a Major's
    // land, and pretending otherwise would make the crowns the cheap way in.
    const landEach =
      divisionRules.hardcore
        ? landForTournamentFight(divisionRules.landBasis)
        : landForFight(divisionRules.landBasis);
    const farmNames: string[] = [];
    for (const [i, side] of sides.entries()) {
      const other = sides[1 - i];
      const farm = database.select().from(farms).where(eq(farms.id, side.entry.farmId)).get()!;
      farmNames.push(farm.name);
      // Records move for bird AND farm (one record, ruled round 15). No GP
      // here — the purse settles at the end; land mints per fight, both sides.
      const farmRecord = side.won ? { wins: farm.wins + 1 } : { losses: farm.losses + 1 };
      database
        .update(farms)
        .set({ landTokensCents: farm.landTokensCents + landEach, ...farmRecord })
        .where(eq(farms.id, side.entry.farmId))
        .run();
      // ⚠ ROUND 37 — THIS is why land had no conservation proof. The mint
      // above used to be reported only as `landEach` inside the world-level
      // `fight` event's `data`: unsigned, unattributed to a farm, and
      // therefore invisible to any sum over `events.lt`. Every other land
      // path (the card, the elimination grants, gacha, buy_land, the stud
      // seat's burn) already wrote a signed per-farm delta, so the crowns
      // were the single hole that made `sum(events.lt) == sum(farm piles)`
      // untestable — and an untestable faucet is exactly how the two silent
      // GP burns survived. One row per SIDE, because the fight event has no
      // farmId and land is owed to two different barns.
      emit(database, {
        type: "crown_land",
        farmId: side.entry.farmId,
        birdId: side.row.id,
        lt: landEach,
        message:
          `${side.row.name} fought the ${label(t.format)} ${roundName} — +${fmtLt(landEach)} LT`,
        data: { tournamentId: t.id, round },
      });
      const birdRow = database.select().from(birds).where(eq(birds.id, side.row.id)).get()!;
      database
        .update(birds)
        .set(
          side.won
            ? {
                wins: birdRow.wins + 1,
                // A juvenile crown is still the discovery year — it does not
                // graduate a maiden (the round-19 rule, held).
                stakesWins: birdRow.stakesWins + (hardcore ? 1 : 0),
              }
            : { losses: birdRow.losses + 1 }
        )
        .where(eq(birds.id, side.row.id))
        .run();
      // Hardcore throughout — the key rule, every round. EXCEPT in the
      // juvenile division (round 23): the discovery year exists to find out
      // what a bird is, and ending careers at age one would strangle the very
      // population the Majors are meant to inherit. A juvenile loser is
      // eliminated from the bracket and goes home to fight another day.
      if (!side.won) {
        if (hardcore)
          database
            .update(birds)
            .set({ status: "retired", retiredBy: "hardcore", retiredWeek: week })
            .where(eq(birds.id, side.row.id))
            .run();
        database
          .update(tournamentEntries)
          .set({ status: "eliminated", eliminatedRound: round })
          .where(eq(tournamentEntries.id, side.entry.id))
          .run();
        // ⚠ ROUND 37 — THIS EMIT WAS OUTSIDE THE `hardcore` GUARD, and had been
        // since the juvenile division was added in round 23. Every juvenile
        // championship loser wrote a `retire` event saying it had been
        // force-retired while the bird walked home perfectly alive: 67 of them
        // in a 21-day sim against 0 actual retirements. Two costs, and the
        // second is the serious one. It lied to the player in the ledger — and
        // it poisoned the doctor's POPULATION line, which counts `retire`
        // events by `data.by` and warns when attrition outruns supply. The
        // single most important balance signal in the game was reading pure
        // fiction, and it would have made round 37's open Thursday look like a
        // population collapse that never happened.
        //
        // A juvenile elimination is not a retirement, so it emits nothing: the
        // bout already has its own `fight` event, and the bracket's own rows
        // record who went out and when.
        if (hardcore)
          emit(database, {
            type: "retire",
            farmId: side.entry.farmId,
            birdId: side.row.id,
            message: `${side.row.name} fell in the ${label(t.format)} ${roundName} — force-retired (${birdRow.wins}–${birdRow.losses + 1})`,
            data: { by: "hardcore", tournamentId: t.id },
          });
      }
      database
        .insert(battleLog)
        .values({
          // ⚠ ROUND 38 — THIS WAS HARDCODED TO PINTAKASI.DAY_OF_WEEK, so every
          // JUVENILE Championship fight was archived under THURSDAY's date
          // while it was actually fought on Wednesday. Two harms. The archive
          // dated a whole division's fights one day late, which any per-day
          // reading — the office's fights-per-day chart, the doctor, any SQL
          // anyone writes — silently inherited. And the fight's WEATHER is
          // `weatherOfDay(dayIndex)` of the REAL day, so a replay rebuilt from
          // the logged day fought under the wrong element: 2 of 201 sampled
          // fights failed to reproduce, and every one of them was a juvenile
          // crown. Found by the round-38 replay check, which is the entire
          // argument for building it — nothing else in the project compares
          // the archive against anything.
          dayIndex,
          lobbyId: null,
          tournamentId: t.id,
          farmId: side.entry.farmId,
          birdId: side.row.id,
          mode: hardcore ? "hardcore" : "juvenile",
          format: t.format,
          lobby: "open",
          claimPrice: null,
          opponentBirdId: other.row.id,
          opponentFarmId: other.entry.farmId,
          opponentName: other.row.name,
          selfGrade: overallGradeOf(side.row.agility + side.row.sight + side.row.stamina + side.row.gameness + side.row.station + side.row.condition),
          opponentGrade: overallGradeOf(other.row.agility + other.row.sight + other.row.stamina + other.row.gameness + other.row.station + other.row.condition),
          // `sides` is built in simulatePair's argument order above, so the
          // loop index IS the side. This is the only thing that lets a fight be
          // replayed from its seed — see schema.ts.
          side: i,
          result: side.won ? "win" : "loss",
          pitFigure: side.figure,
          gpDeltaCents: 0, // purse GP is a tournament settle, not a fight settle
          seed: simSeed,
        })
        .run();
    }
    const w = sim.winner;
    emit(database, {
      type: "fight",
      birdId: sides[w].row.id,
      message:
        `${sides[w].row.name} (${farmNames[w]}) def. ${sides[1 - w].row.name} (${farmNames[1 - w]}) — ` +
        `${header} · figures ${sides[w].figure}/${sides[1 - w].figure} · +${fmtLt(landEach)} LT each · ` +
        // Same round-37 fix as the retire event above: this said "force-retired"
        // for every bout in the game, including the juvenile stage where losing
        // costs a bird nothing but the bracket.
        `${sides[1 - w].row.name} ${hardcore ? "force-retired" : "eliminated"}`,
      data: { tournamentId: t.id, round, figures: sim.figures, landEach },
    });
    return {
      round,
      winner: sides[w].row.name,
      winnerFarm: farmNames[w],
      loser: sides[1 - w].row.name,
      loserFarm: farmNames[1 - w],
      figures: sim.figures,
      landEach,
      playByPlay: sim.playByPlay,
    };
  }

  // ── committee, purse & helpers ────────────────────────────────────────────

  /** The committee's book on a set of birds — earnings, wins, figure. */
  static committeeCards(database: DB, birdIds: string[]): Map<string, CommitteeCard> {
    const out = new Map<string, CommitteeCard>();
    for (const id of birdIds) {
      const logRows = database.select().from(battleLog).where(eq(battleLog.birdId, id)).all();
      const bird = database.select().from(birds).where(eq(birds.id, id)).get()!;
      const purse = database
        .select()
        .from(tournamentEntries)
        .where(eq(tournamentEntries.birdId, id))
        .all()
        .reduce((s, e) => s + e.gpWonCents, 0);
      out.set(id, {
        earningsCents: logRows.reduce((s, r) => s + Math.max(0, r.gpDeltaCents), 0) + purse,
        wins: bird.wins,
        avgFigure:
          logRows.length === 0
            ? 0
            : Math.round(logRows.reduce((s, r) => s + r.pitFigure, 0) / logRows.length),
      });
    }
    return out;
  }

  /**
   * Sort comparator: negative = a ranks ABOVE b. CAREER EARNINGS lead since
   * round 37, when qualification points were deleted and this comparator
   * stopped being merely the bump order and became THE gate: with Thursday
   * open to every age-FORK bird, where a bird sits in this list is the whole
   * of whether it stands.
   *
   * Earnings is the right lead because it is the one number that already
   * aggregates everything the game rewards — pot money from the daily card,
   * claim tags, and banked purse shares — and because it is VISIBLE. A player
   * can read a bird's seating position off figures already on its card,
   * which the points counter never allowed. Then wins → figure → id, so two
   * birds that have never earned still order deterministically rather than
   * by insertion.
   */
  static compareRank(a: CommitteeCard, b: CommitteeCard, aId: string, bId: string): number {
    if (a.earningsCents !== b.earningsCents) return b.earningsCents - a.earningsCents;
    if (a.wins !== b.wins) return b.wins - a.wins;
    if (a.avgFigure !== b.avgFigure) return b.avgFigure - a.avgFigure;
    return aId < bId ? -1 : 1;
  }

  /**
   * The fallen-weighted land ladder, per division (round 23 — the juvenile
   * stage has its own, much smaller table; paying discovery-year birds Major
   * money would have made the free crown the best land in the game).
   */
  /**
   * How far a bird got, as the words the ledger and the office print.
   *
   * Round 40 split this off from the money. It used to be inseparable — the
   * share table WAS the stage table, so naming a stage and paying it were one
   * lookup. Now the purse is paid on fights won, and the stage is a label:
   * "semifinal" is where the bird stopped, not what it was paid for.
   */
  private static stageOf(
    isChampion: boolean,
    eliminatedRound: number | undefined,
    totalRounds: number,
    bracketSize: number
  ): string {
    if (isChampion) return "champion";
    if (eliminatedRound === undefined) return "unbeaten"; // can't happen — a bracket has one survivor
    if (totalRounds - eliminatedRound === 0) return "runner-up";
    // "Semifinals" → "semifinal": the round is plural, one bird's exit is not.
    return roundName(eliminatedRound, totalRounds, bracketSize).toLowerCase().replace(/s$/, "");
  }

  private static grantFor(roundsFromFinal: number, g: Record<string, number>): number {
    const ladder = [g.runnerUp, g.sf, g.qf, g.r16, g.r32, g.r64].filter((v) => v !== undefined);
    return ladder[roundsFromFinal] ?? ladder[ladder.length - 1];
  }

  private static roundName(round: number, totalRounds: number, bracketSize: number): string {
    return roundName(round, totalRounds, bracketSize);
  }

  private static payPurse(
    database: DB,
    t: TournamentRow,
    entry: EntryRow,
    cents: number,
    stage: string,
    birdName: string,
    payouts: TournamentResolution["payouts"],
    farmNameOf: (id: string) => string
  ): void {
    if (cents <= 0) return;
    const farm = database.select().from(farms).where(eq(farms.id, entry.farmId)).get()!;
    const total = farm.gpCents + cents;
    database
      .update(farms)
      .set({ gp: farm.gp + Math.floor(total / 100), gpCents: total % 100 })
      .where(eq(farms.id, entry.farmId))
      .run();
    database
      .update(tournamentEntries)
      .set({ gpWonCents: cents })
      .where(eq(tournamentEntries.id, entry.id))
      .run();
    emit(database, {
      type: "purse_payout",
      farmId: entry.farmId,
      birdId: entry.birdId,
      gpCents: cents,
      message: `${birdName} — ${label(t.format)} purse (${stage}): +${fmtGp(cents)} GP`,
    });
    payouts.push({ bird: birdName, farm: farmNameOf(entry.farmId), gpCents: cents, stage });
  }

  private static refundEntry(database: DB, entry: EntryRow, birdName: string, why: string): void {
    const farm = database.select().from(farms).where(eq(farms.id, entry.farmId)).get()!;
    if (entry.fee > 0)
      database.update(farms).set({ gp: farm.gp + entry.fee }).where(eq(farms.id, entry.farmId)).run();
    database
      .update(tournamentEntries)
      .set({ status: "refunded" })
      .where(eq(tournamentEntries.id, entry.id))
      .run();
    emit(database, {
      type: "refund",
      farmId: entry.farmId,
      birdId: entry.birdId,
      gpCents: entry.fee * 100,
      // A scratch returns the escrow — 80 GP on a Major since round 41, and
    // nothing at all on the free juvenile crown, which is why this is guarded
    // rather than unconditional — say so
      // rather than announcing "0 GP home".
      message:
        `${birdName}'s Pintakasi entry withdrawn — ${why}` +
        (entry.fee > 0 ? ` (${entry.fee} GP home)` : ""),
    });
  }

  private static pending(database: DB, tournamentId: number): EntryRow[] {
    return database
      .select()
      .from(tournamentEntries)
      .where(
        and(eq(tournamentEntries.tournamentId, tournamentId), eq(tournamentEntries.status, "pending"))
      )
      .all();
  }

  private pendingEntries(tournamentId: number): EntryRow[] {
    return Tournaments.pending(this.database, tournamentId);
  }

  private findOrOpen(
    weekIndex: number,
    format: FightFormat,
    division: Division = "major"
  ): TournamentRow {
    const existing = this.database
      .select()
      .from(tournaments)
      .where(
        and(
          eq(tournaments.weekIndex, weekIndex),
          eq(tournaments.format, format),
          eq(tournaments.division, division),
          eq(tournaments.status, "open")
        )
      )
      .get();
    if (existing) return existing;
    return this.database
      .insert(tournaments)
      .values({
        weekIndex,
        format,
        division,
        seed: freshSeed(),
        entryFee: DIVISION_RULES[division].entryFee,
      })
      .returning()
      .get();
  }
}

