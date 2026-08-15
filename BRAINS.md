# Brains: running the stables on a local model

A running log of what we hit putting language models behind the bot stables, and what it costs in seconds. Companion to `PERFORMANCE.md`, which owns the engine's speed; this file owns the *inference* side and the design findings that came with it.

Two rules, same as that file: **numbers come from a run, not from an argument**, and the method is written down beside the number so a later run can be compared to it honestly.

Reproduce anything here with:

```bash
bun run simulate 45 --seed=1                                       # build a world
bun run simulate 7 --keep --seed=1 --brain=qwen3:14b --llm=bot-1   # a brain plays it
bun run brain-bench --farm=bot-1                                   # where the seconds go
```

---

## The speed ledger

**Machine:** MacBook Pro, M1 Max, 10 cores, 64 GB unified memory. ~400 GB/s memory bandwidth.
**Model:** `qwen3:14b` via Ollama 0.32.11, 4-bit, 9.3 GB on disk. Nothing leaves the laptop.

### A game-day, with and without a brain

| Run | Days | s/day | Notes |
|---|---|---|---|
| Scripted only | 92 | **0.90** | 5.11 ms/fight · 7.29 ms/entry |
| One llm barn | 7 | **13.74** | 18 of 19 stables still scripted |

**One barn's brain costs ~12.8 s/day** — about **fourteen times the entire rest of the day's work**, engine, card, championships and all. The engine is not the cost any more and will not be again. Every speed question from here is an inference question.

### Concurrency: four barns cost twice one barn, not four times

| llm barns | s/day | vs. 1 barn |
|---|---|---|
| 1 | 13.74 | — |
| 4 | **27.91** | **2.0×** for 4× the work |

**Four times the barns for twice the wall clock.** The fan-out in `collectProposals` is real parallelism, not a queue: Ollama batches the concurrent requests, and because a barn-day is ~90% *reading*, and reading batches well on a GPU, the marginal barn is far cheaper than the first.

Marginal cost per extra barn: **~4.7 s**, against ~13.7 s for the first one. The staggered replies make the batching visible — four calls issued together came back at 4.4 s, 24.7 s, 27.8 s, 30.9 s.

Projecting all nineteen stables: `13.7 + 18 × 4.7 ≈ **100 s/game-day**`. ⚠ That is extrapolated from two points and should be measured before being believed — but it is the difference between a full llm world being a coffee break and being an overnight job. **A 92-day world with every stable on a model comes out around 2.5 hours**, which is a thing you can run, not a thing you plan around.

And with brains on, the engine has left the chart entirely: **inference was 98% of that run.**

### Where those seconds go (`bun run brain-bench`)

| Phase | Cold | Warm |
|---|---|---|
| Model load | **5,971 ms** | **121 ms** |
| Prompt eval | 4,550 ms (870 tok, ~191 tok/s) | 5,268 ms (1,086 tok, ~206 tok/s) |
| Generation | 177 ms (5 tok) | 180 ms (5 tok) |

Two things fall straight out:

1. **Loading the model costs 49× more cold than warm.** That is the measured argument for waking every barn in the same moment rather than spreading them across the day — one load serves the whole roster. The tick already had this shape for its own reasons.
2. **Reading dominates. Generating is nearly free.** ~200 tokens/second in, and a day's decisions are only a few hundred tokens out. **A barn-day is about 90% reading its mail.** Which means the lever on speed is the size of the brief, not the cleverness of the model — and that is a very different optimization than the ones `PERFORMANCE.md` records.

### What the digest actually saves

| Barn | Birds | Raw `BotView` | Digest | Ratio |
|---|---|---|---|---|
| bot-1 (Sabungero Syndicate) | 19 | ~5,900 tok | **692 tok** | 8.5× |
| bot-14 (Sugalan Social Club) | 100 | ~24,500 tok | **866 tok** | 28.3× |

**The view grows with the barn; the digest barely does.** Five times the birds costs 174 more tokens, because `LIMITS` caps each list and the caps are what make the cost of a barn-day independent of how rich the stable got. A world where every stable ends at a hundred birds costs the same to think about as one where they end at twenty.

At ~200 tok/s, the raw view for a big barn would take **about two minutes to read** — per barn, per day. Nineteen of those is a 38-minute game-day. The digest makes it about five seconds each.

---

## Phase 2: the barns become Rivet Actors

