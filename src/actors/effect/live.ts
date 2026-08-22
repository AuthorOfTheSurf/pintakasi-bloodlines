/**
 * ── THE BARN LEDGER, IMPLEMENTED (the mailbox they sketched) ────────────────
 *
 * The consumer loop below is Rivet's own disabled chat-room sketch, made to
 * run: Queue.take → Match.tag → Match.exhaustive, forked into the wake
 * scope. Everything worth knowing lives in the friction notes this file was
 * written to produce (wiki: rivet-effect-layer-design, "Barn build log"):
 *
 *  · The queue is IN-MEMORY. Sleep or crash and unprocessed mail is gone.
 *    Durability today would mean self-dispatch via
 *    rawRivetkitContext.schedule.after(0, "SomeAction", payload) — which is
 *    stringly-typed, escapes every schema in api.ts, and still wakes as an
 *    ORDINARY action, i.e. it re-enters through the front door and gains no
 *    ordering guarantee. There is no honest durable FIFO on 2.3.10.
 *
 *  · Replies are Deferreds bundled with the message IN PROCESS. They cannot
 *    ride a wire, which is fine here and exactly why the eventual typed
 *    queue wrapper has to own reply correlation itself.
 *
 *  · Ask-messages jump the same queue as send-messages, so ordering holds
 *    across BOTH paths — a BreedRequest issued after a DailySettle sees the
 *    settled ledger. That cross-path ordering is the design doc's whole
 *    argument for `mailbox` being one keyword, not two APIs.
 */
import { Actor } from "@rivetkit/effect";
import { Deferred, Effect, Match, Queue, Schema } from "effect";
import {
  BarnLedger,
  BloodlineViolationError,
  InsufficientGPError,
  type BarnMessage,
} from "./api.ts";

/** What rides the internal queue: wire message, or local ask with a reply slot. */
type MailboxItem =
  | { readonly kind: "send"; readonly message: BarnMessage }
  | {
      readonly kind: "askBreed";
      readonly henId: string;
      readonly roosterId: string;
      readonly fee: number;
      readonly reply: Deferred.Deferred<
        { eggId: string; gpLeft: number },
        InsufficientGPError | BloodlineViolationError
      >;
    };

const STARTING_GP = 1_000;

/** Toy bloodline rule: a bird cannot breed with itself. Stand-in for the
 * engine's real genetics — the experiment needs A failure mode, not THE
 * failure mode. */
const checkBloodline = (henId: string, roosterId: string) =>
  henId === roosterId
    ? { legal: false as const, reason: `bird ${henId} cannot breed with itself` }
    : { legal: true as const, reason: "" };

