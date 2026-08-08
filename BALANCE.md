# BALANCE — the measured state of the fight engine

Produced by `bun run balance`, at `--runs=1000` (±2.2 points at 95%) with
headline numbers re-measured at `--runs=4000` (±1.1) where noted. Every number
here is reproducible: the lab is deterministic over a fixed seed window, and
`--converge=5` re-measures across disjoint windows to prove a figure isn't an
artifact of one.

**Round 27 rewrote this file.** Round 26's edition recorded the fix round
(station slope, stars-as-volume-knob, divisor 85) and left one big item open:
"the phase/blade-weight rework, deferred until the new blade lengths land."
Round 27 is that rework. The dial got its fifth blade and its true middle,
the absolute phase windows died, wind went uniform, stamina became the fuel
tank, and the whole thing was tuned at B3 and worked outward — exactly the
tuning philosophy the odd blade count was designed to buy.

```
bun run balance                       # all 16 cases
bun run balance sensitivity --runs=4000
bun run balance --sweep=FORMATS.b3.statScale=0.9,1.0,1.1
bun run balance --converge=5
bun run balance --json | --csv
```

Warnings are design gaps being catalogued, so the tool **exits 0** with them.
Only tool errors exit non-zero. The whole suite currently prints **one**
warning (item 1 under "Still open").

---

## The round-27 engine, in five sentences

Every turn roll blends ALL FOUR distance stats by the blade's `weights`
(B1 keys agility, B2 sight, B3 nobody — dead flat — B4 stamina, B5 gameness).
Wind is a uniform 100 for every bird; no stat buys hit points. Stamina sets
the FUEL TANK (`8 + stamina × 0.014` turns of full output; past it the bird
hits the wall and its agility/sight halve). A per-blade `statScale` makes a
stat gap worth roughly the same win rate whether the fight samples it 5 times
or 45. Station, condition, stars, weather and the clawback all survived
round 26 unchanged in mechanism — just scaled per blade like everything else.

## Fixed this round, with the after-numbers

### 1. The grade ladder pays the same on every blade (was: ±10-point spread)

Round 26 hit the 80/98 targets only at B3 — the ends deviated because turn
count amplifies stats, and one divisor can't fix five blades. `statScale`
(1.5 / 1.15 / 1.0 / 0.9 / 0.8 across B1–B5) is that fix. At 4,000 runs:

| blade | +100 wins (was, r26) | +200 wins (was, r26) | target |
|---|---|---|---|
| B1 | 76.3% (69.1) | 91.8% (84.9) | 80 / 98 — the one remaining ⚠ |
| B2 | 77.2% (74.8) | 93.1% (91.6) | ✓ |
| **B3** | **83.7%** (82.9) | **97.0%** (97.4) | **✓ the reference point** |
| B4 | 84.9% (87.5) | 97.6% (98.8) | ✓ |
| B5 | 84.6% (—) | 98.0% (—) | ✓ |

B1's +200 miss (91.8 vs 98) is a variance floor, not a tuning error: five
turns of 2d6 plus a 2.5× Tari Strike simply cannot deliver 98% — pushing
statScale high enough to force it would overshoot the +100 target badly. The
sprint stays the game's upset blade, on purpose, and this file is where that
is written down.

### 2. Every blade rewards its intended stats (was: 3 of 4 inverted)

The sensitivity matrix (+200 on one stat vs flat, 4,000 runs):

| stat | B1 | B2 | B3 | B4 | B5 |
|---|---|---|---|---|---|
| agility | **75.5** | 63.8 | 68.2 | 57.6 | 54.6 |
| sight | 65.9 | **74.2** | 68.2 | 60.8 | 57.5 |
| stamina | 56.1 | 59.6 | 68.2 | **80.9** | 71.2 |
| gameness | 55.1 | 58.7 | 67.8 | 71.9 | **86.8** |
| station | 50.0 | 50.0 | 50.0 | 50.0 | 50.0 |
| condition | 51.6 | 51.8 | 52.4 | 51.7 | 52.3 |

