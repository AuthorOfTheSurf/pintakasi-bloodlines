/**
 * Letter grades over the 0–2000 stat scale (ruled 2026-08-03 round 14).
 * 100-point bands: 0–99 C · 100–199 C+ · 200–299 B · 300–399 B+ · 400–499 A
 * · 500–599 A+ · 600–699 S · 700–799 S+. Values of 800+ clamp to S+ for now
 * — nothing on the board is near it; extend the ladder when breeding gets
 * there (open dial). The overall grade is the six-stat average through the
 * same lookup (e.g. total 1400 → 233.3 → B).
 */
export const GRADES = ["C", "C+", "B", "B+", "A", "A+", "S", "S+"] as const;
export type Grade = (typeof GRADES)[number];

export function gradeOf(value: number): Grade {
  const band = Math.floor(Math.max(0, value) / 100);
  return GRADES[Math.min(band, GRADES.length - 1)];
}

export function overallGradeOf(total: number): Grade {
  return gradeOf(total / 6);
}
