import { and, between, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { battleLog, birds, tournamentEntries, tournaments, type BirdRow } from "@/db/schema";
import {
  AGE,
  CLAIMER,
  NW_CAP,
  PINTAKASI,
  SCOUT,
  VALUE,
  feeFor,
  stakePerFight,
  type FightFormat,
} from "./config";
import { readWorldState } from "./farms";
import { GameClock } from "./game-clock";
import { GRADES, overallGradeOf, type Grade } from "./grades";
import { ageOf } from "./lifecycle";
import { forgetBooksAfter, parBook, type ClassRung, type ParBook } from "./pars";

/**
 * THE GAME VALUE — the game's public estimate of a bird's worth in GP. The
 * recipe and every knob are in config VALUE; this file is the arithmetic.
 *
 * Everything it reads is public: the bird's own daily-card figures (on its
 * past-performance lines), its age and stakes record (on its card), and the
 * class pars (on the lobby board). So a stable that prices a bird by it knows
 * nothing a player could not work out.
 */
export interface Appraisal {
  value: number; //          GP, to the nearest VALUE.ROUND_TO: the card value plus `crown`
  form: number | null; //    the recency-weighted figure; null with no figures and no prior yet
  crown: number; //          GP, unrounded: the crown term (see crownTerm)
}

/** What the appraisal reads off a bird: all of it on the bird's public card. */
export type AppraisedBird = { id: string; age: number; stakesWins: number; overallGrade: Grade };

/**
 * Once per bird per day, like the pars: the form reads fights before today
 * only, so the value is fixed from the morning on and a bird's view costs its
 * indexed reads (form, crown) only the first time it is built each day. The
 * crown market is read once per day beside them.
 */
const memo = new WeakMap<
  object,
  { day: number; byBird: Map<string, Appraisal>; market?: CrownMarket }
>();

/** See forgetBooksAfter: the same staleness, for the day's appraisals. */
export function fightRecorded(db: DB, day: number): void {
  forgetBooksAfter(db, day);
  const hit = memo.get(db);
  if (hit && hit.day > day) memo.delete(db);
}

export function appraise(db: DB, bird: AppraisedBird, today: number): Appraisal {
  let day = memo.get(db);
  if (!day || day.day !== today) {
    day = { day: today, byBird: new Map() };
    memo.set(db, day);
  }
  const hit = day.byBird.get(bird.id);
  if (hit) return hit;
  const book = parBook(db, today);
  const form = formFigure(recentFigures(db, bird.id, today), book.prior(bird.overallGrade));
  day.market ??= crownMarket(db, today);
  const crown = crownTerm(crownRead(db, bird, today, book), day.market);
  const made = { value: valueAtForm(form, bird, book, crown), form, crown };
  day.byBird.set(bird.id, made);
  return made;
}

export function gameValue(db: DB, bird: AppraisedBird, today: number): number {
  return appraise(db, bird, today).value;
}

/**
 * The value a fight records as `value_before`: the bird's appraisal on the day
 * the fight was carded, read off the raw row the fight resolves. The day's memo
 * makes it the same number the bird showed that morning.
 */
export function valueBefore(db: DB, row: BirdRow, day: number): number {
  const overallGrade = overallGradeOf(
    row.agility + row.sight + row.stamina + row.gameness + row.station + row.condition
  );
  const age = ageOf(row, GameClock.weekOf(day));
  return gameValue(db, { id: row.id, age, stakesWins: row.stakesWins, overallGrade }, day);
}

/** Newest first: the bird's last FORM_FIGHTS daily-card figures before today. */
function recentFigures(db: DB, birdId: string, today: number): number[] {
  return db
    .select({ figure: battleLog.pitFigure })
    .from(battleLog)
    .where(
      and(
        eq(battleLog.birdId, birdId),
        lt(battleLog.dayIndex, today),
        isNull(battleLog.tournamentId)
      )
    )
    .orderBy(desc(battleLog.dayIndex), desc(battleLog.id))
    .limit(VALUE.FORM_FIGHTS)
    .all()
    .map((r) => r.figure);
}

/**
 * Recent fights weigh most (FORM_DECAY per fight back), and PRIOR_FIGHTS
 * pseudo-fights at what birds of its overall grade typically post pull a short
 * record toward that. The grade is public from birth (it says how strong, never
 * what shape), so an unraced chick of a high grade already reads above a low
 * one. With no fights in the world yet the bird's own figures stand alone.
 */
export function formFigure(newestFirst: number[], prior: number | null): number | null {
  let weight = 0;
  let sum = 0;
  newestFirst.forEach((figure, i) => {
    const w = VALUE.FORM_DECAY ** i;
    weight += w;
    sum += w * figure;
  });
  if (prior !== null) {
    weight += VALUE.PRIOR_FIGHTS;
    sum += VALUE.PRIOR_FIGHTS * prior;
  }
  return weight > 0 ? sum / weight : null;
}

/** The chance a bird of this form wins a fight in a class whose even-money form is `level`. */
export function winChance(form: number, level: number): number {
  return 1 / (1 + Math.exp(-(form - level) / VALUE.SCALE));
}

/**
 * The form an even-money bird brings to this rung: its measured level, or on a
 * thin rung the par less EVEN_GAP. Null without a par.
 */
function levelOf(rung: ClassRung, book: ParBook): number | null {
  const measured = book.level(rung);
  if (measured !== null) return measured;
  const par = book.par(rung);
  return par === null ? null : par - VALUE.EVEN_GAP;
}

/**
 * GP a bird of this form should make per fight on a rung: no rake, so a win
 * takes the other side's stake and a loss gives up its own. Null without a par.
 */
export function perFight(form: number, rung: ClassRung, book: ParBook): number | null {
  const level = levelOf(rung, book);
  if (level === null) return null;
  const stake = stakePerFight(feeFor(rung.mode, rung.classType, rung.price ?? undefined));
  return (2 * winChance(form, level) - 1) * stake;
}

/** The grown rungs a bird's career could run in, by its stakes record today. */
function careerRungs(stakesWins: number): ClassRung[] {
  const rungs: ClassRung[] = [{ mode: "real", classType: "open" }];
  if (stakesWins === 0) rungs.push({ mode: "real", classType: "maiden" });
  if (stakesWins < NW_CAP) rungs.push({ mode: "real", classType: "nw3" });
  for (const price of CLAIMER.PRICES) rungs.push({ mode: "real", classType: "claimer", price });
  return rungs;
}

/**
 * The value a bird of this form would carry: the recipe without the lookup.
 * Exported so a stable can price its own misjudgement of the form the same way
 * the game prices the real one.
 */
export function valueAtForm(
  form: number | null,
  bird: { age: number; stakesWins: number },
  book: ParBook,
  crown = 0
): number {
  const rounded = (gp: number) => Math.round(gp / VALUE.ROUND_TO) * VALUE.ROUND_TO;
  if (form === null) return rounded(VALUE.FLOOR + crown);
  // A juvenile's grown career has not started, so it has all of it left.
  const weeksLeft = Math.max(0, AGE.FIGHTING_CAP - Math.max(bird.age, AGE.REAL_STAKES));
  const runway = weeksLeft * VALUE.FIGHTS_PER_WEEK * VALUE.DISCOUNT;
  let best: number = VALUE.FLOOR;
  for (const rung of careerRungs(bird.stakesWins)) {
    const ev = perFight(form, rung, book);
    if (ev === null) continue;
    const earned = VALUE.FLOOR + Math.max(0, ev) * runway;
    // Running on a tag, anyone may buy the bird at the tag.
    const worth = rung.classType === "claimer" ? Math.min(earned, rung.price ?? earned) : earned;
    best = Math.max(best, worth);
  }
  // The crown sits on top of a claimer's tag cap: a bird with a real shot at a
  // Major is worth more than any tag, which is what keeps it off one.
  return rounded(best + crown);
}

// ── THE CROWN TERM (issue #36; the fit and every knob are in config VALUE) ──

/** The day's crown market: what a Major pays and how many birds chase its finals. */
export interface CrownMarket {
  purseGp: number;
  field: number; // live birds of Major age, AGE.FORK through LAST_MAJOR_AGE
}

/** What the crown term reads off one bird, all of it public. */
export interface CrownRead {
  age: number;
  overallGrade: Grade;
  vsPar: number; //            best Major blade's shrunk figure minus the open par
  earningsGp: number; //       gross career earnings: card winnings plus purses
  juvenileCrownWins: number; // fights won in the Juvenile Championship
}

// Two birds stand in each final, one final per Major blade a week.
const FINALS_PER_WEEK = PINTAKASI.BLADES.length * 2;
// ⚠ FROM THE AGE CAP, NOT FROM THE FIT. The fit's window was ages 3–7: issue
// #38's tick order retires the age-8 field on Hatch Friday before its Thursday
// bracket resolves, so no age-8 bird ever fought a Major in the training
// worlds. #38's fix (PR #39) opens age 8, and this reads the window the rules
// promise, so it is right once that lands. Until then an age-8 bird carries
// one phantom week, and every bird one more week than the fit saw (worth
// ln(6/5) ≈ +0.18 on z at age 3, under a fifth on P).
const LAST_MAJOR_AGE = AGE.FIGHTING_CAP - 1;
const MAJOR_WEEKS = LAST_MAJOR_AGE - AGE.FORK + 1;

/**
 * GP the bird's Major prospects are worth: min(P, CROWN_P_CAP) × K × the going
 * purse, where P is its chance of reaching a Major final in the rest of its
 * career. Zero past the last Major age, and for an egg.
 */
export function crownTerm(bird: CrownRead, market: CrownMarket): number {
  const branch = crownLogit(bird, Math.max(1, market.field));
  if (branch === null) return 0;
  const p = Math.min(1 / (1 + Math.exp(-branch.z)), VALUE.CROWN_P_CAP);
  return p * branch.k * market.purseGp;
}

function crownLogit(bird: CrownRead, field: number): { z: number; k: number } | null {
  if (bird.age >= AGE.FORK && bird.age <= LAST_MAJOR_AGE) {
    const c = VALUE.CROWN_ADULT;
    const weeksLeft = LAST_MAJOR_AGE - bird.age + 1;
    const z =
      Math.log((FINALS_PER_WEEK * weeksLeft) / field) +
      c.INTERCEPT +
      c.VS_PAR * bird.vsPar +
      c.EARNINGS * Math.log1p(Math.max(0, bird.earningsGp));
    return { z, k: c.K };
  }
  if (bird.age >= AGE.CHICK && bird.age < AGE.FORK) {
    const c = VALUE.CROWN_JUVENILE;
    const z =
      c.INTERCEPT +
      c.VS_PAR * bird.vsPar +
      c.GRADE * GRADES.indexOf(bird.overallGrade) +
      c.CROWN_WINS * bird.juvenileCrownWins +
      c.SUPPLY * Math.log((FINALS_PER_WEEK * MAJOR_WEEKS) / field);
    return { z, k: c.K };
  }
  return null;
}

/**
 * The going Major purse and the field, read once a day. The purse is the mean
 * of the Majors completed in the last CROWN_PURSE_WEEKS weeks; a world with
 * none yet uses the juice pool split across the week's Major blades.
 */
function crownMarket(db: DB, today: number): CrownMarket {
  const [recent] = db
    .select({ purse: sql<number | null>`avg(${tournaments.purseCents})` })
    .from(tournaments)
    .where(
      and(
        eq(tournaments.division, "major"),
        eq(tournaments.status, "completed"),
        gte(tournaments.dayResolved, today - 7 * VALUE.CROWN_PURSE_WEEKS),
        lt(tournaments.dayResolved, today)
      )
    )
    .all();
  const purseCents = recent?.purse ?? readWorldState(db).juicePoolCents / PINTAKASI.BLADES.length;
  const week = GameClock.weekOf(today);
  const [band] = db
    .select({ n: sql<number>`count(*)` })
    .from(birds)
    .where(
      and(
        eq(birds.status, "active"),
        between(birds.birthWeek, week - LAST_MAJOR_AGE, week - AGE.FORK)
      )
    )
    .all();
  return { purseGp: purseCents / 100, field: band?.n ?? 0 };
}

/**
 * The bird's crown inputs from fights and purses settled before today, like
 * the form: one grouped read of its fights, and one of its purses for a bird
 * of Major age.
 */
function crownRead(db: DB, bird: AppraisedBird, today: number, book: ParBook): CrownRead {
  const read = { age: bird.age, overallGrade: bird.overallGrade, vsPar: VALUE.CROWN_NO_READ };
  if (bird.age < AGE.CHICK || bird.age > LAST_MAJOR_AGE)
    return { ...read, earningsGp: 0, juvenileCrownWins: 0 };
  const rows = db
    .select({
      format: battleLog.format,
      fights: sql<number>`count(*)`,
      figureSum: sql<number>`sum(${battleLog.pitFigure})`,
      wonCents: sql<number>`sum(max(${battleLog.gpDeltaCents}, 0))`,
      juvenileCrownWins: sql<number>`sum(${battleLog.tournamentId} IS NOT NULL AND ${battleLog.mode} = 'juvenile' AND ${battleLog.result} = 'win')`,
    })
    .from(battleLog)
    .where(and(eq(battleLog.birdId, bird.id), lt(battleLog.dayIndex, today)))
    .groupBy(battleLog.format)
    .all();
  const open = book.par({ mode: "real", classType: "open" });
  let best: number | null = null;
  for (const r of rows) {
    if (open === null || r.fights < VALUE.CROWN_MIN_BLADE_FIGHTS) continue;
    if (!(PINTAKASI.BLADES as readonly FightFormat[]).includes(r.format)) continue;
    const shrunk =
      (r.figureSum + SCOUT.PRIOR_FIGURE * SCOUT.PRIOR_WEIGHT) / (r.fights + SCOUT.PRIOR_WEIGHT);
    best = Math.max(best ?? -Infinity, shrunk - open);
  }
  // Gross earnings enter the CROWN term only. The card value above keeps
  // earnings out on purpose (a bird's past winnings are not its future form),
  // but the Selection Committee seats Majors by gross career earnings, so here
  // they are the gate itself: a bird the committee will not seat cannot reach
  // a final however it figures.
  let earnedCents = rows.reduce((s, r) => s + r.wonCents, 0);
  if (bird.age >= AGE.FORK) {
    const [purses] = db
      .select({ cents: sql<number | null>`sum(${tournamentEntries.gpWonCents})` })
      .from(tournamentEntries)
      .innerJoin(tournaments, eq(tournaments.id, tournamentEntries.tournamentId))
      .where(and(eq(tournamentEntries.birdId, bird.id), lt(tournaments.dayResolved, today)))
      .all();
    earnedCents += purses?.cents ?? 0;
  }
  return {
    ...read,
    vsPar: best ?? VALUE.CROWN_NO_READ,
    earningsGp: earnedCents / 100,
    juvenileCrownWins: rows.reduce((s, r) => s + r.juvenileCrownWins, 0),
  };
}
