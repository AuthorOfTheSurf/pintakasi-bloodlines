# Coach session #2 — day 56 (exp9, the options-brief season)

## Scoreboard through day 56

```
scripted (10): total net worth 677,035 · avg 67,703 · crowns won 12
llm      (10): total net worth 666,908 · avg 66,691 · crowns won 15
```

**Ratio 0.985 — statistical parity, and the llm side LEADS on crowns won
15–12** (7 juvenile + 8 Major champions vs. 6 + 7). Exp8b's day-56 was
0.52; the arc's best-ever FULL-SEASON mark was 0.59. Bagong Laban
(bot-17, operator) is **#2 in the world**; five llm barns sit in the top
ten.

## EV capture diverged by creed — coaching is now a number

Segment 1 baseline was one undifferentiated 78.6%. After coach #1, the
segment-2 per-barn spread (top-value picks / picks):

| Barn | Creed | EV capture | Rests |
|---|---|---|---|
| bot-13 Hacienda Verde | operator | 98% | 0 |
| bot-17 Bagong Laban | operator | 92% | 5 |
| bot-8 Cuchillos de Sonora | claim scout | 85% | 5 |
| bot-9 Cavite Bloodlines | architect | 81% | 7 |
| bot-15 Ilonggo Ironworks | card shark | 78% | 15 |
| bot-marco Marco Gamefarm | architect | 77% | 3 |
| bot-12 Batangas Sprint Club | talent scout | 76% | 3 |
| bot-14 Sugalan Social Club | talent scout | 75% | 7 |
| bot-7 Talisay Tari Club | card shark | 74% | 10 |
| bot-16 Pulang Bagwis | claim scout | 58% | 11 |

Operators (ordered "trust the scout") went to the top; card sharks
(ordered "skip weak rows, rest beats a losing fight") sank below
baseline with the most rests; bot-16's 58% is obedience too — its orders
say campaign cheap claimer rungs, which score below bestBlade rows. The
instrument reads BACK the orders given. And the standings answer the
spec's argmax worry with a twist: the purest score-follower creed is
winning — on a menu whose top row is usually right, trust is a strategy.

## Watch-outs → endgame orders

- **The cull outpaced the shed**: 103 retired vs. 68 bred, 39 actives.
  Universal order: breed row EVERY day both sides free; a retire is for
  hens who LOSE.
- Chicks → juvenile crown rows the day they appear; age-8 veterans
  always take the Major row; architects expand at the wall.
- 10/10 bound + read-back verified, mid-run (seg3b).

## Envoy bug, third dataset

Seg3's first launch wedged ALL TEN barns out of days 57–58 —
`no_envoys` through the full 3-attempt retry, after a clean process
exit (seg2b) had leased the actors to its own envoy. Cure, again:
daemon restart + relaunch (seg3b bound 10/10 instantly). The llm side
sat out two days; the scripted side played them — a small honest
handicap noted for the postmortem. Pattern now firm across the arc:
**a process handoff wedges reused actors until the daemon's in-memory
leases are cleared; the takeTurn retry alone cannot always outwait it.**

## What day 91 must answer

1. Final ratio — does parity hold as scripted land compounds (llm LT
   4–25k vs. scripted up to 70k)?
2. Do the endgame orders show up in the EV numbers (breed-row uptake,
   fewer winner-culls)?
3. Champions from BRED chicks, not starters.
4. First full-season EV capture + gait table for BRAINS.md.
