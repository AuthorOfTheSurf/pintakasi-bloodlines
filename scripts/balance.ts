/**
 * `bun run balance` — what is each fight knob actually WORTH?
 *
 * A thin shell. All the thinking lives in src/engine/balance/, where the test
 * suite can reach it — `bun test` never looks inside scripts/. This file does
 * argv and stdout and nothing else.
 *
 *   bun run balance                                  every case
 *   bun run balance sensitivity stars                named cases only
 *   bun run balance --list                           names + questions, run nothing
 *   bun run balance --runs=4000                      sample size (default 1000)
 *   bun run balance --seed=100000                    start of the seed window
 *   bun run balance --format=b2              one blade, for a fast loop
 *   bun run balance --converge=5                     re-measure over 5 disjoint
 *                                                    seed windows, report spread
 *   bun run balance --sweep=BATTLE.ELEMENT_EDGE=0.25,0.5,1
 *   bun run balance --quiet                          verdicts and findings only
 *   bun run balance --json                           the raw report
 *   bun run balance --csv                            one line per row, for a diff
 *
 * EXIT CODE 0 EVEN WHEN ROWS CARRY WARNINGS. A ⚠ here is a design gap being
 * catalogued — "the underdog gate is worth more than five stars" is a
 * conversation, not a build failure. Non-zero is reserved for tool errors: a
 * case name that doesn't exist, a knob that doesn't exist, a malformed flag,
 * or a case that threw. Silently measuring nothing is the failure mode this
 * whole argv block is designed against.
 *
 * Writes no files. `--json`/`--csv` go to stdout so the caller redirects.
 */
import { FORMAT_NAMES, type FightFormat } from "@/engine/config";
import { CASES } from "@/engine/balance/cases";
import { LAB, sweepableKnobs, withKnob } from "@/engine/balance/lab";
import {
  convergeCases,
  formatConvergence,
  formatCsv,
  formatReport,
  measure,
} from "@/engine/balance/report";
import type { BalanceCase, BalanceReport, CaseOptions } from "@/engine/balance/types";

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

/** Every bad-argv path lands here, so the shape of a failure is identical. */
function die(message: string, options?: string[]): never {
  console.error(message);
  if (options) for (const o of options) console.error(`  ${o}`);
  process.exit(1);
}

const num = (name: string, raw: string | undefined, fallback: number): number => {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) die(`--${name}=${raw} is not a positive number.`);
  return n;
};

// ── which cases ─────────────────────────────────────────────────────────────
// Positional args are case names (the doctor takes a path this way, simulate
// takes a day count). Anything not starting with `--` is a selector.
const wanted = args.filter((a) => !a.startsWith("--"));
const unknown = wanted.filter((w) => !CASES.some((c) => c.name === w));
if (unknown.length > 0)
  die(
    `Unknown case${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}. Known cases:`,
    CASES.map((c) => `${c.name.padEnd(16)} ${c.question}`)
  );
const cases: BalanceCase[] = wanted.length ? CASES.filter((c) => wanted.includes(c.name)) : CASES;

if (args.includes("--list")) {
  const width = Math.max(...CASES.map((c) => c.name.length));
  console.log("BALANCE CASES");
  for (const c of CASES) console.log(`  ${c.name.padEnd(width)}  ${c.question}`);
  console.log("");
  console.log(`${CASES.length} case${CASES.length === 1 ? "" : "s"} · sweepable knobs:`);
  for (const k of sweepableKnobs()) console.log(`  ${k}`);
  process.exit(0);
}

// ── how to run them ─────────────────────────────────────────────────────────
const convergeWindows = args.some((a) => a.startsWith("--converge"))
  ? num("converge", flag("converge") ?? "3", 3)
  : 0;

const format = flag("format") as FightFormat | undefined;
if (format && !FORMAT_NAMES.includes(format))
  die(`Unknown format "${format}". Known formats:`, FORMAT_NAMES);

const opts: CaseOptions = {
  // Convergence exists to decide whether a quoted number is real, and a number
  // worth quoting is measured at the headline sample — running it at the cheap
  // default would just measure the noise the exercise is trying to rule out.
  runs: num("runs", flag("runs"), convergeWindows ? LAB.HEADLINE_RUNS : LAB.DEFAULT_RUNS),
  seedFrom: num("seed", flag("seed"), LAB.SEED_FROM),
  format,
};

const asJson = args.includes("--json");
const asCsv = args.includes("--csv");
const quiet = args.includes("--quiet");

// ── the sweep ───────────────────────────────────────────────────────────────
/** `--sweep=ROOT.KNOB=v1,v2,v3` — parsed strictly; every error is fatal. */
function parseSweep(raw: string): { knob: string; values: number[] } {
  const at = raw.indexOf("=");
  if (at === -1) die(`--sweep needs KNOB=values, e.g. --sweep=BATTLE.ELEMENT_EDGE=0.25,0.5,1`);
  const knob = raw.slice(0, at);
  if (!sweepableKnobs().includes(knob)) die(`Unknown knob "${knob}". Sweepable knobs:`, sweepableKnobs());
  const values = raw
    .slice(at + 1)
    .split(",")
    .filter((v) => v !== "")
    .map((v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) die(`--sweep value "${v}" is not a number.`);
      return n;
    });
  if (values.length === 0) die(`--sweep=${knob}= has no values. Give it a comma-separated list.`);
  return { knob, values };
}

const sweepArg = flag("sweep");
const sweepPlan = sweepArg === undefined ? undefined : parseSweep(sweepArg);

// A case blowing up is a tool error, not a finding — it must not be rendered
// as a report with a quietly missing table. See measure()'s note.
function run<T>(what: string, fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    die(`${what} failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ── output ──────────────────────────────────────────────────────────────────
// --json and --csv are EXCLUSIVE alternatives to the human render, never an
// extra print on top of it, so a redirect gets a clean file.

if (sweepPlan) {
  const { knob, values } = sweepPlan;
  const runs = values.map((value) => ({
    knob,
    value,
    report: run(`sweep ${knob}=${value}`, () =>
      withKnob(knob, value, () => measure(cases, opts))
    ),
  }));

  if (asJson) console.log(JSON.stringify(runs, null, 2));
  else if (asCsv)
    // The knob value has to survive into the spreadsheet, and a CSV has no
    // place to put a block header — so it rides on the table name.
    console.log(
      runs
        .map(({ value, report }) =>
          formatCsv({
            ...report,
            tables: report.tables.map((t) => ({ ...t, title: `${t.title} @ ${knob}=${value}` })),
          })
        )
        .join("\n\n")
    );
  else
    console.log(
      runs
        .map(({ value, report }) => formatReport(report, { quiet, context: `${knob} = ${value}` }))
        .join("\n\n")
    );
  process.exit(0);
}

if (convergeWindows) {
  const c = run(`convergence over ${convergeWindows} windows`, () =>
    convergeCases(cases, opts, convergeWindows)
  );
  console.log(asJson ? JSON.stringify(c, null, 2) : formatConvergence(c));
  process.exit(0);
}

const report: BalanceReport = run("measurement", () => measure(cases, opts));
console.log(
  asJson
    ? JSON.stringify(report, null, 2)
    : asCsv
      ? formatCsv(report)
      : formatReport(report, { quiet })
);

// LAST, and always 0 — warnings are the output, not a failure. Errors exited
// through `die` long before here.
process.exit(0);
