# Postmortem #9 — day 91 (2026-08-16, exp9: the options-brief season)

World `data/sim-20260816-1435.db` · seed 1 · doctor 0 warnings / 0
invariant failures · the first season played on `--brief=options`
(round 63, runs/options-brief-spec.md).

## Final scoreboard

```
scripted (10): total net worth 1,168,744 · avg 116,874 · crowns 26
llm      (10): total net worth   991,976 · avg  99,198 · crowns 22
```

**Ratio 0.85.** The arc: 0.48 / 0.58 / 0.59 / 0.52 / 0.43 / 0.40 /
0.44 / 0.38 → **0.85**. The previous all-time record (exp3's 0.59) is
not just beaten, it isn't close. Bagong Laban finished **#4 in the
world**; four llm barns in the top nine; the weakest llm barn (84k)
finished above exp8's BEST barn's whole trajectory.

## What one interface change was worth

Same model, same personas, same coach cadence, same world rules as
exp8b. One flag different. Exp8b→exp9:

| Metric | exp8b | exp9 |
|---|---|---|
| Final ratio | 0.38 | **0.85** |
| Crowns won (scoreboard) | 3 | **22** (10 juvenile + 12 Major) |
| …from birds bred in-world | 0 | **17 of 22** |
| llm juvenile fights | 969 | 1,446 |
| Retire fired uncoached | never | **day 21, first legal day** |
| Real translation losses | hundreds | **~19 all season** (720 of 739 drops were duplicate-pick echoes, first pick kept) |

The pipeline didn't just run — it produced the trophies: **17 of 22
champions were bred, hatched, christened, discovered, and declared
inside the season.**

## The two laws, resolved

- **The first-link law is DEAD — it was an interface artifact.** Retire
  self-initiated on day 21, the first day a retire row could legally
  render (age-3 line), with no coach in existence. Eight experiments of
  standing prose never fired it once; a scored row fired it same-day.
  Chain initiation was never beyond the model — ORIGINATING an action
  from prose was. Selection ≠ synthesis, proven end to end.
- **The pipe law generalizes.** Seven gaps were fixed one data field at
  a time across eight experiments; pre-computing the whole join fixed
  the class. The remaining known gap is TEMPORAL (gap #8, the claim
  window — llm claims still ~nil because the board is empty at collect
  time; spec §10, scoped v1.1).

## EV capture — the new instrument's first season

| Segment | top-pick rate | picks | rests | offMenu |
|---|---|---|---|---|
| 1 (uncoached) | 78.1% | 1,727 | 55 | 5 |
| 2 (creed orders) | 78.9% | 818* | 66 | 0 |
| 3 (endgame orders) | 76.1% | 1,392 | 127 | 0 |

*seg2 pick volume reflects the day-36 external kill + resume.

The aggregate hides the finding: after coach #1 the per-barn spread ran
**58%→98% exactly along creed lines** (operators top at 98/92, card
sharks below baseline with the most rests, the cheap-claimer scout at
58 — see coach2-day56.md). Coaching stopped being a vibe: the orders
given are readable in the numbers. And the argmax worry inverted: the
operators — the trust-the-scout creed — finished #4 and #12. On a menu
whose top row is usually right, trust IS a strategy; the sharks'
discipline cost more than it saved this season.

## Gait (first measurement)

llm proposals/barn/day: 7.0 / 5.3 / 6.4 by segment — the reply-size
relief let a full-card day run 15–18 actions when the menu offered
them, but the once-a-day cycle remains the binding constraint vs.
scripted logic (which also shops the claim window the llm never sees).
The residual 0.15 gap decomposes roughly into: land compounding
(scripted LT up to 140k vs llm max 38k — land is minted by fight volume
and staking hours the llm side can't match at one cycle/day), the
claim-window blindness, and two llm sit-out days (57–58, envoy wedge).

## The envoy bug — the season's operational tax

Three process handoffs, three lease wedges: seg2's launch crashed twice
(`no_envoys`, once PAST a daemon restart — the durable variant, crash
site isolated to the unretried persona `tune()` at startup); seg3's
launch wedged ALL TEN barns through the full takeTurn retry, costing the
llm side days 57–58. Protocol that ended it: **resumes never pass
--personas (creeds are durable in actor state) + cycle the daemon before
every resume** — seg3b and seg3c both bound 10/10 instantly under it.
For the Rivet report: reused actors + process handoff = wedge until the
daemon's in-memory leases clear; a client-side retry cannot always
outwait it; a capability/liveness check at wake dispatch would end the
class.

## Exp10 candidates

1. **The claim window (v1.1, spec §10)** — the last structural gap; the
   claim-scout creed is playing blind and still finished mid-table.
2. **Two-season world on the options brief** — exp8's deferred-value
   question, now asked from parity instead of from 0.38.
3. **Bigger model, same menu** — with the interface no longer the
   bottleneck, a frontier brain measures MODEL headroom cleanly for the
   first time (does EV capture converge to the sharks' pattern or find
   better deviations?).
