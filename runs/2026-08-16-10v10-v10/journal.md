# Exp10 — the instrumentation season (2026-08-16)

World `data/sim-20260816-1706.db` · seed 1 (exp9's world replayed) ·
10v10 · qwen3:30b-a3b · `--actors --personas=championship
--brief=options` + round 64 (`menu_json`: full offered menus + taken
picks + tie-aware `topValuePicksTaken`) · first season on
`RIVET_POOL=pintakasi` (post-code-audit config hygiene).

## What this season tests

1. THE INSTRUMENT: are high EV-capture barns rubber-stamping row A, or
   selecting? (Zane's question; needs per-row values + taken picks.)
2. Replication: does exp9's 0.85 hold on a re-run?
3. Infra: pool isolation + DEBUG daemon — do wedges name their defect?

## Segment 1 (days 1–28) — clean

- 10/10 all segment. Day-28 ratio **1.02, llm leading** (exp9: 0.92).
  Retire self-initiated day 21 again (first legal day). Gate passed.
- First tie-aware read: topA 78–81%, topVALUE ~88%; tied-top menus 17%,
  letter-A-when-tied only 57% → **content-selection, not position bias**.
- Watch-item: 6 bred by day 28 (exp9: 19).

## The seg2 handoff — the wedge's best specimen yet

- Launch wedged 10/10; **survived TWO daemon restarts** (new — exp9's
  cure failed). `/actors` API: `sleeping: None, connectable: None`,
  stale `no_envoys`, selector `pintakasi` correct.
- 30-min threshold did NOT self-clear (checked +2.5h). Cure: cycle
  after ~3h → 10/10 instant. Cost: llm sat out days 29–30.
- Probable trigger: daemon cycled ~90s after seg1's exit, interrupting
  engine-side shutdown processing. Protocol amended: let the engine
  settle after a sim exits.
- Coach #1 creed orders bound day 33 (read-back verified 10/10).

## Day 56 — coach #2 (ratio 0.93)

- Per-creed tie-aware table in `coach2-day56.md`: bot-17 86% topA /
  **100% topVALUE** (zero true deviations); claim scout 56% (exp9: 58%)
  — the creed ladder replicates on fresh data.
- Cull outran shed: 29 bred vs 95 retired, 31 actives → endgame orders.

## The seg3 handoffs — the park characterized

- Seg3 wedged at launch even after an 8-min settle + cycle. Killed
  before any day committed (lesson from seg2 applied).
- **The probe experiment:** after 56 min + cycle, a 1-day probe bound
  10/10 instantly, played day 57, exited cleanly — and its own exit
  re-parked all ten actors. THE PARK IS CAUSED BY PROCESS EXIT.
- 49 min + cycle: wedged again (the window isn't a constant).
- Seg3c (cycle at +48min): the watcher cried WEDGED on first-attempt
  timeout lines, but takeTurn retries had recovered it — days 58–61
  played 10/10. Killed by my own watcher; relaunched as seg3d without
  drama. Watcher rule now: count brains-per-day, not timeout lines.
- Endgame orders bound day 62, read-back verified 10/10.

## Day 91 — season complete (ratio 0.82, doctor clean)

- llm 960,104 (avg 96,010) vs scripted 1,168,973 — **0.82** vs exp9's
  0.85 on the same seed, through all the infra fire. Crowns 9 vs 38
  (breeding lag: 89 bred vs exp9's 153 — endgame orders 5 days late).
- 16 real translation losses in 888 calls; gait 6.1 proposals/barn-day.
- Full analysis: `postmortem-day91.md`. Arc pauses here — Zane pivots
  to the Rivet application; exp11 candidates filed.
