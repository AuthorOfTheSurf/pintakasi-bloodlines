# Coach session #1 — day 28 (exp10, the instrumentation season)

World `data/sim-20260816-1706.db` · seed 1 (same world as exp9 — this
season is also a replication test) · round 64 (`menu_json` live).

## Scoreboard through day 28

```
scripted (10): total net worth 353,330 · avg 35,333 · crowns 6
llm      (10): total net worth 359,811 · avg 35,981 · crowns 2
```

**Ratio 1.02 — the llm side LEADS at day 28.** Exp9's day-28 on the same
seed was 0.92; the options brief replicated and then some. Bagong Laban
#3, Hacienda Verde #4; six llm barns in the top eleven. Crowns lag 2–6
(scripted's early juvenile sweep) — same shape exp9 had before the
crown wave landed in segment 2.

## Gate (exp9's criteria, re-run)

1. **Retire uncoached: day 21** — the first legal day, SAME day as exp9.
   The first-link dissolution replicates exactly. 30 retire proposals.
2. Eggs uncoached: 6 bred by day 28 (exp9: 19 — lower, put on watch).
3. Juvenile economy uncoached: 798 juvenile fights (exp9: 712),
   78 juvenile crown entries (exp9: 91).
4. Translation losses: 25 all segment (incl. dupes), 8 offMenu.
5. Ratio 1.02 vs exp9's 0.92.

## THE NEW INSTRUMENT — first tie-aware read (menu_json, 1,702 picks)

Aggregate capture: topPicksTaken 80.8% · **topValuePicksTaken 87.6%** —
the tie-aware number runs ~7 points higher, confirming exp9's metric
understated agreement exactly as suspected.

The structural read Zane asked for:

| Menu shape | Share | What the model did |
|---|---|---|
| Top row UNIQUELY best | 83% of picks | took it 87% of the time |
| Top value TIED (2+ rows) | 17% | took a tied-top row 92% — but **letter A only 57% of those** |
| Close-second (Δ1) taken | — | 3.6% of all picks |
| Lower rows / explicit rests | — | 116 / 34 |

**The verdict on the rubber-stamp worry: the model is reading content,
not position.** When the top value is tied, a pure "reply yes to the
first option" bot would take letter A ~100% of the time; this model
takes A only 57% — it distinguishes between equal-valued rows on their
`why`/content. And 13% of uniquely-topped menus still get deviations
(close-seconds, lower rows, rests). Selection is real; the scout is
just usually right.

41 birds went unaddressed (menu shown, no pick returned) — small,
worth watching by creed after orders land.

## Orders (same palette as exp9 coach #1 — replication preserved)

Strategy differentiation only, no dated imperatives. Per creed (2 each):
- **Card sharks** (bot-7, bot-15): take value 6+, skip ≤2 unless age-1,
  never crown off-blade, rest beats a losing fight.
- **Bloodline architects** (bot-marco, bot-9): every breed row, retire
  rows on aging/losing hens, list every stud, chicks aim at juvenile
  crown rows.
- **Claim scouts** (bot-8, bot-16): every claim row shown; campaign at
  cheap claimer rungs between claims.
- **Talent scouts** (bot-14, bot-12): free pulls always, cull hard after
  5 fights, fight the hits into juvenile crowns.
- **Operators** (bot-13, bot-17): top-value row by default, deviate with
  a reason, age-8 veterans always take the free Major shot.

Breeding watch-item: 6 bred vs exp9's 19 — the architects' orders carry
the load here; check at day 56.

## What segment 2 must show

1. EV capture divergence by creed — now scoreable tie-aware (does the
   shark discipline show up as *informed* deviations, i.e. Δ1 rows and
   rests, rather than random ones?).
2. Breeding volume recovering toward exp9's pace.
3. Crown wave landing as rosters age (exp9 day 56: llm led 15–12).
4. Infra: first season on pool `pintakasi` + DEBUG daemon — any wedge
   at the seg2 handoff now names its defect in the log.
