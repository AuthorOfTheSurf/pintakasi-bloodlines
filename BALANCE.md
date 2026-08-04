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
bun run balance                       # all 15 cases
bun run balance sensitivity --runs=4000
bun run balance --sweep=FORMATS.b3.statScale=0.9,1.0,1.1
bun run balance --converge=5
bun run balance --json | --csv
```

Warnings are design gaps being catalogued, so the tool **exits 0** with them.
Only tool errors exit non-zero. The whole suite currently prints **seven**
warnings: item 1 under "Still open" (B1's +200 floor) and the six rows of the
new `pairs` case, which are all the same finding — item 0.

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

## Still open, ranked

### 0. Stacking one stat beats pairing two, almost everywhere (NEW, biggest)

Measured by the new `pairs` case (`bun run balance pairs`), same-budget
table: give one bird +200 spread across a pair (+100 each) and another bird
+200 stacked on whichever stat that blade weighs more, equal totals so the
clawback cancels. The splitter wins **nowhere**. Representative cells —
Sight&Gameness on B5 **31.0%**, Agility&Stamina on B4 37.5%, Agility&Sight
on B1 44.9%, and only B3 sits at a true 50% (equal weights, so there is
nothing to stack toward).

This is not a tuning miss, it is the shape of the formula: **the turn roll is
LINEAR in the weighted blend, so a fixed stat budget is always best spent on
the single highest-weight stat.** A corner solution is the mathematically
correct answer to a linear objective. Pairs can only pay through the
non-linear side routes — stamina's fuel tank, gameness's quit check and deep
bonus — and those are worth a few points, not the 10–20 the weight gap costs.
The one place it nearly holds is where the weights are TINY: Stamina&Gameness
on B1 measures 49.6%, because giving up 0.12-vs-0.08 of weight costs almost
nothing and the side routes cover it.

Zane's ruling (PAIR_INTENT in `intent.ts`) says single-stat lines must not
dominate, so this is a real violation and the six warnings are honest. It
cannot be fixed by re-weighting — any weight matrix has a heaviest entry.
The levers are structural, and each is its own round:

1. **Diminishing returns per stat** — blend on `sqrt(stat)` or subtract a
   per-stat surplus tax, so the second +100 in one stat buys less than the
   first. Turns the corner solution into an interior one and makes pairs
   optimal by construction. Cleanest, and it touches every number in the lab.
2. **A pair bonus** — an explicit term rewarding the MINIMUM of a blade's two
   heaviest stats. Direct, easy to explain in the Handbook, but a new
   mechanic to teach.
3. **Per-stat caps by blade** — a ceiling on how much of one stat a blade
   will read. Blunt, and it makes a great stat feel wasted.

Nothing shipped yet: the measurement came first, deliberately.

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
the weight matrix, the fuel wall, the grade ladder, crits and figure fidelity. Still dark: the
gacha/breeding stat distributions the engine is actually fed, and anything
about the live population — that stays the doctor's job. Crit identity after
the rework: B2 is still the swingiest blade (15.9% of outcomes flip without
crits) and B1's crit tax on a favourite is 3.5 points — "knives swingy,
gaffs true" is finally the right story at the gaff end (B4 0.3, B5 0.1).

The blade intent IS now tuned to — round 27 reversed round 26's "measure,
don't tune" stance deliberately, because the dial now has its middle and the
odd count the tuning philosophy required. A future B6/B7 pair (if ever)
re-opens the outer ends, not the middle.
