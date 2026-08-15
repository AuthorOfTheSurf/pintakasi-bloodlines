# Postmortem #5 — day 91 (2026-08-15, exp5 attempt 2, "the instrument round")

World `data/sim-20260815-1736.db` · doctor: 0 warnings, 0 invariant failures.

## Final scoreboard

```
scripted (10): total net worth 1,227,995 · avg 122,799 · crowns 40
llm      (10): total net worth   532,348 · avg  53,235 · crowns 7
```

**Ratio 0.43 — a regression** (arc: 0.48 → 0.58 → 0.59 → 0.52 → **0.43**).
The instrument round made the barns BETTER-INFORMED and WORSE-PAID, and the
autopsy says exactly why.

## The three questions coach #2 left open

1. **Did any llm juvenile-crown entry land? NO — and now we know the real
   lock.** Season juvenile fights: scripted 6,214, llm **0**. Not one. The
   chicks existed (87 bred birds — a five-experiment record), but an age-1
   bird may only fight `mode:"juvenile"`, and nothing in the prompt or
   brief ever said so; `enter` actions default to `mode:"real"`, the engine
   said its quiet no, and every chick sat idle through its one discovery
   week. Eligibility (2 juvenile wins) was therefore unreachable — the
   juvenile crowns were locked behind a MODE WORD. Instrument gap #4, same
   family as the crown blindness, the missing facts, and the missing retire
   verb: the model cannot use a door the mail never mentions.
2. **Did the egg wave beat the age cliff? Half-way.** 87 birds bred (vs ~0
   in exp1), 18 manual retirements, 65 retire proposals — the retire→breed
   loop genuinely ran. End-of-season actives: llm 87 vs scripted 380. The
   pipeline finally exists; it started ~4 weeks too late to fully restock.
3. **Ratio vs exp3's 0.59? Down 16 points**, and the volume line explains
   most of it: 1,053 llm fights vs exp4's 2,460 and exp3's ~1,700. The
   weekLedger law ("if cardNetGp is negative, enter fewer") plus the cull
   law suppressed exactly the volume that mints land and pays purses.
   Exp4 proved volume without depth is negative-margin; exp5 proved
   **caution without volume is worse** — the fee leak stopped, and the
   income stopped with it.

## Instrument autopsy

| Instrument | Verdict |
|---|---|
| weekLedger margin feedback | Worked TOO well — overtrading gone, but volume collapsed with it. Needs a floor: "cut clearly-losing matchups," not "enter fewer." |
| retire verb + cull law | Alive and used (65 proposals / 18 landed). Keep. |
| juvenile crown visibility | Necessary, NOT sufficient — blocked by the mode gap above. |
| blade-fit law | 51/84 Major entries (61%) at best-evidenced blade — *below* exp4's 73%; young thin-evidence birds dominate declarations, so the law needs the scout's bestBlade named in the declaration line, not a win-rate the bird hasn't earned yet. |
| expand_barn nudge | Untested — no barn refilled to cap. |

## Exp6 changes (baked in from day 1)

1. **THE MODE LAW** — brief flags every age-1 fighter `juvenile: true`;
   system prompt: age-1 birds enter with `mode:"juvenile"` ONLY, every day
   of their discovery year. This unlocks everything the juvenile
   instruments were built for.
2. **Pipeline from week 1** — first breeding by day 7; two pairings a week
   when hen+stud+space allow. Exp5's pipeline worked but started at day 29.
3. **Volume floor restored** — every healthy bird fights unless its matchup
   is clearly bad; weekLedger trims the worst entries, never the card.
4. **Endgame veteran law** — age-8 birds campaign nightly and take the free
   Major shot (the cliff retires them regardless).

## Provenance note

Attempt 1 of exp5 was aborted at day 75 (daemon store corruption — see
`aborted-attempt-1/WHY-ABORTED.md`); attempt 2 ran clean end to end: zero
actor timeouts, zero invariant failures, all three segments + two coach
sessions on protocol.
