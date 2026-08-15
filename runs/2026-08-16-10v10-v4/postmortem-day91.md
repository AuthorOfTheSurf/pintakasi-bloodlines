# Postmortem #4 — day 91 (2026-08-16)

World: `sim-20260815-1255` · 0 invariant failures.

## Final scoreboard

```
  scripted (10): total net worth 1,250,336 · avg 125,034 · crowns 40
  llm      (10): total net worth   655,424 · avg  65,542 · crowns 6
```

## The four-experiment arc

| Measure | Exp1 | Exp2 | Exp3 | Exp4 |
|---|---|---|---|---|
| llm avg net worth | 61,343 | 69,905 | **70,419** | 65,542 |
| llm/scripted ratio | 0.48 | 0.58 | **0.59** | 0.52 |
| llm crowns | 0 | 6 | **12** | 6 |
| llm fights | ~1,700 | ~1,780 | 1,711 | **2,460** |

## The checklist verdict: a real negative result, honestly earned

Exp4's bird-by-bird checklist delivered exactly what it asked for — record
volume, +44% fights over exp3 — and net worth went DOWN. The mechanism:

- Entry fees scale with entries; purses scale with WINNING. A barn carding
  its whole roster nightly at an average depth of **5.5 birds** (Kevin:
  ~100+) fights tired, over-matched birds for fees it can't win back.
- The hardcore warning worked as written (fewer, safer declarations) but
  with no deeper pipeline behind it, selectivity just meant fewer crowns
  (6, five barns).
- Breeding improved late (21 in seg3, best segment of the run) — too late
  to matter, and attrition from the volume push ate the gains.

Exp3 remains the high-water mark. The arc's shape is now clear:
**instrument fixes and goal-language moved the ratio from 0.48 to 0.59;
volume-forcing pushed past the point of positive margin.** The binding
constraint is and was ROSTER DEPTH — every lever that doesn't grow the
roster faster than attrition now has diminishing or negative returns.

## Exp5 candidates (Zane's call, not auto-run)

1. **Depth-first laws**: demote blanket volume; promote breed-rate and
   claim-rate to primary (grow to 15+ birds, THEN card everything).
2. **Economy feedback in the brief**: a `weekSoFar` line (fees paid vs
   purses+land won) so the model can feel its own margin — currently it
   flies blind on profitability.
3. **Condition/EV gating**: teach "enter when favored or cheap, rest when
   tired" — needs condition/odds facts in the brief to aim it.
