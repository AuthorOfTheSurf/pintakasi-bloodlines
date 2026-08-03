import { expect, test } from "bun:test";
import { gradeColor, gradeOf, overallGradeOf } from "./grades";

/** 100-point bands, ruled rounds 14–15. 1000+ clamps to O+ for now. */
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
  expect(gradeOf(850)).toBe("O"); // round 15's levels above S+
  expect(gradeOf(950)).toBe("O+");
  expect(gradeOf(1200)).toBe("O+"); // clamp — extend the ladder when breeding gets here
});

test("grade colors follow the letter family", () => {
  expect(gradeColor("C+")).toBe(gradeColor("C"));
  expect(new Set([gradeColor("C"), gradeColor("B"), gradeColor("A"), gradeColor("S"), gradeColor("O")]).size).toBe(5);
});

test("overall = six-stat average through the same lookup (Zane's worked example)", () => {
  expect(overallGradeOf(1400)).toBe("B"); // 1400 / 6 = 233.3 → B
  expect(overallGradeOf(2400)).toBe("A"); // 400 average
});
