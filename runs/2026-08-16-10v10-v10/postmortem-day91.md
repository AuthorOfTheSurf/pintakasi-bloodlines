# Postmortem #10 — day 91 (2026-08-16, exp10: the instrumentation season)

World `data/sim-20260816-1706.db` · seed 1 (exp9's world, replayed) ·
round 64 (`menu_json`) · doctor 0 warnings / 0 invariant failures ·
first season on pool `pintakasi`.

## Final scoreboard

```
scripted (10): total net worth 1,168,973 · avg 116,897 · crowns 38
llm      (10): total net worth   960,104 · avg  96,010 · crowns  9
```

**Ratio 0.82** (exp9 on the same seed: 0.85). The replication held
within 3 points THROUGH a night of infra fire: two llm sit-out days
(29–30), creed orders landing day 33 instead of 29, endgame orders day
62 instead of 57, and one healthy segment killed by an over-eager
watcher (mine). The options brief's jump from the 0.38–0.59 band is not
a fluke; two independent seasons now sit at 0.82–0.85.

## What the season was FOR: the tie-aware readout

Season EV capture by segment (picks / letter-A rate / tie-aware rate):

| Segment | picks | topA | topVALUE | uniq-top taken | rests |
|---|---|---|---|---|---|
| 1 (uncoached) | 1,702 | 81% | 88% | 87% | 34 |
| 2 (creed orders) | 539 | 69% | 79% | 79% | 51 |
| 3 (endgame orders) | 1,287 | 76% | 82% | 85% | 142 |

Answers to the questions that commissioned the season:
1. **The old metric understated agreement by ~7 points** — ties were
   scored as deviations. Tie-aware capture runs 79–88% all season.
2. **The model is not a rubber stamp.** 17% of menus tie at the top;
   when they do, the model takes letter A only ~57% of the time (pure
   position-bias would be ~100%) — it distinguishes equal-valued rows
   by content. 13–21% of uniquely-topped menus still get deviations.
3. **Obedience is now exactly measurable**: bot-17 (operator) scored
   86% topA / **100% topVALUE** in seg2 — its every "deviation" was a
   tied row. The creed ladder replicated exp9's (operators top, claim
   scout ~56% bottom, sharks/scouts mid) on fresh data.
4. **Fidelity verdict for the 0–9 scale:** ties are common (17%) but
   the model already handles them sensibly, and unique-top menus
   dominate. No forced case for coarsening the scale; if anything the
   Δ1 close-second uptake (~4%) suggests the second row could carry
   more signal (richer `why`), not less scoring.

## The pipeline lagged, and it showed in crowns

9 llm crowns vs exp9's 22. Mechanism: the cull outran the shed all
season (89 bred vs exp9's 153; mid-season trough of 31 actives), so
crown brackets went unfilled while scripted (38 crowns, Kevin Gamefarm
12 alone) compounded. Where exp9's endgame orders landed day 57 and
produced the bred-champion wave, exp10's landed day 62 — five days of
breeding lead time lost to the wedge, and juvenile champions need ~14+
days from egg to bracket. Volume otherwise: 5,401 llm fights (1,867
juvenile), gait 6.1 proposals/barn-day (exp9: 6.4), 16 real translation
losses in 888 calls (all offMenu fabrications again — the menu path
stayed clean for a second straight season).

## The envoy bug: the season's real harvest

Exp10 characterized the wedge far beyond exp9:

1. **The park is caused by process EXIT, not launch.** A 1-day probe
   bound 10/10, played, exited cleanly — and its own exit re-parked all
   ten actors within seconds. Every clean handoff re-arms the wedge.
2. **It survives daemon restarts** (two, in seg2's case) — the state is
   durable: `/actors` API shows `sleeping: None, connectable: None`,
   stale `no_envoys`, correct pool selector.
3. **The 30-minute stop threshold did not self-clear it** (verified at
   +2.5h once, +48min once, daemon untouched).
4. **Recovery is time + cycle, sometimes + retry:** cures observed at
   ~50–160 min after park; one launch inside the window recovered on
   takeTurn's own retries (seg3c — killed by my watcher before I saw
   it). The window is not a clean constant.
5. **Config exoneration:** pool `pintakasi` set on both sides all
   season (selector confirmed via API) — the wedge is not a pool/
   namespace misconfiguration. The misuse half of the code audit fixed
   what it fixed; these defects are the engine's.
6. **Watcher discipline:** "timeout lines present" ≠ wedged. Count
   brains-per-day; takeTurn retries absorb one-round timeouts.

## Exp11 candidates (post-application; the arc pauses here)

1. Claim window (v1.1, spec §10) — still the last structural gap.
2. Richer `why` on close-second rows — the tie-aware data says the
   scoring scale is fine; the margin is in the reasons.
3. Breeding lead-time law — orders that protect the shed BEFORE the
   cull, so the crown wave doesn't depend on coach timing.
