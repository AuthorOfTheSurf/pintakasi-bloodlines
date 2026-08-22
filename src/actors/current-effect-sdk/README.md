# The current Effect SDK, raw

The baseline: the same actor patterns written directly against `@rivetkit/effect` 2.3.10 (beta) with no layer on top. Kept as the honest before-picture for [`../proposed-simple-sdk/`](../proposed-simple-sdk/) — every ergonomic claim over there is measured against this idiom.

- [`api.ts`](./api.ts) — the contract: `Action.make()` payload/success/error schemas, `Schema.TaggedErrorClass`, `Actor.make()`.
- [`live.ts`](./live.ts) — the implementation: `toLayer()` wake function, `Effect.gen` handlers, the FIFO mailbox consumer (`Queue.take` → `Match.tag` → `Match.exhaustive`, `forever` + `forkScoped`) — the shape Rivet's own commented-out sketch draws.
- [`barn-ledger.test.ts`](./barn-ledger.test.ts) — proofs against a real local engine (shared harness lives in the proposed SDK folder; one `Registry.test` per process).

Findings from building this (peer-dependency trap, raw-`.ts` package exports, v4 API renames, the action-time context) are logged in the wiki design doc.
