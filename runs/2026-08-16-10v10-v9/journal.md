# Exp9 — the options-brief season (2026-08-16)

World `data/sim-20260816-1435.db` · seed 1 · 10v10 · qwen3:30b-a3b ·
`--actors --personas=championship --brief=options` (round 63) · fresh
daemon started at launch (the 21-hour-old one was cycled — aged-daemon
envoy risk).

## What this season tests (pre-registered, spec §8)

The first world played on the OPTIONS brief: every fighter arrives with
legal, pre-valued rows attached; the reply is picks + an offMenu hatch.
Baseline = exp8b (identical code otherwise). Success criteria:

1. `retire` fires **before coach #1** (~day 14) — if yes, the first-link
   law was an interface artifact, not a model limit.
2. Eggs before day 28 without a dated coach imperative.
3. Juvenile crown entries ≥ exp8 pace without the coach naming them.
4. EV capture rate reported per segment (brain_log.offered_json — first
   measurement, no target).
5. Ratio vs. the 0.38–0.59 arc band — directional, not the headline.

Fail-fast gate at day 28 per Zane's standing rule (0 juvenile fights =
abort, fix, relaunch).

## Protocol

simulate 28 → coach #1 → simulate 28 --keep → coach #2 → simulate 35
--keep → postmortem day 91. Coach sessions shift role this season: the
rows carry the first-link imperatives now, so coaching goes to strategy
differentiation per creed. Tune orders verified by read-back, mid-run
only (never cold).

## Segment 1 (days 1–28) — launched

- Launch clean: all 10 barns answered day 0 (1.9–10.2s each).
- Day-0 drops are all **offMenu** attempts — breed/crown with invented
  handles on an all-eggs morning (the championship preambles urge the
  pipeline before anything exists to pair). Dropped honestly at
  translation; the MENU path cannot express these — exactly the split
  the design predicted.

## Day 28 — gate PASSED (all five), coach #1 done

- Ratio **0.92** (arc day-28 record was 0.57). Full readout in
  `coach1-day28.md`.
- THE HEADLINE: the first-link law broke — retire self-initiated on day
  21, the first day the row could legally render. 51 retirements, 19
  bred, 91 juvenile crown entries, 2 juvenile champions, all UNCOACHED.
- EV capture first reading: 78.6% top-pick, 53 rests, 5 offMenu, 11
  drops all segment.
- Envoy bug: seg2 launch crashed twice (durable no_envoys on seg1's
  actors, survived a daemon restart). Crash site isolated: the persona
  re-application at sim startup is the one unretried actor call.
  Protocol fix: resumes never pass --personas (creeds are durable).
- Coach #1: strategy-differentiation orders only (no dated imperatives),
  10/10 bound + verified mid-run. Seg2 running days 29–56.
