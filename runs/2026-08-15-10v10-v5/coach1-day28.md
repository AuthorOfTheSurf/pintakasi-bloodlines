# Coach session #1 — day 28 (2026-08-15, exp5 attempt 2, the clean run)

World: `data/sim-20260815-1736.db`. Fresh daemon store, retire verb live
from day 1, no infrastructure incidents — 0 actor timeouts in segment 1.

## Scoreboard through day 28

```
scripted (10): total net worth 386,476 · avg 38,648 · crowns 7
llm      (10): total net worth 208,297 · avg 20,830 · crowns 1
```

Ratio 0.54. Attempt 1 sat at 0.56 at the same mark — same shape, clean
provenance this time.

## Instrument readings

- **Juvenile entries: 0** (scripted side well past 100). Same diagnosis as
  attempt 1 and NOT a bug: a chick's discovery year is one game-week, needs
  2 juvenile wins by Wednesday — and every barn holds **zero eggs**, so
  there are no chicks. The pipeline is the gate to the juvenile crowns.
- **Retire verb: 0 uses.** Present in the schema, never proposed unprompted.
  The verb exists; the habit doesn't — that's what standing orders are for.
- **Crown ledger (season to date):** Ilonggo +5,162 GP on 640 fees (fleet
  best); Cavite +665/480; Cuchillos +197/320 (breakeven-ish); Pulang Bagwis
  903/800 (loose declarations); Batangas 0 back on 960 and Bagong Laban 0
  on 1,120 — **off-blade declarations are pure donation**, the same 27%
  leak exp4's data showed.

## Orders (all ten via tune, mid-run per the operational law, 10/10 bound)

Shared core: weekly retire-worst-hen → breed same day, an egg always
cooking (age-9 force-retirement will empty un-restocked barns by day 63);
chick at age 1 → juvenile lobbies daily → 2 wins by Wednesday → crown
division juvenile at b2/b4 nearest bestBlade; Majors at bestBlade only;
read weekLedger — cut bad matchups, never crowns; expand_barn when full.

Per-barn: pointed at each ledger line above — the two crown-fee bleeders
(Batangas, Bagong Laban) ordered to stop declaring off-blade entirely;
Ilonggo told to protect its engine by breeding the replacement first;
Talisay and Sugalan (zero crown activity) ordered to get a bird declared.

## What segment 2 must show

1. Eggs at every barn by day 35; first juvenile-crown entries by day 42.
2. retire proposals appearing in brain_log.
3. Off-blade Major declarations → ~zero; ratio ≥ 0.54 and climbing.
