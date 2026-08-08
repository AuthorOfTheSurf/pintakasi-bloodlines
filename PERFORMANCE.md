# Simulation performance — state of play and where to dig next

Written at the end of round 43, updated in round 44. Everything below is
MEASURED unless it says otherwise; re-measure before trusting any of it two
rounds from now.

## The headline numbers (M-series Mac, one core)

| Run | Wall clock | ms/fight |
|---|---|---|
| 91 days, round-42 code | 306s | 21.3 |
| 91 days, after round 43 | ~110s | 7.5 |
| 112 days, after round 43 | 241s | 8.3 |
| 182 days, after round 43 | 3,087s (51 min) | 21.3 |
| **112 days, after round 44** | **164s** | **5.5** |
| **182 days, after round 44** | **812s (13.5 min)** | **5.25** |

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

## Where the remaining time goes (112-day profile, round 44, ~163s total)

| Phase | cost | share | What it is |
|---|---|---|---|
| tick: lobbies.resolve | 40.3s | 25% | the fights going off: per-fight bird/farm reads, settle-up, battle_log + book writes |
| bots "3b crowns" | 32.7s | 20% | crown chase; ~2/3 of it is thrown/refused `Tournaments.enter` attempts (committee evaluations on full fields are genuine work now) |
| bots "3 breeding" | 17.2s | 11% | the round-43 batched browse — already fixed once |
| bots "5 carding" | 15.0s | 9% | `weatherCardsToday` + `pickOffering` + `enter` |
| bots "4 liquidity" | 11.4s | 7% | odd-lobby filling |
| bots "1 ritual" | 10.7s | 7% | check-in, gacha rolls, barn expansion, staking |
| bots "6 claims" | 9.9s | 6% | claimer-field shopping (builds real cards) |
| doctor | 5.2s | 3% | once per run |

## Candidate directions, in EV order

1. **Batch `Lobbies.resolve`** — now the single biggest block. Each fight
   re-selects both bird rows and both farm rows, updates them one statement
   at a time, and a group of four birds fighting three rounds re-reads the
   same rows per round. One read per lobby (the rows are already in hand at
   deal time) plus grouped writes is the same shape as the breeding fix.
2. **The crown chase's refusal bill.** The remaining throwers are committee
   refusals on full fields — real bump-line evaluations, now book-fed, but
   still one sort + three reads per attempt, re-run nightly per rejected
   barn. A per-(tournament, day) memo of the current weakest would cut most
   of it; invalidate on any entry/bump to that tournament.
3. **Threading.** The tick is one SQLite transaction, so in-tick parallelism
   is hard; the honest split is coarser — fight resolution batches, or the
   doctor off-thread. Measure what's parallelizable first.
4. **Fight volume itself — Zane's note, verbatim policy.** If profiling shows
   the fights (resolve + their settle-up reads) are a big share of a late day,
   **reconsider multi-fight lobbies**: the round-34 group stage 3×'d the
   number of fights per entry. Round-44 status: resolve is 25% of the run —
   the largest single block, but Zane read the round-43 numbers and ruled
   "doesn't seem to be the multi-fight lobbies"; direction (1) should come
   first since it attacks the same seconds without touching game design.
5. ~~Re-run 182 days~~ — DONE (see headline table): 812s, ms/fight flat at
   ~5 across all 26 weeks. The dev default stays 112 (Zane's ruling: <3 min
   is right for iteration); 182 is now a ~14-minute judgement run. Late days
   cost ~13–17s each purely from fight volume, so directions (1) and (2)
   above are what would shrink the long run further.

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
- Fresh worlds only for comparisons; `--keep` re-seeds farms mid-world.
- Real-player worlds could be bigger than 20 farms; the target should be set
  from the sim_timings curve, not from wishing.
