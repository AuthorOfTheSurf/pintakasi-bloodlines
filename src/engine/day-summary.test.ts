import { expect, test } from "bun:test";
import type { HonestDayReport } from "./auto-play";
import { honestDaySentence } from "./day-summary";

test("the Play my day sentence writes a wallet the way the farm page does, separators included", () => {
  const report: HonestDayReport = {
    gpBefore: 117206.03,
    gpAfter: 117242.03,
    checkedIn: true,
    pullsSpent: 0,
    studsListed: 0,
    studsRepriced: [],
    barnExpanded: false,
    ltUnstaked: 0,
    ltBought: 0,
    landBoughtGp: 0,
    ltStaked: 0,
    covers: 0,
    named: [],
    crownsEntered: 0,
    birdsEntered: 0,
  };
  expect(honestDaySentence(report)).toEndWith(
    "Your GP went from 117,206.03 to 117,242.03 (+36.00)."
  );
  expect(honestDaySentence({ ...report, gpAfter: 115206.03 })).toEndWith(
    "Your GP went from 117,206.03 to 115,206.03 (−2,000.00)."
  );
});
