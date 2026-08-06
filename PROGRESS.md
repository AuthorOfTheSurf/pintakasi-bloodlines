# Balance and discovery progress

This note records the work from population supply through Pit Figure and
discovery calibration. It is a measurement log, not a declaration that the
loop is finished.

## What changed

- **Population supply, `76b5534`:** hens become breedable again after they
  lay, rather than waiting for the egg to hatch. New farms now begin with
  eight eggs instead of four.
- **Long-horizon health, `c1d8843`:** `bun run simulate` now defaults to 91
  days, thirteen full weeks, and the Doctor reports the health of that world.
- **Discovery instrumentation, `12b7fd2` and `b8b4211`:** the Doctor now
  measures true-home hits, adjacent-blade hits, random baselines, evidence
  coverage, and scout accuracy by age.
- **Figure calibration and exploration lab, `215cc4f`:** the balance suite
  gained a grade-and-distance Pit Figure target-dummy case. Simulation can
  also trial an end-first exploration order without changing normal play.
- **Close-loss Pit Figures, `20d8d20`:** both birds now earn their own
  ghost-paced and company-adjusted performance before the loser takes a
  beaten-length deduction. The winner remains strictly above the loser.
- **Grade-relative scouting, `b3432f4`:** the scout removes coarse public
  own-grade and opponent-grade expectations before comparing blade evidence.
  Fight logs snapshot those public grades so old form lines remain historical.

## Controlled measurements

`bun run balance figure figuregrade --runs=4000` after the close-loss change:

| Observation | Result |
| --- | --- |
| +100 points to every hidden stat | +29.8 to +39.4 mean figure, depending on blade |
| B specialist at home vs fixed B+ company | 22.3 |
| B+ specialist at home | 40.9 |
| A specialist at home | 59.4 |
| S+ specialist at home | 110.0 |

The grade table is a controlled target-dummy calibration, not a promise about
live cards. Live figures also contain company, result, weather, and specialist
shape.

## Simulation artifacts

All paths are repository-relative and can be inspected with `bun run doctor
<path>` or served through `bun dev:sim` after selecting the newest file.

| Database | Purpose |
| --- | --- |
| `data/sim-20260806-0241.db` | Early population-supply check |
| `data/sim-20260806-0302.db` | Follow-up population/discovery check |
| `data/sim-20260806-0313.db` | First 91-day baseline |
| `data/sim-20260806-season-a.db` through `season-c.db` | Three discovery baseline worlds |
| `data/sim-20260806-end-first-a.db` through `end-first-c.db` | Simulation-only extreme-first exploration trials |
| `data/sim-20260806-1226.db` | Close-loss Pit Figure validation, 91 days |
| `data/sim-20260806-1318.db` | Grade-relative scout normalization, 91 days |

The latest world (`sim-20260806-1318.db`) reached day 91 with 515 birds and
passed all five Doctor invariants. It recorded 4,648 fights from 5,505 entries;
15.6% of entries went unmatched, which remains a health warning.

## Discovery: what is proven, and what is not

*Updated after round 29 — the three diagnostic limitations named below have
been fixed, and the answer changed once the audit stopped measuring the wrong
thing.*

The original reading here was raw selected-format hits rising 20.7% to 26.2%
across age buckets, with the caveat that this was **not** proof the scout was
teaching anybody anything. That caveat was right, and for three reasons that
round 29 addressed one at a time.

1. **The verdict graded the wrong quantity.** A card lands where the scout
   said AND where `SCOUT.EXPLORE` sent it AND where the lobby had room. The
   Doctor now grades the scout report's own top-ranked blade against its own
   random baseline.
2. **Tournament rows were counted as decisions.** A bracket bout's format is
   fixed by the committee. They are excluded from decisions and still feed the
   scout history, since a bracket fight is real evidence.
3. **The denominator was full of coin flips.** Home-blade margins measure
   p10 1.9 / p50 11.1 / p90 28.3 weighted stat points — half the flock had no
   home worth finding. The Doctor now prints a clear-home line beside the raw
   one.

