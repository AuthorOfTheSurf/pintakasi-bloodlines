# Coach session #1 — day 28 (2026-08-16, exp8 attempt 2: the stud market)

World `data/sim-20260816-0553.db` · attempt 1 aborted at the day-28 gate
(see `aborted-attempt-1/WHY-ABORTED.md` — gap #7, the invisible stud
market, found and fixed).

## Scoreboard through day 28

```
scripted (10): total net worth 389,862 · avg 38,986 · crowns 8
llm      (10): total net worth 222,472 · avg 22,247 · crowns 0
```

**Ratio 0.57 — the best day-28 mark of all eight experiments.** The
juvenile economy is doing real work: 407 juvenile fights, 7 juvenile crown
entries, cheap fees, land minting.

## The gate finding: the retire deadlock, isolated at last

Still 0 eggs — but the diagnosis is now surgical. 73 breed proposals; the
drops read `breed: unknown mother #1` or name invented ids (`bot-16-8`) —
because the `hens` list is EMPTY at nearly every barn (4 retired hens
across ten farms). The chain is deadlocked at its first link: **retire has
never fired from standing orders in eight experiments** — not as preamble
(exp6), not as blunt day-2 orders (exp7, exp8 both attempts). It has ONLY
ever fired from mid-season coach imperatives ("TODAY, retire…" → 65, 110,
26 proposals in exp5/6/7). Conditional phrasing ("whenever the shed runs
empty") is wallpaper; the model will not self-initiate the first link of a
chain whose payoff is two steps away.

The stud-market fix (gap #7) is necessary but not sufficient — the market
is visible now, and it matters only once a hen exists to pair.

## Orders (10/10 bound + verified)

One dominating order: TODAY, before any entry, retire the worst age-3+
female (most losses); TOMORROW breed her to the best visible stud (own or
studMarket); keep the loop; never name a mother id that isn't in the hens
list. Everything else praised and held (juvenile habit, full card,
bestBlade crowns, veteran shots).

## What segment 2 must show

1. Retire proposals > 0 within days (historically immediate post-coach).
2. First eggs by ~day 35, hatched chicks fighting juvenile by ~day 50.
3. Ratio holding ≥ 0.55; first Major declarations.
