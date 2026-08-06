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
