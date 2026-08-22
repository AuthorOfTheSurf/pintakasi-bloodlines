/**
 * EXPERIMENT — not wired into the game; the shipped barn (../barn.ts) is
 * untouched. A typed FIFO mailbox on `@rivetkit/effect` 2.3.10, written in
 * the raw SDK idiom to measure it. Friction notes live in the PR body and
 * the wiki design doc (rivet-effect-layer-design, "Barn build log").
 */
import { Action, Actor } from "@rivetkit/effect";
import { Schema } from "effect";

// --- Mailbox messages ---

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

// --- Typed errors ---

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

// --- Actions ---

/** Fire-and-forget into the mailbox ("send"). Success is a receipt. */
export const Enqueue = Action.make("Enqueue", {
  payload: { message: BarnMessage },
  success: Schema.Struct({ queued: Schema.Number }),
});

/** Request-response through the same mailbox ("ask"). */
export const BreedRequest = Action.make("BreedRequest", {
  payload: {
    henId: Schema.String,
    roosterId: Schema.String,
    fee: Schema.Number,
  },
  success: Schema.Struct({ eggId: Schema.String, gpLeft: Schema.Number }),
  error: Schema.Union([InsufficientGPError, BloodlineViolationError]),
});

/** Read the ledger; bypasses the mailbox (reads may race). */
export const GetLedger = Action.make("GetLedger", {
  success: Schema.Struct({
    gp: Schema.Number,
    eggs: Schema.Array(Schema.String),
    processedOrder: Schema.Array(Schema.String),
    settledThroughDay: Schema.Number,
  }),
});

export const BarnLedger = Actor.make("BarnLedger", {
  actions: [Enqueue, BreedRequest, GetLedger],
});
