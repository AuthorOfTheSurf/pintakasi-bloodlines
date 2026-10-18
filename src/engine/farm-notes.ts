import { eq, max } from "drizzle-orm";
import type { DB } from "@/db/client";
import { events, farmNotes, gameState } from "@/db/schema";
import { currentActor, queueNoteIfBuffered, withActor, type Actor } from "./actor";

/**
 * THE FARM'S OWN LINES (the farm log, 2026-10): moves a player can see that
 * are not ledger rows.
 *
 * They cannot be `events` rows. The live world's ledger is the conservation
 * proof's input and worldhash's identity check, and a bot renames or reprices
 * something nearly every day, so a new event type would change the ledger of
 * every world. They live beside it instead, ordered against it by
 * `after_event_id`, and read through the same farm log.
 */
export type NoteKind =
  | "named" // a bird took a name
  | "stud_price" // a rooster's cover price was set (pending or posted at once)
  | "play_my_day" // the summary a Play my day run leaves
  | "card"; // the summary an Enter card press leaves

export interface NoteInput {
  farmId: string;
  kind: NoteKind;
  birdId?: string;
  message: string;
  data?: unknown;
  // "public" when anyone looking at the bird could already see the change (a
  // name, a posted price). "owner" when it is the barn's own business.
  visibility: "owner" | "public";
}

function dayNow(db: DB): number {
  return db.select().from(gameState).where(eq(gameState.id, 1)).get()?.dayIndex ?? 0;
}

function newestEventId(db: DB): number {
  return (
    db
      .select({ id: max(events.id) })
      .from(events)
      .get()?.id ?? 0
  );
}

export const FarmNotes = {
  /**
   * One log line, credited to whoever the current frame says is acting.
   * Inside a tick it waits for the tick's event ids, so it lands between the
   * right two events.
   */
  write(db: DB, input: NoteInput): void {
    const actor = currentActor(db);
    const row = {
      farmId: input.farmId,
      dayIndex: dayNow(db),
      kind: input.kind,
      birdId: input.birdId ?? null,
      message: input.message,
      data: input.data === undefined ? null : JSON.stringify(input.data),
      visibility: input.visibility,
      actorKind: actor?.kind ?? null,
      via: actor?.via ?? null,
      actorFarmId: actor?.farmId ?? null,
      runId: actor?.runId ?? null,
    };
    if (queueNoteIfBuffered(db, row)) return;
    db.insert(farmNotes)
      .values({ ...row, afterEventId: newestEventId(db) })
      .run();
  },

  /**
   * A BUTTON PRESS that leaves one summary line its moves link back to. The
   * owner asked for exactly this: "store each button summary as a log entry".
   *
   * The summary row goes in FIRST, so its id exists to stamp on every span and
   * note the press produces. When `fn` returns, the row gets its sentence and
   * moves to the top of the run. If `fn` throws, the row says the run stopped
   * and why, so a half-played day is never silent.
   *
   * Runs happen at a request, never inside a tick: a tick has no button.
   */
  run<T>(
    db: DB,
    kind: Extract<NoteKind, "play_my_day" | "card">,
    actor: Extract<Actor, { kind: "player" | "autoplay" }>,
    fn: () => T,
    summarize: (result: T) => { message: string; data?: unknown }
  ): T {
    const runId = db
      .insert(farmNotes)
      .values({
        farmId: actor.farmId,
        dayIndex: dayNow(db),
        afterEventId: newestEventId(db),
        kind,
        message: "",
        visibility: "owner",
        actorKind: actor.kind,
        via: actor.via,
        actorFarmId: actor.farmId,
      })
      .returning({ id: farmNotes.id })
      .get().id;
    const finish = (message: string, data?: unknown) =>
      db
        .update(farmNotes)
        .set({
          message,
          data: data === undefined ? null : JSON.stringify(data),
          afterEventId: newestEventId(db),
          runId,
        })
        .where(eq(farmNotes.id, runId))
        .run();
    try {
      const result = withActor(db, { ...actor, runId }, fn);
      const { message, data } = summarize(result);
      finish(message, data);
      return result;
    } catch (err) {
      finish(`Stopped partway: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  },
};

/**
 * The one sentence for a stud price, shared by the player's door
 * (Breeding.setStudPrice) and the house's (priceStuds' direct write), so a
 * price reads the same whoever set it. The actor column says who.
 */
export function noteStudPrice(
  db: DB,
  stud: { farmId: string; birdId: string; name: string; from: number | null; to: number },
  pending: boolean
): void {
  const what =
    stud.from === null
      ? `Set ${stud.name}'s first stud price: ${stud.to} GP a cover.`
      : `Changed ${stud.name}'s stud price from ${stud.from} GP to ${stud.to} GP a cover.`;
  FarmNotes.write(db, {
    farmId: stud.farmId,
    kind: "stud_price",
    birdId: stud.birdId,
    message: pending ? `${what} The new price starts at the next day tick.` : what,
    data: { from: stud.from, to: stud.to, pending },
    visibility: "owner",
  });
}