One key stat per off-center blade, every stat live on every blade (the old
engine had gameness structurally DEAD on B1 — its phase started at turn 11 of
a 5-turn blade), and **B3 even to 0.4 points** — the flat bird's home. All
five rows match `intent.ts`, which was re-ruled to the round-27 map in the
same commit. The lab's `reach` case now audits the matrix itself: weights all
positive, rows summing to 1, and the dial symmetric (agility's column read
B1→B5 mirrors gameness's read B5→B1; sight mirrors stamina; max |diff| 0.08).

### 3. Shape pays — except at the middle, where it correctly doesn't

Same-total builds (+100 top two stats, −100 bottom two): specialists win
66.5 / 61.1 / — / 67.8 / 75.8 on B1/B2/B4/B5, anti-specialists lose the
mirror image. At B3 both directions of specialist fail to beat flat
(48.8 / 50.7) — "no shape beats flat at the middle blade" is now a lab
verdict, not a slogan. Getting it took under-weighting stamina/gameness at B3
(0.29/0.29/0.21/0.21) because those two carry side routes (the wall; the
morale check) that equal weights had left ~4 points loud.

### 4. Stamina is a real distance stat (was: a decorative decay knob + secret HP)

The old plumbing — wind pool per stamina point, per-turn decay — is gone.
Uniform 100 wind, and stamina's two new routes measured separately (`fuel`):

| blade | whole lift | direct weight alone | fuel wall alone |
|---|---|---|---|
| B1 | +5.9 | +5.9 | −0.6 |
| B2 | +10.3 | +10.3 | −0.7 |
| B3 | +17.5 | +14.0 | +3.9 |
| B4 | +30.3 | +27.8 | +2.3 |
| B5 | +20.9 | +19.0 | −0.2 |

Honest verdict: the **weight** carries stamina's value; the **wall** adds
2–4 points on the middle blades and ~nothing at the ends — at B1/B2 no tank
ever empties (0% of fights reach the wall), and at B5 *everyone* is blown by
the end (99.5% of fights pass a starter's 12.9 fuel turns), so marginal fuel
turns matter most at B3/B4 (37% / 85% wall rates). The wall's real product is
structure: the "X is blown — running on heart" beat, and the guarantee that
the deep water tests heart in every long fight.

### 5. Figures survived the surgery

Recalibrated `GHOST_PACE` puts an even starter fight at ~52 on every blade
(winner mean; the target band). Fidelity improved again: +50 per stat moves
the figure +9.8 to +12.7 (2–3 fog widths), +100 moves it +19 to +23, on every
blade, and the figure inversion guard now floors a winner at one band (a
bell decision with almost no blood could band a WIN to 0 at uniform wind and
tie the loser's floor).

### 6. The stars/weather spread across blades tightened for free

Because `statScale` scales the element edges too, a 5★ matchup is worth
77–87% across the dial instead of round 26's 70–88, and the stacked worst
case (5★ wheel + weather day) peaks at **94.9%** on B5 — was 95.8 on B4.
Still verdict-shaped, still the rarest configuration in the game, still item
2 under watch.

---

## Pairs buy range — measured after round 28 (`pairs`)

Zane's hypothesis: a bird bred `[450, 450, 350, 350]` should be strong at
both blades its two stats key, and still good in the middle against a flat
bird. **Confirmed, at 4,000 runs, for all six pairs.** Every row is +100 on
two stats against a flat 350 bird:

| pair | B1 | B2 | B3 | B4 | B5 |
|---|---|---|---|---|---|
| **agility & sight** | **70.8** | **69.2** | 68.2 | 59.0 | 56.2 |
| sight & stamina | 61.1 | 67.1 | 69.4 | **72.8** | 65.2 |
| stamina & gameness | 55.3 | 59.2 | 68.7 | **77.0** | **80.6** |
| agility & stamina | 66.3 | 61.7 | 69.4 | **71.4** | 63.4 |
| sight & gameness | 60.2 | 66.5 | 67.9 | 66.4 | **75.3** |
| agility & gameness | 65.8 | 61.0 | 67.9 | 65.2 | **73.8** |

±1.0. No pair is ever below 55% — a paired bird has no bad blade, which is
the property the plan is bought for.

**Range is real, and it costs peak.** The shape table runs a pair and a
single spike at the SAME total surplus, both against flat:

| build | peak | peak height | spread (max−min) |
|---|---|---|---|
| pair agility & sight | B1 | 70.8 | **14.6** |
| spike agility +200 | B1 | **75.5** | 20.9 |
| pair stamina & gameness | B5 | 80.6 | 25.3 |
| spike gameness +200 | B5 | **86.8** | 31.8 |

The trade, in one line: a pair gives up roughly **5 points of peak** and buys
back roughly **5 points at its second home and at B3**. Spike spreads run
16.7–31.8, pair spreads 9.7–25.3 — narrower and taller vs wider and flatter,
exactly as the PFL precedent says. Both are real lines; neither dominates.
(Single-spike balance is a separate concern, ruled so by Zane: stars, station
and condition are all still on the table for a one-number bird.)

**The middle blade is the pair's blade.** B3 sits at 67.9–69.4 for every
single pair — for four of the six it beats one of the pair's own key blades,
and for the widest pairs it is their *third* best blade. That is B3 doing
what it was built to do: it weighs all four stats equally, so a two-stat bird
collects on both halves there while a spike collects on one. The `pairs` case
exempts the even blade from its home check for exactly this reason (read off
`intent.ts`, not hardcoded, so a future even blade inherits it).

**Saturation is mild.** Every pair keeps 92–100% of the sum of its two single
lifts; the only real losses are at the extreme corners (stamina & gameness on
B5: +30.6 of +33.4), where the ceiling does the flattening. Nothing here
behaves like two stats fighting over the same roll.

**One honest caveat about the ends.** Pairing a far stat onto an end blade
softens that end: agility & stamina peaks at B4, not B1, and agility &
gameness at B5, not B1 — because B1 reads its partner stat at 0.12 while B4
reads stamina at 0.40. The end blades are the least forgiving places to bring
a split bird, which is a fair reading of a sprint.

## The Pit Figure is centered ~20 points low — measured round 29

> **RESOLVED in round 30, and not the way this section proposed.** The scale
> did not need re-centring, it needed an ANCHOR: `GHOST_PACE` and the whole
> ghost-divisor family are deleted, and the figure is now spine × night with
> a unit. The blade-fit shrinkage recorded below is fixed too — fit went
> multiplicative. See **"The Pit Figure has a unit — rebuilt round 30"**.
> Kept as history because it is the measurement that forced the rebuild.


`GHOST_PACE`'s comment promises that an even fight between starters figures
~50. It doesn't, and hasn't since round 27 rescaled the wind and every
`damageMult`. The `symmetry` control reads:

| blade | mean figure, even fight |
|---|---|
| B1 | 26.9 |
| B2 | 27.1 |
| B3 | 29.3 |
| B4 | 30.2 |
| B5 | 31.5 |

Flat across the dial, so the cross-format normalization still works — the
whole SCALE is just low. Live worlds agree: mean normalized figure 32.1
(winners 55.3, losers 8.9).

Two consequences, one fixed and one deferred.

**Fixed:** `SCOUT.PRIOR_FIGURE` was 50 — the score an unread blade gets. With
reality at ~30, every blade a bird had actually fought was dragged toward 32
while every blade it hadn't stayed parked at 50. *Evidence lost to ignorance,
by construction.* Replaying 5,505 live entries with only that number changed:
scout accuracy **26.5% → 31.2%** exact, **52.2% → 56.0%** on-or-adjacent.
`PRIOR_WEIGHT` at 0.5 / 1 / 2 all landed within 0.3, so this was the prior
itself, not the Bayes.

**Deferred:** re-tuning `GHOST_PACE` so ~50 really is average. Live figures
currently occupy roughly 5–55 of the 0–150 range, so `FIGURE.NOISE` (±4) eats
a large share of every read, and the blade-fit signal the scout exists to find
is proportionally quieter than it should be. Recentring would stretch the
usable scale ~1.6× for free. It is its own round: `GHOST_FIGURE`, `CLASS_BASE`,
`MAX` and the Handbook's figure pages move together, and an S+ specialist
already reads 110 against the clamp at 150.

### The blade-fit signal, and why it is hard

Read the `figuregrade` table ACROSS a row rather than down it. A fixed
200-point specialist shape, against fixed B+ company:

| public grade | home | adjacent | middle | home − middle |
|---|---|---|---|---|
| B (250) | 22.6 | 18.3 | 11.9 | 10.7 |
| B+ (350) | 41.2 | 36.7 | 29.3 | 11.9 |
| A (450) | 59.6 | 56.0 | 50.5 | 9.1 |
| A+ (550) | 77.4 | 73.9 | 70.3 | 7.1 |
| S (650) | 93.8 | 90.6 | 88.9 | 4.9 |
| S+ (750) | 110.2 | 107.6 | 106.7 | 3.5 |

Down a column, a grade step is worth +16 to +21. Across a row, the entire
blade-fit signal is 3.5–11.9 and **shrinks as the bird improves** — the
home-vs-adjacent gap (2.6–4.5) is under `FIGURE.NOISE` at every grade. The
Pit Figure is overwhelmingly a POWER meter; discovery needs a SHAPE meter.
Good birds are harder to type than bad ones, which is a long-term ceiling on
the discovery loop and probably wants its own ruling.

**Two fixes tested and rejected, so nobody retries them.** Normalizing the
result out of the figure (subtracting the win/loss means) DROPPED accuracy
31.2% → 23.2% — winning at a blade *is* blade-fit evidence. Weather
normalization is worth only +0.2 to +0.8 points; real, but not the
bottleneck, since only ~25% of entries are timed and stars scale the effect.
It needs no schema change whenever it is wanted (`weatherOfDay(dayIndex)` is
a pure function of a column already stored).

## The flock had no shape to discover — measured round 29

> **RESOLVED in round 30 — partly.** The scout half is fixed (mature clear-home
> accuracy 30.5% → 57.5%), and the flock now has a pedigree ladder proving the
> shape is compounding rather than merely being chosen. What is NOT settled is
> the population itself: the doctor's "worth finding" line still straddles its
> 50% bar. See **"Discovery, after the rebuild"** and open item 7.
> Kept as history — this is the measurement that produced `BREEDING_PLAN`.


The doctor's answer key is the argmax over `FORMATS[].weights`. Measured
across a 13-week world, how much the median bird's home blade beats its
runner-up:

| percentile | home-blade margin (weighted stat points) |
|---|---|
| p10 | 1.9 |
| p50 | 11.1 |
| p90 | 28.3 |

**Half the flock had no home blade worth finding.** Those birds are
unlearnable by construction, and grading the scout on them reports noise as
failure. Restricting to birds with a real home, on the same logs:

| answer key | scout exact | vs random |
|---|---|---|
| all birds | 31.2% | 20% |
| home margin ≥ 10 | 35.6% | 20% |
| home margin ≥ 25 | 47.6% | 20% |

The scout was never as blind as the raw number said. The cause was breeding,
not the report: bots took the first legal cover off a shuffled list, which
optimises for nothing and regresses every line to the middle. Round 29 gave
them `BREEDING_PLAN` — a house shape, and a priced choice — and the doctor
now prints the flock's median home margin beside the accuracy, because that
number is the CEILING on everything above it.

## The Pit Figure has a unit — rebuilt round 30

Round 29 booked "recalibrate `GHOST_PACE`" as its own round. It got one, and
the diagnosis moved: the number was not mis-centred, it was **unanchored**.
`pace / GHOST_PACE × 100` reads like "percent of a maxed bird", but `pace` was
wind DEALT — which depends on the opponent — so nothing pinned the scale.
Twice over that showed: round 27 rescaled the wind and every figure in the
game moved ~20 points silently, and `CLASS_BASE`/`CLASS_DIVISOR` existed only
to put back a quality signal raw pace could not carry.

The figure is now **spine × night**. The SPINE is the bird's weighted stat
blend at that blade on a fixed scale — dice-free, opponent-free, and
untouched by `damageMult`, `ROLL_DIVISOR` or the wind pool, so no future
combat rebalance can move it. The NIGHT is the ratio of the roll bonus the
bird actually rolled to what a `NOMINAL_CONDITION` bird would have rolled,
which is where condition, the wheel, the weather, station's clawback and the
fuel wall land. A loss is marked down by beaten lengths as a SHARE. One track
variant fogs both sides. `GHOST_PACE`, `GHOST_FIGURE`, `CLASS_BASE`,
`CLASS_DIVISOR`, `BEATEN_SCALE`, `MIN_BEATEN` and `MAX` are deleted — figures
are no longer capped at all.

**The peg, measured at build time (600 fights per cell).** Two identical
flat-1000 birds at B3: the winner posts **102.8**, the loser **81.6**, mean
92.1. So `PEG_FIGURE` is what a flat `PEG_STAT` bird posts *when it wins* —
the peg is on the number, not near it. Flat 320 (today's starters) reads 25.2
mean; flat 1500 reads 153.1.

**A grade is 10 points, everywhere.** The spine is linear in the blend, a
grade band is 100 stat points, and 1000 stat points are 100 figure points —
so a letter grade is worth exactly 10 figure points at every rung. Nothing
fits that number any more; the lab's grade-calibration case DERIVES its
target from `FIGURE.PEG_STAT`/`PEG_FIGURE` (10% tolerance for quantization)
and measures, across grades and blades:

+10.1 / +9.9 / +9.7 / +11.5 / +11.6 / +11.7 / +11.5 / +11.6 / +12.2 / +10.9 /
+10.8 / +10.8 / +10.7 / +10.7 / +10.4

A miss there now means the engine broke a promise its own config makes,
rather than that somebody set a target too high.

### Blade fit went multiplicative for free — the round-29 shrinkage is gone

Every format's weight matrix sums to exactly 1.00 (round 27), so a FLAT bird
blends identically at all five blades: cross-blade comparability by
construction, with no hand-tuned per-blade table — which is exactly the job
`GHOST_PACE` had been doing by hand. A SHAPED bird's fit then falls out
proportionally with no fit term written anywhere. Measured on a true
specialist (pair +200, off-pair −200) at five levels:

| base | B1 | B2 | B3 | B4 | B5 | home−middle | home−worst |
|---|---|---|---|---|---|---|---|
| 320 | 37.0 | 32.0 | 25.8 | 16.3 | 13.2 | 11.2 | 23.8 |
| 500 | 54.7 | 49.4 | 43.1 | 31.1 | 27.1 | 11.6 | 27.6 |
| 800 | 84.5 | 79.6 | 74.0 | 58.8 | 53.7 | 10.5 | 30.8 |
| 1200 | 127.7 | 122.2 | 118.0 | 103.0 | 95.7 | 9.6 | 32.0 |
| 1600 | 175.7 | 170.8 | 168.2 | 153.0 | 147.6 | 7.5 | 28.2 |

Compare the round-29 table above, where home−middle **collapsed 11.9 → 3.5**
as birds improved and good birds were structurally harder to type than bad
ones. Home−middle now holds near 10 at every level, and home−worst GROWS with
the bird. Against `FIGURE.NOISE` (±4) that is a signal a scout can read on a
good bird, which is the thing the old figure had stopped being able to do.

### Discovery, after the rebuild

Rebuilding the figure moved the scale under the scout — the round-27 mistake,
repeated. This time both fitted constants were replaced rather than re-fitted:
`SCOUT.OWN_GRADE_STEP` 15 → **10, derived** (and pinned by `scout.test.ts`, so
a future re-peg fails loudly), and `SCOUT.OPPONENT_GRADE_STEP` 5 → **0** — the
opponent has left the figure entirely. Measured, holding own grade at B+: mean
figure 27.0 against B+ company, 27.8 against B, 25.8 against A. Flat.

`SCOUT.PRIOR_FIGURE` 30 → **27** is the one number still measured rather than
derived, and it is worth knowing why. The spine says a B+ bird "should" figure
~35; the live flock averages 27 because its CONDITION is starter-grade (~320
against a nominal 1000), so nearly every bird fights below nominal form and
every loser is marked down on top. Both are properties of the population, not
of the formula — **so this number drifts UP on its own as the flock breeds
up.** Re-measure when the BLOODLINES ladder shows the mean grade has moved a
band.

The payoff, on the clear-home verdict (birds whose home blade actually beats
its runner-up — the scout is not graded on coin flips):

| age bucket | clear-home exact, r29 | r30 | random |
|---|---|---|---|
| age 1 | — | 57.3% | 20% |
| age 2–3 | — | 50.9% | 20% |
| **age 4+** | **30.5%** | **57.5%** (83.5% on-or-adjacent) | 20% |

Raw accuracy over all birds, including the shapeless ones: 50.4 / 41.8 / 44.0
by the same buckets.

### Is the flock actually getting better? (the BLOODLINES ladder)

Every bird now carries a GENERATION — starters and gacha pulls 0, a chick its
dam's + 1 — and the doctor prints a ladder per generation. Before this
existed, a world could have bred sideways for thirteen weeks and every other
number in the report would have looked fine. From a 91-day sim (the round-30
era default — runs are 182 days since round 43):

| generation | mean stat | mean stars | median home margin |
|---|---|---|---|
| 0 | 328.2 | 1.75★ | 8.1 |
| 1 | 335.7 | 1.74★ | 11.2 |
| 2 | 348.1 | 2.06★ | 10.3 |

+20.0 stat points over two nests, and the shape line rises off the founders.
The loop compounds, slowly. The margin column uses the identical `homeBlade`
arithmetic the discovery audit is graded on, so "more tuned" means the same
thing in both places.

**Hens are now bred to their own shape** (`BREEDING_PLAN.OWN_SHAPE_MIN` = 40),
with the barn's house axis kept only as a fallback for the genuinely flat.
Measured over the 149 breeding hens of the round-29 world, best-pair
separation ran p25 = 32 / median = 55.5 / p75 = 91, so the bar hands about a
third of the flock to the house pair and breeds the rest to itself. The
doctor's ruler was rebuilt to match: it now prices the CHOICE — how far the
chosen sire sits along the DAM's own shape, against what an unchosen sire
would score on those same axes. **Sires chosen +67.0 against an unchosen sire
+1.0; foals land at +59.5.** Nothing but selection produces that gap.

One honest note. The first version of the accompanying test asserted that
covered hens carry more shape than the average bird. It passed on a 20-day
world and is FALSE in a mature one (hens +59.0 vs any bird +64.5) — the flock
number is lifted by the plan's own foals while the breeding hens are mostly
unselected founders. The assertion was removed rather than tuned.

## The unmatched rate was the KEY SPACE, not the scout — measured round 31

Round 30 closed with a hypothesis: discovery had got sharper, so bots carded
their birds' true best blades more often, so entries spread across five blades
and fragmented the lobby keys. The reading was that better discovery *costs*
matchmaking density. **That trade does not exist.** Round 31 fixed the key
space alone — the scout, `SCOUT.EXPLORE`, `JITTER` and the figure were not
touched — and the unmatched rate fell by more than two thirds. Discovery never
had to be traded for anything.

The cause was that lobbies were CONJURED ON DEMAND: entering created the lobby
if its key did not exist, so every fight type was on offer every day and the
perfect fight always existed because you invented it by asking. Measured over
91 days, before:

| | |
|---|---|
| live lobby keys | 74 |
| entries a day across them | ~70 |
| mean birds per lobby | 2.9 (against a capacity of 8) |
| entries that never drew an opponent | 16.3% |

**The decomposition is what settled the argument.** Of those unmatched entries,
**35% were the sole entrant** in a lobby nobody else joined, **31% were two
barn-mates alone** (matchmaking never pairs same-barn birds), and **34% were
the odd bird out**. The first two are pure key-space damage — no matchmaker
can fix them, only collision can — and no scout policy makes a room of one
into a fight.

### What was cut, and what it had measured

| axis | before | after | the measurement that ruled it |
|---|---|---|---|
| hardcore on the daily card | yes | **gone** | 201 entries → 55 fights, **45.3% unmatched** — the worst of any mode, for under one fight a day |
| `nw2` / `nw3` | two classes | **one (`nw3`)** | exclusive constituencies of **10** and **18** birds out of 181 active |
| `CLAIMER.PRICES` | 5 rungs | **3** (50/200/600) | claimers were **40 of 75 keys** — 53% of the space off one axis — at **0.33 entries per key** |
| `CLAIMER.JUVENILE_PRICES` | 3 rungs | **2** (25/100) | same axis, same arithmetic |
| total key space | **75** | **50** | |

The dear claimer rungs were not thin, they were dead: b3@400 drew **two**
entries in 84 days. Hardcore survives where it earns its keep — the Pintakasi
Majors, which are tournaments and never open a lobby.

Cutting the space is only half of it. The other half is that ~11 of those 50
keys are POSTED each day (`cardOfDay`, 10 on the Majors' crown day), so entries
are forced to collide. Every class runs daily in both divisions and the BLADES
rotate, because the classes nest (maiden ⊂ nw3 ⊂ open) and 33 of 181 active
birds are open-only — adult open must exist daily or veterans strand. Measured
blade gaps: k=3 and k=2 classes reach every blade within **4 days**, k=1
classes within **8**, and the whole card within **3 days** in both divisions.

That k=1 gap is what forced the chooser to invert — blade first, class as the
slack. A juvenile's entire discovery year is 7 days against an 8-day worst
gap, so a class-first chooser could have retired a winless chick that never saw
a blade in a maiden.

### The result, on a fresh 91-day world (the era's default length — 182 since round 43)

| | before | after |
|---|---|---|
| mean birds per lobby | 2.9 | **7.36** |
| entries never drawing an opponent | 16.3% | **4.5%** |
| lobbies holding a single bird | 334 (16.6%) | **26 (3.9%)** |
| same-barn-only stranding | ~302 birds | **25 birds** |
| lobbies | 2,012 | 673 |

All five invariants pass with **zero health warnings** (round 30 ended on two).
Two things worth checking that did NOT get worse:

- **Championship fields survived losing the hardcore points route.** With
  `POINTS_FOR.hardcore` unreachable, three real wins is the only road to
  `QUALIFYING_POINTS` — and majors ran **29 of 30** with a mean field of
  **11.0**, up from 9.6 in round 30.
- **The claimer marketplace got healthier, not smaller.** 0.33 entries per key
  → roughly **4.4**, with `claims placed` adoption steady at 14/15 farms.

### Discovery held, with one honest caveat

Clear-home scout accuracy reads **53.4% at age 2–3** against the 20% random
baseline. Age 4+ reads **36.3%** — but on a much smaller sample this run (160
decisions), and age-1 answer coverage is down to 3.3%. Those two are recorded
as noise-prone rather than as a result: a card that posts fewer keys also posts
fewer decisions to grade, so the discovery denominators are thinner than the
round-30 ones they would be compared against. Worth watching, not worth
concluding from.

New instrumentation, since the doctor is where this argument gets settled next
time: a **LOBBY FILL** section (mean, a bucketed histogram, singletons and
same-barn stranding) with `DOCTOR.FILL_WARN` = 5, and `BotDayReport.noCard`
counting birds the card had nothing for — the only error surface the bot layer
has, because `quietly()` swallows everything else.

## Still open, ranked

### 1. B1 cannot reach the +200 target (accepted, documented)

91.8% vs 98. Five turns of dice with 2.5× crits has a floor on how sure any
outcome can be. Accepted as blade identity: the sprint is where a maiden can
shock a monster. Revisit only if breeding depth makes B1 feel like a coin
flip between real classes — the lever is `FORMATS.b1.statScale` and the lab
sweeps it in one line.

### 2. The 5★ ceiling still stacks loud on the long blades

5★ wheel + weather on B5 = 94.9% between otherwise equal birds. Rarest
possible setup (both 5★, favorable wheel, ascendant day, deepest blade) and
better than last round, but watch it as bred stock climbs the star ladder.

### 3. Weather figure inflation at the star ceiling still clears the fog

At 5★ the day inflates figures +6.0 to +7.4 — above `FIGURE.NOISE` (4) and
over one band. At 2.5★ and below it stays inside the fog (where round 24's
ruling was made and `formats.test.ts` pins it). Stance unchanged: the rarest
bird's best day is allowed to be loud.

### 4. B5's key stat is louder than B1's

Gameness at B5 buys 86.8; agility at B1 buys 75.5. The residue of the same
variance floor as open item 1, plus gameness's two side routes (morale check,
deep-water bonus) which no weight tune removes. The dial-symmetry ideal says
these should match; they are ~11 points apart. Cosmetic until someone builds
a cross-blade tier list.

### 5. Crowd Noise is still unbuilt

Station at parity still does nothing (50.0 across the board — correct under
the ruling, boring by design). The planned per-fight-type stage level
(Championship 100, cheap claimers 0) is the mechanic that gives station a
job between even birds. Unblocked; needs its own round.

### 6. Breeding speed (logarithmic) — explicitly deferred by Zane

Separate unit of work: larger grade jumps at the low end, tapering toward
2000, plus a years-to-max analysis against the weekly breeding cycle.

### 7. Better discovery may be costing matchmaking density (round 30, HYPOTHESIS)

> **RESOLVED in round 31 — the hypothesis was wrong about the cause and right
> about the lever.** It was never the scout. Lobbies were conjured on demand,
> so the key space was effectively self-serve at 74 live keys; cutting it to 50
> and POSTING ~11 a day took the unmatched rate **16.3% → 4.5%** with the scout
> untouched. "The lever is lobby-key coarseness, not the scout" was the correct
> half of the guess, and it turns out discovery and density do NOT pull against
> each other. See **"The unmatched rate was the KEY SPACE, not the scout"**.
> Kept as history because it is the open question that produced the card.

The unmatched-entry warning moved up: round 29 ran 14.7%, and round 30's runs
measured 18.7%, 18.1% and 16.3%. Noisy, but the centre has moved. The
plausible mechanism — **and it is not proven, no ablation was run** — is that
a sharper scout makes bots card their bird's true best blade more often, which
spreads entries across all five blades and fragments the lobby keys. If that
is what it is, it is a real trade and not a bug: discovery and density pull
against each other, and the lever is lobby-key coarseness, not the scout.
Measure it before believing it.

### 8. The "flock is being bred flat" warning fires on noise (round 30)

The doctor warns when under 50% of birds have a home blade worth finding.
Round 30's runs measured 49.5%, 50.7% and 53.3% — the warning straddles its
own bar, so it fires or doesn't on run-to-run variance. Either the bar wants
moving or the measurement wants a wider sample; a health line that flips sign
on noise teaches nobody anything. (It did not fire on the round-31 world, which
is not evidence either way — that is the complaint. Round 32 read 57.0%, which
is further from the bar and still does not tell you where the bar belongs.)

### 9. The odd bird out is structural, and the fix is scoped (round 31 → 32)

The residue after the card is **~4.5%**, and it is nearly all the last bird in
a room that closed odd. Nothing about the key space removes it: unbounded
lobbies mean parity is a coin flip, where the old capacity of 8 was even ON
PURPOSE. But unbounded lobbies also change the residue's SHAPE for the better.
Round-robin across a whole room is impossible (30 birds = 435 fights), so the
next round partitions each room into GROUPS — Zane's FIFA group-stage analogy —
where a room of 30 becomes seven groups of four plus one of two and *everybody
fights*. Only a room holding a single entry would strand anyone.

It is a wide change, not a knob: `CADENCE.FIGHTS_PER_BIRD_PER_DAY`, the
`potCents = ea.fee * 200` assumption, per-fight `landForFight` minting and the
single-`battleLogId` shape of `lobbyEntries` all move together. Zane's ruling
on the money: **entry fees become divisible by 3** (40 → 42, 8 → 9) and the
stake splits across the fights actually taken, refunding the remainder.

**Round 32 update, and it goes the wrong way on purpose.** Opening the breeding
barn roughly doubled the population, mean fill went **7.36 → 9.94** birds a
lobby — and unmatched went **4.5% → 5.7%** anyway. That is not a regression in
the card; it is the same odd-bird-out residue riding more entries, so more
rooms close odd. Singletons held at 3.8%. Nothing about round 32 changes the
diagnosis, it just raises the price of not fixing it.

### 10. Same-barn stranding has no cap any more (round 31, watch)

Dropping `LOBBY.CAPACITY` also dropped the round-17 per-farm seating cap, which
was defined as `capacity / 2` and had no denominator left. It was **not**
replaced: a barn that pours its roster into one key strands its own surplus and
is refunded in full, which is self-correcting. Measured at **25 birds** across
91 days, down from ~302. The doctor's LOBBY FILL section prints it every run;
if it climbs, the cap needs replacing with something that works without a
capacity.

### 11. The element wheel fades as the flock breeds up (round 31, newly opened)

The wheel is ADDITIVE, so its edge shrinks in relative terms exactly as
breeding raises the stat floor — the opposite of what a counter-meta wants.
Two companions to the same rework: per-fight random weather, and showing a
lobby's element composition, because the counter-meta is currently *unplayable*
rather than merely weak — the field is fogged, so nobody can counter what they
cannot see. PFL-style aging curves and carriage (Ground/Air, still data-only
since round 23, and the natural second star axis) sit in the same queue.

### 12. Selection pressure vs. band utilization (round 32, newly opened)

Round 32 turned `breedDrive` into DEPTH — the share of a barn's retired hens it
covers each day — and the broodmare band went from 47% ever-carried to 75.9%.
The suite does not measure this and nothing here changed, but the trade-off
belongs on the list: **covering more hens means covering less selectively**,
because the marginal hen is by construction the worst one on the barn's ranked
list. The mid-round sim, taken before `MIN_HENS_COVERED` and
`MAX_COVERS_PER_DAY` were separated, showed gen-2 mean stat gain **falling to
+11.5** while home margin rose to +7.8; separating the knobs recovered it to
**+30.0 / +6.9**. So the current setting sits on the right side of the curve,
and nothing yet locates the peak. This is a doctor question (the BLOODLINES
ladder, both columns) rather than a lab one, unless someone builds a case for
it.

## Comment/code discrepancies

1. ~~`config.ts` worked example: 300 stamina → 23 wind~~ — moot: the wind
   pool no longer exists (round 27).
2. None currently known. The doctor's `docs.test.ts` and the lab's `reach`
   matrix audit are the standing tripwires.

## Not yet measured

The lab covers the six stats (singly and in PAIRS), elements, stars, weather,
the weight matrix, the fuel wall, the grade ladder, crits, figure fidelity and
grade-relative figure calibration. Still dark: the
gacha/breeding stat distributions the engine is actually fed, and anything
about the live population — that stays the doctor's job. Crit identity after
the rework: B2 is still the swingiest blade (15.9% of outcomes flip without
crits) and B1's crit tax on a favourite is 3.5 points — "knives swingy,
gaffs true" is finally the right story at the gaff end (B4 0.3, B5 0.1).

The blade intent IS now tuned to — round 27 reversed round 26's "measure,
don't tune" stance deliberately, because the dial now has its middle and the
odd count the tuning philosophy required. A future B6/B7 pair (if ever)
re-opens the outer ends, not the middle.
