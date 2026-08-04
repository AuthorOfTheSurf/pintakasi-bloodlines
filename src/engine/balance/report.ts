/**
 * THE FIGHT BALANCE LAB — running the cases and rendering them.
 *
 * The cases measure; this module runs them, hoists what they found, and draws
 * it. Nothing here knows what a win rate means — that judgement is already
 * baked into each row's `verdict` by intent.ts before it arrives.
 *
 * Rendering RETURNS A STRING and never prints, which is the same split
 * scripts/doctor.ts calls out at its top: all the thinking lives under
 * src/engine/ where `bun test` can reach it, and scripts/ only does argv and
 * stdout. A formatter that printed could not be asserted on.
 *
 * The house style is the doctor's, deliberately: UPPERCASE unindented section
 * titles, two-space content, ` · ` between inline facts, `⚠` on its own line
 * for a section-level warning and as a SUFFIX when it is a verdict on one row.
 * Two tools that both answer "is this healthy?" should not look like two tools.
 */
import { converge, LAB } from "./lab";
import type { BalanceCase, BalanceReport, CaseOptions, Table } from "./types";

/**
 * Tooling thresholds — NOT game balance, which is why they aren't in config.
 * (The doctor's DOCTOR block and lab.ts's LAB block follow the same rule.)
 */
const REPORT = {
  // Minimum width of the left-hand label column. Below this, a table of short
  // labels renders as a ragged little stub next to its own question line.
  MIN_LABEL_WIDTH: 12,
  // Gap between columns. Two spaces reads as a table; one reads as a typo.
  GUTTER: 2,
} as const;

// ── measuring ───────────────────────────────────────────────────────────────

/**
 * Run the selected cases and collect their tables.
 *
 * A case that throws is NOT caught here. A measurement that blew up is a tool
 * error, not a finding, and swallowing it would print a confident report with
 * a silently missing table — the exact failure mode the CLI's loud-exit rules
 * exist to prevent. The script turns the throw into a non-zero exit.
 */
export function measure(cases: BalanceCase[], opts: CaseOptions): BalanceReport {
  const tables = cases.flatMap((c) => c.run(opts));
  return {
    runs: opts.runs,
    seedFrom: opts.seedFrom,
    tables,
    findings: tables.flatMap((t) => t.findings ?? []),
    // `clean` is a summary, never a gate: a warn row is a design gap we are
    // cataloguing on purpose, so the process still exits 0. See scripts/balance.ts.
    clean: !tables.some((t) => t.rows.some((r) => r.verdict === "warn")),
  };
}

// ── rendering ───────────────────────────────────────────────────────────────

/**
 * There is no table helper anywhere else in this repo — every aligned block in
 * the doctor hand-rolls its own `padEnd(34)` / `padStart(4)` at the call site.
 * That is fine for six fixed blocks and untenable for N tables whose columns
 * come from the cases, so this module measures its own widths. The LOOK is
 * unchanged; only the magic numbers are gone.
 */
function widthsOf(table: Table): { label: number; cells: number[] } {
  const heads = headersOf(table);
  const label = Math.max(
    REPORT.MIN_LABEL_WIDTH,
    heads.label.length,
    ...table.rows.map((r) => r.label.length)
  );
  const cells = heads.cells.map((col, i) =>
    Math.max(col.length, ...table.rows.map((r) => (r.cells[i] ?? "").length))
  );
  return { label, cells };
}

/**
 * A case may or may not name its label column. `symmetry` lists "blade" first
 * and then eight cells; a case whose rows are self-evident just lists the
 * eight. Both readings of `columns` are defensible against types.ts, so both
 * are accepted — the alternative was an off-by-one that silently prints every
 * header one column left of the numbers it describes, which is worse than any
 * amount of leniency here.
 */
function headersOf(table: Table): { label: string; cells: string[] } {
  const widest = Math.max(0, ...table.rows.map((r) => r.cells.length));
  return table.columns.length === widest + 1
    ? { label: table.columns[0], cells: table.columns.slice(1) }
    : { label: "", cells: table.columns };
}

const gutter = " ".repeat(REPORT.GUTTER);

/**
 * Labels left, numbers right. Cells are pre-formatted by the case (it owns its
 * own precision), so this pads them as strings and never re-formats a number —
 * a renderer that rounded would quietly disagree with `--json`.
 */
