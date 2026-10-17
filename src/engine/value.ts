import { and, desc, eq, isNull, lt } from "drizzle-orm";
import type { DB } from "@/db/client";
import { battleLog, type BirdRow } from "@/db/schema";
import { AGE, CLAIMER, NW_CAP, VALUE, feeFor, stakePerFight } from "./config";
import { GameClock } from "./game-clock";
import { overallGradeOf, type Grade } from "./grades";
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
  value: number; //          GP, to the nearest VALUE.ROUND_TO
  form: number | null; //    the recency-weighted figure; null with no figures and no prior yet
}

/** What the appraisal reads off a bird: all of it on the bird's public card. */
export type AppraisedBird = { id: string; age: number; stakesWins: number; overallGrade: Grade };

/**
 * Once per bird per day, like the pars: the form reads fights before today
 * only, so the value is fixed from the morning on and a bird's view costs one
 * indexed read the first time it is built each day.
 */
const memo = new WeakMap<object, { day: number; byBird: Map<string, Appraisal> }>();

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
  const made = { value: valueAtForm(form, bird, book), form };
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
  book: ParBook
): number {
  if (form === null) return VALUE.FLOOR;
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
  return Math.round(best / VALUE.ROUND_TO) * VALUE.ROUND_TO;
}
