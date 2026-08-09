# Simulation performance — state of play and where to dig next

Written at the end of round 43, updated in rounds 44 and 47. Everything below
is MEASURED unless it says otherwise; re-measure before trusting any of it two
rounds from now.

## The headline numbers (M-series Mac, one core)

| Run | Wall clock | ms/fight |
|---|---|---|
| 91 days, round-42 code | 306s | 21.3 |
| 91 days, after round 43 | ~110s | 7.5 |
| 112 days, after round 43 | 241s | 8.3 |
| 182 days, after round 43 | 3,087s (51 min) | 21.3 |
| 112 days, after round 44 | 164s | 5.5 |
| 182 days, after round 44 | 812s (13.5 min) | 5.25 |
| **112 days, after round 47** | **2:11 (131s)** | **4.48** |
| **182 days, after round 47** | **9:58 (598s)** | **4.10** |

(Wall clocks print as m:ss since round 47 — Zane's ask — so the table follows.
The 182-day ms/fight now sits BELOW the 112-day figure: the bump-line memo
below earns most of its keep in the back half of a long run, when the Major
fields are full every week and refusals dominate the crown chase.)

The round-43 182-day row is the story round 44 attacked: **per-fight cost
tripled across a long run** (11 → 34 ms/fight comparing week 3 to week 25)
because the scout re-read whole careers per decision. Round 44 replaced the
career scans with an incremental book (below), and the 182-day re-run
confirms the superlinearity is gone: **ms/fight is flat at ~5 from week 1
through week 26** (seed 1, 149,779 fights, doctor clean). Per-day wall clock
still grows — 0.9s/day around week 3 to ~13s/day at week 24 — but that is
fight VOLUME (963 → ~33,000 fights per fortnight as the population compounds
to ~6,300 birds), not per-fight cost. Totals mislead; compare ms/fight, and
compare runs only under the same `--seed`.

## How to measure (do this before optimizing anything)

- `bun run simulate` prints a `TIMING` block (per-phase, slowest days,
  ms/fight) and a per-day suffix on every day line.
- Every run writes per-day wall-clock into the **`sim_timings`** table;
  /admin charts it (Charts tab, "Sim cost per day"). One query graphs any run:
  `SELECT day_index, ms FROM sim_timings ORDER BY 1`.
- **`--seed` is mandatory for A/B**, and seeding is necessary but not
  sufficient — round 43 found the committee tie-breaking on `randomUUID()`,
  which un-pinned every bracket for eight rounds. Before trusting a "matched
  worlds" comparison, run the same seed twice and diff the event logs to zero
  (`determinism.test.ts` pins this, but only through day 15). Bird ids are
  unseeded UUIDs, so normalize them by first-appearance order before diffing
  two separate processes' logs.
- For attribution inside the tick, the round-43/44 method was crude and
  worked: a temporary `__prof` accumulator keyed by playFarm step / runTick
  phase, dumped at the end of the run. Bun 1.2's `--cpu-prof` silently does
  nothing. ⚠ A naive `__time(label, fn)` wrapper loses every call that
  THROWS — round 44's crown-chase cost hid there; use try/finally if the
  path being measured throws by design.

## What has already been taken (don't re-dig these)

- **Round 35**: indexes (there were none), `seedWorld`.
- **Round 43, stage 1**: `chaseCrowns` full-table scan → SQL; `naming` full
  scans → indexed probes; `Lobbies.board()` grew `detail` levels so the bots'
  liquidity pass stopped building full entry cards; `viewLobby` N+1; doctor
  single-pass rewrites; `committeeCards` batched.
- **Round 43, breeding batch** (commit `8c8043f`): `browseStuds` ran ~30
  queries per (hen, stud) pair — now three batched reads per browse. This
  alone halved the 91-day run.
- **Round 44, the scout's running book** (`bird_form`): per-(bird, blade)
  sums of battle_log, advanced by `recordFight` (the ONLY door a battle_log
  row may enter through) in the same transaction as the log insert.
  `formatRecords`/`scoutReport` became one keyed ≤5-row read instead of two
  whole-career scans per decision per day; `committeeCards` reads the same
  book (its `earn_cents` column) instead of re-grouping battle_log on every
  full-field entry attempt. Guarded by the doctor's ninth invariant
  ("scout book matches the log"), which recomputes the book from the log
  every run — a new insert site that bypasses `recordFight` fails loudly.
  Bit-identical by construction: same-seed event logs diff to zero against
  the pre-book engine (proven over 35 days, 17,494 lines).
- **Round 44, the lazy confirmation view** — the single biggest win, and it
  was one line of shape: `Lobbies.enter()` built a full LobbyView receipt
  that the bots immediately `void`ed — **21% of the entire 112-day run**
  (45.7s of 217s) spent rendering a value nobody read. It is a getter now:
  the API routes still serialize their receipt, the bots never trigger the
  build.
- **Round 44, batched roster reads + skip-the-seated**: `scoutReports(ids)`
  reads a whole roster's book in one query (carding loop, crown chase,
  auto-play); the crown chasers skip birds already holding a week's seat
  instead of paying a thrown "already registered" per bird per blade per day
  — with the skip set REFRESHED after every successful entry, because our own
  entry can bump our own weakest bird back off the pending list (a stale
  snapshot silently un-declares it; the seed-7 diff caught exactly this).