export const BarnLedgerLive = BarnLedger.toLayer(
  Effect.fnUntraced(function* ({ state }) {
    // The mailbox lives in the wake scope: born on wake, dead on sleep —
    // and its unprocessed contents die with it (friction note above).
    const mailbox = yield* Queue.unbounded<MailboxItem>();

    // One message fully handled before the next is taken. The `yield*` on
    // handleMessage inside the loop IS the FIFO guarantee — there is no
    // other serialization anywhere in this file.
    const handleMessage = (item: MailboxItem) =>
      Match.value(item).pipe(
        Match.when({ kind: "send" }, ({ message }) =>
          Match.value(message).pipe(
            Match.tag("QueueFight", (msg) =>
              state
                .update((s) =>
                  // Insufficient GP on a fire-and-forget: the fight is
                  // silently skipped. A send has no reply channel — the
                  // design doc's argument for making dead-letter visibility
                  // part of any real mailbox wrapper.
                  s.gp < msg.entryFee
                    ? {
                        ...s,
                        processedOrder: [...s.processedOrder, "QueueFight:skipped"],
                      }
                    : {
                        ...s,
                        gp: s.gp - msg.entryFee,
                        processedOrder: [...s.processedOrder, "QueueFight"],
                      },
                )
                .pipe(Effect.orDie),
            ),
            Match.tag("GachaPull", (msg) =>
              state
                .update((s) => ({
                  ...s,
                  gp: msg.tier === "Paid" ? s.gp - 10 * msg.rolls : s.gp,
                  processedOrder: [...s.processedOrder, "GachaPull"],
                }))
                .pipe(Effect.orDie),
            ),
            Match.tag("DailySettle", (msg) =>
              state
                .update((s) => ({
                  ...s,
                  settledThroughDay: Math.max(s.settledThroughDay, msg.gameDay),
                  processedOrder: [...s.processedOrder, "DailySettle"],
                }))
                .pipe(Effect.orDie),
            ),
            Match.exhaustive,
          ),
        ),
        Match.when({ kind: "askBreed" }, (ask) =>
          Effect.gen(function* () {
            const current = yield* state.get.pipe(Effect.orDie);
            // Reject-before-mutate, per the SDK examples' own discipline:
            // the error path must leave the ledger untouched.
            if (current.gp < ask.fee) {
              return yield* Deferred.fail(
                ask.reply,
                new InsufficientGPError({
                  required: ask.fee,
                  available: current.gp,
                }),
              );
            }
            const pairing = checkBloodline(ask.henId, ask.roosterId);
            if (!pairing.legal) {
              return yield* Deferred.fail(
                ask.reply,
                new BloodlineViolationError({ reason: pairing.reason }),
              );
            }
            const eggId = `egg-${ask.henId}-${ask.roosterId}-${current.eggs.length}`;
            const next = yield* state
              .updateAndGet((s) => ({
                ...s,
                gp: s.gp - ask.fee,
                eggs: [...s.eggs, eggId],
                processedOrder: [...s.processedOrder, "BreedRequest"],
              }))
              .pipe(Effect.orDie);
            return yield* Deferred.succeed(ask.reply, {
              eggId,
              gpLeft: next.gp,
            });
          }),
        ),
        Match.exhaustive,
      );

    // The consumer: Rivet's sketch, verbatim in structure. forkScoped ties
    // it to the wake scope — it is cancelled on sleep, which is the
    // durability hole documented at the top of this file.
    yield* Effect.gen(function* () {
      const item = yield* Queue.take(mailbox);
      yield* handleMessage(item);
    }).pipe(Effect.forever, Effect.forkScoped);

    return BarnLedger.of({
      Enqueue: Effect.fnUntraced(function* ({ payload }) {
        yield* Queue.offer(mailbox, { kind: "send", message: payload.message });
        const queued = yield* Queue.size(mailbox);
        return { queued };
      }),
      BreedRequest: Effect.fnUntraced(function* ({ payload }) {
        const reply = yield* Deferred.make<
          { eggId: string; gpLeft: number },
          InsufficientGPError | BloodlineViolationError
        >();
        yield* Queue.offer(mailbox, { kind: "askBreed", ...payload, reply });
        // The action's typed error channel and the Deferred's error type
        // line up exactly — this await is where the mailbox's answer
        // becomes the wire's answer.
        return yield* Deferred.await(reply);
      }),
      GetLedger: () => state.get.pipe(Effect.orDie),
    });
  }),
  {
    state: {
      schema: Schema.Struct({
        gp: Schema.Number,
        eggs: Schema.Array(Schema.String),
        processedOrder: Schema.Array(Schema.String),
        settledThroughDay: Schema.Number,
      }),
      initialValue: () => ({
        gp: STARTING_GP,
        eggs: [],
        processedOrder: [],
        settledThroughDay: -1,
      }),
    },
    name: "Barn Ledger (Effect experiment)",
    icon: "scale-balanced",
    // ⚠ WHAT CANNOT BE WRITTEN HERE, AND MUST BE, BEFORE THIS PATTERN CAN
    // CARRY THE REAL BARN: the classic barn.ts depends on
    // `actionTimeout: 600_000` (LLM turns) and `noSleep: true` (the wake
    // stampede) — and toLayer's option passthrough is `name` and `icon`
    // ONLY (verified against dist/Actor.js, rivetkitActorOptionsKeys).
    // Registry.layer likewise cannot set maxIncomingMessageSize, which the
    // 8 MB morning briefs require. Both are filed as headline friction.
  },
);