Separately, `SCOUT.PRIOR_FIGURE` was found to be miscalibrated: set to 50 on
the strength of a `GHOST_PACE` comment that round 27 had quietly falsified.
Even fights actually figure 26.9–31.5, so evidence lost to ignorance by
construction. Replaying the same 5,505 entries with only that number changed
lifted scout accuracy 26.5% to 31.2% exact.

With all four fixed, a fresh 91-day world reads **32.9% exact on mature birds
with a real home, against 20% by chance**, and passes every invariant with
zero health warnings. Two candidate fixes were tested and rejected on the
data: normalizing the result out of the figure (accuracy fell to 23.2%) and
weather normalization (+0.2 to +0.8, real but not the bottleneck).

The remaining ceiling is the population, not the report. See `BALANCE.md`.

### Round 30 — the figure got a unit, and discovery roughly doubled

Round 29 booked "recentre the Pit Figure" as the next step. Round 30 did the
round and changed the diagnosis: the scale was not mis-centred, it was
**unanchored**. `pace / GHOST_PACE × 100` measured wind DEALT, which depends
on the opponent, so nothing pinned it — which is why round 27 could move every
figure in the game by ~20 points without anybody noticing. The figure is now
**spine × night**: an absolute, dice-free, opponent-free stat blend at the
blade, modulated by what the bird actually brought that night. The whole ghost
family (`GHOST_PACE`, `GHOST_FIGURE`, `CLASS_BASE`, `CLASS_DIVISOR`,
`BEATEN_SCALE`, `MIN_BEATEN`, `MAX`) is deleted.

**What that PROVED, in measurements:**

- A letter grade is worth exactly **10 figure points at every rung** — derived
  from the peg (1000 stat points = 100 figure points), not fitted. The lab's
  calibration table reads +9.7 to +12.2 against the derived +10.
- **Blade fit is multiplicative** and no longer fades on good birds:
  home−middle 11.2 / 11.6 / 10.5 / 9.6 / 7.5 at base 320 → 1600, where the old
  additive fit collapsed 11.9 → 3.5. Home−worst GROWS, 23.8 → 32.0.
- **Scout accuracy on birds with a real home: 30.5% → 57.5% for mature birds**
  (83.5% on-or-adjacent) against an unmoved 20% baseline, after `SCOUT.
  OWN_GRADE_STEP` was re-derived (15 → 10) and `OPPONENT_GRADE_STEP` retired
  (5 → 0). The scout's constants had been fitted to the figure's OUTPUT, which
  is the same failure round 29 caught — now structurally prevented, because
  `scout.test.ts` pins the derivation.
- **The loop compounds.** Birds carry a generation, and the doctor prints a
  BLOODLINES ladder: gen 0 → 1 → 2 reads 328.2 → 335.7 → 348.1 mean stat,
  1.75★ → 1.74★ → 2.06★, median home margin 8.1 → 11.2 → 10.3. Slowly, but in
  the right direction, and now visible.
- **Breeding selects, and it is measured on the choice.** Hens are bred to
  their own shape rather than the barn's (`OWN_SHAPE_MIN` = 40, set off the
  measured p25 = 32 / median = 55.5 / p75 = 91 spread of 149 hens). The
  doctor's ruler was rebuilt to price the choice, not the policy: chosen sires
  sit **+67.0** along the dam's own shape against **+1.0** for an unchosen one;
  foals land at +59.5.

**What is NOT proven, and should not be read as settled:**

- The unmatched rate moved up — 14.7% in round 29, 18.7 / 18.1 / **16.3%**
  across round-30 runs. The plausible mechanism is that a sharper scout cards
  true best blades more often, spreading entries over five blades and
  fragmenting lobby keys — i.e. better discovery costs matchmaking density.
  **No ablation was run. This is a hypothesis with numbers attached.**