function renderTable(table: Table): string[] {
  const w = widthsOf(table);
  const out: string[] = [];
  out.push(table.title);
  out.push(`  ${table.question}`);
  const heads = headersOf(table);
  out.push(
    `  ${heads.label.padEnd(w.label)}${gutter}` +
      heads.cells.map((c, i) => c.padStart(w.cells[i])).join(gutter)
  );
  for (const row of table.rows) {
    const cells = w.cells.map((width, i) => (row.cells[i] ?? "").padStart(width)).join(gutter);
    // The verdict is a suffix on the line, not a bullet in front of it — the
    // doctor's weather line and adoption bars both read this way, and it keeps
    // the numeric columns in one unbroken block down the page.
    const mark = row.verdict === "ok" ? " ✓" : row.verdict === "warn" ? " ⚠" : "";
    const note = row.note ? `  ${row.note}` : "";
    out.push(`  ${row.label.padEnd(w.label)}${gutter}${cells}${mark}${note}`);
  }
  return out;
}

export function formatReport(
  r: BalanceReport,
  opts: { quiet?: boolean; context?: string } = {}
): string {
  const out: string[] = [];
  const seedTo = r.seedFrom + r.runs - 1;
  out.push(
    `FIGHT BALANCE LAB · ${r.tables.length} table${r.tables.length === 1 ? "" : "s"}` +
      (opts.context ? ` · ${opts.context}` : "")
  );
  out.push(`${r.runs.toLocaleString()} runs · seeds ${r.seedFrom}–${seedTo}`);

  // --quiet is the doctor's "for pasting into a message" mode: the verdicts
  // and the findings, none of the tables they came from.
  if (!opts.quiet) {
    for (const table of r.tables) {
      out.push("");
      out.push(...renderTable(table));
    }
  }

  const warned = r.tables.flatMap((t) =>
    t.rows.filter((row) => row.verdict === "warn").map((row) => ({ table: t.title, row }))
  );
  if (warned.length > 0) {
    out.push("");
    out.push("WARNINGS");
    for (const { table, row } of warned)
      out.push(`  ⚠ ${table} · ${row.label}${row.note ? ` — ${row.note}` : ""}`);
  }

  if (r.findings.length > 0) {
    out.push("");
    out.push("FINDINGS");
    for (const f of r.findings) out.push(`  ${f}`);
  }

  out.push("");
  const rows = r.tables.reduce((s, t) => s + t.rows.length, 0);
  out.push(
    `${warned.length} warning${warned.length === 1 ? "" : "s"} · ` +
      `${rows} row${rows === 1 ? "" : "s"} measured · ` +
      `${r.findings.length} finding${r.findings.length === 1 ? "" : "s"}`
  );
  return out.join("\n");
}

// ── convergence ─────────────────────────────────────────────────────────────

/**
 * A cell is a pre-formatted string ("54.2%", "1.31×", "±0.8"), because the
 * case owns its precision. To compare the SAME cell across seed windows we
 * have to read the number back out. Strip the decoration and parse; anything
 * that isn't a number (a bird's shape, an element name) returns undefined and
 * is skipped rather than guessed at.
 */
function measured(cell: string): { value: number; ci?: number } | undefined {
  const m = /^(-?[\d.]+)\s*[%×x]?\s*(?:±\s*([\d.]+))?$/.exec(cell.trim().replace(/,/g, ""));
  if (!m || !Number.isFinite(Number(m[1]))) return undefined;
  return { value: Number(m[1]), ci: m[2] === undefined ? undefined : Number(m[2]) };
}

const numeric = (cell: string) => measured(cell)?.value;

/** The column a case reports its interval in, when it splits it out. */
const isCiColumn = (col: string) => /±|\bci\b/i.test(col);

export interface ConvergedRow {
  table: string;
  label: string;
  column: string;
  values: number[];
  mean: number;
  spread: number;
  /** The case's own 95% interval, when it published one. */
  ci?: number;
  /** Spread wider than the interval the row claims — the window is deciding. */
  wide: boolean;
}

export interface ConvergenceReport {
  windows: number;
  runs: number;
  seeds: number[];
  rows: ConvergedRow[];
}

/**
 * Re-measure everything over K disjoint seed windows.
 *
 * The point, from lab.ts's own history: a 200-seed test once asserted a
 * ceiling BELOW the true value and passed, because seeds 1..200 said 73% and
 * seeds 201..400 said 80%. A number that moves more between windows than its
 * own confidence interval allows is not a number yet — it is a description of
 * one seed window, and that is exactly what `wide` flags.
 *
 * Window placement is NOT recomputed here. The cases run once per window, and
 * then `converge` is handed a lookup into those results — so the stride and
 * the offsets stay defined in exactly one place (lab.ts) and the mean/spread
 * arithmetic is the same code the primitive already owns.
 */
