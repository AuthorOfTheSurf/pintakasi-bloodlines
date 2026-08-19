# The envoy bug, code-audited (2026-08-16)

Source audit of the Rivet engine + rivetkit at tag `v2.3.10` — the exact
version we run (`@rivetkit/engine-cli-darwin-arm64@2.3.10`). Clone at
`~/Repos/rivet-src`. Purpose: we had claimed "bug" on behavior alone;
this pass checks the claim against the code. **Verdict: it splits.**
Half of what we saw is our own misuse of an undocumented sharing rule;
the other half is three genuine engine defects, now pinned to file:line.

## Part 1 — the cross-registry wake storm was MISUSE, not a bug

Our repro session's finding #1 ("the engine assigns wake work to envoys
that cannot serve it — pool selection appears not to filter by actor
types") was the wrong model. The engine **cannot** filter by actor type:

- An envoy registers with exactly five fields, all in the WebSocket URL:
  `protocol_version, namespace, pool_name, envoy_key, version`
  (`engine/packages/pegboard-envoy/src/utils.rs:7-82`). **No actor-type
  list is in the registration protocol.**
- The post-handshake `ToRivetMetadata.prepopulateActorNames` map *looks*
  like a capability set but is a dashboard hint only — its one consumer
  writes namespace-scoped display metadata
  (`pegboard-envoy/src/ws_to_tunnel_task.rs:1227-1256`); the allocator
  never reads it.
- Allocation is purely `(namespace_id, pool_name)` + a 10s liveness
  filter (`pegboard/src/workflows/actor2/alloc_serverful/mod.rs:13-21`,
  `config/pegboard.rs:351`). The actor's name is never consulted.

Both our processes (the counter repro AND the barn worlds) used
all-default `setup()`: namespace `"default"`, pool `"default"`
(`rivetkit/src/registry/config/envoy.ts:13`,
`config/index.ts:362`). To the engine they were interchangeable workers
of one pool. Dispatching barn wakes at the counter envoy was **correct
behavior given our configuration.** There is no queue-replay bug either:
each orphaned actor self-polls with backoff, and they all latch onto the
first eligible envoy at once (`actor2/mod.rs:561-585`) — that's the
"storm."

**The fix that exists today:** one pool per app, set on BOTH the
registry and the client:

```ts
setup({ use: {...}, envoy: { poolName: "pintakasi" } })
createClient(endpoint, { poolName: "pintakasi" })
```

or `RIVET_POOL=pintakasi` in the environment (feeds both defaults).
⚠ **Doc bug:** the docs say `RIVET_RUNNER`; 2.3.10 code reads
`RIVET_POOL` (`rivetkit/src/utils/env-vars.ts:17-18`). Setting
`RIVET_RUNNER` silently does nothing.

Caveats before we adopt it:
- `pool_name` is **immutable per actor**, stamped at create
  (`actor2/mod.rs:322-325`). Existing worlds' actors stay in `default`
  forever; adopt the pool on a fresh world, or accept that old actors
  keep hunting the `default` pool.
- Key reservations are pool-agnostic (`(namespace, name, key)` only —
  `ops/actor/get_reservation_for_key.rs:44-50`), so re-pooling does not
  mint fresh actors for existing keys.
- Nothing in the docs says "different registries must not share a
  pool"; the pool feature is framed as an advanced/GPU-routing option
  (`docs/general/runtime-modes.mdx:94-104`). The startup banner never
  prints the pool and only prints non-default namespaces — nothing on
  the console hints at a collision.

## Part 2 — the per-actor wedge is REAL: three engine defects

The permanent `no_envoys` wedge on one actor while siblings bind in
milliseconds is not explained by pool sharing. Three code-proofed
mechanisms, each an actual defect:

**D1 — `Wake` is dropped outside `Sleeping`, and non-Running states
never check envoy liveness.** An actor parked in `GoingAway`/`StopIntent`
awaiting a stop-ack from a **dead** envoy is unreachable for up to
`actor_stop_threshold` = 30 minutes (`actor2/mod.rs:868-890` drops the
wake; `config/pegboard.rs:215-217`; liveness checks only run in
`Transition::Running`, `actor2/mod.rs:508-541`). Graceful shutdown puts
running actors in exactly this state (`ops/envoy/evict_actors.rs:72-105`),
and the gateway sees `sleeping=false` so it won't even send a Wake —
just 30s timeouts, every attempt. **Durable** — this explains the wedge
that survived a daemon restart.

