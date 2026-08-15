# Postmortem #7 — day 91 (2026-08-16, exp7: the open door)

World `data/sim-20260816-0330.db` · doctor 0/0 · infrastructure-clean.

## Final scoreboard

```
scripted (10): total net worth 1,222,629 · avg 122,263 · crowns 41
llm      (10): total net worth   540,779 · avg  54,078 · crowns 5
```

**Ratio 0.44** (arc: 0.48 / 0.58 / **0.59** / 0.52 / 0.43 / 0.40 / 0.44).
Day-56 pace was 0.55 — best of the arc — and segment 3 gave it back to the
age cliff, as every experiment since exp3 has.

## The three questions, answered

1. **The second juvenile wave HAPPENED.** 168 juvenile fights in segment 3
   — all from christened bred chicks (gap #6's fix working as built) — on
   top of month-one's 400 from starting birds. Season total: 568 juvenile
   fights, 20 juvenile crown entries, **1,260 LT of juvenile-division land
   banked**. The full discovery loop — breed → hatch → christen → fight
   juvenile daily → bank 2 wins → declare the crown — ran end to end for
   the first time in seven experiments.
2. **First juvenile crown WIN: not yet.** 0-for-20 as entrants. The chicks
   enter against scripted juveniles bred from planned pairings at 10× the
   volume; a thin pipeline sends its only chicks, not its best.
3. **Ratio: 0.44.** The juvenile machinery is now genuinely profitable at
   the margin (land + advancement shares) but roster depth still decides
   the season: 46 llm birds bred all season vs a scripted fleet that ended
   with 377 actives against our 17. Same cliff, same shape, better
   mid-game.

## The wallpaper hypothesis: CONFIRMED

Identical season-plan content: as exp6's day-1 standing preamble → day-28
counters all zero. As exp7's day-2 blunt dated orders (same tune channel,
same field, same model, same seed) → 400 juvenile fights and 12 crown
entries by day 28. **The channel was never the variable; the wording is.**
General laws get *acknowledged*; short dated imperatives naming ONE action
("TODAY, retire your worst hen and breed her before the day ends") get
*executed*. Production design note: the world actor's coach tick should
speak in orders, not policy.

## The pipe law, final tally — six gaps, one lesson

| # | Gap | Layer |
|---|---|---|
| 1 | Crown facts absent from brief (exp1) | facts |
| 2 | (exp3) fighter window + reply budget as volume ceilings | capacity |
| 3 | `retire` verb missing (exp5) | verbs |
| 4 | `mode` defaulted to "real" for age-1 birds (exp5) | defaults |
| 5 | Schema enum barred `"juvenile"` (exp6) | field values |
| 6 | Naming law had no llm affordance (exp7) | plumbing chores |

The model can only play the game its pipe can carry — and the pipe has six
distinct layers that must all agree: facts, capacity, verbs, defaults,
legal field values, and the chores the engine assumes someone does.

## Exp8 lever (launching tonight)

**Breeding volume.** 46 bred/season vs the cliff's appetite is the whole
remaining gap. Exp8 carries every fix and changes one thing: the breeding
order goes from weekly to DAILY-when-possible ("every day a retired hen
and a stud are both free, breed — same day, no exceptions"), with the
juvenile habit unchanged. If depth still can't keep pace, the honest
conclusion is exp3's: the ~5-action/day gait is a model-capability wall,
and the next experiment class is a bigger model, not a better prompt.