export function convergeCases(
  cases: BalanceCase[],
  opts: CaseOptions,
  windows: number
): ConvergenceReport {
  const seeds = Array.from({ length: windows }, (_, i) => LAB.SEED_FROM + i * LAB.WINDOW_STRIDE);
  const byWindow = new Map(seeds.map((seedFrom) => [seedFrom, measure(cases, { ...opts, seedFrom })]));

  const shape = byWindow.get(seeds[0])!;
  const rows: ConvergedRow[] = [];
  for (const [t, table] of shape.tables.entries()) {
    const heads = headersOf(table);
    const ciIndex = heads.cells.findIndex(isCiColumn);
    for (const [i, row] of table.rows.entries()) {
      // The columns worth converging are the ones carrying their own ± — a
      // case only publishes an interval on the thing it set out to measure, so
      // that marks the measurements without the renderer having to know what
      // any case is about. `elements` puts four of them on one row (one per
      // blade), and converging only the first would quietly hide three.
      // Failing that: the first cell that parses as a number at all, since
      // cases put the measurement before the diagnostics.
      const withCi = row.cells.flatMap((c, j) => (measured(c)?.ci !== undefined ? [j] : []));
      const first = row.cells.findIndex((c) => numeric(c) !== undefined);
      const picks = withCi.length > 0 ? withCi : first === -1 ? [] : [first];
      for (const col of picks) {
        const pick = (seedFrom: number) =>
          numeric(byWindow.get(seedFrom)!.tables[t]?.rows[i]?.cells[col] ?? "") ?? NaN;
        const c = converge(pick, { windows });
        const ci =
          measured(row.cells[col])?.ci ??
          (ciIndex === -1 ? undefined : numeric(row.cells[ciIndex]));
        rows.push({
          table: table.title,
          // Only name the column when the row has more than one, so a
          // single-measurement table doesn't repeat "win%" down the page.
          label: picks.length > 1 ? `${row.label} · ${heads.cells[col]}` : row.label,
          column: heads.cells[col],
          values: c.values,
          mean: c.mean,
          spread: c.spread,
          ci,
          wide: ci !== undefined && c.spread > ci,
        });
      }
    }
  }
  return { windows, runs: opts.runs, seeds, rows };
}

export function formatConvergence(r: ConvergenceReport): string {
  const out: string[] = [];
  out.push(`FIGHT BALANCE LAB · CONVERGENCE · ${r.windows} windows`);
  out.push(
    `${r.runs.toLocaleString()} runs per window · seeds ${r.seeds.join(", ")} · ` +
      `stride ${LAB.WINDOW_STRIDE.toLocaleString()}`
  );

  const label = Math.max(REPORT.MIN_LABEL_WIDTH, ...r.rows.map((x) => `${x.table} ${x.label}`.length));
  const num = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "—");
  const cols = ["mean", "spread", "±ci"];
  const width = 8;

  out.push("");
  out.push("PER-WINDOW VALUES");
  out.push(
    `  ${" ".repeat(label)}${gutter}` +
      [
        ...r.seeds.map((_, i) => `w${i + 1}`.padStart(width)),
        ...cols.map((c) => c.padStart(width)),
      ].join(gutter)
  );
  for (const row of r.rows) {
    const cells = [...row.values.map(num), num(row.mean), num(row.spread), row.ci === undefined ? "—" : num(row.ci)];
    out.push(
      `  ${`${row.table} ${row.label}`.padEnd(label)}${gutter}` +
        cells.map((c) => c.padStart(width)).join(gutter) +
        // A wide row is the finding, so it is marked where it happens rather
        // than only counted in the footer.
        (row.wide ? `  ⚠ spread ${num(row.spread)} > ci ${num(row.ci!)} (${row.column})` : "")
    );
  }

  const wide = r.rows.filter((x) => x.wide).length;
  const unbounded = r.rows.filter((x) => x.ci === undefined).length;
  out.push("");
  out.push(
    `${wide} row${wide === 1 ? "" : "s"} move more than their own interval · ` +
      `${r.rows.length} row${r.rows.length === 1 ? "" : "s"} converged · ` +
      `${unbounded} without a published interval`
  );
  return out.join("\n");
}

// ── CSV ─────────────────────────────────────────────────────────────────────

const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/**
 * One line per table row, with the table name on it, so two runs of the lab
 * can be diffed in a spreadsheet — which is how you see a knob change move
 * forty numbers at once instead of reading two reports side by side.
 *
 * Emitted as one block per table rather than a single flat sheet: tables carry
 * different column sets, and a union header would produce mostly-empty rows
 * whose meaning depends on which column happened to line up. A blank line and
 * a fresh header is what a spreadsheet imports as a separate block and what
 * `diff` reads without lying about it.
 */
export function formatCsv(r: BalanceReport): string {
  return r.tables
    .map((t) => {
      const heads = headersOf(t);
      return [
        ["table", heads.label || "row", ...heads.cells, "verdict", "note"].map(csvCell).join(","),
        ...t.rows.map((row) =>
          [
            t.title,
            row.label,
            ...heads.cells.map((_, i) => row.cells[i] ?? ""),
            row.verdict ?? "",
            row.note ?? "",
          ]
            .map(csvCell)
            .join(",")
        ),
      ].join("\n");
    })
    .join("\n\n");
}