Phase 1's brain was a function the sim called. Phase 2 moves it into a **Rivet Actor** — a durable, addressable correspondent (`src/actors/barn.ts`). The sim mails a barn its morning view; the barn thinks (the Ollama call now lives inside the actor) and mails back intentions. `--actors` on any brains-on run.

**The gate run:** a full game-week, four barns, every decision through actors — days 66–72 of the seed-1 world.

| | Result |
|---|---|
| Actor calls | 28, **0 failures** |
| Doctor | 0 warnings · **0 invariant failures** |
| Careers | all four barns: 7 days played, read back from durable state |
| Wall clock | 42.9 s/day (a much richer world than the phase-1 test: 117–289 fights/day) |
| Actor overhead | ≈ none — 1 barn direct 13.7 s/day (phase 1) vs ~11 s/day through an actor |

**What `bun add rivetkit` actually installs.** The entire Rivet Engine — a native Rust binary that self-starts on `127.0.0.1:6420`, keeps its state in `~/.rivetkit/var/engine/db`, and **outlives the process that spawned it** (it is a daemon; `registry.shutdown()` drains your envoy but leaves the engine running). "Self-hosted agent infra" turned out to mean one package install and zero configuration.

**The career is the demo.** A barn actor's state is what the barn knows about *itself* — days played, actions proposed and dropped, seconds spent thinking — never game state, which the world database owns alone. Measured surviving: a sim process restart (2 → 4 days played across two runs), and then a full engine-daemon restart (state reloaded from disk, career continued). The mailbox outlives the mailman, the letters, and the post office being rebuilt.

### Field notes, phase 2

