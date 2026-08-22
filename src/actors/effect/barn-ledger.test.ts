/**
 * ── PROOF RUN FOR THE EFFECT MAILBOX EXPERIMENT ─────────────────────────────
 *
 * Three claims, each load-bearing for the design doc:
 *
 *  1. FIFO ACROSS BOTH PATHS. Sends are processed in offer order, and an
 *     ask (BreedRequest) queued after them runs after ALL of them — which
 *     also makes awaiting an ask a free flush barrier for the mailbox.
 *  2. TYPED ERRORS SURVIVE THE WIRE. InsufficientGPError and
 *     BloodlineViolationError arrive catchTag-able with their fields, not
 *     as stringly RivetErrors.
 *  3. THE LEDGER BALANCES. Sequential processing means no lost updates:
 *     final GP is exactly start minus every accepted debit.
 *
 * Runs under `bun test`, not @effect/vitest — the repo's runner is bun and
 * part of the experiment is seeing whether the SDK's test story survives
 * outside its own harness. ManagedRuntime carries the layer; Registry.test
 * auto-spawns a local rivet-engine for the suite (first run downloads it).
 */
import { afterAll, expect, test } from "bun:test";
import { Registry } from "@rivetkit/effect";
import { Effect, Layer, ManagedRuntime } from "effect";
import { BarnLedger } from "./api.ts";
import { BarnLedgerLive } from "./live.ts";

const TestLayer = Registry.test.pipe(
  Layer.provideMerge(BarnLedgerLive),
  Layer.provide(Registry.layer()),
);

const runtime = ManagedRuntime.make(TestLayer);
afterAll(() => runtime.dispose());

// Engine boot + first-time binary download can be slow; everything after
// the first call is local and fast.
const TIMEOUT = 120_000;

test(
  "mailbox processes sends in order and asks behind them",
  async () => {
    await runtime.runPromise(
      Effect.gen(function* () {
        const barn = (yield* BarnLedger.client).getOrCreate("t-fifo");

        // Three sends, offered in a known order…
        yield* barn.Enqueue({
          message: { _tag: "QueueFight", birdId: "b1", entryFee: 40 },
        });
        yield* barn.Enqueue({
          message: { _tag: "GachaPull", tier: "Paid", rolls: 3 },
        });
        yield* barn.Enqueue({ message: { _tag: "DailySettle", gameDay: 7 } });

        // …then an ask through the SAME mailbox. Awaiting it is the flush:
        // if it resolves, everything offered before it has been processed.
        const bred = yield* barn.BreedRequest({
          henId: "hen-1",
          roosterId: "roo-2",
          fee: 200,
        });

        const ledger = yield* barn.GetLedger();
        expect(ledger.processedOrder).toEqual([
          "QueueFight",
          "GachaPull",
          "DailySettle",
          "BreedRequest",
        ]);
        // start 1000 − fight 40 − paid gacha 3×10 − breed 200
        expect(ledger.gp).toBe(1000 - 40 - 30 - 200);
        expect(bred.gpLeft).toBe(ledger.gp);
        expect(ledger.eggs).toEqual([bred.eggId]);
        expect(ledger.settledThroughDay).toBe(7);
      }),
    );
  },
  TIMEOUT,
);

test(
  "typed domain errors cross the wire catchTag-able, ledger untouched",
  async () => {
    await runtime.runPromise(
      Effect.gen(function* () {
        const barn = (yield* BarnLedger.client).getOrCreate("t-errors");

        // Broke: fee larger than the whole stake.
        const broke = yield* barn
          .BreedRequest({ henId: "h", roosterId: "r", fee: 5_000 })
          .pipe(
            Effect.map(() => "unexpectedly succeeded" as const),
            Effect.catchTag("InsufficientGPError", (e) =>
              Effect.succeed(`short by ${e.required - e.available}` as const),
            ),
          );
        expect(broke).toBe("short by 4000");

        // Illegal pairing: the toy rule is "not with yourself".
        const illegal = yield* barn
          .BreedRequest({ henId: "same", roosterId: "same", fee: 100 })
          .pipe(
            Effect.map(() => "unexpectedly succeeded" as const),
            Effect.catchTag("BloodlineViolationError", (e) =>
              Effect.succeed(e.reason),
            ),
          );
        expect(illegal).toContain("cannot breed with itself");

        // Both rejections left the ledger exactly as born.
        const ledger = yield* barn.GetLedger();
        expect(ledger.gp).toBe(1000);
        expect(ledger.eggs).toEqual([]);
      }),
    );
  },
  TIMEOUT,
);

test(
  "concurrent sends are serialized: nothing lost, ledger balances",
  async () => {
    await runtime.runPromise(
      Effect.gen(function* () {
        const barn = (yield* BarnLedger.client).getOrCreate("t-burst");

        // Twenty fights fired with unbounded concurrency. Arrival order is
        // the race's business; the claim under test is that every accepted
        // debit lands exactly once (a parallel-action ledger with this
        // read-modify-write shape could interleave and lose updates).
        yield* Effect.forEach(
          Array.from({ length: 20 }, (_, i) => i),
          () =>
            barn.Enqueue({
              message: { _tag: "QueueFight", birdId: "b", entryFee: 45 },
            }),
          { concurrency: "unbounded" },
        );

        // Flush via the ask barrier.
        yield* barn.BreedRequest({ henId: "h", roosterId: "r", fee: 100 });

        const ledger = yield* barn.GetLedger();
        // 1000 GP affords 20 fights at 45 each; the last of the twenty
        // finds 1000 − 19×45 = 145 ≥ 45, so ALL twenty debit… wait — the
        // breed also needs 100. Order matters: all fights precede the
        // breed, so fights take 900, breed sees 100 and takes it. Zero
        // lost, zero double-spent, zero left.
        expect(
          ledger.processedOrder.filter((t) => t === "QueueFight").length,
        ).toBe(20);
        expect(ledger.gp).toBe(1000 - 20 * 45 - 100);
      }),
    );
  },
  TIMEOUT,
);
