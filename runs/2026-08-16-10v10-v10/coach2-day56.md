# Coach session #2 — day 56 (exp10, the instrumentation season)

## Scoreboard through day 56

```
scripted (10): total net worth 681,029 · avg 68,103 · crowns 19
llm      (10): total net worth 634,496 · avg 63,450 · crowns 7
```

**Ratio 0.93** (exp9 day-56: 0.985; arc's best full season before that:
0.59). Bagong Laban #3, Batangas Sprint Club #5; four llm barns in the
top ten. The deficit vs exp9's parity decomposes into: two wedge
sit-out days (29–30), coach #1 orders landing day 33 instead of day 29
(the seg2 wedge delayed the tune), and the breeding lag below.

## The watch-item came due: the shed is starving

29 bred vs 95 retired · **31 actives** (exp9 day-56: 68 bred, 39
actives). Crowns 7 vs 19 — a thin roster can't fill crown brackets.
Same failure shape as exp9's day-56 watch-out, one notch worse. The
endgame orders below are exp9's, escalated.

## Per-creed EV capture, seg2 (orders bound day 33) — FIRST TIE-AWARE READ

| Barn | Creed | topA | topVALUE | uniq-top taken | devs | rests |
|---|---|---|---|---|---|---|
| bot-17 | operator | 86% | **100%** | 100% | 0 | 0 |
| bot-13 | operator | 82% | 82% | 88% | 7 | 4 |
| bot-marco | architect | 78% | 90% | 90% | 5 | 3 |
| bot-9 | architect | 67% | 78% | 76% | 14 | 7 |
| bot-12 | talent | 70% | 82% | 80% | 10 | 9 |
| bot-14 | talent | 76% | 79% | 79% | 13 | 6 |
| bot-7 | shark | 79% | 79% | 80% | 9 | 2 |
| bot-15 | shark | 74% | 77% | 85% | 7 | 5 |
| bot-8 | claim | 68% | 77% | 79% | 13 | 7 |
| bot-16 | claim | 41% | **56%** | 50% | 36 | 8 |

Findings the old metric couldn't show:
1. **bot-17's 14-point gap between topA (86%) and topVALUE (100%)** —
   every single "deviation" was a tied-value row. The purest
   trust-the-scout barn deviates ZERO times once ties are scored
   honestly. Coaching obedience is now exactly measurable.
2. The creed ladder replicates exp9's shape (operators top, claim
   scout bottom at 56% vs exp9's 58%) — on a different segment with a
   different wedge history. The instrument is stable.
3. Deviations are *informed*: claim scout bot-16's 36 deviations are
   its orders (cheap claimer rungs score below bestBlade rows).

## Envoy bug — the season's specimen (better than the coaching data)

Seg2's launch produced the arc's first wedge that SURVIVED two daemon
restarts: all ten actors durably parked (`sleeping: None`,
`connectable: None`, stale `no_envoys`, selector correct — read
straight off the engine's /actors API). The 30-minute stop threshold
did NOT self-clear it (checked at +2.5h). Probable cause: the daemon
was cycled ~90s after seg1's clean exit, interrupting engine-side
shutdown processing — the cycle-before-resume protocol CAUSED the
deeper wedge. Cure: another cycle hours later → 10/10 instant.
**Protocol amended: never cycle the daemon within minutes of a sim
exit; let the engine finish its shutdown bookkeeping first.**

## Endgame orders (bound mid-seg3, read-back verified)

Universal, appended to creeds: **breed EVERY day both sides are free —
the barn dies without chicks; a retire is only for a bird that LOSES;
chicks take juvenile crown rows the day they appear; age-8 veterans
always take the Major row.** Architects additionally: expand at the
barn wall.

## What day 91 must answer

1. Does the breed order refill the shed in time to matter (exp9's did:
   153 bred by day 91)?
2. Ratio: does the wedge tax + thin roster cost the 0.85 replication?
3. Tie-aware capture under endgame orders — does breed-row uptake show
   up as a measurable jump the way exp9's aggregate suggested?