- The "flock is being bred flat" warning straddles its own bar (49.5 / 50.7 /
  53.3% of birds with a home blade worth finding), so it fires on noise.
- `SCOUT.PRIOR_FIGURE` (27) is the one scout constant that still cannot be
  derived — it is a property of the POPULATION's condition, not the formula,
  and it will drift up on its own as the flock breeds up.

State at the end of the round: `bunx tsc --noEmit` clean, 319 tests passing,
the balance suite at 1 warning across 154 rows and 46 findings (the standing
B1 +200 spec target, a target issue and not an engine one), and a 91-day world
with zero invariant failures and the two health warnings above.

### Round 31 — the card, and the unmatched rate explained

Round 30's first recommended step was "explain the unmatched rate, don't assume
it," on a hypothesis that a sharper scout was fragmenting the lobby keys. Round
31 answered it, and the answer was not the scout. **Lobbies were conjured on
demand** — `Lobbies.enter` created the lobby when its key did not exist, so
every fight type was available every day and the perfect fight always existed
because you invented it by asking.

The cost, over 91 days: **74 live keys taking ~70 entries a day, 2.9 birds per
lobby, 16.3% of entries never drawing an opponent** — of which 35% were the
sole entrant, 31% were two barn-mates alone, and only 34% were the odd bird
out. Two thirds of it was key-space damage that no matchmaker could touch.

The fix was collision, in three parts, with the scout untouched:

- **The key space cut 75 → 50.** Hardcore off the daily card entirely (it had
  measured 201 entries → 55 fights at a **45.3% unmatched rate**, the worst of
  any mode; it survives in the Majors, which are tournaments and open no
  lobby), `nw2` merged into `nw3` (exclusive constituencies of 10 and 18 birds
  out of 181), and the claimer tag ladders thinned to 3 grown rungs and 2
  juvenile ones — claimers alone had been **40 of the 75 keys at 0.33 entries
  per key**.
- **A published daily card.** `cardOfDay(dayIndex)` posts ~11 keys a day, pure
  from the day index like `weatherOfDay` — no schema, and `cardOfDay(day + 1)`
  is free, so tomorrow is public and plannable. Every CLASS runs daily in both
  divisions; the BLADES rotate, because the classes nest and 33 of 181 active
  birds are open-only.
- **Unbounded lobbies.** `LOBBY.CAPACITY` deleted; exactly one lobby per posted
  key per day. Capacity-8 duplication had been splitting a hot key back into
  two half-empty rooms, undoing the concentration the card exists to create.

**Measured on a fresh 91-day world:** mean birds per lobby **2.9 → 7.36**,
unmatched entries **16.3% → 4.5%**, single-bird lobbies **334 (16.6%) → 26
(3.9%)**, same-barn stranding **~302 birds → 25**, lobbies 2,012 → 673. All
five invariants pass with **zero health warnings** (round 30 ended on two).
Championship fields survived losing the hardcore points route — majors 29 run /
1 cancelled at a field of **11.0**, up from 9.6 — and claimer keys went from
0.33 entries per key to roughly 4.4, so the marketplace got healthier rather
than smaller.

Two structural notes worth keeping. The chooser had to be **inverted — blade
first, class as the slack** — because a class running one blade a day has an
8-day worst gap and a juvenile's whole discovery year is 7 days; inverting uses
the nesting, so a chick whose blade isn't in today's maiden runs juvenile open
at that blade instead. And `entryRefusal` is now **one predicate with two
callers**: the door throws it, the chooser filters on it. Both entry paths wrap
`enter` in `quietly()`, so a chooser proposing specs the door rejects would
surface as nothing but a silently collapsed fill rate.

A pre-existing bug was found and fixed first, in its own commit: the crown-day
door queried pending tournament entries **without filtering by division**, so a
Juvenile Championship registrant could enter a normal lobby AND fight its crown
on the same Wednesday. Nothing caught it — the tournament stamps its battle-log
rows with Thursday's day index, and the doctor's one-card-per-bird-per-day
invariant buckets on `lobbyEntries` only. Landed separately so an inflated
juvenile fight count wouldn't be read as the schedule change moving numbers.

