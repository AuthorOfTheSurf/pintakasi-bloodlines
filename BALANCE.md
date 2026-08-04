# BALANCE — the measured state of the fight engine

Produced by `bun run balance`, at `--runs=4000` (±1.1 points at 95%) unless a
row says otherwise. Every number here is reproducible: the lab is deterministic
over a fixed seed window, and `--converge=5` re-measures across disjoint
windows to prove a figure isn't an artifact of one.

This file is a **gap report, not a spec**. Nothing here has been tuned. The
point of the round was to stop guessing — two knobs shipped at 2× and 4× their
intended strength in consecutive rounds, both caught by hand, because the only
fight measurement in the repo was one closure wired to two identical birds on
one blade.

```
bun run balance                       # all 11 cases
bun run balance sensitivity --runs=4000
bun run balance --sweep=BATTLE.ELEMENT_EDGE=0.25,0.5,1
bun run balance --converge=5
bun run balance --json | --csv
```

Warnings are design gaps being catalogued, so the tool **exits 0** with them.
Only tool errors exit non-zero.

---

## The five gaps, ranked

### 1. Station inverts the grade ladder — breeding is currently net-negative

The headline. A bird one full grade better (+100 on all six stats) **loses**:

| blade | +100 bird wins | with station neutralised | station's cost | intent |
|---|---|---|---|---|
| Long Knife | **40.9%** | 56.4% | −15.5 | 80% |
| Short Knife | **38.2%** | 59.0% | −20.8 | 80% |
| Long Gaff | **34.4%** | 58.8% | −24.3 | 80% |
| Short Gaff | **33.0%** | 66.8% | −33.7 | 80% |

At +200 (two grades) it is still under 50% on every blade — 46.5–47.9%, against
an intended 98%.

The arithmetic: +100 on every stat buys `100/ROLL_DIVISOR` = **+0.25** on a
roll. Crossing the 1.1× total-stat threshold hands the *weaker* bird its full
`station × form / STATION_DIVISOR` ≈ **+0.88 × form**, on every roll of the
fight. The underdog bonus is roughly 3.5× the grade step that triggered it.

This is not station softening the ladder. It is reversing it. Overall grade is
one of the only ways a player can read a bird before it fights, and breeding is
the game's entire progression — both currently point the wrong way.

Sweeping the knob shows the ladder is fine underneath: with station at 0 the
curve is monotone and sane (58.5 / 66.4 / 81.0 / 96.5% at +100/+200/+400/+800).

### 2. Station has two cliffs, and one point of it is worth −15 points of win rate

Station is the only stat behind a hard binary gate (`underdog`, set once,
`total(other) >= total(self) × 1.1`). Against an even 350-flat bird:

| your station | your total | gate | Short Gaff win% |
|---|---|---|---|
| 0 | 1750 | open (you) | 50.0 |
| **159** | 1909 | open (you) | **66.3** |
| **160** | 1910 | **closed** | **50.0** |
| 559 | 2309 | closed | 50.0 |
| **560** | 2310 | open (them) | **21.1** |
| 2000 | 3750 | open (them) | 21.1 |

Raising station by **one point** — 159 → 160 — closes your own gate and costs
16 points of win rate. Raise it far enough and you open your *opponent's* gate
and fall to 21%. Station is the only stat in the game where more is worse,
twice, at thresholds nothing surfaces to the player.

When the gate is held open (vs a 689-flat bird), station is enormous and
perfectly well-behaved: 10.9% → 100% across its range on Short Gaff. The
mechanic works. The gate is the problem.

### 3. Stars are nearly inert, and half of the ladder does nothing at all

`Math.floor(halfStars / 2)` means **0.5★ ≡ 0★, 1.5★ ≡ 1★, 2.5★ ≡ 2★** — every
half-step is discarded. Measured, the pairs are bit-identical.

Worse, the naive measurement is *inverted*: a 5★ bird loses to an identical 0★
bird on every blade (33.0–40.9%), because +100 across six stats trips the same
underdog gate as gap 1. Controlled for station, 5.0★ is worth only **+6.4 to
+16.8 points** of win rate — and 5 full stars add `5 × BOOST_PER_FULL_STAR /
ROLL_DIVISOR` = **+0.25** on a roll, which is exactly one weather day and half
an element edge.

| | Long Knife | Short Knife | Long Gaff | Short Gaff |
|---|---|---|---|---|
| 5★ vs 0★, naive | 40.9 | 38.2 | 34.4 | 33.0 |
| 5★ vs 0★, station neutralised | 56.4 | 59.0 | 58.8 | 66.8 |
| the gate's bite | +15.5 | +20.8 | +24.3 | +33.7 |

