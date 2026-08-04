# BALANCE — the measured state of the fight engine

Produced by `bun run balance`, at `--runs=4000` (±1.1 points at 95%) unless a
row says otherwise. Every number here is reproducible: the lab is deterministic
over a fixed seed window, and `--converge=5` re-measures across disjoint
windows to prove a figure isn't an artifact of one.

**Round 26 rewrote this file.** The previous edition was a gap report — eight
ranked defects, nothing tuned. This edition is the state after the fix round
that followed it: the station slope, the stars-as-element-amplifier rework,
`ROLL_DIVISOR` 400 → 85, and condition re-ruled as intended. The old edition's
numbers survive inline as "was" figures so the before/after stays readable.

```
bun run balance                       # all 14 cases
bun run balance sensitivity --runs=4000
bun run balance --sweep=BATTLE.ROLL_DIVISOR=100,85,75
bun run balance --converge=5
bun run balance --json | --csv
```

Warnings are design gaps being catalogued, so the tool **exits 0** with them.
Only tool errors exit non-zero.

---

## Fixed this round, with the after-numbers

### 1. The grade ladder points forward (was: station INVERTED it)

The old binary underdog gate paid the weaker bird ~3.5× the stat lead that
tripped it: a bird +100 better on every stat **lost** 59–67% of the time.
Station is now a smooth clawback — the outmatched side recovers
`station/2000 × UNDERDOG_CLAWBACK (0.5) × the gap's per-roll value`, capped
below the gap by construction, with station itself excluded from the totals
being compared (heart is not class). With `ROLL_DIVISOR` retuned 400 → 85,
tuned at the middle of the blade dial per the design's own philosophy:

| blade | +100 wins (was) | +200 wins (was) | station cost | target |
|---|---|---|---|---|
| B1 | 69.1% (40.9) | 84.9% (46.9) | +1.3 | 80 / 98 |
| B2 | 74.8% (38.2) | 91.6% (46.6) | +1.4 | 80 / 98 |
| **B3** | **82.9%** (34.4) | **97.4%** (47.9) | +1.6 | **80 / 98 ✓** |
| B4 | 87.5% (33.0) | 98.8% (46.5) | +1.2 | 80 / 98 |

B3 — the future midpoint once B5 exists — sits on both targets. The ±10-point
spread toward the ends is turn count amplifying stats, and belongs to the
deferred phase-weight rework, not to this knob. The lab pins the anti-inversion
as a permanent regression test (`lab.test.ts`: flat 450/550/750 must all beat
flat 350).

### 2. The station cliffs are gone

The old gate's 159→160 cliff (−16 points for one stat point) and the 560 flip
(handing the *opponent* its station): both now measure exactly 50.0% on every
row — station at parity is a flat line, and buying more of it is never worse.
When genuinely outmatched (one grade down), the payout is strictly monotone:
station 0 → 2000 lifts 11–30% up to 22–37%, always short of 50%. An underdog
with maximum heart makes a real fight of it and remains the underdog — that is
the whole ruling. (Station still does nothing between even birds; that stays
true until Crowd Noise gives it a per-fight stage role.)

### 3. Stars are the element's volume knob (was: nearly inert, half the ladder dead)

Both edges now scale by `halfStars/10`; the flat stat boost is gone, and with
it the confound where a 5★ bird measured *worse* than its 0★ twin. Every
half-step is a real rung, measured at a favorable matchup:

| stars | B1 | B2 | B3 | B4 |
|---|---|---|---|---|
| 0★ | 50.0 | 50.0 | 50.0 | 50.0 |
| 0.5★ | 51.9 | 52.9 | 54.4 | 54.6 |
| 2.5★ | 60.3 | 64.0 | 69.2 | 72.3 |
| 5★ | 69.9 | 76.2 | 83.2 | 87.9 |

