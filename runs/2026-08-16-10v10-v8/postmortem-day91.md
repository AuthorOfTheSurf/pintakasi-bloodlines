# Postmortem #8 — day 91 (2026-08-16, exp8: the stud market and the broken deadlock)

World `data/sim-20260816-0553.db` · doctor 0/0 · attempt 1 aborted at day 28
by the fail-fast gate (gap #7); attempt 2 below.

## Final scoreboard

```
scripted (10): total net worth 1,311,563 · avg 131,156 · crowns 46
llm      (10): total net worth   504,819 · avg  50,482 · crowns 3
```

**Ratio 0.38** (arc: 0.48 / 0.58 / **0.59** / 0.52 / 0.43 / 0.40 / 0.44 /
0.38). Lowest of the arc — and simultaneously the most structurally
successful llm season ever played. Both things are true, and the tension
IS the finding.

## The history line first

**🏆 Cruel Beak (Ilonggo Ironworks) — first llm juvenile crown CHAMPION in
eight experiments. B2 crown, 1,110 GP purse.** Bred, hatched, christened,
fought juvenile daily, banked wins, declared at its blade, and won the
bracket. The full discovery loop, closed with a trophy.

## The depth war: WON

| Metric | exp7 | exp8b |
|---|---|---|
| bred all season | 46 | **252** |
| end-of-season actives | 17 | **167** |
| manual retirements | 16 | 55 |
| juvenile fights | 568 | 969 |
| total fights | 1,978 | 2,216 |

The age-9 cliff that emptied five straight seasons finally met a pipeline
that out-bred it. Gap #7's fix (the stud market) plus the coach's
first-link imperative did it: 54 bred by day 56, 252 by day 91.

## Then why 0.38?

Three honest reasons:
1. **A 91-day season doesn't pay back a 252-bird pipeline.** Breeding
   fees, stud fees, juvenile fees, and 55 retirements (income-earners
   converted to breeders) all land THIS season; a roster averaging age 2.7
   pays off NEXT season. The llm side finished holding an asset the
   scoreboard prices at zero.
2. **The scripted side ate the same lunch twice** — their best season ever
   (131k avg): llm stud fees and claim liquidity flow to the incumbents,
   and 46 scripted crowns against 3 llm crowns (a young roster declares
   few Majors).
3. **The gait ceiling stands** — even a perfect pipeline runs through ~5
   actions/day; scripted logic breeds, cards, and declares without budget.

**The scoreboard argument for a two-season world**: exp3 optimized for
day-91 net worth and died old; exp8 built for day-120 and got graded at
91. If the arc's question is "can a coached local model learn the game,"
exp8's structures say yes; if it's "can it out-earn purpose-built logic in
one season," the answer through eight experiments is a consistent no at
0.4-0.6×.

## The first-link law (now three-times proven)

`retire` — the first link of the pipeline chain — has NEVER fired from
standing orders (preamble or blunt day-2 orders alike, eight experiments).
It fires immediately and massively from a dated mid-season imperative
("TODAY, before any entry, retire your worst hen"): 119 proposals and 52
retirements in the segment after coach #1 said exactly that. Production
coach ticks must name the first link, not the chain.

## Exp9 candidates (for Zane)

1. **The two-season world** (day 1→182, coach every 4 weeks): let exp8's
   pipeline structure prove or disprove its deferred-value claim — the
   cleanest test of whether 0.38 was an investment or a loss.
2. **Fresh 91 days with everything + first-link orders at day 2** ("TODAY,
   retire your worst hen" as the literal opening order): tests whether the
   deadlock can be broken WITHOUT waiting for coach #1 — the last piece of
   the wallpaper question.
3. **The bigger-model season**: same harness, frontier brain (or qwen3
   at higher num_predict), measuring what the gait ceiling is worth — the
   experiment BRAINS.md has pointed at since exp3.
