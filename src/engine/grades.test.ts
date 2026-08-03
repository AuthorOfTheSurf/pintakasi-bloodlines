import { expect, test } from "bun:test";
import { gradeOf, overallGradeOf } from "./grades";

/** 100-point bands, ruled 2026-08-03 round 14. 800+ clamps to S+ for now. */
test("the grade ladder", () => {
  expect(gradeOf(0)).toBe("C");
  expect(gradeOf(99)).toBe("C");
  expect(gradeOf(100)).toBe("C+");
  expect(gradeOf(250)).toBe("B");
  expect(gradeOf(399)).toBe("B+");
  expect(gradeOf(450)).toBe("A");
  expect(gradeOf(599)).toBe("A+");
  expect(gradeOf(650)).toBe("S");
  expect(gradeOf(799)).toBe("S+");
  expect(gradeOf(1200)).toBe("S+"); // clamp — extend the ladder when breeding gets here
});

test("overall = six-stat average through the same lookup (Zane's worked example)", () => {
  expect(overallGradeOf(1400)).toBe("B"); // 1400 / 6 = 233.3 → B
  expect(overallGradeOf(2400)).toBe("A"); // 400 average
});
