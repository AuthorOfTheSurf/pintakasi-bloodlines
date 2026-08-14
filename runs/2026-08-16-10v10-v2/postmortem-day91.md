# Postmortem #2 — day 91 (2026-08-16, overnight)

World: `sim-20260815-0245` · 91 days · 0 invariant failures · segment 2
survived two host SIGTERMs with clean `--keep` resumes.

## Final scoreboard

```
  scripted (10): total net worth 1,211,754 · avg 121,175 · crowns 42
  llm      (10): total net worth   699,045 · avg  69,905 · crowns 6
```

## Exp1 → exp2, like for like

| Measure | Exp1 | Exp2 |
|---|---|---|
| llm avg net worth | 61,343 | **69,905** (+14%) |
| llm/scripted ratio | 0.48 | **0.58** |
| llm crowns won | 0 | **6** (six different barns) |
| llm breeds (91d) | 2 | **~95** (pipeline real from seg2 on) |
| First crown declaration | day 58 (after mid-run fix) | day ≤28 (sighted from day 1) |

The lessons carried over worked exactly as designed: crown-sighted briefs
produced declarations from week 2 and six championships; the three-law
preamble + one pointed coach session produced a real breeding pipeline.
Coached barns: bot-14 (rank 16→13, won a crown after its sharpened order),
bot-7 (19→16); bot-17 stayed at the floor (20→19) — orders lift most barns,
not all.

Ginto, tamed: rank 17 with 4 crowns and 80k LT — an honest competitor.

## The remaining gap has a mechanical name: roster depth × brief visibility

- Fights: llm 1,784 vs scripted 11,960. The llm side *stalled* in segment 3
  (~1 fight/barn-day) while scripted exploded.
- Why: **bot-kevin holds 71 active birds; bot-15 holds 13.** Ninety-one days
  of scripted breeding compounds into a deep roster; the llm pipeline
  started at day 29.
- And the instrument caps it twice: **the brief lists only 12 fighters**
  (`LIMITS.fighters`), so "enter every healthy bird" is structurally capped
  at 12 — and the reply budget (`num_predict`) sizes to ~10 actions. A deep
  llm roster would be *invisible and unenterable* beyond the caps.

## Exp3 changes (the carry-forward)

1. **Raise the brief's fighter window** (12 → 24) and the reply budget to
   match — remove the structural volume ceiling before asking for volume.
2. **Preamble sharpened**: law 1 becomes literal ("15 healthy birds means 15
   entries"); law 3 gets a cadence ("at least one breed every week from the
   first week stock exists").
3. Everything else held: same split, seed, model, segments, coach cadence.
