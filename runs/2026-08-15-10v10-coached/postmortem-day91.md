# Postmortem — day 91 (2026-08-16, overnight)

World: `sim-20260815-0137` · 91 days · 910 llm barn-days scheduled, 890
played (two full-fleet no_envoys sit-outs after the segment-3 daemon
restart) · 0 invariant failures across all three segments.

## Final scoreboard (day 91)

```
  scripted (10): total net worth 1,272,740 · avg 127,274 · crowns 44
  llm      (10): total net worth   613,431 · avg  61,343 · crowns 0
```

Scripted swept ranks 1–9 all three segments; the llm ten held 10–19 as a
solid block; Ginto (scripted whale, roll-to-zero by design) pinned rank 20
throughout. Kevin Gamefarm ran away with the world: 273k net worth, 16
crowns, 185k LT.

## What the experiment established

1. **Volume is the game.** The scoreboard gap is a fight-volume gap
   compounding through land. Scripted barns fought 3× as often; every fight
   mints LT; staked LT yields daily. By day 91 the llm side's LT holdings
   (1,297–7,815) were an order of magnitude under scripted's (20k–185k).
2. **Coaching works — on what the barn can see.** Session #1's volume order
   roughly doubled enter proposals (487→874) and tripled LT accumulation.
   Language moved the scoreboard's slope.
3. **A coach cannot fix a fact-gap.** The crown order went 0-for-560 while
   the brief carried no tournament facts. The day-56 instrument fix
   (majorsThisWeek + crownEligible) produced **143 crown proposals and 28
   real Major declarations within one segment** — the blindness diagnosis
   confirmed by the cure. Doctrine: facts in the brief, skill in the orders.
4. **Declaring ≠ winning: 28 declarations, 19 eliminations, 9 refunds, 0
   crowns.** Eight blind low-volume weeks left the llm birds underdeveloped,
   and they walked into brackets owned by scripted champions. Winning crowns
   is a bird-quality pipeline problem, not a declaration problem.
5. **Breeding never took: 2 breeds in 91 days across ten barns** (the
   architects bred once each in segments 1–2, zero in segment 3). The
   pipeline creed produced no pipeline. Open question for exp2: whether
   breedable stock (retired hens + studs + space) was actually available and
   ignored, or never accumulated.
6. **Compliance varies by barn, not creed.** bot-17 eventually complied with
   the volume order (72 enters in seg3); its creed-twin bot-13 always had
   (53). The architects (bot-marco, bot-9: 26 each) stayed low-volume all
   run — possibly creed-consistent (pipeline over card), except they also
   didn't breed.

## What experiment #2 changes (the "everything we learned" build)

- **Crown-sighted from day 1** (the instrument fix ships in the brief).
- **Starting creeds bake in the lessons**: the volume doctrine (fights mint
  land win or lose), the crown chase, and an explicit breeding cadence for
  the architects — coaching should refine, not remediate.
- **Ginto normalized** (Zane's ruling): the roll-to-zero whale profile
  becomes a moderate spender so all ten scripted barns are honest
  competitors.
- Same seed (1), same split, same model, same 28/28/35 segments, coach at
  day 28 and 56.

## Honest caveats

- The two sit-out days cost the llm side ~20 barn-days of play (~2%).
- The day-56 instrument change makes segment 3 not directly comparable to
  segments 1–2 — deliberate, logged, and the reason exp2 exists.
- Net worth values LT at the 0.8 GP purchase price; land never sells back,
  so the llm side's *liquid* position is relatively better than the total
  suggests — but the land yield they forwent compounds, and that was the
  real loss.
