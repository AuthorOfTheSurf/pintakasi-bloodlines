# Coach session #2 — day 56 (2026-08-15)

World: `sim-20260815-0137`. Segment 2 health: 280 calls / 2 failed /
40.84 s/day (briefs grow with the world) · 0 invariant failures.

## Scoreboard at day 56

```
  rank  farm                        brain      GP         LT      net worth  crowns (GP won)
     1  Kevin Gamefarm              scripted     73,119   92,454    147,082  7 (21,724)
     2  Reno Gamefarm               scripted     74,836   51,751    116,237  6 (15,670)
     3  Lupa Land Holdings          scripted     25,386   83,174     91,925  —
     4  Kidlat sa Silangan          scripted     56,415   27,539     78,446  3 (4,261)
     5  Sabungero Syndicate         scripted     58,245   24,150     77,565  3 (4,624)
     6  Tari ng Bayan               scripted     60,218   15,821     72,875  2 (4,629)
     7  Sagupaan Stables            scripted     56,499   10,516     64,912  —
     8  Bulawan Broodfarm           scripted     53,257    8,619     60,152  —
     9  Dugo't Dangal Farms         scripted     51,037   11,193     59,991  —
    10  Sugalan Social Club         llm          46,410    3,301     49,051  —
    11  Pulang Bagwis               llm          45,535    3,951     48,696  —
    12  Cavite Bloodlines           llm          46,236    2,164     47,967  —
    13  Talisay Tari Club           llm          44,494    3,814     47,545  —
    14  Ilonggo Ironworks           llm          43,883    4,423     47,422  —
    15  Cuchillos de Sonora         llm          40,618    4,222     43,995  —
    16  Batangas Sprint Club        llm          39,619    2,624     41,718  —
    17  Bagong Laban                llm          39,674    2,331     41,538  —
    18  Hacienda Verde              llm          38,918    3,264     41,529  —
    19  Marco Gamefarm              llm          39,202    1,281     40,227  —
    20  Ginto Gaming Club           scripted        181      739        772  —

  scripted (10): total net worth 769,958 · avg 76,996 · crowns 21
  llm      (10): total net worth 449,689 · avg 44,969 · crowns 0
```

## Did session #1's orders take? Half.

**The volume order took.** Enter proposals per barn, segment 1 → segment 2:
bot-15 71→157, bot-8 44→111, bot-14 33→103, bot-16 45→102, bot-7 65→106.
Fleet total 487→874 proposals; llm fights roughly 2.5× segment 1's rate. LT
holdings tripled-to-quadrupled (417–1,085 → 1,281–4,423). Two barns ignored
the order (bot-marco 40→40, bot-17 54→52) — noted for session #3.

**The crown order could not take, and now we know why.** Zero uses of the
crown verb in 280 more calls — 560 for the experiment — despite an explicit
order. Investigation: **the morning brief contains no tournament section at
all.** No majorsThisWeek, no eligibility flag, nothing. Scripted bots read
the crown facts straight from the database (`chaseCrowns`); an outside brain
only knows what its mail says, and its mail never mentioned the Majors.

**The lesson, stated as doctrine: a coach cannot fix a fact-gap.** "Facts in
the brief, skill in the standing orders" — the crown order was skill aimed at
a missing fact. No amount of language makes a barn see a tournament its
brief doesn't carry.

## The instrument fix (applied at this boundary, in the open)

`BotView.crowns` now carries this week's Major formats and the ids of MY
birds clearing the declare bar (same facts, same indexed query as
`chaseCrowns`: active, named, hardcore age, ≥1 real win). The digest adds
`majorsThisWeek` and marks eligible fighters `crownEligible: true`; the
system prompt gains the crown rule and a GOOD-DAY line. This changes the
world every barn sees from day 57 — recorded here precisely because a
mid-experiment instrument change is a discontinuity the story must own.

## Orders: KEEP, all ten barns

Deliberate: the standing orders already demand crowns and volume. Holding
them constant while the brief gains the crown facts isolates the
instrument's effect — segment 3 measures the fix, not a new speech.

## What day 91 must show

1. First crown declarations (and ideally a first llm crown won) — if crowns
   appear now, the blindness diagnosis is confirmed by the cure.
2. The two order-ignoring barns (bot-marco, bot-17) vs their compliant
   creed-twins — the first within-creed compliance comparison.
3. Whether the net-worth gap (76,996 vs 44,969 avg) stops WIDENING — the
   compounding land base makes catching up unlikely in 35 days; the honest
   target is the second derivative.
