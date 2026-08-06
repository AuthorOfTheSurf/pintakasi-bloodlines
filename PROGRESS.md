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

*Updated after round 29 — the three diagnostic limitations named below have
been fixed, and the answer changed once the audit stopped measuring the wrong
thing.*

The original reading here was raw selected-format hits rising 20.7% to 26.2%
across age buckets, with the caveat that this was **not** proof the scout was
teaching anybody anything. That caveat was right, and for three reasons that
round 29 addressed one at a time.

1. **The verdict graded the wrong quantity.** A card lands where the scout
   said AND where `SCOUT.EXPLORE` sent it AND where the lobby had room. The
   Doctor now grades the scout report's own top-ranked blade against its own
   random baseline.
2. **Tournament rows were counted as decisions.** A bracket bout's format is
   fixed by the committee. They are excluded from decisions and still feed the
   scout history, since a bracket fight is real evidence.
3. **The denominator was full of coin flips.** Home-blade margins measure
   p10 1.9 / p50 11.1 / p90 28.3 weighted stat points — half the flock had no
   home worth finding. The Doctor now prints a clear-home line beside the raw
   one.

Separately, `SCOUT.PRIOR_FIGURE` was found to be miscalibrated: set to 50 on
the strength of a `GHOST_PACE` comment that round 27 had quietly falsified.
Even fights actually figure 26.9–31.5, so evidence lost to ignorance by
construction. Replaying the same 5,505 entries with only that number changed
lifted scout accuracy 26.5% to 31.2% exact.

With all four fixed, a fresh 91-day world reads **32.9% exact on mature birds
with a real home, against 20% by chance**, and passes every invariant with
zero health warnings. Two candidate fixes were tested and rejected on the
data: normalizing the result out of the figure (accuracy fell to 23.2%) and
weather normalization (+0.2 to +0.8, real but not the bottleneck).

The remaining ceiling is the population, not the report. See `BALANCE.md`.

## Recommended next steps

*Items 1 and 4 of the original list are done; the rest stand, re-ordered.*

1. **Run matched multi-seed worlds** comparing the current and end-first
   discovery policies, now that the audit is sound. Report exact and adjacent
   scout accuracy, coverage and unmatched rate across seeds, not one world.
2. **Recentre the Pit Figure scale.** `GHOST_PACE` puts even fights ~20 points
   low, so live figures occupy about a third of the 0–150 range and the ±4 fog
   eats a large share of every read. Its own round: `GHOST_FIGURE`,
   `CLASS_BASE`, `MAX` and the Handbook move together.
3. **Watch the flock shape line.** The breeding plan is demonstrably choosing
   (sires +83 along their barn's house axis against a flock baseline of +4),
   but 13 weeks is roughly two selected generations and `STAT_VARIANCE`
   regenerates most of the spread each time. Whether shape accumulates is a
   longer-horizon question.
4. **Then revisit population and claimers.** The unmatched rate now sits at
   14.7%, under the warning bar, but claimer and hardcore lobby keys are still
   the thin ones.
