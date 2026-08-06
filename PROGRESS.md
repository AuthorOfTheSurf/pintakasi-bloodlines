# Balance and discovery progress

This note records the work from population supply through Pit Figure and
discovery calibration. It is a measurement log, not a declaration that the
loop is finished.

## What changed

- **Population supply, `76b5534`:** hens become breedable again after they
  lay, rather than waiting for the egg to hatch. New farms now begin with
  eight eggs instead of four.
- **Long-horizon health, `c1d8843`:** `bun run simulate` now defaults to 91
  days, thirteen full weeks, and the Doctor reports the health of that world.
- **Discovery instrumentation, `12b7fd2` and `b8b4211`:** the Doctor now
  measures true-home hits, adjacent-blade hits, random baselines, evidence
  coverage, and scout accuracy by age.
- **Figure calibration and exploration lab, `215cc4f`:** the balance suite
  gained a grade-and-distance Pit Figure target-dummy case. Simulation can
  also trial an end-first exploration order without changing normal play.
- **Close-loss Pit Figures, `20d8d20`:** both birds now earn their own
  ghost-paced and company-adjusted performance before the loser takes a
  beaten-length deduction. The winner remains strictly above the loser.
- **Grade-relative scouting, `b3432f4`:** the scout removes coarse public
  own-grade and opponent-grade expectations before comparing blade evidence.
  Fight logs snapshot those public grades so old form lines remain historical.

## Controlled measurements

`bun run balance figure figuregrade --runs=4000` after the close-loss change:

| Observation | Result |
| --- | --- |
| +100 points to every hidden stat | +29.8 to +39.4 mean figure, depending on blade |
| B specialist at home vs fixed B+ company | 22.3 |
| B+ specialist at home | 40.9 |
| A specialist at home | 59.4 |
| S+ specialist at home | 110.0 |

The grade table is a controlled target-dummy calibration, not a promise about
live cards. Live figures also contain company, result, weather, and specialist
shape.

## Simulation artifacts

All paths are repository-relative and can be inspected with `bun run doctor
<path>` or served through `bun dev:sim` after selecting the newest file.

| Database | Purpose |
| --- | --- |
| `data/sim-20260806-0241.db` | Early population-supply check |
| `data/sim-20260806-0302.db` | Follow-up population/discovery check |
| `data/sim-20260806-0313.db` | First 91-day baseline |
| `data/sim-20260806-season-a.db` through `season-c.db` | Three discovery baseline worlds |
| `data/sim-20260806-end-first-a.db` through `end-first-c.db` | Simulation-only extreme-first exploration trials |
| `data/sim-20260806-1226.db` | Close-loss Pit Figure validation, 91 days |
| `data/sim-20260806-1318.db` | Grade-relative scout normalization, 91 days |

The latest world (`sim-20260806-1318.db`) reached day 91 with 515 birds and
passed all five Doctor invariants. It recorded 4,648 fights from 5,505 entries;
15.6% of entries went unmatched, which remains a health warning.

## Discovery: what is proven, and what is not

The latest Doctor output shows raw selected-format hits rising from 20.7% at
age 1 to 26.2% at age 4+, compared with roughly 20% random selection. It also
shows better adjacent-blade selection at age 4+ (55.2% versus a 48.2% random
baseline).

This is **not yet proof that scout discovery steadily improves with age**.
The green Doctor verdict currently uses selected-format hit rate rather than
the scout report's own ranked-blade accuracy. It also includes tournament
fight rows even though later bracket rounds are not new blade-choice
decisions, and its "true best blade" uses the static format-weight matrix
rather than realized fight performance. Those are diagnostic limitations, not
evidence that the feature is healthy.

## Recommended next steps

1. **Fix the discovery audit before changing policy again.** Restrict it to
   daily-card blade choices, judge convergence by prior-evidence scout accuracy
   against its random baseline, and call the current answer key "weight-matrix
   affinity" until a realized-performance reference field is calibrated.
2. **Run matched multi-seed worlds.** Compare current and end-first policies
   over the same seeds after the audit fix. Report exact and adjacent scout
   accuracy, coverage, and unmatched rate, not a single-world result.
3. **Then decide discovery policy.** Keep whichever policy improves mature
   scout accuracy without collapsing lobby liquidity. A juvenile-only
   double-header experiment remains a sensible separate test if coverage is
   still the bottleneck.
4. **Measure the new grade normalization directly.** Add raw-versus-normalized
   accuracy and residual grade/company bias to Doctor before tuning its
   coefficients. Weather normalization should wait until it can be based on
   historical public weather context, not reconstructed hidden data.
5. **Revisit population and claimers after discovery is trustworthy.** The
   15.6% unmatched rate and force-retirement churn are real design questions,
   but tuning them before the measurement loop is sound would mix causes.
