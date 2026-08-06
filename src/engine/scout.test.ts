import { expect, test } from "bun:test";
import { FIGURE, SCOUT } from "./config";
import { GRADE_BAND } from "./grades";
import { normalizedScoutFigure } from "./scout";

test("the scout removes only the public grade expectation", () => {
  // An A posting one grade-step above B+ against the same company is the same
  // blade evidence, not a better distance read. Results and margins do not
  // enter this helper, so they remain meaningful figure evidence.
  expect(normalizedScoutFigure(80 + SCOUT.OWN_GRADE_STEP, "A", "B+")).toBe(
    normalizedScoutFigure(80, "B+", "B+")
  );
  // ⚠ REVERSED IN ROUND 30. This used to assert that better COMPANY raised a
  // figure by a public allowance, because the old figure paid a class credit
  // for the bird you beat. The rebuilt figure reads the bird's own blend
  // against a fixed dummy — the opponent is not in it — and the sim confirms
  // it: holding own grade at B+, mean figure was 27.0 against B+ company,
  // 27.8 against B, 25.8 against A. Flat. So company must now be a NO-OP
  // here, and a nonzero OPPONENT_GRADE_STEP would be the scout inventing a
  // correction for an effect the engine no longer has.
  expect(normalizedScoutFigure(80, "B+", "A")).toBe(normalizedScoutFigure(80, "B+", "B+"));
  expect(normalizedScoutFigure(80, "B+", "C")).toBe(normalizedScoutFigure(80, "B+", "B+"));
  expect(SCOUT.OPPONENT_GRADE_STEP).toBe(0);
});

test("the own-grade step is DERIVED from the figure's scale, not fitted to it", () => {
  // The drift pin. Round 27 moved the figure scale and left this constant 18
  // points adrift; nobody noticed until round 29 measured it. Round 30 gave
  // the figure a unit so the number can be computed instead: the spine is
  // linear in the stat blend, so PEG_STAT stat points buy PEG_FIGURE figure
  // points, and a grade is GRADE_BAND stat points. If someone re-pegs the
  // figure without re-deriving the scout, this fails and says why.
  const derived = (GRADE_BAND / FIGURE.PEG_STAT) * FIGURE.PEG_FIGURE;
  // `as number` because config is `as const`, so the literal type would make
  // this a compile-time tautology instead of the runtime check it needs to be.
  expect(SCOUT.OWN_GRADE_STEP as number).toBe(derived);
  // And the correction still has to point the right way: a bird graded above
  // the reference is expected to figure HIGHER, so its read is marked down.
  expect(normalizedScoutFigure(80, "A", "B+")).toBeLessThan(normalizedScoutFigure(80, "B+", "B+"));
  expect(normalizedScoutFigure(80, "B", "B+")).toBeGreaterThan(normalizedScoutFigure(80, "B+", "B+"));
});
