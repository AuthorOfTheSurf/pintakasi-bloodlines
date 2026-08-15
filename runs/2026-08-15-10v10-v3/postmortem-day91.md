# Postmortem #3 — day 91 (2026-08-15, dawn)

World: `sim-20260815-0419` · 0 invariant failures · clean run, no host reaps.

## Final scoreboard

```
  scripted (10): total net worth 1,185,648 · avg 118,565 · crowns 36
  llm      (10): total net worth   704,188 · avg  70,419 · crowns 12
```

## The three-experiment arc

| Measure | Exp1 | Exp2 | Exp3 |
|---|---|---|---|
| llm avg net worth | 61,343 | 69,905 | **70,419** |
| llm/scripted ratio | 0.48 | 0.58 | **0.59** |
| llm crowns | 0 | 6 | **12 — every barn ≥1** |
| First llm crown | never | ~day 45 | day ≤28 |
| llm breeds | 2 | ~95 | ~50 |
| Best llm rank | 10 | 10 | 7 mid-run (bot-12, 3 crowns); 10–11 at close |

Every llm barn is now a champion — in exp1, none was, and the cause chain
is fully documented: blindness (no crown facts) → sight (instrument fix) →
declarations → wins, with each link measured in its own experiment.

## What exp3's specific changes did — and didn't

- The lifted fighter window (12→24) and reply budget (700→1400) did NOT
  move the model's gait: 4.6 proposals/day in segment 3, same as ever, max
  18. **The ceiling was never the instrument this time — it's the model's
  natural action budget.** A scripted bot happily writes 20+ actions; the
  30b converges on ~5 considered ones.
- Roster depth remains the wall, and now with a twist: crown brackets
  FORCE-RETIRE losers, so chasing championships with a shallow roster eats
  the roster. bot-12 finished rank 11 holding FOUR active birds (Kevin:
  81). The llm barns fight above their depth.

## The exp4 lever, when Zane wants it

The remaining gap is a volume/depth war the current prompt shape can't
win at ~5 actions/day. Candidate levers, in rough order of promise:
1. **Structured volume**: make the ask per-domain ("for EACH fighter in
   your brief, enter or say why not") or two-pass (card pass + economy
   pass) — turns the ~5-action gait into a per-bird checklist.
2. **Protect the roster**: teach hardcore/crown risk (force-retirement) so
   depth survives the crown chase; pair with heavier breeding.
3. Bigger local model for the player, or Haiku-class hosted for an arm.