1. **`start()` vs `startAndWait()` — the gap wedges actors forever.** `registry.start()` returns before the envoy registers with the engine. An actor whose first message arrives in that gap gets *created* but bound to no pool — and because actor records are durable, it stays unstartable in every later run. Durable state means durable mistakes: in a stateless system a botched create vanishes at restart; here it was faithfully preserved. (Second lesson, same shape: deleting the engine's RocksDB store while a live daemon held it open let the daemon's shutdown flush resurrect the corruption. Kill the process, *then* clear the store.)
2. **The rebind window: reused actors bounce, fresh ones don't.** An actor created by a previous sim process stays bound to that process's dead envoy for ~30–40s after a new process registers its own. A `takeTurn` sent in that window fails `no_envoys`; the same actor answers fine a minute later. Fresh actors never hit it. The fix is a retry in `barnDecider` — which is also just what mailing a durable correspondent *is*: a bounced letter gets resent; it does not mean the recipient died.
3. **A long-lived engine daemon degrades.** After several registry generations (sim runs) against one daemon, old actors stopped rebinding at all — three retries over two minutes, nothing. A daemon restart with the *same* persisted store rebound them on the first retry. Recipe for now: restart the engine between sessions if `no_envoys` persists. Worth raising with the Rivet folks — this is serverful-mode wake-after-owner-drain, exercised harder than a dev loop usually would.
4. **The decider seam paid for itself.** `--actors` swaps in a different `BotDecider`; `collectProposals`, the engine, and the tests are untouched. Direct-Ollama vs actor-routed differ in exactly one constructor call, so the A/B stays honest by construction — same discipline as the one-line model swap.
5. **The failure path costs 3× the success path.** A wedged barn burned ~30 s/day (the engine's ready-timeout) to accomplish nothing; a healthy one thinks for ~11 s. Budgets should assume failures are *slower* than successes, not free.

### Snapshots: skip the deterministic runway (Zane's idea)

The first 48 days of a seeded world replay identically every time — simulating them again buys nothing. So bank the world once and fork it per experiment:

```bash
bun run simulate 48 --seed=1                 # build the runway once (~45s)
sqlite3 data/<that db> "PRAGMA wal_checkpoint(TRUNCATE);"
cp data/<that db> data/snapshots/day48-seed1.db
bun run simulate 7 --from=data/snapshots/day48-seed1.db --brain=qwen3:14b --llm=4 --actors
```

`--from` copies the snapshot to a fresh timestamped db and plays on; the snapshot is never written. Day 49 is where the population and fight volume start compounding (week 7 — past the retirement trough), so experiments begin at the interesting part. Keep the roster identical across worlds you mean to compare. One trap, found the hard way: a stale `-wal` file beside the target path gets replayed over the fresh copy and silently resurrects whatever world it belonged to — the fork clears sidecars first.

## The 14-day run, and the paper trail (`brain_log`)

The decisions used to print to the terminal and vanish. Now every brains-on run writes a **`brain_log`** row per barn per game-day — brief size, everything proposed, everything dropped with reasons, decide time — so a long run can be *studied*: which decisions followed which context. (Telemetry like `sim_timings`; `worldhash` skips it.)

```sql
SELECT day_index, farm_id, brief_tokens, proposed_json FROM brain_log ORDER BY 1;
```

**The run:** 14 game-days × 4 barns, forked from the day-48 snapshot, all decisions through actors. 56 actor calls, **0 failures** (fresh keys + fresh daemon + the retry — the reliability recipe holds). 8:16 wall clock, 34.7 s/day of it brains. 0 warnings, 0 invariant failures. Aggregates: mean brief **590 tokens**, mean decide **21.8 s**, 258 actions proposed, 22 dropped — every single drop the same known gap (`enter` with no bird; the per-verb `oneOf` schema fix is still untried and is now measurably the #1 quality lever).

**The finding — parity with the scripted bots.** At the day-48 fork the four stables ranked **4, 5, 7, 8** of 19 on GP; after two llm-played weeks they rank **4, 5, 6, 7**, and their GP gains (+10.3k–12.6k) sit inside the scripted pack's range. Unlike phase 1's caveat-laden rank (a rich barn plus one llm week), this is a clean read: identical scripted history for all 19, then 14 days of model play. **A general 14B holding position against purpose-written TS logic at its own game — nobody taught it the meta; it read a 15-line system prompt.** The next honest question is whether it can *gain* ground (strategy, memory, `tune` — phase 3 territory), and `brain_log` is the instrument that will answer it.

## Phase 3: `tune` — reaching into a running world

The barn's durable state grew its first *strategy*: **standing orders**, set by a second action on the actor, folded into the next morning's prompt (after the house rules, marked as outranking them). `bun run tune <farm> "<orders>"` from any terminal, any time — including while a sim is mid-run in another one.

**The live demo, measured.** During an 8-day run, after day 51's turn, from a second process:

```bash
bun run tune bot-3 "STOP entering fights entirely. Do not use the enter action at all. …"
```

The world never paused, nothing restarted, and `brain_log` shows the break exactly where the tune landed:

| bot-3's day | 49 | 50 | 51 | ← tune → | 52 | 53 | 54 | 55 |
|---|---|---|---|---|---|---|---|---|
| `enter` actions | 3 | 3 | 3 | | **0** | **0** | **0** | **0** |

The mid-run call bound on the **first attempt** — the actor was live on the sim's envoy, so no rebind window. (Tuning a *cold* barn after its sim exits is the flaky path — it walks straight into the rebind window and, under an aged daemon, the no-rebind bug. Prefer tuning live worlds; restart the daemon otherwise.)

This is the moment the sim stops being a batch job: nineteen barns with different standing orders are nineteen *different players*, and an operator — or another agent — can coach any of them mid-season without touching the engine.

**Same run: the per-verb schema paid off in full.** `RESPONSE_SCHEMA` became an `anyOf` with one branch per verb, so "`bird` is required when `do` is `enter`" is finally sayable — that whole failure class became *unrepresentable at generation time* instead of dropped at translation time. The 14-day run dropped 22 of 258 actions, every one a birdless `enter`; this run: **32 calls, 152 proposed, 0 dropped.** The #1 measured quality lever, closed by making the invalid shape impossible to emit.

## Phase 4: the full fleet, and the night the world fell over

Phase 4's design splits skill into two loops: the **player** (a local model, in the tick, 14+ wakes a day) and the **coach** (a big model, out of the tick, reading `brain_log` and writing standing orders via `tune` — see `COACHING.md`). The personas (`src/actors/personas.ts`, `--personas`) are the coach's opening move made automatic: each llm barn starts under its scripted twin's house creed. **Goals port over; decision logic does not** — the scripted knobs (entryRate 0.85, claimAggression 0.75…) stay un-ported so the A/B measures brains, not imitations.

### The flagship run: 19 barns × 7 days, and two new failure modes

The first full-fleet week (qwen3:14b, days 57–63) died at its 30-minute cap on the final day, and taught more by failing than a clean run would have:

1. **The 64 KB letter slot.** bot-14 — a whale sitting on a 100-bird barn — bounced out of *every single day* with `incoming_too_long`. The raw `BotView` crosses the wire to the actor (the digest happens inside, in the decider), and a 100-bird view is ~100 KB against rivetkit's default 64 KB incoming-message limit. This failure is retry-proof: the payload is the same size every attempt. **Fix:** `maxIncomingMessageSize: 8 MB` on the registry. The lesson generalizes: the digest saved *inference* cost, but the un-digested view still had to fit through the actor's front door.
2. **The wake stampede.** Barns sleep between game-days; every morning all 19 wake at once on a machine Ollama has already pinned. The engine gives an actor 5 s to answer its wake signal — and on days 59–60 that deadline missed en masse (fleet collapsed to 8/19 answering, all wake-signal or cascading HTTP timeouts, actor generations climbing 4→6 as they thrashed). **Fix:** `noSleep: true` — a barn's whole life is one sim run; the envoy drain retires it — plus "wake signal" in the retry regex for the stragglers.

The run itself became the **baseline arm by accident** (the launch command dropped `--personas`; the actors confirmed "standing orders: none"). Baselines are cheap to acquire when you make them by mistake.

### qwen3:30b-a3b: the MoE pays out double

| Model | Disk | Warm decode | 19-barn fleet | s/day |
|---|---|---|---|---|
| qwen3:14b (dense) | 9.3 GB | 28.0 tok/s | 19/19 after timeout fix | **102.8** |
| qwen3:30b-a3b (MoE) | 18.6 GB | **63.7 tok/s** | 38 calls, **0 failures** | **51.3** |

Twice the parameters on disk, half the wall clock: a mixture-of-experts model stores 30B weights but activates ~3B per token, so it *reads* like a big model and *streams* like a small one — decode is bandwidth ÷ **active** bytes, not total bytes. Prefill is nearly free warm (KV-cached). A full-fleet 92-day world drops from ~2.6 hours to **~1.3 hours**.

### First persona fingerprints (2-day burst, day 49–50)

- The world's only two `buy_land` proposals came from bot-11 and bot-13 — **the two landlords**. bot-13 also staked.
- bot-14, a whale with 11,405 GP, rolled the gacha. bot-10, a whale with **159 GP**, thought for 25–55 s and returned an empty day — which is the creed ("buy while GP stays above the reserve") being read *correctly enough to abstain*. Orders are goals, and a broke whale honoring its reserve is the goal working.

## The 10v10 experiments (round 53–55): coaching, measured three times

Three back-to-back 91-day worlds, 10 scripted vs 10 llm barns
(qwen3:30b-a3b), coach sessions at days 28/56, full records in `runs/`.
Each experiment started with everything the previous one taught.

| Measure | Exp1 | Exp2 | Exp3 | Exp4 | Exp5 | Exp6 | Exp7 |
|---|---|---|---|---|---|---|---|
| llm avg net worth | 61,343 | 69,905 | **70,419** | 65,542 | 53,235 | 50,129 | 54,078 |
| llm/scripted ratio | 0.48 | 0.58 | **0.59** | 0.52 | 0.43 | 0.40 | 0.44 |
| llm crowns | 0 | 6 | **12 — every barn ≥1** | 6 | 7 | 6 | 5 |
| llm fights | ~1,700 | ~1,780 | 1,711 | **2,460** | 1,053 | 1,253 | 1,978 |
| llm juvenile fights | 0 | 0 | 0 | 0 | 0 | 0 | **568** |

Exp4 is the arc's honest negative result: the bird-by-bird checklist bought
record volume and LOST ground — entry fees scale with entries, purses scale
with winning, and at 5.5 birds average depth the margin goes negative.
Roster depth is the binding constraint; exp3 stands as the high-water mark.

Exp5 (the instrument round: juvenile crown visibility, weekLedger margin
feedback, blade-fit + cull laws, the retire verb) regressed to 0.43 and
earned two lessons at once: **caution without volume is worse than volume
without depth** (the margin law halved fights to 1,053, and land + purses
halved with them), and **instrument gap #4 — the mode word**: age-1 birds
may only fight `mode:"juvenile"`, nothing ever said so, so llm chicks
logged 0 juvenile fights against the scripted side's 6,214 and the
juvenile crowns stayed locked. Its real wins: the retire→breed loop ran
(87 bred — a record — 18 culls), and attempt 2 was infrastructure-clean.
Exp6 baked in the mode law, week-1 breeding, a volume floor, and the
endgame veteran law — and landed at 0.40 with the juvenile door STILL shut:
**instrument gap #5**, the response schema's `enter` mode enum lacked
"juvenile", so the ordered word was unrepresentable at generation time
(125 proposals, zero legal — fixed round 59). Five gaps, one law: facts,
verbs, field values, defaults, and prompt must all agree, because the model
can only play the game its pipe can carry. Exp6's lasting contribution is
the meta-finding: across six experiments the GOAL_PREAMBLE has set identity
but has NEVER initiated a multi-step season plan — every behavior chain
(retire→breed, cull rhythm) started only after a coach session issued it as
a blunt dated order. **Coaching is the executive function**; standing text
decays into wallpaper — and exp7 proved the mechanism by A/B: identical
season-plan content was inert as exp6's preamble and immediately effective
as exp7's blunt day-2 dated orders through the SAME standing-orders field.
The channel was never the variable; wording specificity is. (Production implication for the world actor: a
scheduled coach tick, or re-delivering the season plan as fresh daily
orders.) Two instrument rounds both lost ground to exp3's simple laws. Exp7 (mode
enum open + day-2 orders + gap #6, the naming law, fixed at day 56) ran
the full discovery loop end to end for the first time — 568 juvenile
fights across both generations, 20 juvenile crown entries, 1,260 LT of
juvenile land — and still finished 0.44: the age-9 cliff against 46
bred/season is the whole remaining gap (17 vs 377 end actives). The pipe
law's final tally is six layers: facts, capacity, verbs, defaults, legal
field values, and engine-assumed chores (christening). Next lever: breeding
volume (exp8); if depth still can't keep pace, the wall is the ~5-action
gait — a model-capability question, answered with a bigger model.

What three experiments established, one lesson each:

1. **Exp1 — a coach cannot fix a fact-gap.** The crown order went 0-for-560
   while the brief carried no tournament facts; the day-56 instrument fix
   produced 28 real declarations within one segment. Facts in the brief,
   skill in the standing orders — now proven in both directions.
2. **Exp2 — lessons compound.** Crown-sighted from day 1 + the three-law
   preamble: first llm championships (six), a real breeding pipeline after
   one pointed coach session, ratio +10 points.
3. **Exp3 — the model has a gait.** With every instrument ceiling lifted
   (fighter window 24, reply budget 1400), the 30b still proposes ~5
   actions/day where scripted logic writes 20+. Volume is now a
   model-capability question, not an instrument one — and crown brackets
   force-retire losers, so shallow rosters pay double. Exp4 levers filed in
   the postmortem.

Operational finds along the way: the cold-tune wedge is POSITIONAL (the
first actor called after a daemon generation change wedges once; the rest
bind) — a tighter repro signature for the rivetkit issue. And two host
SIGTERMs mid-run cost nothing: `--keep` resumed from the last committed
day with actor orders intact — durable state doing exactly what it's for.

## Findings (phase 1)

### 1. It was never a context-window problem

The digest exists because a `BotView` is "too big to hand a model" — that was the working assumption, and measured, **it is wrong as stated.** 24,500 tokens fits comfortably in this model's window. It is not a *limit* problem, it is a *time* problem: reading it costs two minutes at 200 tok/s.

Worth being precise about, because the two have different fixes. A limit problem is solved by a bigger window or a bigger model. A time problem is solved by sending less — and sending less is cheap, portable, and helps every model including the ones with room to spare.

### 2. Prompt-eval cost is the thing to optimize, and it is barely started

Everything in `digest()` today is *selection* — take the top 12 fighters, the top 6 hens. Nothing yet is *compression*. Obvious next moves, none of them tried:

- **The brief repeats its own keys.** JSON pays for `"bestBlade"` once per bird; a header-plus-rows table pays once per brief. Probably 30–40% off the fighters block alone.
- **Most of the brief does not change between days.** Farm identity, barn size, the stud list. If the provider ever caches prompt prefixes, ordering the brief stable-part-first turns most of the read into a cache hit — and the ordering is free to do now, before it pays.
- **The card is described five times over.** `cardTonight` lists every open key; a barn only cares about the ones matching a bird it owns.

### 3. The model is fine at the game and bad at ambiguity

Given a well-formed brief it proposes 8–10 sensible actions: check in, roll the free pulls, enter its best fighters at the blade the scout points to, list retired roosters at stud. It does not need to be told the strategy.

What broke it was **an ambiguous namespace, and that was our fault, not its.** Bird handles were `b1, b2, b3…` and the five blade formats in this game are named `b1`–`b5`. The brief handed the model `"format":"b1"` and `"id":"b1"` in the same JSON object.

On an opening-week day when every bird was still an egg and the fighters list was empty, it reached for the only `b` tokens on the page and proposed entering the *formats* as birds. Five dropped actions reading `unknown bird b1` — with a `b1` sitting right there in the prompt.

**An identifier invented for a prompt must not share a namespace with one the domain already uses.** Handles are `#1, #2` now. Zero handle errors since.

### 4. An empty list invites invention

The same incident says something more general. Asked to act with an empty `fighters` list, the model did not answer "nothing to do" — it found the nearest plausible tokens and used them. **Absence reads as a gap to fill.** Where a brief can legitimately be empty, it is probably worth saying so in words (`"fighters": []` plus a `"note": "no birds are old enough to fight yet"`) rather than letting an empty array speak for itself. Untested; worth an experiment.

### 5. A schema constrains shape, never sense

Ollama's `format` parameter genuinely works — every reply was valid JSON matching the schema, with no parsing and no retries. But a flat schema cannot say *"`bird` is required when `do` is `enter`"*, so three actions arrived as well-formed `enter`s with no bird at all. A per-verb `oneOf` would close it. **Structured output removes the parsing problem completely and the correctness problem not at all.**

### 6. The database decided the architecture

The tick runs inside one synchronous `better-sqlite3` transaction because GP conservation only holds across a whole day. An `await` cannot go in there. That single fact forced **collect-then-apply** — gather every barn's intent outside the transaction, apply it inside — which turns out to be the right shape for three unrelated reasons:

- it is the only way to hold the conservation proof while a decider is slow;
- it makes the wakes cluster, which is what makes the model load once;
- and it means **the engine cannot tell a bot from a human**, since both are now just an actor that received "your turn" and mailed an action back.

An architecture arrived at from a database constraint, and it is the same architecture the actor model would have suggested.

### 7. The fault tolerance was already there

`quietly()` — swallow the refusal, take no for an answer, carry on — was written for scripted bots long before any model existed. It is exactly what makes an unreliable decider safe: a model proposing a breed it cannot afford is refused at the same door a bot is. **We had built the safety net years before the thing that needed it.**

### 8. Fixed order, not proposal order

Actions are sorted into a canonical sequence before being applied. A model that lists its day back-to-front should not get a worse day than one that happens to list it correctly — and a model that discovers it can reorder its way into an advantage has found a bug, not a strategy.

---

## Open questions

- ✅ **Does concurrency help?** Yes — 4 barns cost 2.0× one barn, not 4×. Measured above. What is *not* measured is where it stops: `OLLAMA_NUM_PARALLEL` has a default ceiling, and somewhere past it the batch turns into a queue and the marginal barn goes back to full price. Finding that knee is the next measurement, and it sets the real cost of a full llm world.
- **How small can the model go?** 14B was chosen to get it working, not because the task needs it. Choosing one action from a typed menu given a brief may well be an 8B task, and 8B halves the read.
- **Does a bigger model play better, or just slower?** 32B and 70B both fit in 64 GB. Untested.
- **What does a barn's memory do to the brief?** Nothing carries between days yet. Memory and beliefs are the point of a per-barn actor, and they are also more tokens to read every single day — the first real tension between playing well and playing cheaply.
- **Is the local model actually worse here?** Unmeasured against a hosted model. The comparison is one environment variable away and is the experiment worth running.

---

## Method notes

- `bun run brain-bench [--model=] [--farm=] [--db=]` reads the newest sim database, prints raw-vs-digest size, and makes one real call to report Ollama's own load / prompt-eval / generation split. It writes nothing.
- The sim's `TIMING` block grew a **`brains`** line, reported separately from `tickMs` on purpose: folding inference latency into the engine's ms/fight would make every number in `PERFORMANCE.md` incomparable the day a model arrived.
- Token counts are `chars / 3.5`, a rule of thumb for dense JSON. Rough, deliberately — the interesting figure is the *ratio*, which survives any reasonable estimate.
- Barn size varies enormously by house style (19 birds to 100 in the same world), so quote which farm a measurement came from. `bot-1` is a mid-sized stable and `bot-14` is the largest.