**Declared intent** (not implemented): stars should scale the *elemental
advantage* — 5.0★ = maximum elemental advantage, 0.5★ = minimal, 0★ = none.
The numbers above are the baseline that rework has to beat.

### 4. Three of six stats never drive a turn, and one blade can't reach its phase

Phases are **absolute turn windows** (agility T1–2, sight T3–10, gameness T11+)
while each blade sets its own ceiling. The intersection:

| blade · phase | window | turns | % of fights reaching |
|---|---|---|---|
| Long Knife · agility | T1–T2 | 2 | 100% |
| Long Knife · sight | T3–T5 | 3 | 71% |
| **Long Knife · gameness** | **unreachable** | **0** | **0%** |
| Short Knife · gameness | T11–T12 | 2 | 8.9% |
| Long Gaff · gameness | T11–T20 | 10 | 65.8% |
| Short Gaff · gameness | T11–T30 | 20 | 95.2% |

Agility drives **exactly 2 turns in every format** — 40% of a Long Knife, 6.7%
of a Short Gaff. And `stamina`, `station` and `condition` are **never** phase
stats in any format; they reach a fight only indirectly (wind pool + decay
resistance; the underdog gate; the per-turn form multiplier).

Measured lift from +200 on one stat:

| stat | Long Knife | Short Knife | Long Gaff | Short Gaff |
|---|---|---|---|---|
| agility | **54.7** | 52.7 | 52.2 | 51.6 |
| sight | 54.4 | **57.6** | 56.6 | 57.0 |
| stamina | 52.9 | 53.1 | 55.0 | 55.3 |
| gameness | 50.7 | 52.7 | **59.1** | **64.0** |
| station | 50.0 | 50.0 | 50.0 | 50.0 |
| condition | 50.7 | 50.5 | 50.6 | 51.4 |

Against intent, **only Short Gaff matches**. Long Knife has gameness dead;
Short Knife inverts stamina and gameness over agility; Long Gaff puts gameness
and sight over stamina — and stamina is ranked 2nd or 3rd on every blade in the
intent while never being a phase stat at all.

Note the `shape` case passes on all four blades (a specialist beats an
anti-specialist at equal total, 52.6–57.8%). Shape works *in aggregate* even
where individual stats are ranked wrong — the two are not in conflict, they are
measuring different things, and the aggregate is the weaker claim.

### 5. Condition silently inflates the Pit Figure by ~15 points

Two **identical** birds at different condition levels win 50% by construction —
but the figure they post does not hold still:

| condition (both birds) | mean figure |
|---|---|
| 0 | 39.0 |
| 1000 | 46.2 |
| 2000 | 53.8 |

That is ~15 points, three full `FIGURE.BAND`s, on a signal whose entire job is
to tell a player what a bird is. Condition also *boosts* rather than merely
stabilising — a favourite gains 4–9 points of win rate across its range — which
contradicts the config comment calling it a variance buffer that "only ever
hurts."

---

## Corrections to things previously believed

Recorded because both were stated confidently, in this repo, by me.

- **"Weather's figure inflation sits inside the ±NOISE fog."** True on
  shortKnife (+2.8), which is where it was measured. On **Short Gaff it is
  +5.7** — larger than both `FIGURE.NOISE` (4) and `FIGURE.BAND` (5). The claim
  was blade-specific and got written down as general.
- **"The non-monotonic stat curve is pre-existing engine weirdness, out of
  scope."** It was gap 1. A stat gap large enough to trip the underdog gate
  makes the better bird worse, which is why the curve bent.

## Comment/code discrepancies

Found while tracing; none fixed this round.

1. `fight-sim.ts:89` says the underdog gate uses "total **base** stats". It
   uses **star-boosted** stats. (The lab now clamps per-stat to match the
   engine exactly — an earlier version didn't, and disagreed above 1900 stats.)
2. `config.ts` worked example says 300 stamina → 23 wind; `Math.round` makes a
   350-stamina bird 24, not 23.5.
3. `fight-sim.ts:214` can emit a **loser figure of −5**: the `Math.min(winner −
   BAND, …)` is applied *after* `band()`'s `[0, MAX]` clamp.

## Not yet measured

The lab covers the six stats, elements, stars, weather, blade reach and the
grade ladder. Still dark: the gacha/breeding stat distributions the engine is
actually fed, crit (`critMult`) frequency and impact, `DECAY_*` in isolation,
and anything about the live population — that stays the doctor's job.

The blade intent is deliberately **not** tuned to. More blade lengths are
coming (PFL runs 9 distances to our 4), and fitting the curve to four points
now would be premature.
