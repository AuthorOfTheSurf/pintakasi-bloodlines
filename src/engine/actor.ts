import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { actorSpans, farmNotes, type ActorKind } from "@/db/schema";

/**
 * WHO DECIDED A MOVE (the farm log, 2026-10).
 *
 * Every money and bird move already reaches the ledger through `emit`, and
 * it reaches it the same way whether a player clicked, Claude called a tool,
 * Play my day ran, a house bot took its turn or the tick settled the card.
 * Nothing recorded which of those it was, so a new player whose GP dropped
 * could not tell "I did that" from "the game did that".
 *
 * The actor is a property of a stretch of synchronous engine work, not of a
 * row. A boundary says who it is once, with `withActor`, and every event
 * emitted inside inherits it. Nothing inside the engine knows a frame exists,
 * so none of the emit call sites changed and nothing here touches an RNG.
 *
 * Storage follows the same idea. Events get rising ids in emit order, so a
 * run of events with one actor is an id RANGE, and actor_spans stores the
 * ranges. Inside a tick the ids do not exist yet (events.ts buffers them), so
 * the trail counts buffer positions and `endBuffered` swaps in real ids.
 *
 * ⚠ PER DATABASE HANDLE, like the event buffer. Two test worlds in one
 * process never see each other's frames. A frame set on one handle is
 * invisible to another handle on the same file, which is the honest answer:
 * the other handle's writes were not made inside this frame.
 */
export type Actor =
  // A player's own click (web), a script holding their farm key (api), or
  // Claude acting on their key (mcp). `runId` links the moves of one button
  // press to its summary note.
  | { kind: "player"; via: "web" | "api" | "mcp"; farmId: string; runId?: number }
  // Auto-play on a player's farm: the Play my day button, the play_my_day
  // tool, or the sim's stand-in for a player who never logged in.
  | { kind: "autoplay"; via: "button" | "mcp" | "sim"; farmId: string; runId?: number }
  | { kind: "bot"; via: "scripted" | "llm"; farmId: string }
  // The tick: the card, the crowns, Hatch Friday, the payouts.
  | { kind: "game" }
  // A steward's act, such as approving an application into a farm.
  | { kind: "steward" };

/** An actor as the tables store it. */
export interface StoredActor {
  kind: ActorKind;
  via: string | null;
  farmId: string | null;
  runId: number | null;
}

function toStored(actor: Actor): StoredActor {
  if (actor.kind === "game" || actor.kind === "steward")
    return { kind: actor.kind, via: null, farmId: null, runId: null };
  return {
    kind: actor.kind,
    via: actor.via,
    farmId: actor.farmId,
    runId: "runId" in actor ? (actor.runId ?? null) : null,
  };
}

type NoteInsert = typeof farmNotes.$inferInsert;

interface OpenSpan {
  actor: StoredActor;
  first: number;
  last: number;
}

/** The trail's state while a tick buffers its events. */
interface Buffered {
  spans: OpenSpan[];
  // A note made mid-tick sits after the newest buffered event, or before the
  // first one (-1) when the tick has emitted nothing yet.
  notes: { row: Omit<NoteInsert, "afterEventId">; after: number }[];
  lastPosition: number;
}

interface Trail {
  frames: StoredActor[];
  open: OpenSpan | null;
  buffered: Buffered | null;
}

const trails = new WeakMap<object, Trail>();

function trailOf(db: DB): Trail {
  let trail = trails.get(db);
  if (!trail) {
    trail = { frames: [], open: null, buffered: null };
    trails.set(db, trail);
  }
  return trail;
}

/**
 * Stop collecting into the open span. Mid-tick it is queued for the flush.
 * Outside a tick it is already in the table: `sawEvent` writes it row by row.
 */
function closeSpan(trail: Trail): void {
  const span = trail.open;
  if (!span) return;
  trail.open = null;
  if (trail.buffered) trail.buffered.spans.push(span);
}

function writeSpans(db: DB, spans: OpenSpan[]): void {
  if (spans.length === 0) return;
  db.insert(actorSpans)
    .values(
      spans.map((s) => ({
        firstEventId: s.first,
        lastEventId: s.last,
        actorKind: s.actor.kind,
        via: s.actor.via,
        actorFarmId: s.actor.farmId,
        runId: s.actor.runId,
      }))
    )
    .run();
}

