import { sql, type SQL } from "drizzle-orm";
import type { DB } from "@/db/client";
import { LT_CENTS } from "./config";
import type { StoredActor } from "./actor";
import type { EventType } from "./events";

/**
 * THE FARM LOG'S READER (2026-10): one farm's moves, newest first, each with
 * who made it.
 *
 * It merges two sources and copies neither. Ledger rows come from `events`
 * (their actor from the actor_spans range that covers them) and the lines
 * that are not ledger rows come from `farm_notes`. Everything is selected by
 * FARM id, never by bird id. That is a fog rule, not a style: a claim row
 * carries the SELLER's bird under the claimant's farm, so a bird-id join
 * would show a seller the sealed claims on his own bird.
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
} as const;
export type LogLabel = keyof typeof LOG_LABELS;
export const LOG_LABEL_KEYS = Object.keys(LOG_LABELS) as LogLabel[];

/**
 * THE ONE PLACE A STORED ACTOR BECOMES A LABEL, written as SQL so the
 * actor filter runs in the database and the admin ledger can use the same
 * rule over every farm at once. `viewer` is the farm whose log this is.
 *
 * Nothing on the span, or a game or steward actor, reads as the game. That
 * covers events from before the log existed, so the live world's history
 * reads as the game's rather than as nobody's.
 */
export function labelSql(viewer: SQL): SQL {
  return sql`CASE
    WHEN actor_kind IS NULL OR actor_kind IN ('game', 'steward') THEN 'game'
    WHEN actor_farm_id IS NOT ${viewer} THEN 'another_farm'
    WHEN actor_kind = 'player' THEN 'you'
    WHEN actor_kind = 'autoplay' THEN 'play_my_day'
    WHEN via = 'llm' THEN 'llm_barn'
    ELSE 'house' END`;
}

/**
 * Who may read an event type, for this reader and the ones after it. The
 * owner's log shows "owner" and "public" rows. A public reader later shows
 * "public" only, and needs no migration because this is a function of the
 * type. A Record over EventType, so a new event type does not compile until
 * somebody decides who may see it.
 */
export const EVENT_VISIBILITY: Record<EventType, "owner" | "public" | "hidden"> = {
  farm_registered: "public",
  check_in: "owner",
  gacha: "owner",
  hatch: "public",
  retire: "public",
  breed: "owner",
  stud_income: "owner",
  // A pool accrual names no money of the farm's own (the pools gain, the
  // wallet does not move), so on a farm's log it is noise.
  pool_accrual: "hidden",
  stud_listed: "public",
  stud_unlisted: "public",
  entry: "owner",
  fight: "public",
  refund: "owner",
  card_settled: "owner",
  // Sealed until settled, and the claimant's business only.
  claim: "owner",
  claim_won: "owner",
  claim_refund: "owner",
  tag_income: "owner",
  staking_payout: "owner",
  stake: "owner",
  unstake: "owner",
  buy_land: "owner",
  barn_expanded: "owner",
  tournament_entry: "owner",
  tournament_bump: "owner",
  purse_payout: "owner",
  crown_land: "owner",
  champion: "public",
};

const HIDDEN_TYPES = (Object.keys(EVENT_VISIBILITY) as EventType[]).filter(
  (t) => EVENT_VISIBILITY[t] === "hidden"
);

export interface FarmLogEntry {
  /** Opaque; pass back as `before` for the next page. */
  cursor: string;
  day: number;
  who: LogLabel;
  /** How the actor reached the game: "mcp" is Claude, "sim" the sim's auto-play. */
  via: string | null;
  /** The event type, or the note kind for a line that is not a ledger row. */
  kind: string;
  message: string;
  gp: number | null;
  lt: number | null;
  /** The button press this move belongs to (its summary line's id). */
  runId: number | null;
}

export const FARM_LOG_PAGE = { DEFAULT: 50, MAX: 200 } as const;

interface Row {
  ord: number;
  src: number;
  id: number;
  day: number;
  kind: string;
  message: string;
  gpCents: number | null;
  lt: number | null;
  via: string | null;
  runId: number | null;
  who: LogLabel;
}

type Cursor = { ord: number; src: number; id: number };

function parseCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  const parts = raw.split(".").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n)))
    throw new Error(`Not a farm log cursor: ${raw}`);
  const [ord, src, id] = parts;
  return { ord, src, id };
}

/**
 * Both sources as one ordered stream. An event sorts by its id; a note sorts
 * just after the newest event that existed when it was written, so a name or
 * a price lands between the moves around it. A run's summary note is moved to
 * the top of its run when the run ends, so it reads above its own moves.
 */
