/**
 * The contract between the cases (which measure) and the report (which
 * renders). Kept in its own module so neither has to import the other, and so
 * adding a case never touches the formatter.
 *
 * A case returns TABLES, not prose. The judgement — "is this number what we
 * wanted" — lives in `intent.ts` and is attached as a `verdict` per row, so
 * the same measurement can be printed with or without an opinion about it.
 */
import type { FightFormat } from "@/engine/config";

export interface Row {
  label: string;
  /** Pre-formatted cells, one per column. The case owns its own precision. */
  cells: string[];
  /**
   * A measurement can only carry a verdict when something declared what the
   * right answer was. Rows without an intent stay silent rather than guessing.
   */
  verdict?: "ok" | "warn";
  /** Shown inline after the cells — why the verdict, or what to watch. */
  note?: string;
}

export interface Table {
  /** UPPERCASE, doctor-style. */
  title: string;
  /** The question this table answers, in one line, printed under the title. */
  question: string;
  columns: string[];
  rows: Row[];
  /** Sentences worth carrying up into the report footer. */
  findings?: string[];
}

export interface CaseOptions {
  runs: number;
  seedFrom: number;
  /** Restrict to one blade, for a fast loop while iterating. */
  format?: FightFormat;
}

export interface BalanceCase {
  /** CLI selector, lowercase, no spaces. */
  name: string;
  /** One line for `--list`. */
  question: string;
  run(opts: CaseOptions): Table[];
}

export interface BalanceReport {
  runs: number;
  seedFrom: number;
  tables: Table[];
  findings: string[];
  /** False when any row carries a `warn` verdict. Never fails the process. */
  clean: boolean;
}
