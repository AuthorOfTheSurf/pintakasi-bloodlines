import { and, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { battleLog, birds, farms, gameState, tournamentEntries, tournaments } from "@/db/schema";
import {
  FORMATS,
  JUVENILE_MAJOR,
  PINTAKASI,
  landForFight,
  landForTournamentFight,
  weatherOfDay,
  ECONOMY,
  type Element,
  type FightFormat,
} from "./config";
import { emit, fmtGp } from "./events";
import { simulatePair, type Combatant } from "./fight-sim";
import { Flock } from "./flock";
import { canHardcore, canJuvenile } from "./lifecycle";
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
    purseShares: PINTAKASI.PURSE_SHARES as Record<string, number>,
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
    purseShares: JUVENILE_MAJOR.PURSE_SHARES as Record<string, number>,
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
  crownPoints: number; //  qualification points won on the daily card (round 22)
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

  /** The week's three blades: the anchors, plus the rotating middle. */
  static bladesOfWeek(weekIndex: number): FightFormat[] {
    return [...PINTAKASI.ANCHORS, PINTAKASI.MIDDLE[weekIndex % 2]] as FightFormat[];
  }

  /**
   * The Juvenile Championship's two blades (round 23) — one from the short
   * end of the dial, one from the long end, rotating week by week so a
   * discovery year sees both halves of the spectrum.
   */
  static juvenileBladesOfWeek(weekIndex: number): FightFormat[] {
    return [...JUVENILE_MAJOR.BLADES[weekIndex % JUVENILE_MAJOR.BLADES.length]] as FightFormat[];
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
      // Qualification, not money (round 22): the crowns are FREE and a bird
      // earns its way in on the daily card. See PINTAKASI.POINTS_FOR.
      if (birdRow.crownPoints < PINTAKASI.QUALIFYING_POINTS)
        throw new Error(
          `${bird.name} holds ${birdRow.crownPoints} of the ${PINTAKASI.QUALIFYING_POINTS} qualification points a crown asks for — ` +
            `campaign on the daily card first (a real win banks ${PINTAKASI.POINTS_FOR.real}, a hardcore ${PINTAKASI.POINTS_FOR.hardcore})`
        );
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
    // Free since round 22 — the knob survives so a future season can charge
    // again without a rebuild, but at 0 nothing is escrowed or refunded.
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
    emit(this.database, {
      type: "tournament_entry",
      farmId: this.farmId,
      birdId,
      gpCents: -fee * 100,
      message:
        `registered ${bird.name} for the ${label(tournament.format)} (week ${week}, ` +
        (fee > 0 ? `${fee} GP escrowed` : `free — qualified on ${birdRow.crownPoints} points`) +
        `) — hardcore: lose and the career ends`,
    });
    return {
      entryId: inserted.id,
      note: `Registered. The ${label(tournament.format)} runs Thursday — every loser force-retires; the champion takes the purse.`,
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
    // Since round 22 the entries are free, so the purse IS this blade's cut
    // of the juice pool — which means gacha spend and breed fees are what
    // the champion actually takes home. (The fee term survives so a paid
    // season would still add to the pot without a rebuild.)
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

    const rounds: TournamentResolution["rounds"] = [];
    const eliminatedIn = new Map<number, number>(); // entry.id → round
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
        const report = Tournaments.runFight(database, t, a, b, round, roundName, rng, week, weather);
        fights.push(report);
        const winner = report.winner === nameOf.get(a.id) ? a : b;
        const loser = winner === a ? b : a;
        eliminatedIn.set(loser.id, round);
        next.push(winner);
      }
      rounds.push({ name: roundName, fights, byes });
      alive = next;
    }
    const championEntry = alive[0]!;
    const championBird = database.select().from(birds).where(eq(birds.id, championEntry.birdId)).get()!;
    const championFarm = farmNameOf(championEntry.farmId);

    // GP to the top: shares by finishing stage, first-round losers zeroed,
    // the rest renormalized. Rounding dust crowns the champion too.
    const rules = DIVISION_RULES[(t.division ?? "major") as Division];
    const shareTable = rules.purseShares;
    const shares = new Map<number, { share: number; stage: string }>(); // entry.id →
    shares.set(championEntry.id, { share: shareTable.champion, stage: "champion" });
    for (const e of field) {
      const round = eliminatedIn.get(e.id);
      if (round === undefined || e.id === championEntry.id) continue;
      const fromFinal = totalRounds - round;
      const raw =
        fromFinal === 0
          ? { share: shareTable.runnerUp, stage: "runner-up" }
          : fromFinal === 1
            ? shareTable.sfLoser
              ? { share: shareTable.sfLoser, stage: "semifinal" }
              : null
            : fromFinal === 2
              ? shareTable.qfLoser
                ? { share: shareTable.qfLoser, stage: "quarterfinal" }
                : null
              : null;
      if (raw && round > 1) shares.set(e.id, raw); // first-round losers take ZERO (the ruling)
    }
    const totalShare = [...shares.values()].reduce((s, v) => s + v.share, 0);
    const payouts: TournamentResolution["payouts"] = [];
    let paid = 0;
    for (const [entryId, { share, stage }] of shares) {
      if (entryId === championEntry.id) continue; // champion settles last, with the dust
      const cents = Math.floor((purseCents * share) / totalShare);
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
      database.update(farms).set({ landTokens: farm.landTokens + grant }).where(eq(farms.id, e.farmId)).run();
      database.update(tournamentEntries).set({ landGranted: grant }).where(eq(tournamentEntries.id, e.id)).run();
      emit(database, {
        type: "purse_payout",
        farmId: e.farmId,
        birdId: e.birdId,
        lt: grant,
        message: `${nameOf.get(e.id)} — ${label(t.format)} land grant: +${grant} LT (${
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
    weather: Element
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
        .set({ landTokens: farm.landTokens + landEach, ...farmRecord })
        .where(eq(farms.id, side.entry.farmId))
        .run();
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
          dayIndex: t.weekIndex * 7 + PINTAKASI.DAY_OF_WEEK, // the day this crown was fought
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
          result: side.won ? "win" : "loss",
          pitFigure: side.figure,
          gpDeltaCents: 0, // purse GP is a tournament settle, not a fight settle
          seed: simSeed,
          playByPlay: sim.playByPlay,
        })
        .run();
    }
    const w = sim.winner;
    emit(database, {
      type: "fight",
      birdId: sides[w].row.id,
      message:
        `${sides[w].row.name} (${farmNames[w]}) def. ${sides[1 - w].row.name} (${farmNames[1 - w]}) — ` +
        `${header} · figures ${sides[w].figure}/${sides[1 - w].figure} · +${landEach} LT each · ${sides[1 - w].row.name} force-retired`,
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

  /** The committee's book on a set of birds — points, earnings, wins, figure. */
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
        crownPoints: bird.crownPoints,
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
   * Sort comparator: negative = a ranks ABOVE b. QUALIFICATION POINTS lead
   * since round 22 — with the crowns free, the bump line should reward the
   * bird that campaigned hardest, not the barn with the deepest wallet.
   * Then earnings → wins → figure → id.
   */
  static compareRank(a: CommitteeCard, b: CommitteeCard, aId: string, bId: string): number {
    if (a.crownPoints !== b.crownPoints) return b.crownPoints - a.crownPoints;
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
      // Free entry (round 22) means a scratch costs nobody anything — say so
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
        entryFee: PINTAKASI.ENTRY_FEE,
      })
      .returning()
      .get();
  }
}

function toCombatant(row: typeof birds.$inferSelect): Combatant {
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
    element: row.element,
    halfStars: row.halfStars,
  };
}
