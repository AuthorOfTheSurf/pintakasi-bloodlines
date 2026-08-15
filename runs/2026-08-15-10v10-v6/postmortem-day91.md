# Postmortem #6 — day 91 (2026-08-15, exp6)

World `data/sim-20260815-2011.db` · doctor: 0 warnings, 0 invariant failures
· infrastructure-clean end to end (0 actor timeouts across all 3 segments).

## Final scoreboard

```
scripted (10): total net worth 1,253,232 · avg 125,323 · crowns 39
llm      (10): total net worth   501,292 · avg  50,129 · crowns 6
```

**Ratio 0.40.** The arc now reads 0.48 → 0.58 → **0.59** → 0.52 → 0.43 →
0.40. Two instrument rounds in a row have LOST ground against exp3's
simple-laws high-water mark. That pattern is itself the finding.

## The smoking gun: instrument gap #5, the schema-barred door

The mode law was in the preamble from day 1, in both coach sessions, and
the chicks existed (57 hatched, birth-weeks 5–11). The model even tried:
**125 juvenile-flavored enter proposals in brain_log**. Season juvenile
fights: **still zero** — because the response schema's `enter` verb
declared `mode: enum ["real","hardcore"]`. Ollama constrains generation to
the schema, so `"mode":"juvenile"` was UNREPRESENTABLE. The prompt
commanded a word the schema forbade the model from writing; every juvenile
entry either got schema-coerced to a mode the engine refused for an age-1
bird, or dropped.

Five instrument gaps, one law, now proven five ways: **the model can only
play the game its pipe can carry.** Facts (exp1: crown blindness), verbs
(exp5: retire), field values (exp6: the mode enum), defaults (exp5:
mode:"real"), and prompts must AGREE — a law stated anywhere fails if any
one layer can't express it. Fixed in round 59 (one word in the enum);
ready for exp7.

## The other questions

- **Egg wave vs age cliff**: better than exp5 in discipline, worse in
  timing — eggs at all 10 barns by day 56 (exp5: 6/10) but the first
  breeding still waited for coach #1, so end-of-season actives were 68 vs
  scripted 354 (exp5: 87 vs 380). Starting week-1 breeding remains
  unexecuted in both experiments — the preamble alone has never once
  produced a day-1-week action.
- **Volume**: 1,253 llm fights (exp5: 1,053; exp3: ~1,700; exp4: 2,460).
  The restored volume-floor language recovered only a fifth of the gap —
  rosters were too thin by mid-season for "enter every healthy bird" to
  mean many birds.
- **Crown economics**: 6 crowns, 17,438 GP in purses — Hacienda 2,
  Batangas 2, Cavite 1, Marco 1.
- **Retire loop**: 110 proposals, 13 manual retirements — now habitual
  across two experiments. The verb is a permanent win.

## The finding worth a BRAINS.md paragraph: coaching is the executive function

Day-28 checkpoint (before any coaching): 0 retire proposals, 0 eggs — with
every law already in the preamble. Day-56 (one coach session later): 108
retire proposals, eggs at all ten barns. Identical pattern in exp5. Across
six experiments the preamble has reliably set IDENTITY (creeds, goals,
declaration appetite) and has never once initiated a multi-step SEASON
PLAN; every pipeline, every cull rhythm, every new behavior chain started
the segment after a coach session repeated it as a blunt, dated order.
For the world-actor design this is a real architecture input: the
production loop needs a scheduled coach tick (or the preamble needs to be
re-delivered as fresh "today's orders" daily), because standing text decays
into wallpaper while direct orders execute.

## Exp7 candidates (for Zane)

1. **Open the juvenile door for real** (enum fixed; expect first juvenile
   crowns ever — the full discovery loop finally testable end to end).
2. **Day-1 orders**: deliver the season plan as standing orders at world
   creation (tune immediately after seed, before day 1 ticks) instead of
   relying on the preamble — tests the wallpaper hypothesis directly.
3. **Reconsider the exp3 baseline**: instruments + exp3's simple laws
   (enter everything, declare crowns, breed weekly) without the margin
   caveat — isolate whether the caution language is what's been costing
   10-19 points of ratio.
