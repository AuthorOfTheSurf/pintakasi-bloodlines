# Exp11 — the seamless season (2026-08-16 night)

World `data/sim-20260816-2310.db` · seed 1 · 10v10 · qwen3:30b-a3b ·
`--actors --personas=championship --brief=options` · round 64
instrumentation · **ONE CONTINUOUS 91-DAY PROCESS — zero handoffs.**

## The design change

Exp10 proved the envoy park is caused by process exit, so exp11 removed
process exits: the segment splits were never necessary. Coach sessions
run MID-SIM via `tune` (the only thing that edits actor state after
init — the statefulness demo in its strongest form). Orders pre-staged;
fired the moment the db crossed the milestone day.

## Timeline

- Launch: fresh world, fresh daemon, `RIVET_POOL=pintakasi`. 10/10 from
  day 1.
- **Day 28** (23:23): ratio 1.04, llm leading. Creed orders tuned into
  all ten barns in SIX SECONDS mid-run (read-back verified 10/10);
  world stayed on day 29 throughout. In force day 30.
- **Day 56 window** (23:38, world at 58): ratio 1.02, llm leading,
  crowns 12–16. Endgame orders bound 10/10 in five seconds; in force
  day 59.
- **Day 91**: doctor 0 warnings / 0 invariant failures. **Zero
  `no_envoys` / `actor_ready_timeout` lines in the entire season log.**

## Final

```
scripted (10): total net worth 1,194,808 · avg 119,481 · crowns 34
llm      (10): total net worth 1,020,101 · avg 102,010 · crowns 17
```

**Ratio 0.85 — ties exp9's all-time record**, now with none of exp9's
or exp10's infra tax. The options-brief arc closes at 0.85 / 0.82 /
0.85 across three seasons (prose arc peak: 0.59). Pulang Bagwis #4
(4 crowns, 12,739 GP won); seven llm barns above 94k; every llm barn
in the top 17.

Pipeline: 121 bred, 47 end actives, 6,030 fights (1,992 juvenile),
17 crowns. Gait 6.2 proposals/barn-day. 27 real translation losses in
909 calls. EV capture by segment (tie-aware): 84% uncoached → 80%
under creeds → 80% under endgame, rests climbing 50 → 124 → 167 as
the shark/endgame discipline bites.

## Verdict

The three exp11 questions all answered YES:
1. Seamless: one process, zero wedges, zero lost llm days.
2. Mid-run coaching: seconds, not days — orders bound inside a single
   game day, twice.
3. Clean replication: 0.85 with full instrumentation and no
   confounders. This is the season to cite.
