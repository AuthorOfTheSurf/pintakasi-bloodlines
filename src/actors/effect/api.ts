/**
 * ── EXPERIMENT: THE BARN LEDGER ON THE EFFECT SDK (round 64) ────────────────
 *
 * NOT WIRED INTO THE GAME. This actor exists to answer one question with
 * running code: what does a typed, sequential mailbox look like on
 * `@rivetkit/effect` 2.3.10 TODAY, before Rivet ships typed queue wrappers?
 * The shipped barn (../barn.ts, classic SDK) stays untouched — it is the
 * citable exp11 artifact and this experiment must not disturb it.
 *
 * Why a LEDGER and not the brain: the brain (takeTurn) is read-mostly and
 * parallel-safe, which is why plain actions were enough for phase 2. The
 * thing that NEEDS a mailbox is money — the wiki's World Actor question.
 * Fees, breeding, gacha, settlement: commands where two interleaved handlers
 * could double-spend. So this experiment gives one barn a tiny private
 * ledger and forces every GP-touching command through a FIFO mailbox.
 *
 * The mailbox shape deliberately copies the DISABLED sketch in Rivet's own
 * chat-room-effect example ("Message processing (not yet implemented)"):
 * pull-based Queue.take, Match.tag dispatch, Match.exhaustive, consumer
 * forked into the wake scope. We are running the pattern they drafted and
 * did not land, and writing down where it bites.
 *
 * This file is the CONTRACT half (importable by clients, no server code) —
 * the split the SDK enforces, and honestly one of its better ideas.
 */
import { Action, Actor } from "@rivetkit/effect";
import { Schema } from "effect";

// --- Domain messages (the mailbox's vocabulary) -----------------------------
//
// One tagged struct per command. The union is what a durable queue would
// carry; today it rides inside `Enqueue` (fire-and-forget) or the ask-style
// actions below. Schema.TaggedStruct gives each message the same `_tag`
// discriminant the Match dispatch keys on.

export const QueueFight = Schema.TaggedStruct("QueueFight", {
  birdId: Schema.String,
  entryFee: Schema.Number,
});

export const GachaPull = Schema.TaggedStruct("GachaPull", {
  tier: Schema.Literals(["Free", "Paid"]),
  rolls: Schema.Number,
});

export const DailySettle = Schema.TaggedStruct("DailySettle", {
  gameDay: Schema.Number,
});

export const BarnMessage = Schema.Union([QueueFight, GachaPull, DailySettle]);
export type BarnMessage = typeof BarnMessage.Type;

// --- Typed errors -----------------------------------------------------------
//
// Declared as Schema classes so they travel the action error channel and
// arrive on the client as catchTag-able instances — the SDK's own idiom
// (see hello-world-effect's NegativeAmountError).

export class InsufficientGPError extends Schema.TaggedErrorClass<InsufficientGPError>()(
  "InsufficientGPError",
  {
    required: Schema.Number,
    available: Schema.Number,
  },
) {}

export class BloodlineViolationError extends Schema.TaggedErrorClass<BloodlineViolationError>()(
  "BloodlineViolationError",
  {
    reason: Schema.String,
  },
) {}

// --- Actions ----------------------------------------------------------------

/**
 * The SEND path: fire-and-forget into the mailbox. Returns the queue depth
 * at accept time (a receipt, not a result — the handler has not run yet).
 * This is `barn.send(msg)` from the design doc, spelled the only way the
 * SDK can spell it today: an ordinary request-response action that enqueues.
 */
export const Enqueue = Action.make("Enqueue", {
  payload: { message: BarnMessage },
  success: Schema.Struct({ queued: Schema.Number }),
});

/**
 * The ASK path: breeding goes through the SAME mailbox as everything else,
 * but the caller waits for the outcome — an egg id, or a typed domain
 * error. Reply correlation is a Deferred that never crosses the wire,
 * which is exactly the `complete` callback in Rivet's disabled sketch.
 */
export const BreedRequest = Action.make("BreedRequest", {
  payload: {
    henId: Schema.String,
    roosterId: Schema.String,
    fee: Schema.Number,
  },
  success: Schema.Struct({ eggId: Schema.String, gpLeft: Schema.Number }),
  error: Schema.Union([InsufficientGPError, BloodlineViolationError]),
});

/** Read the ledger — bypasses the mailbox on purpose: reads can race. */
export const GetLedger = Action.make("GetLedger", {
  success: Schema.Struct({
    gp: Schema.Number,
    eggs: Schema.Array(Schema.String),
    // Every message tag in the order the CONSUMER processed it — the test's
    // proof of FIFO. A parallel-action implementation cannot fake this.
    processedOrder: Schema.Array(Schema.String),
    settledThroughDay: Schema.Number,
  }),
});

// --- The actor contract -----------------------------------------------------

export const BarnLedger = Actor.make("BarnLedger", {
  actions: [Enqueue, BreedRequest, GetLedger],
});
