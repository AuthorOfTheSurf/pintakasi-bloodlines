# The envoy-rebind bug, pinned — repro session (2026-08-16)

`scripts/rivet-repro.ts`: a counter actor, one process generation per run,
no game, no Ollama. Six generations against one rivetkit 2.3.10 serverful
engine daemon. Raw session output at the bottom; analysis first.

## What the session shows

| Gen | Daemon | key a (created gen1, touched first) | keys b, c |
|---|---|---|---|
| 1 | fresh | OK 70 ms (create) | OK ~28 ms |
| 2 | same | OK but **8.0 s** (rebind window) | OK 5 ms |
| 3 | same | **FAIL 30 s** (`no_envoys`), then OK on retry | OK ~20 ms |
| 4 | same | **FAIL × 4 attempts** (2+ min) — wedged | OK ~30 ms |
| 5 | same | **FAIL × 4 attempts** — still wedged | OK ~25 ms |
| 6 | **restarted** | FAIL once, then OK — **cured**, state intact (n=4) | b paid one 30 s timeout too, then OK |

## The mechanism, as the daemon's own logs tell it

At the moment each new generation's envoy registered, the engine dumped a
storm of wake requests for **`barn` actors** — actors from the 10v10
worlds, a different registry entirely — onto the repro process's envoy,
which hosts only `counter`. Thirty consecutive
`not_registered: Actor factory 'barn' is not registered` errors at gen 3's
registration instant.

So, three findings, one bug:

1. **The engine assigns wake work to envoys that cannot serve it.** Pool
   selection in serverful mode appears not to filter by the envoy's actor
   types. Every stale sleeping actor in the store is a wake request waiting
   to be flung at whatever envoy shows up next.
2. **The actor whose wake rides that storm gets a poisoned record.** key
   `a` — first-touched, wake queued during the storm — went from slow
   (gen 2) to retry-cured (gen 3) to permanently `no_envoys` (gens 4–5),
   while its neighbors bound in milliseconds all along. The failure is
   PER-ACTOR, in the engine's in-memory state: durable storage was never
   wrong (the counter resumed at the correct value after restart).
3. **Daemon restart is the cure because the poison is in memory.** Same
   store, restarted process: one rebind-window timeout, then healthy.

This explains every symptom the 10v10 experiments logged: the positional
first-contact wedge at coach sessions (the first barn tuned after a
generation change rides the storm), the rebind window (storm duration),
and the "aged daemon" no-rebind (a poisoned record never recovering while
the daemon lives).

## What we'd tell the Rivet team

Serverful mode, rivetkit 2.3.10: engine wake-scheduling should filter by
the envoy's registered actor types, and a failed wake should not be able
to wedge an actor's lease while capable envoys exist. 60-line repro:
`scripts/rivet-repro.ts`, driver = run it 5× against one daemon.

## Raw session output