- **Round 47, the settle-up ledger** (`SettleLedger` in lobbies.ts): resolving
  a fight used to re-SELECT both bird rows and both farm rows and write every
  increment as its own UPDATE — ~10 statements per fight on what was the
  largest remaining block (25% of a 112-day run). `complete()` now reads each
  lobby's birds once and all ~20 farms once per pass, applies every mutation
  (records, cent-carry credits, refunds, land, claim transfers) to the cached
  rows in the original order, and flushes one UPDATE per dirty row. None of
  the replaced statements emitted events, so the event stream is untouched.
  Proven bit-identical: seed-1 event logs (17,602 lines over 35 days) and
  final farm/bird tables diff to zero against the per-statement engine.
  Worth ~0.99 ms/fight of the round's 1.14 at 112 days. The group deal in
  `close()` also batched (one UPDATE per group, not per entry).
- **Round 47, the bump-line memo**: a refused Major entry — the COMMON case,
  ~124 declarations chasing 96 seats, re-attempted daily — re-priced the whole
  committee book (cards for 32 incumbents + newcomer, then a sort) just to
  rediscover the same weakest bird. Refusals now memoize the weakest per
  (world, tournament), valid only while provably fresh: same day, no fight
  recorded and no purse settled since (`bookVersion` in scout.ts), and no
  entry inserted or bumped (every insert deletes the memo). A memo hit prices
  only the newcomer's own card; anything that might BUMP falls through to the
  live read, so seating decisions never ride the cache. ~0.15 ms/fight at 112
  days, more at 182 (fields are full longer). Guarded by a staleness test in
  tournaments.test.ts.

## Where the remaining time goes

⚠ The per-phase table below is the ROUND-44 profile (112 days, ~163s total).
Round 47 took its top two rows (resolve and the crown chase's refusal bill)
but did not re-profile the split — re-run the `__prof` method before trusting
these shares for the next dig. What certainly remains per fight: the
battle_log insert + bird_form upsert (`recordFight`) and the fight event's
insert (plus `emit`'s one-row gameState read), and per entry the escrow
debit and entry insert on the way in.

| Phase | cost | share | What it is |
|---|---|---|---|
| tick: lobbies.resolve | 40.3s | 25% | **taken in round 47** (the settle-up ledger) — what's left is recordFight + the fight event |
| bots "3b crowns" | 32.7s | 20% | crown chase; the refusal bill **taken in round 47** (bump-line memo); the skip-the-seated scan and entry preamble remain |
| bots "3 breeding" | 17.2s | 11% | the round-43 batched browse — already fixed once |
| bots "5 carding" | 15.0s | 9% | `weatherCardsToday` + `pickOffering` + `enter` |
| bots "4 liquidity" | 11.4s | 7% | odd-lobby filling |
| bots "1 ritual" | 10.7s | 7% | check-in, gacha rolls, barn expansion, staking |
| bots "6 claims" | 9.9s | 6% | claimer-field shopping (builds real cards) |
| doctor | 5.2s | 3% | once per run |

## Candidate directions, in EV order

1. ~~Batch `Lobbies.resolve`~~ — DONE round 47 (the settle-up ledger; see
   above). 5.62 → 4.63 ms/fight on the seed-1 112-day A/B by itself.
2. ~~The crown chase's refusal bill~~ — DONE round 47 (the bump-line memo;
   see above). 4.63 → 4.48 ms/fight at 112 days, and the gap between the
   112- and 182-day ms/fight suggests more of its value lands late-run.
3. **Re-profile, then pick.** The round-44 phase table is now two rounds
   stale and its two biggest rows are gone; the next dig should start by
   re-running the `__prof` accumulator, not by trusting the table. Likely
   new leaders: carding/liquidity (board reads + `enter`'s per-entry
   escrow round-trips) and breeding's browse.
4. **Threading.** The tick is one SQLite transaction, so in-tick parallelism
   is hard; the honest split is coarser — fight resolution batches, or the
   doctor off-thread. Measure what's parallelizable first.
5. **Fight volume itself — Zane's note, verbatim policy.** If profiling shows
   the fights (resolve + their settle-up reads) are a big share of a late day,
   **reconsider multi-fight lobbies**: the round-34 group stage 3×'d the
   number of fights per entry. Round-47 status: resolve's per-fight overhead
   was more than halved without touching game design, and the 182-day run is
   under 10 minutes; the design question stays shelved.

## Traps for the next round

- A "pure" speed change that shifts rng consumption rewrites the world —
  shuffles draw per element, so hoisting one out of a loop changes every
  later decision. Same seed + zero-diff event logs is the acceptance test.
- Bird ids are `randomUUID()` and NOT seeded. Any new ordering, Map
  iteration, or tie-break that touches them is a determinism bug.
- **battle_log rows go through `engine/scout.ts` `recordFight`, never a bare
  insert** — the scout book must advance with the log or the ninth invariant
  fails the run. Test helpers included.
- **Sim databases from before round 44 have no `bird_form`**, so the doctor
  (and the scout) read them wrong — the invariant fails loudly. Old sim
  worlds are disposable by design; don't "fix" this with a backfill.
- `enter()`'s `.lobby` receipt is LAZY — it re-derives on access. Read it
  before mutating further if a snapshot reading matters.
- **Inside `Lobbies.complete()`, the DATABASE's farm and bird rows are stale**
  (round 47): mutations ride the settle-up ledger and only flush at the end
  of the pass (birds per lobby, farms once). New code inside the card must
  read and write the ledger, not the tables — a fresh SELECT mid-pass sees
  pre-fight balances, and a direct UPDATE gets overwritten by the flush.
- The bump-line memo's freshness rests on `recordFight` and `payPurse`
  bumping `bookVersion` — a NEW write site for committee-visible earnings
  (battle_log deltas or `gpWonCents`) must bump it too, or a same-day refusal
  can be judged against a dead seating order.
- Fresh worlds only for comparisons; `--keep` re-seeds farms mid-world.
- Real-player worlds could be bigger than 20 farms; the target should be set
  from the sim_timings curve, not from wishing.
