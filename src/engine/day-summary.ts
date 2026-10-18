import type { HonestDayReport } from "./auto-play";

/**
 * The sentences a Play my day run leaves, in one place. The farm page shows
 * them as a list the moment the run ends, and the farm log keeps them as the
 * run's summary line. One builder, so the two can never tell a player
 * different stories about the same day.
 *
 * ⚠ TYPE-ONLY IMPORTS. The farm page is a client component and imports this,
 * so nothing here may pull in the database.
 */
export function honestDayLines(report: HonestDayReport): string[] {
  const s = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return [
    report.checkedIn ? "Checked in." : null,
    report.pullsSpent ? `Spent ${s(report.pullsSpent, "free pull")}.` : null,
    report.studsListed ? `Listed ${s(report.studsListed, "stud")}.` : null,
    report.studsRepriced.length
      ? `Repriced ${s(report.studsRepriced.length, "stud")} by last week's demand (Hatch Friday). Any price you had set by hand was replaced.`
      : null,
    report.barnExpanded ? "Expanded the barn." : null,
    report.ltUnstaked ? `Unstaked ${report.ltUnstaked} LT to pay for the barn.` : null,
    report.ltBought
      ? `Bought ${report.ltBought} LT for ${report.landBoughtGp} GP to pay for the barn.`
      : null,
    report.ltStaked ? `Staked ${report.ltStaked} LT.` : null,
    report.covers ? `Bred ${s(report.covers, "hen")}.` : null,
    report.named.length ? `Named ${report.named.map((n) => n.name).join(", ")}.` : null,
    report.crownsEntered ? `Registered ${s(report.crownsEntered, "bird")} for a crown.` : null,
    `Entered ${s(report.birdsEntered, "bird")} on tonight's card.`,
  ].filter((l): l is string => l !== null);
}

/** The run's one log line: what it did, then what it did to the wallet. */
export function honestDaySentence(report: HonestDayReport): string {
  // The farm page's wallet format (gp2 in farm-app.tsx), with the locale
  // pinned: this sentence is stored on the log and read by every viewer, so
  // it cannot take the separators of whichever server wrote it.
  const gp = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const diff = report.gpAfter - report.gpBefore;
  const sign = diff >= 0 ? "+" : "−";
  return (
    `Played the day. ${honestDayLines(report).join(" ")} ` +
    `Your GP went from ${gp(report.gpBefore)} to ${gp(report.gpAfter)} (${sign}${gp(Math.abs(diff))}).`
  );
}
