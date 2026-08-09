import { sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { battleLog, birdForm } from "@/db/schema";
import { GRADES, type Grade } from "./grades";
import { SCOUT } from "./config";

/**
 * Turn a public Pit Figure back into a like-for-like scouting observation.
 * A figure still contains the result, beaten lengths, and blade performance;
 * this removes only the coarse, publicly visible grade/company expectation.
 * B+ is the reference because it is the standard-card middle.
 */
export function normalizedScoutFigure(figure: number, selfGrade: Grade, opponentGrade: Grade): number {
  const step = (grade: Grade) => GRADES.indexOf(grade) - GRADES.indexOf(SCOUT.REFERENCE_GRADE);
  return figure - step(selfGrade) * SCOUT.OWN_GRADE_STEP - step(opponentGrade) * SCOUT.OPPONENT_GRADE_STEP;
}

/**
 * THE ONE DOOR a battle_log row enters through (round 44). Inserts the row
 * AND advances the scout's running book (bird_form) in the same breath, so
 * the two can never drift — the doctor's checkScoutBook invariant proves it
 * every run, and the test helpers that fabricate careers use this too.
 *
 * WHY A BOOK AT ALL: scoutReport/formatRecords used to re-read a bird's whole
 * battle_log history for every carding decision, every day. Careers only get
 * longer, so per-fight cost grew all run (measured 11 → 34 ms/fight across a
 * 182-day world) — the superlinear half of the sim's cost curve. The book
 * turns each of those scans into one ≤5-row keyed read.
 *
 * ⚠ BIT-IDENTICAL, NOT MERELY EQUIVALENT. norm_sum accumulates one float64
 * addition per fight, in insert order — the same op sequence the old scan's
 * running sum performed in rowid order — and figure_sum stays an integer that
 * is divided and rounded AT READ TIME. Same-seed worlds diff to zero against
 * the pre-book engine. Do not "improve" the arithmetic here (Kahan, SQL-side
 * rounding, storing the average): the scores tie-break real decisions, and a
 * last-digit change silently rewrites every world.
 */
/**
 * A monotonic version on each world's committee-visible numbers (round 47).
 * The Selection Committee's bump-line memo (tournaments.ts) is valid only
 * while nothing that feeds a CommitteeCard has moved — every recorded fight
 * and every purse settlement bumps this, so the memo can never survive into
 * a world where the seating order might have changed. Keyed by the DB handle
 * (a WeakMap), so parallel test worlds never see each other's counter.
 */
const bookVersions = new WeakMap<object, number>();
export function bookVersion(db: object): number {
  return bookVersions.get(db) ?? 0;
}
export function bumpBookVersion(db: object): void {
  bookVersions.set(db, bookVersion(db) + 1);
}

export function recordFight(db: DB, row: typeof battleLog.$inferInsert): number {
  bumpBookVersion(db);
  const inserted = db.insert(battleLog).values(row).returning({ id: battleLog.id }).get();
  // The schema defaults grades to B+ when an insert omits them (old test
  // worlds do); the book must normalize with what the row actually stores.
  const norm = normalizedScoutFigure(
    row.pitFigure,
    (row.selfGrade ?? "B+") as Grade,
    (row.opponentGrade ?? "B+") as Grade
  );
  const win = row.result === "win" ? 1 : 0;
  db.insert(birdForm)
    .values({
      birdId: row.birdId,
      format: row.format,
      fights: 1,
      wins: win,
      losses: 1 - win,
      figureSum: row.pitFigure,
      bestFigure: row.pitFigure,
      normSum: norm,
      earnCents: Math.max(0, row.gpDeltaCents),
    })
    .onConflictDoUpdate({
      target: [birdForm.birdId, birdForm.format],
      set: {
        fights: sql`${birdForm.fights} + 1`,
        wins: sql`${birdForm.wins} + ${win}`,
        losses: sql`${birdForm.losses} + ${1 - win}`,
        figureSum: sql`${birdForm.figureSum} + ${row.pitFigure}`,
        bestFigure: sql`max(${birdForm.bestFigure}, ${row.pitFigure})`,
        normSum: sql`${birdForm.normSum} + ${norm}`,
        earnCents: sql`${birdForm.earnCents} + ${Math.max(0, row.gpDeltaCents)}`,
      },
    })
    .run();
  return inserted.id;
}