**D2 — `Reallocating` starvation.** While an actor is in the retry loop,
each incoming client `Wake` is consumed-and-discarded, which *suppresses
the reallocation attempt* (it only runs when the signal queue is empty)
while the backoff still grows, up to 512s (`actor2/mod.rs:561-585`,
`runtime.rs:818-841`). A client retrying every ~30s can starve the actor
until the 5-minute give-up parks it `Sleeping` with `error=NoEnvoys`.

**D3 — gasoline lease leak (in-memory, cured by engine restart).**
`Worker::tick` pulls workflows (taking the lease AND deleting the wake
conditions in one txn) *before* reaping finished handles; if the just-
committed workflow's task hasn't returned yet, the pull hits
`continue` on "workflow already running on this worker" — leaving the
workflow leased, its wake conditions consumed, and no task running.
Nothing recovers it while the worker lives; lease expiry requires the
owning worker's ping to go stale (`gasoline/src/worker.rs:178-199`,
`gasoline/src/db/kv/mod.rs:1335-1383`, `:554-576`). **Exactly matches
"poisoned in memory, daemon restart cures, durable state intact."**

Plus one cosmetic-but-costly interaction:
- The client-visible `no_envoys` is a **stale persisted field** — set on
  a failed allocation and cleared only by a later successful one
  (`actor2/runtime.rs:277`, `mod.rs:57-64`) — not a live statement about
  envoy availability at request time. And rivetkit **hard-throws on the
  first `actor_ready_timeout` whenever any stored error exists**, never
  spending its 60-attempt retry budget
  (`rivetkit/src/client/actor-handle.ts:511-539`). Stale error + eager
  throw = "wedged" from the client's chair even when a healthy envoy
  is back.

Log fingerprints (for future daemons): `workflow already running on this
worker` (ERROR) confirms D3; `cannot wake actor that is not sleeping`
(DEBUG, needs `RIVET_LOG_LEVEL=DEBUG`) confirms D1/D2.
`RIVET_DEBUG_PEGBOARD_ALLOCATOR=1` dumps the eligible-envoy set per
allocation. Our archived logs contain **zero** D3 fingerprints; the exp9
seg3 wedge window (all ten barns, 07:31:58) plus the "connection reset
without closing handshake" envoy line at 07:36 fits D1/D2.

## Part 3 — Rivet already knows about this class

An open, unmerged PR stack filed **2026-07-30** (two weeks before our
repro) targets exactly this territory:

- **#5512** `fix(actors): surface unregistered actor startup errors` —
  their own description confirms our masking finding: guard "retried the
  wake signal up to 8 times before eventually returning a generic
  ActorWakeRetriesExceeded/timeout error" when the true cause was
  `not_registered`.
- **#5513** `fix(rivetkit): reject conflicting local envoy connections` —
  adds `reject_existing_envoy` so a second local app can't silently join
  an occupied engine.
- **#5514** `protect local serverless handler ownership`, **#5510**
  `isolate managed engine storage by port` — same multiple-local-apps-
  one-engine class.

None of it is in 2.3.10. Their direction is fail-fast + reject-sharing,
not capability-based routing — consistent with Part 1's verdict.

## What this changes

1. **Our operational protocol stands** for 2.3.10: cycle the daemon
   before every resume (clears D3 if present; forces D1-parked actors
   through recovery), never pass `--personas` on resume.
2. **Our Rivet report gets rewritten.** The old ask ("filter wake
   dispatch by envoy actor types") was impossible — the protocol carries
   no capability set. The new report is stronger: three file:line engine
   defects (D1/D2/D3) + the stale-error × eager-throw client interaction,
   none covered by the open #5510–5514 stack, plus a doc bug
   (`RIVET_RUNNER` vs `RIVET_POOL`). That's a contribution-grade issue.
3. **Config hygiene for us:** adopt `RIVET_POOL=pintakasi` on the next
   FRESH world (immutability caveat above), and never point a second
   registry (repro scripts included) at a daemon that owns live worlds —
   or give it its own pool.
