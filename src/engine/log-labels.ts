/**
 * The farm log's words and shapes, with no database in them. The farm page
 * is a client component and imports this; engine/farm-log.ts holds the
 * queries that fill these shapes.
 */

/**
 * The words an owner reads, keyed by what the reader works out. "Another
 * farm" is a move on your farm that a different barn made, such as a cover
 * bought on your stud or a claim that took your bird.
 */
export const LOG_LABELS = {
  you: "you",
  play_my_day: "Play my day",
  game: "the game",
  another_farm: "another farm",
  house: "house stable",
  llm_barn: "LLM barn",
  // A move made before this world kept the log (alpha-1's first weeks). Its
  // maker was never written down, and guessing would put words in the log's
  // mouth: a player's own early check-ins are not the game's.
  unrecorded: "before the log",
} as const;
export type LogLabel = keyof typeof LOG_LABELS;
export const LOG_LABEL_KEYS = Object.keys(LOG_LABELS) as LogLabel[];

/**
 * The note kinds that are a button press's own summary line. Every move the
 * press made carries the same runId as the summary, so a reader can group
 * them under it.
 */
export const RUN_SUMMARY_KINDS = ["play_my_day", "card"] as const;
export type RunSummaryKind = (typeof RUN_SUMMARY_KINDS)[number];

export interface FarmLogEntry {
  /** Opaque; pass back as `before` for the next page. */
  cursor: string;
  day: number;
  who: LogLabel;
  /** How the actor reached the game: "mcp" is Claude, "sim" the sim's auto-play. */
  via: string | null;
  /** The event type, or the note kind for a line that is not a ledger row. */
  kind: string;
  /** True on a button press's summary line; its moves follow with its runId. */
  isRunSummary: boolean;
  message: string;
  gp: number | null;
  lt: number | null;
  /** The button press this move belongs to; its summary line carries the same runId. */
  runId: number | null;
}
