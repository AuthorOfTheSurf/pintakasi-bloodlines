# Coach session #1 — day 28 (2026-08-15, exp5 "the instrument round")

## The scoreboard the coach saw

```
data/sim-20260815-1625.db — through day 28 · net worth = GP + 0.8·LT

rank  farm                        brain      GP         LT      net worth  crowns (GP won)
   1  Kevin Gamefarm              scripted     39,279   18,261     53,888  2 (8,953)
   2  Lupa Land Holdings          scripted     25,175   35,879     53,879  1 (2,627)
   3  Sabungero Syndicate         scripted     33,156    9,815     41,008  2 (3,851)
  10  Batangas Sprint Club        llm          25,927    3,423     28,665  —
  11  Pulang Bagwis               llm          24,070    3,931     27,215  1 (5,098)
  19  Ilonggo Ironworks           llm          16,114      501     16,515  —
  20  Ginto Gaming Club           scripted      1,612    6,224      6,591  —

scripted (10): total 377,498 · avg 37,750 · crowns 6
llm      (10): total 211,957 · avg 21,196 · crowns 1
```

Ratio at day 28: **0.56** — the strongest start of the five experiments
(exp4 sat near 0.5 at the same mark). Pulang Bagwis holds a Major crown
already; two llm barns sit ABOVE three scripted ones.

## What the new instruments showed

**The week ledger works, and its verdict is loud: crowns pay.** Last-7-days
margins for the four barns that entered championships — Batangas +3,024 GP
won on 480 fees, Pulang Bagwis +8,120 on 480, Cavite +892 on 160, Hacienda
+469 on 320. Every single crown week was profitable. Daily-card nets hover
near zero (±700) — the card is roughly break-even money that mints land; the
crowns are the actual income.

**The juvenile instrument fired, and hit the real constraint.** 24 juvenile
crown proposals in `brain_log` (the verb + brief lines work) — and **zero
landed**, against the scripted side's 106 juvenile entries. Diagnosis, and
it is not a bug this time: age is one bird-year per game-week, so the
discovery year is a chick's SINGLE age-1 week, and eligibility needs 2
juvenile wins banked before Wednesday. The llm barns had **zero eggs at day
28** — no chicks, therefore no tickets. The instrument made the juvenile
crowns visible; only a living pipeline can make them reachable.

**A third instrument gap found and fixed mid-run, exp1-style, logged
openly:** the cull law ordered "retire chronic losers to the breeding shed"
— and the verb menu had NO `retire`. A prompt commanding an action the barn
cannot express. Added `retire` (same public `Flock.retire` API the web UI
uses; engine still refuses under age 3) to bot-brain + schema + system
prompt, ordered before `breed` so a barn can cull a hen and pair her the
same morning. Tests 486/486 green.

## The orders written (all ten barns, `tune`, 10/10 bound)

Shared core: (1) retire the worst age-3+ loser hen TODAY, breed her the same
day, repeat weekly — an egg always cooking; (2) chick at age 1 → juvenile
lobbies every day → 2 wins before Wednesday → crown division juvenile at
b2/b4 nearest bestBlade; (3) Majors at bestBlade only; read weekLedger — if
cardNetGp goes negative, cut matchups, not crowns.

Per-barn: Talisay (card winners nightly, cull the 0-3s) · Ilonggo (playing
too small — enter more) · Marco (no retirees: retire a hen or no juvenile
crowns ever) · Cavite (crown week paid — scale it) · Cuchillos (shed idle —
pair the two retirees TODAY) · Pulang Bagwis (breed the replacement BEFORE
the next hardcore declaration) · Sugalan (cardNet −200: winners only) ·
Batangas (keep the crown engine, add the weekly breed) · Hacienda (thin
margin — bestBlade Majors only) · Bagong Laban (retire, breed, get
crownEligible).

## Operational note

Cold-tuning ten barns with no sim running wedged five envoy registrations
(the pinned lease-poisoning bug, textbook form) and the wedged leases then
broke seg2's first launch with `actor_ready_timeout`. Cure as documented:
daemon restart + `--keep` relaunch — day 29 ticked clean on the first try
(17 fights), rebind warnings absorbed by the retry regex. The rule stands:
**never cold-tune a fleet; launch the segment first, tune mid-run.**

## What segment 2 must show

1. Eggs > 0 at every barn by day 35; first llm juvenile-crown entries landing.
2. `retire` verb actually used (brain_log) — culls converting into breedings.
3. Crown declarations staying at bestBlade; ratio holding ≥ 0.56.