And the leak detector holds: same-element duels read 50.0% at **every** star
level — stars without a matchup are worth nothing, by construction and now by
measurement. `ELEMENT_EDGE` was raised to 1.0 and `WEATHER.EDGE` to 0.5 as
**ceilings** (delivered value scales with stars; a 2.5★ bird gets exactly
round 24's ruled values).

### 4. The figure now tracks the bird (was: a breeding step invisible on the knives)

A side effect of `ROLL_DIVISOR` 85 — roll margins now scale with real stat
gaps, so the discovery signal sharpened enormously:

| true gap | B1 (was) | B4 (was) |
|---|---|---|
| +50 | +7.3 (1.8) | +13.3 (4.7) |
| +100 | +14.8 (3.7) | +24.7 (9.4) |

One generation of breeding is now 3–5 fog-widths of figure on every blade.
Two related fixes landed in `fight-sim.ts`: the loser is scored down from the
winner's *clamped* figure (a maiden crushed by a monster used to post 145),
and the loser figure is floored at 0 (the recorded −5 bug).

### 5. Condition re-ruled: the wildcard is intended (was: "contradicts its comment")

Zane's ruling: condition is the Temper analog — it targets no blade and no
phase, it makes everything the bird already is arrive more reliably, and the
boost is intended, not a bug. The config comment now says so. At divisor 85 it
is genuinely powerful: a +100 favourite converts at 66% (condition 0) up to
83–98% (condition 2000) depending on blade. The ~13-point figure lift across
the condition range is accepted — the figure reports performance, and a
consistent bird genuinely performs better.

---

## Still open, ranked

### 1. The blade ends miss the grade targets (deferred by design)

B1 is 11 under at +100 and B4 is 7.5 over; only B3 sits on target. One divisor
cannot fix this — turn count amplifies stats. This is the phase/blade-weight
rework, explicitly deferred until the new blade lengths land (tune the middle,
work outward).

### 2. Stat rankings still miss intent on 3 of 4 blades

B2 now **matches** its intended order (a divisor-85 side effect — it was
inverted before). Still wrong: B1's gameness is structurally dead (its phase
starts at turn 11, the blade caps at 5); B3 runs sight over stamina/gameness;
B4 has agility over stamina. Stamina is ranked 2nd–3rd in the intent on every
blade but never drives a turn anywhere — and the `fuel` case shows its entire
lift is the wind pool (+1.8 to +3.9), with decay resistance decorative (≤0.3).
All of it is the same deferred rework.

### 3. The 5★ ceiling stacks loud on the long blades

At full stars, wheel edge + weather day on B4 measures **95.8%** between
otherwise equal birds (wheel alone 87.9%). That is the rarest possible
configuration — both birds 5★, favorable matchup, ascendant day, marathon
blade — but it is verdict-shaped. Watch it as bred stock climbs the star
ladder; the lever is the ceilings, and the lab sweeps them in one line.

### 4. Weather figure inflation at the star ceiling clears the fog

At 5★ the weather day inflates figures +4.4 to +5.6 — above `FIGURE.NOISE`
(4) and around one band. At 2.5★ and below it stays inside the fog, which is
where round 24's ruling was made and where `formats.test.ts` pins it. Stance:
the rarest bird's best day is allowed to be loud; the ordinary bird's day is
not.

### 5. B3's shape case reads backwards

A stamina/gameness specialist (B3's intended top stats) *loses* 43.4% to its
own anti-specialist — the blade rewards sight, per the sensitivity matrix.
Same deferred rework as open item 2; the shape case just makes it vivid.

### 6. Nobody is playing the going — probably correctly

Doctor: weather timing 1.13× chance over **starred** entries (0★ entries are
excluded now — they have no going to play). But a day-one flock tops out at
1.5★, where the delivered weather edge is 0.15 of a roll; mild bot appetite
may simply be right. Revisit when the population's stars climb.

## Comment/code discrepancies

1. ~~`fight-sim.ts` underdog "total base stats" vs star-boosted~~ — moot: the
   stars rework removed the boost entirely; totals are base (minus station).
2. `config.ts` worked example says 300 stamina → 23 wind; `Math.round` makes a
   350-stamina bird 24, not 23.5. (Still unfixed, still cosmetic.)
3. ~~The −5 loser figure~~ — fixed this round (floored at 0, and scored down
   from the clamped winner).

## Not yet measured

The lab covers the six stats, elements, stars, weather, blade reach, the grade
ladder, stamina's two routes (`fuel`), crits (`crit`) and figure fidelity
(`figure`). Still dark: the gacha/breeding stat distributions the engine is
actually fed, and anything about the live population — that stays the
doctor's job. Crit identity note survives the retune: B2 is still the
swingiest blade (15.0% of outcomes flip without crits) and B3 at critMult 1.3
still flips 12.0% — the "knives swingy, gaffs true" story remains half false.

The blade intent is deliberately **not** tuned to. More blade lengths are
coming (an odd count, so the middle blade can weigh every stat evenly), and
fitting the curve to four points now would be premature.
