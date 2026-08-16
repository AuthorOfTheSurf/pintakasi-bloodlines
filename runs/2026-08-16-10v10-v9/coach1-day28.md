# Coach session #1 — day 28 (exp9, the options-brief season)

World `data/sim-20260816-1435.db` · gate: **PASSED, all five criteria** ·
no fail-fast.

## Scoreboard through day 28

```
scripted (10): total net worth 375,245 · avg 37,524 · crowns won 5
llm      (10): total net worth 344,820 · avg 34,482 · crowns won 3
```

**Ratio 0.92 — the previous day-28 arc record was 0.57 (exp8b).**
Pulang Bagwis is #5 in the WORLD, ahead of six scripted barns.

## The gate findings (pre-registered, spec §8)

1. **THE FIRST-LINK LAW BROKE.** Retire proposals began day 21 — the
   first day starter birds crossed the age-3 legality line, i.e. the
   first day the row could legally render — with no coach in existence.
   11 proposals that day, steady daily after. 51 llm retirements by
   day 28. Eight experiments of standing orders never produced ONE;
   a scored row on the bird produced them the day it appeared.
   **The first-link law was an interface artifact, not a model limit.**
2. **Eggs uncoached:** 19 bred by day 28 (exp8b: 0, deadlocked until
   coach #1's dated imperative).
3. **Juvenile economy uncoached:** 712 juvenile fights (exp8: 407),
   **91 juvenile crown entries and 2 juvenile CHAMPIONS** (exp8 at day
   28: 7 entries, 0 champions — the first champion in eight experiments
   didn't land until exp8's endgame). Plus 49 Major entries, 1 Major
   champion.
4. **EV capture, first reading: 78.6%** (1,321 of 1,680 picks took the
   bird's top-value row) · 53 explicit rests · 5 offMenu actions ·
   **11 dropped actions all segment** (exp8 measured hundreds).
5. Ratio 0.92 vs. the 0.38–0.59 arc band.

## The envoy bug, new evidence (segment-2 launch)

Seg2's first two launches crashed on wake of seg1's actors:
`actor_ready_timeout / no_envoys` — and the SAME actor id failed again
after a full daemon restart, which is the durable-lease variant. New
finding for the Rivet report: the crash site was the persona
re-application (`getOrCreate().tune()` at sim startup, scripts/simulate.ts
~line 271) — the one early actor call with NO retry wrapper; rivetkit's
`checkForSchedulingError` throws before barnDecider's rebind retry can
exist. Fix that worked: resume WITHOUT `--personas` — the creeds are
durable in actor state from seg1, so re-applying them was redundant risk.
Protocol update: **--personas belongs to segment 1 only; resumes never
pass it.**

## Orders (10/10 bound + read-back verified, mid-run)

Coaching's new role — the rows carry first links now, so orders carry
STRATEGY. No dated imperatives issued. Per creed (2 barns each):
- **Card sharks** (bot-7, bot-15): take value 6+, skip ≤2 unless age-1,
  never crown off-blade, rest beats a losing fight.
- **Bloodline architects** (bot-marco, bot-9): every breed row, retire
  rows on aging/losing hens, list every stud, chicks aim at juvenile
  crown rows.
- **Claim scouts** (bot-8, bot-16): every claim row shown; campaign at
  cheap claimer rungs between claims (board mostly invisible until the
  claim window ships — spec §10).
- **Talent scouts** (bot-14, bot-12): free pulls always, cull hard after
  5 fights, fight the hits into juvenile crowns.
- **Operators** (bot-13, bot-17): top-value row by default, deviate with
  a reason, age-8 veterans always take the free Major shot.

## What segment 2 must show

1. Does EV capture DIVERGE by creed? (Card sharks should drop below the
   78.6% baseline via principled skips; operators should rise above it.)
2. Ratio holding ≥ 0.8 as scripted depth compounds.
3. The LT gap (llm barns hold 2–5k LT vs. scripted 6–35k) — watch
   whether fight volume closes it or coach #2 needs a land policy.
4. Juvenile champions from BRED chicks (seg1's came from starters).
