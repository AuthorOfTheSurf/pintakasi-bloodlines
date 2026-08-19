# Coach session #1 — day 28 (2026-08-15)

Coach: Claude (autonomous, per COACHING.md). World: `sim-20260815-0137`.
Segment 1 health: 280 calls / 0 failures / 28.03 s/day · 0 invariant failures.

## Scoreboard at day 28

```
  rank  farm                        brain      GP         LT      net worth  crowns (GP won)
     1  Reno Gamefarm               scripted     43,260   14,948     55,219  2 (8,696)
     2  Lupa Land Holdings          scripted     24,036   37,359     53,923  —
     3  Kevin Gamefarm              scripted     34,593   16,832     48,059  1 (4,773)
     4  Tari ng Bayan               scripted     36,133    8,737     43,123  2 (4,629)
     5  Sagupaan Stables            scripted     33,839    9,414     41,370  —
     6  Kidlat sa Silangan          scripted     32,170    8,468     38,944  1 (1,268)
     7  Sabungero Syndicate         scripted     31,611    7,690     37,763  1 (1,268)
     8  Bulawan Broodfarm           scripted     32,420    6,417     37,554  —
     9  Dugo't Dangal Farms         scripted     30,175    4,829     34,038  —
    10  Bagong Laban                llm          29,374      862     30,063  —
    11  Pulang Bagwis               llm          28,758    1,085     29,626  —
    12  Sugalan Social Club         llm          27,259      765     27,871  —
    13  Cavite Bloodlines           llm          27,109      771     27,726  —
    14  Cuchillos de Sonora         llm          25,964      981     26,749  —
    15  Hacienda Verde              llm          25,707    1,067     26,560  —
    16  Ilonggo Ironworks           llm          25,753    1,008     26,559  —
    17  Talisay Tari Club           llm          25,738      757     26,344  —
    18  Batangas Sprint Club        llm          24,790      695     25,346  —
    19  Marco Gamefarm              llm          23,572      417     23,906  —
    20  Ginto Gaming Club           scripted        107      431        452  —

  scripted (10): total net worth 390,444 · avg 39,044 · crowns 7
  llm      (10): total net worth 270,750 · avg 27,075 · crowns 0
```

Scripted sweeps ranks 1–9; all ten llm barns hold 10–19. (Rank 20 is Ginto,
the scripted whale, doing exactly its job: rolling to the bottom of its
wallet.)

## Diagnosis

One cause: **volume.**

- **Fights in 28 days**: scripted barns 164–547; llm barns **29–55**. The llm
  barns enter 1–2 birds a day like careful managers; scripted pit crews card
  most of their roster nightly.
- Fights mint land win or lose (`landForFight`), so low volume is why the LT
  column is a wasteland: llm barns hold 417–1,085 LT vs scripted 4,317–37,359.
  Staked land compounds daily, so the gap widens on its own.
- Aggravator #1: the bloodline architects (bot-marco, bot-9) bred **once** in
  four weeks, combined. The pipeline creed produced no pipeline.
- Aggravator #2: **zero uses of the `crown` verb across all ten barns** — not
  one Major declaration in a month, in an experiment whose shared goal names
  championships as the +EV peaks.
- The models play cautious, tidy, and small. Nothing is *wrong* — 0 failures,
  drops are early-world eggs-only artifacts — they are simply under-playing
  the game's central loop: fight → land → stake → compound.

## Orders written (identical within each creed pair, per protocol)

| Barns | Creed | Orders |
|---|---|---|
| bot-7, bot-15 | card shark | Keep picking edges, but your volume is starving you: fights mint land win or lose, so enter every healthy bird at fair odds or better, every single day. Declare for a Major crown the moment any bird qualifies — that is where the purses are. |
| bot-marco, bot-9 | bloodline architect | You bred once in four weeks — the pipeline IS the business: pair a hen and a stud every time barn space allows. Meanwhile campaign every healthy bird daily; fights mint land win or lose. Declare for a Major crown whenever a bird qualifies. |
| bot-8, bot-16 | claim scout | Good claiming; now campaign what you built: enter every healthy bird every single day — fights mint land win or lose. Keep claiming undervalued birds. Declare for a Major crown whenever a bird qualifies. |
| bot-14, bot-12 | talent scout | Keep rolling for prospects, but FIGHT them: enter every healthy bird every single day — fights mint land win or lose. Cull the misses without sentiment. Declare for a Major crown whenever a bird qualifies. |
| bot-13, bot-17 | operator | The math this month says volume: enter every healthy bird every day (fights mint land win or lose), breed whenever space allows, and declare for a Major crown whenever a bird qualifies. Claim or roll only when clearly +EV. |

Operational note: nine tunes landed on the first pass; bot-7 wedged on the
cold-tune path and needed a second engine-daemon restart before its orders
applied (verified: career 28 days, orders present).

## What day 56 must show for the coaching to be judged working

1. Fight volume per llm barn well above the 29–55 band — the single number to
   watch.
2. LT accumulation inflecting (the compounding loop finally entered).
3. First `crown` verbs in `brain_log`; ideally a first llm crown won.
4. Breeds from the architects at a pipeline cadence, not once a month.
