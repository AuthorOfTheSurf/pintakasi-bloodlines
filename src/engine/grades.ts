/**
 * Letter grades over the 0–2000 stat scale (ruled 2026-08-03 rounds 14–15).
 * 100-point bands: 0–99 C · 100–199 C+ · 200–299 B · 300–399 B+ · 400–499 A
 * · 500–599 A+ · 600–699 S · 700–799 S+ · 800–899 O · 900–999 O+ (round 15's
 * two levels above S+). Values of 1000+ clamp to O+ — extend the ladder when
 * breeding gets there. The overall grade is the six-stat average through the
 * same lookup (e.g. total 1400 → 233.3 → B).
 */
export const GRADES = ["C", "C+", "B", "B+", "A", "A+", "S", "S+", "O", "O+"] as const;
export type Grade = (typeof GRADES)[number];

/**
 * Stat points per letter grade. Exported since round 30, when the Pit Figure
 * was rebuilt with a UNIT and a grade step became a fixed quantity of figure
 * points (SCOUT.OWN_GRADE_STEP is derived from this number and PEG_STAT/
 * PEG_FIGURE, and scout.test.ts pins the derivation). Nothing may re-type the
 * literal — the whole point of round 30 was that a constant fitted to the
 * figure's output goes stale the moment the figure moves.
 */
export const GRADE_BAND = 100;

export function gradeOf(value: number): Grade {
  const band = Math.floor(Math.max(0, value) / GRADE_BAND);
  return GRADES[Math.min(band, GRADES.length - 1)];
}

export function overallGradeOf(total: number): Grade {
  return gradeOf(total / 6);
}

/** Grade tint (ruled round 15): C blue · B orange · A green · S purple · O amber. */
export const GRADE_COLORS: Record<string, string> = {
  C: "#5b9bd5",
  B: "#e07f2a",
  A: "#3f9e4d",
  S: "#9a6fd8",
  O: "#ffbf00",
};

export function gradeColor(grade: Grade): string {
  return GRADE_COLORS[grade[0]] ?? "#e8e0d0";
}
