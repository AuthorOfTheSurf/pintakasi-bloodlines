import { expect, test } from "bun:test";
import { SCOUT } from "./config";
import { normalizedScoutFigure } from "./scout";

test("the scout removes only public grade and company expectations", () => {
  // An A posting 15 above B+ against the same B+ company is the same
  // blade evidence, not a better distance read. Results and margins do not
  // enter this helper, so they remain meaningful figure evidence.
  expect(normalizedScoutFigure(95, "A", "B+")).toBe(normalizedScoutFigure(80, "B+", "B+"));
  // Better company raises raw figures by the public allowance, not hidden
  // stat inspection: the coarse letter grade is all the scout may know.
  expect(normalizedScoutFigure(85, "B+", "A")).toBe(normalizedScoutFigure(80, "B+", "B+"));
  expect(SCOUT.OWN_GRADE_STEP).toBeGreaterThan(SCOUT.OPPONENT_GRADE_STEP);
});