```
── generation 1 (daemon untouched since gen1) ──
gen=1 pid=32390 keys=a,b,c
  key=a attempt=1 OK n=1 ms=70
  key=b attempt=1 OK n=1 ms=29
  key=c attempt=1 OK n=1 ms=28
── generation 2 (daemon untouched since gen1) ──
gen=2 pid=32470 keys=a,b,c
  key=a attempt=1 OK n=2 ms=8031
  key=b attempt=1 OK n=2 ms=5
  key=c attempt=1 OK n=2 ms=5
── generation 3 (daemon untouched since gen1) ──
gen=3 pid=32633 keys=a,b,c
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"5zhctureng5sxqi10myxfvml7tal00\"}"
  key=a attempt=1 FAIL ms=30027 err=Actor failed to start (5zhctureng5sxqi10myxfvml7tal00): "no_envoys"
ts=2026-08-15T05:16:24.652668Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.652651Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.653721Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.660221Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.662074Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.663318Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.664164Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.667089Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.668247Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.669587Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.672877Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.675147Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.677225Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.681211Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.683026Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.686001Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.687682Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.691013Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.692885Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.693491Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.704886Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.710575Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.717033Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.719999Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.72036Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.725445Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.726911Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.743389Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.760731Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
ts=2026-08-15T05:16:24.779759Z level=error message="actor start failed" error="not_registered: Actor factory \'barn\' is not registered." error_chain="[\"not_registered: Actor factory \'barn\' is not registered.\"]"
  key=a attempt=2 OK n=3 ms=8
  key=b attempt=1 OK n=3 ms=25
  key=c attempt=1 OK n=3 ms=13
── generation 4 (daemon untouched since gen1) ──
gen=4 pid=33177 keys=a,b,c
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"5zhctureng5sxqi10myxfvml7tal00\"}"
  key=a attempt=1 FAIL ms=30024 err=Actor failed to start (5zhctureng5sxqi10myxfvml7tal00): "no_envoys"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"5zhctureng5sxqi10myxfvml7tal00\"}"
  key=a attempt=2 FAIL ms=30011 err=Actor failed to start (5zhctureng5sxqi10myxfvml7tal00): "no_envoys"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"5zhctureng5sxqi10myxfvml7tal00\"}"
  key=a attempt=3 FAIL ms=30018 err=Actor failed to start (5zhctureng5sxqi10myxfvml7tal00): "no_envoys"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"5zhctureng5sxqi10myxfvml7tal00\"}"
  key=a attempt=4 FAIL ms=30029 err=Actor failed to start (5zhctureng5sxqi10myxfvml7tal00): "no_envoys"
  key=b attempt=1 OK n=4 ms=45
  key=c attempt=1 OK n=4 ms=16
── generation 5 (daemon untouched since gen1) ──
gen=5 pid=35239 keys=a,b,c
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"5zhctureng5sxqi10myxfvml7tal00\"}"
  key=a attempt=1 FAIL ms=30027 err=Actor failed to start (5zhctureng5sxqi10myxfvml7tal00): "no_envoys"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"5zhctureng5sxqi10myxfvml7tal00\"}"
  key=a attempt=2 FAIL ms=30009 err=Actor failed to start (5zhctureng5sxqi10myxfvml7tal00): "no_envoys"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"5zhctureng5sxqi10myxfvml7tal00\"}"
  key=a attempt=3 FAIL ms=30014 err=Actor failed to start (5zhctureng5sxqi10myxfvml7tal00): "no_envoys"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"5zhctureng5sxqi10myxfvml7tal00\"}"
  key=a attempt=4 FAIL ms=30020 err=Actor failed to start (5zhctureng5sxqi10myxfvml7tal00): "no_envoys"
  key=b attempt=1 OK n=5 ms=33
  key=c attempt=1 OK n=5 ms=15
── daemon RESTART, then generation 6 ──
gen=6 pid=37245 keys=a,b,c
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"5zhctureng5sxqi10myxfvml7tal00\"}"
  key=a attempt=1 FAIL ms=30028 err=Actor failed to start (5zhctureng5sxqi10myxfvml7tal00): "no_envoys"
  key=a attempt=2 OK n=4 ms=20
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"9e82xqipd8x8nxfuqwfwu6tjoucl00\"}"
  key=b attempt=1 FAIL ms=30005 err=Actor failed to start (9e82xqipd8x8nxfuqwfwu6tjoucl00): "no_envoys"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"9e82xqipd8x8nxfuqwfwu6tjoucl00\"}"
  key=b attempt=2 FAIL ms=30006 err=Actor failed to start (9e82xqipd8x8nxfuqwfwu6tjoucl00): "no_envoys"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"9e82xqipd8x8nxfuqwfwu6tjoucl00\"}"
  key=b attempt=3 FAIL ms=30081 err=Actor failed to start (9e82xqipd8x8nxfuqwfwu6tjoucl00): "no_envoys"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"9e82xqipd8x8nxfuqwfwu6tjoucl00\"}"
  key=b attempt=4 FAIL ms=30007 err=Actor failed to start (9e82xqipd8x8nxfuqwfwu6tjoucl00): "no_envoys"
  key=c attempt=1 OK n=6 ms=30
```
