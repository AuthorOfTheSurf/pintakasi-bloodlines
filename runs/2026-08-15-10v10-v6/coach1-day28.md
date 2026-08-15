# Coach session #1 — day 28 (2026-08-15, exp6)

World `data/sim-20260815-2011.db` · doctor 2 warnings, 0 invariant failures
· clean infra (0 actor timeouts).

## Scoreboard through day 28

```
scripted (10): total net worth 375,251 · avg 37,525 · crowns 6
llm      (10): total net worth 203,045 · avg 20,304 · crowns 0
```

Ratio 0.54 — the same day-28 shape as exp5 (0.54) and exp4.

## The finding that matters: baked-in laws do not self-execute

Exp6's v4 preamble carries the pipeline law ("breed in WEEK ONE"), the mode
law, and the veteran law from day 1 — and at day 28 the counters read:
**0 retire proposals, 0 eggs, 0 juvenile fights.** (Juvenile fights are 0
partly as a consequence: no breeding → no chicks → nothing the mode law
can act on. Fights overall: 637, the volume floor is holding.)

This replicates a five-experiment pattern worth naming for the record: the
GOAL_PREAMBLE reliably sets *identity and direction* (creeds, crown
declarations, volume) but multi-step season plans (retire → breed → raise →
juvenile-fight → crown) only start moving after a COACH SESSION repeats
them as direct, dated orders. Facts in the brief, skill in the standing
orders — and *sequencing in the coaching*.

## Orders (10/10 bound mid-run)

One order, all barns, maximum bluntness: retire the worst age-3+ hen TODAY
and breed her before the day ends; repeat weekly, two pairings when space
allows. Chicks at age 1 fight ONLY mode:"juvenile", every day, 2 wins by
Wednesday, crown division juvenile at b2/b4 nearest bestBlade. Adults: full
card nightly at bestBlade; crownEligible → declare at bestBlade; age-8
winners always take the free Major shot.

## What segment 2 must show

1. Retire proposals > 0 and eggs > 0 by day 35 (exp5 hit both by day 56
   after the same order — exp6 should beat that timeline).
2. **The mode law's real test: the first llm juvenile-mode fights in six
   experiments**, once the first chicks reach age 1 (~2 weeks after the
   first breeding).
3. Crowns: first llm declarations landing (0 so far — slower than exp5's 1).
