/**
 * The mailbox: Rivet's own disabled chat-room sketch, made to run —
 * Queue.take → Match.tag → forkScoped consumer in the wake scope.
 * Known limits (details in the PR body): the queue is in-memory, so
 * unprocessed mail dies on sleep; replies are in-process Deferreds; and
 * toLayer can pass through only `name`/`icon` — no actionTimeout, no
 * sleep control — which is why this cannot carry the real barn yet.
 */
import { Actor } from "@rivetkit/effect";
import { Deferred, Effect, Match, Queue, Schema } from "effect";
import {
  BarnLedger,
  BloodlineViolationError,
  InsufficientGPError,
  type BarnMessage,
} from "./api.ts";

type MailboxItem =
  | { kind: "send"; message: BarnMessage }
  | {
      kind: "askBreed";
      henId: string;
      roosterId: string;
      fee: number;
      reply: Deferred.Deferred<
        { eggId: string; gpLeft: number },
        InsufficientGPError | BloodlineViolationError
      >;
    };

const STARTING_GP = 1_000;

// Toy stand-in for the engine's real genetics.
const checkBloodline = (henId: string, roosterId: string) =>
  henId === roosterId
    ? { legal: false as const, reason: `bird ${henId} cannot breed with itself` }
    : { legal: true as const, reason: "" };

export const BarnLedgerLive = BarnLedger.toLayer(
  Effect.fnUntraced(function* ({ state }) {
    const mailbox = yield* Queue.unbounded<MailboxItem>();

    const handleMessage = (item: MailboxItem) =>
      Match.value(item).pipe(
        Match.when({ kind: "send" }, ({ message }) =>
          Match.value(message).pipe(
            Match.tag("QueueFight", (msg) =>
              state
                .update((s) =>
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
  },
);