**Not proven this round:** discovery. Clear-home accuracy reads 53.4% at age
2–3 against a 20% baseline, but age 4+ reads 36.3% on only 160 decisions and
age-1 answer coverage fell to 3.3%. Fewer posted keys means fewer graded
decisions, so those buckets are noise-prone — recorded as something to watch,
not as a result.

## Recommended next steps

*Re-ordered after round 31. The old item 1 (explain the unmatched rate) is
DONE and its hypothesis is disproved — see above and open item 7 in
`BALANCE.md`. The old item 6 (revisit claimers, "still the thin ones") is done
with it: the claimer ladder was thinned and hardcore left the card entirely.*

1. **Multi-fight lobbies — the group stage.** The remaining ~4.5% unmatched is
   the odd bird out, which is structural: unbounded lobbies make parity a coin
   flip where the old capacity of 8 was even on purpose. Round-robin across a
   room is impossible (30 birds = 435 fights), so partition each room into
   GROUPS — a room of 30 becomes seven groups of four plus one of two, and
   everybody fights. Only a room holding a single entry strands anyone. Wide,
   not a knob: `CADENCE.FIGHTS_PER_BIRD_PER_DAY`, the `potCents = ea.fee * 200`
   assumption, per-fight `landForFight` minting and the single-`battleLogId`
   shape of `lobbyEntries` move together. Zane's ruling on the money: entry
   fees become divisible by 3 (40 → 42, 8 → 9), and the stake splits across the
   fights actually taken, refunding the remainder.
2. **Re-measure discovery on the new card, with a proper denominator.** The
   round-31 age-4+ and age-1 buckets are too thin to read. Until they are, no
   claim about discovery getting better or worse under the card should be
   believed in either direction.
3. **The element rework.** The wheel is additive, so it fades as the flock
   breeds up; per-fight random weather; and show a lobby's element composition,
   because the counter-meta is currently unplayable rather than merely weak —
   the field is fogged, so nobody can counter what they cannot see.
4. **Fix the flat-flock warning's bar.** 49.5 / 50.7 / 53.3% against a 50% bar
   is a coin flip printed as a verdict. Either widen the sample or move the
   bar to where it means something.
5. **Run matched multi-seed worlds** comparing the current and end-first
   discovery policies. The audit is sound and the figure it reads has a unit,
   so a difference between policies is finally attributable to the policies —
   but it wants item 2 first, or it will be measuring the denominator.
6. **Element in the breeding score** (opened by round 30, deferred by Zane): a
   cross-element cover should cost star potential, so bots keep lines pure.
   Deferred on the suspicion that the population is too thin and the star
   incentive too weak for the effect to measure — which is itself testable.
7. **Re-measure `SCOUT.PRIOR_FIGURE` when the BLOODLINES ladder moves a band.**
   It is the flock's mean, not a constant of the engine, and it will drift up
   as the flock breeds up. Do not fit it to a formula it does not obey.
8. **Carriage (Ground/Air) and PFL-style aging curves.** Carriage has been
   data-only since round 23 and is the natural second star axis. Both are new
   mechanics rather than repairs, so they queue behind the group stage.
9. **Standing watch: same-barn stranding, now that nothing caps it.** Dropping
   the capacity dropped the round-17 per-farm seating cap with it (it was
   `capacity / 2`), and it was not replaced — a barn that floods one key
   strands its own surplus and is refunded. 25 birds over 91 days, printed
   every run by LOBBY FILL. If it climbs, it needs a cap that works without a
   capacity.
10. **Standing watch: does shape keep accumulating past generation 2?** The
    ladder shows the first two nests compounding (+20.0 stat points, home
    margin 8.1 → 11.2), but 13 weeks is roughly two selected generations and
    `STAT_VARIANCE` regenerates most of the spread each time. A longer horizon
    is the only way to answer it.