function stream(farmId: string, before: Cursor | null): SQL {
  const eventsBefore = before ? sql`AND e.id < ${before.ord + (before.src > 0 ? 1 : 0)}` : sql``;
  const notesBefore = before
    ? sql`AND (n.after_event_id, 1, n.id) < (${before.ord}, ${before.src}, ${before.id})`
    : sql``;
  const hidden = HIDDEN_TYPES.length
    ? sql`AND e.type NOT IN (${sql.join(
        HIDDEN_TYPES.map((t) => sql`${t}`),
        sql`, `
      )})`
    : sql``;
  return sql`
    SELECT e.id AS ord, 0 AS src, e.id AS id, e.day_index AS day, e.type AS kind,
           e.message AS message, e.gp_cents AS gpCents, e.lt AS lt,
           s.actor_kind AS actor_kind, s.via AS via, s.actor_farm_id AS actor_farm_id,
           s.run_id AS runId
      FROM events e
      LEFT JOIN actor_spans s
        ON s.first_event_id = (SELECT MAX(first_event_id) FROM actor_spans WHERE first_event_id <= e.id)
       AND s.last_event_id >= e.id
     WHERE e.farm_id = ${farmId} ${hidden} ${eventsBefore}
    UNION ALL
    SELECT n.after_event_id, 1, n.id, n.day_index, n.kind, n.message, NULL, NULL,
           n.actor_kind, n.via, n.actor_farm_id, n.run_id
      FROM farm_notes n
     WHERE n.farm_id = ${farmId} AND n.message <> '' ${notesBefore}`;
}

/** A ledger line reads as a sentence: capital first, full stop last. */
function sentence(message: string): string {
  const trimmed = message.trim();
  const capped = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?)]$/.test(capped) ? capped : `${capped}.`;
}

/**
 * One page of a farm's log, newest first. `who` narrows it to one label.
 * The owner's reader: it shows "owner" and "public" rows of THIS farm only.
 */
export function farmLogPage(
  db: DB,
  farmId: string,
  opts: { limit?: number; before?: string; who?: LogLabel } = {}
): { entries: FarmLogEntry[]; more: boolean } {
  const limit = Math.min(
    Math.max(1, Math.floor(opts.limit ?? FARM_LOG_PAGE.DEFAULT)),
    FARM_LOG_PAGE.MAX
  );
  const before = parseCursor(opts.before);
  const whoFilter = opts.who ? sql`WHERE who = ${opts.who}` : sql``;
  const rows = db.all<Row>(sql`
    SELECT * FROM (
      SELECT ord, src, id, day, kind, message, gpCents, lt, via, runId,
             ${labelSql(sql`${farmId}`)} AS who
        FROM (${stream(farmId, before)})
    ) ${whoFilter}
    ORDER BY ord DESC, src DESC, id DESC
    LIMIT ${limit + 1}`);
  return {
    entries: rows.slice(0, limit).map((r) => ({
      cursor: `${r.ord}.${r.src}.${r.id}`,
      day: r.day,
      who: r.who,
      via: r.via,
      kind: r.kind,
      message: r.src === 0 ? sentence(r.message) : r.message,
      gp: r.gpCents === null ? null : r.gpCents / 100,
      lt: r.lt === null ? null : r.lt / LT_CENTS,
      runId: r.runId,
    })),
    more: rows.length > limit,
  };
}

/** How many lines each label has on this farm's log, for the filter's counts. */
export function farmLogCounts(db: DB, farmId: string): Record<LogLabel, number> {
  const rows = db.all<{ who: LogLabel; n: number }>(sql`
    SELECT who, COUNT(*) AS n FROM (
      SELECT ${labelSql(sql`${farmId}`)} AS who FROM (${stream(farmId, null)})
    ) GROUP BY who`);
  const counts = Object.fromEntries(LOG_LABEL_KEYS.map((k) => [k, 0])) as Record<LogLabel, number>;
  for (const r of rows) counts[r.who] = r.n;
  return counts;
}

/**
 * The stored actor behind each of these events, for the stewards' ledger.
 * Raw rather than labelled: a steward reads every farm at once, so "you" means
 * nothing there, and the kind, the door and the acting farm say more. Null
 * for an event no span covers (written before the log began).
 */
export function eventActors(db: DB, ids: readonly number[]): Map<number, StoredActor> {
  const out = new Map<number, StoredActor>();
  if (ids.length === 0) return out;
  const rows = db.all<{ id: number } & StoredActor>(sql`
    SELECT e.id AS id, s.actor_kind AS kind, s.via AS via, s.actor_farm_id AS farmId,
           s.run_id AS runId
      FROM events e
      JOIN actor_spans s
        ON s.first_event_id = (SELECT MAX(first_event_id) FROM actor_spans WHERE first_event_id <= e.id)
       AND s.last_event_id >= e.id
     WHERE e.id BETWEEN ${Math.min(...ids)} AND ${Math.max(...ids)}`);
  for (const { id, ...actor } of rows) out.set(id, actor);
  return out;
}
