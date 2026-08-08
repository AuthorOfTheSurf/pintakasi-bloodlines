# Simulation performance — state of play and where to dig next

Written at the end of round 43 for whoever picks this up. Everything below is
MEASURED unless it says otherwise; re-measure before trusting any of it two
rounds from now.

## The headline numbers (round 43, M-series Mac, one core)

| Run | Wall clock | ms/fight |
|---|---|---|
| 91 days, round-42 code | 306s | 21.3 |
| 91 days, after round 43 | ~110s | 7.5 |
| 112 days (the new default) | 241s | 8.3 |
| 182 days | 3,087s (51 min) | 21.3 |

The last two rows are the story: **per-fight cost triples across a long run**
(11 → 34 ms/fight comparing week 3 to week 25 of the 182-day world). The world
grows and each unit of work also gets dearer. Totals mislead; compare
ms/fight, and compare runs only under the same `--seed`.

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
  (`determinism.test.ts` pins this, but only through day 15).
- For attribution inside the tick, the round-43 method was crude and worked:
  a temporary `__prof` accumulator in bots.ts keyed by playFarm step, dumped
  at the end of the run. Bun 1.2's `--cpu-prof` silently does nothing.

## What has already been taken (don't re-dig these)

- **Round 35**: indexes (there were none), `seedWorld`.
- **Round 43, stage 1**: `chaseCrowns` full-table scan → SQL; `naming` full
  scans → indexed probes; `Lobbies.board()` grew `detail` levels so the bots'
  liquidity pass stopped building full entry cards (with per-card career
  scans) it only read `filled`/`fee` from; `viewLobby` N+1; doctor
  single-pass rewrites; `committeeCards` batched.
- **Round 43, breeding batch** (the big one, commit `8c8043f`): `browseStuds`
  ran ~30 queries per (hen, stud) pair — farm row, children-of-father,
  per-ancestor pedigree walk. Now three batched reads per browse. This alone
  halved the 91-day run. The pedigree walk and kinship verdict live once in
  `ancestorsVia`/`kinVerdict`, parametrised over where parent rows come from.

## Where the remaining time goes (91-day profile, post-breeding-fix era)

From the round-43 phase profile (numbers are the pre-fix run, 218s total,
minus breeding's 107s — shares will have shifted, re-profile first):

| Phase | ~cost then | What it is |
|---|---|---|
| bots "5 carding" | 28.5s | per-bird `weatherCardsToday` + `pickOffering` + `Lobbies.enter` |
| tick: lobbies.resolve | 17.5s | the fights themselves going off |
| bots "3b crowns" | 14.9s | `chaseCrowns`/`chaseJuvenileCrowns`, daily |
| bots "4 liquidity" | 12.8s | odd-lobby filling, `enter` attempts |
| bots "1 ritual" | 10.2s | check-in, gacha rolls, stud listing, staking |
| scoutScores (within) | 5.3s | per-bird career reads |
| pickOffering (within) | 5.4s | chooser logic |

## The structural problem, and the candidate fixes

**Work per day ≈ birds × career length, and both rise all run.** The scout
(`scoutReport`/`scoutScores`/`formatRecords`) re-reads a bird's whole
`battle_log` history for every carding decision, every day. Careers only get
longer, so per-fight cost grows without bound. Indexes made each read cheap;
nothing makes them fewer or smaller.

1. **Incremental per-bird aggregates** (the likely big one). What the scout
   and the class ladder actually consume is per-(bird, format) sums: fights,
   wins, figure totals, last-N form. Maintain those on a table updated at
   settle-up instead of re-deriving from raw logs. This is a schema change
   (worlds remake, per house rules) and touches the round-28 fog carefully —
   the aggregate must contain only what a player could see. Expected effect:
   flattens the 11→34 ms/fight growth curve, which is worth more than any
   constant-factor win.
2. **Threading** (Zane has raised it). The tick is one SQLite transaction, so
   in-tick parallelism is hard; the honest split is coarser — e.g. fight
   resolution batches, or running the doctor/report off-thread. Measure how
   much of a late day is actually parallelizable before building anything.
3. **`Lobbies.enter` and the carding loop.** Each entry pays eligibility +
   card-cap checks (indexed but numerous) and the per-bird chooser. At 2,300
   fights/day the enter path runs tens of thousands of small queries. Batching
   the per-bird reads for a barn's whole roster (one query per barn instead of
   one per bird) is the same shape as the breeding fix.
4. **Fight volume itself — Zane's note, verbatim policy.** If profiling shows
   the fights (resolve + their settle-up reads) are a big share of a late day,
   **reconsider multi-fight lobbies**: the round-34 group stage 3×'d the
   number of fights per entry (one entry = up to 3 fights). That was a game
   design win bought at simulation cost; Zane is open to revisiting the
   trade. Get the number first — at the 91-day profile, resolve was ~8% of
   the run, which did NOT justify it; at day 170+ of a 182-day world nobody
   has measured the share yet.
5. **The doctor at scale.** 24s at 182 days (was 2.3s at 91) — same
   superlinear shape. Low priority (it runs once), but the same aggregate
   table from (1) would feed it nearly for free.

## Traps for the next round

- A "pure" speed change that shifts rng consumption rewrites the world —
  shuffles draw per element, so hoisting one out of a loop changes every
  later decision. Same seed + zero-diff event logs is the acceptance test.
- Bird ids are `randomUUID()` and NOT seeded. Any new ordering, Map
  iteration, or tie-break that touches them is a determinism bug.
- Fresh worlds only for comparisons; `--keep` re-seeds farms mid-world.
- The 1-hour 182-day run is the *known* cost of the current design at 20
  farms. Real-player worlds could be bigger; the target should be set from
  the sim_timings curve, not from wishing.
