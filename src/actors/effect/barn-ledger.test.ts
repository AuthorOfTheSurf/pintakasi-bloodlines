/**
 * Proofs for the mailbox experiment, run under `bun test` against a real
 * auto-spawned engine: FIFO holds across send+ask (awaiting an ask is a
 * flush barrier), typed errors cross the wire catchTag-able, and a
 * concurrent burst serializes with a balanced ledger.
 */
import { afterAll, expect, test } from "bun:test";
import { Effect } from "effect";
import { BarnLedger } from "./api.ts";
import { engine, release, retain } from "./test-harness.ts";

retain();
afterAll(() => release());
// the first call is local and fast.
const TIMEOUT = 120_000;

// Durable actors + fixed keys = state bleeding across suite runs; randomize.
const fresh = (label: string) => `${label}-${crypto.randomUUID()}`;

test(
  "mailbox processes sends in order and asks behind them",
  async () => {
    await engine.run(
      Effect.gen(function* () {
        const barn = (yield* BarnLedger.client).getOrCreate(fresh("t-fifo"));
        yield* barn.Enqueue({
          message: { _tag: "QueueFight", birdId: "b1", entryFee: 40 },
        });
        yield* barn.Enqueue({
          message: { _tag: "GachaPull", tier: "Paid", rolls: 3 },
        });
        yield* barn.Enqueue({ message: { _tag: "DailySettle", gameDay: 7 } });
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
        // 1000 − fight 40 − paid gacha 3×10 − breed 200
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
    await engine.run(
      Effect.gen(function* () {
        const barn = (yield* BarnLedger.client).getOrCreate(fresh("t-errors"));
        const broke = yield* barn
          .BreedRequest({ henId: "h", roosterId: "r", fee: 5_000 })
          .pipe(
            Effect.map(() => "unexpectedly succeeded" as const),
            Effect.catchTag("InsufficientGPError", (e) =>
              Effect.succeed(`short by ${e.required - e.available}` as const),
            ),
          );
        expect(broke).toBe("short by 4000");
        const illegal = yield* barn
          .BreedRequest({ henId: "same", roosterId: "same", fee: 100 })
          .pipe(
            Effect.map(() => "unexpectedly succeeded" as const),
            Effect.catchTag("BloodlineViolationError", (e) =>
              Effect.succeed(e.reason),
            ),
          );
        expect(illegal).toContain("cannot breed with itself");
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
    await engine.run(
      Effect.gen(function* () {
        const barn = (yield* BarnLedger.client).getOrCreate(fresh("t-burst"));
        yield* Effect.forEach(
          Array.from({ length: 20 }, (_, i) => i),
          () =>
            barn.Enqueue({
              message: { _tag: "QueueFight", birdId: "b", entryFee: 45 },
            }),
          { concurrency: "unbounded" },
        );
        yield* barn.BreedRequest({ henId: "h", roosterId: "r", fee: 100 });

        const ledger = yield* barn.GetLedger();
        // fights take 20×45 = 900, then the breed takes 100: exactly zero left
        expect(
          ledger.processedOrder.filter((t) => t === "QueueFight").length,
        ).toBe(20);
        expect(ledger.gp).toBe(1000 - 20 * 45 - 100);
      }),
    );
  },
  TIMEOUT,
);
