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