/**
 * Run `fn` as `actor`. The innermost frame wins, so a bot's turn inside the
 * tick is the bot's and the settlement after it is the game's.
 *
 * ⚠ SYNCHRONOUS BY CONTRACT. Two requests awaiting inside frames on the one
 * shared handle would interleave their ranges. The engine is synchronous, so
 * this costs nothing, and a promise coming back is refused rather than
 * trusted.
 */
export function withActor<T>(db: DB, actor: Actor, fn: () => T): T {
  const trail = trailOf(db);
  closeSpan(trail);
  trail.frames.push(toStored(actor));
  try {
    const result = fn();
    if (result instanceof Promise)
      throw new Error("withActor wraps synchronous engine work; an await inside it mixes actors");
    return result;
  } finally {
    closeSpan(trail);
    trail.frames.pop();
  }
}

/** Who is acting right now on this handle, or null outside every frame. */
export function currentActor(db: DB): StoredActor | null {
  return trails.get(db)?.frames.at(-1) ?? null;
}

/**
 * events.emit reports every row here: `position` is its buffer index inside
 * a tick, its id outside one. A span grows only while the actor is the same
 * and the positions are consecutive, so an event another handle slipped in
 * between starts a fresh span instead of being claimed by this one.
 *
 * ⚠ OUTSIDE A TICK THE SPAN IS WRITTEN WITH ITS EVENT, not when the frame
 * closes. A frame can wrap a transaction that rolls back. Written at close,
 * the span outlived its rolled-back event, and SQLite hands that event's id
 * to the next one, so the next span hit the stale row's primary key. Written
 * alongside the event, it rolls back with it.
 */
export function sawEvent(db: DB, position: number): void {
  const trail = trails.get(db);
  if (!trail) return;
  if (trail.buffered) trail.buffered.lastPosition = position;
  const actor = trail.frames.at(-1);
  if (!actor) return;
  const open = trail.open;
  if (open && open.actor === actor && position === open.last + 1) {
    open.last = position;
    if (!trail.buffered)
      db.update(actorSpans)
        .set({ lastEventId: position })
        .where(eq(actorSpans.firstEventId, open.first))
        .run();
    return;
  }
  closeSpan(trail);
  trail.open = { actor, first: position, last: position };
  if (!trail.buffered) writeSpans(db, [trail.open]);
}

/** events.withBufferedEvents calls this on the way in. */
export function beginBuffered(db: DB): void {
  const trail = trailOf(db);
  closeSpan(trail);
  trail.buffered = { spans: [], notes: [], lastPosition: -1 };
}

/**
 * …and this once the buffered rows are in, with the id each one received.
 * `before` is the newest event id from before the tick, for notes made
 * before the tick's first event.
 */
export function endBuffered(db: DB, ids: readonly number[], before: number): void {
  const trail = trailOf(db);
  closeSpan(trail);
  const buffered = trail.buffered;
  trail.buffered = null;
  if (!buffered) return;
  const idAt = (position: number) => {
    if (position < 0) return before;
    const id = ids[position];
    if (id === undefined) throw new Error(`No event id for buffered position ${position}`);
    return id;
  };
  writeSpans(
    db,
    buffered.spans.map((s) => ({ actor: s.actor, first: idAt(s.first), last: idAt(s.last) }))
  );
  if (buffered.notes.length > 0)
    db.insert(farmNotes)
      .values(buffered.notes.map((n) => ({ ...n.row, afterEventId: idAt(n.after) })))
      .run();
}

/** A tick that threw rolls its events back, so its trail goes with them. */
export function abortBuffered(db: DB): void {
  const trail = trails.get(db);
  if (!trail) return;
  trail.buffered = null;
  trail.open = null;
}

/**
 * farm-notes.ts hands a note here. Mid-tick it waits for the ids; outside a
 * tick `newestEventId` places it now. Returns false when it was queued.
 */
export function queueNoteIfBuffered(db: DB, row: Omit<NoteInsert, "afterEventId">): boolean {
  const buffered = trails.get(db)?.buffered;
  if (!buffered) return false;
  buffered.notes.push({ row, after: buffered.lastPosition });
  return true;
}
