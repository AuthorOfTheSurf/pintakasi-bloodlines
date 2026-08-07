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

### Round 32 — the broodmare band opens, and two schedules stop being lopsided

Round 31 left the world with a healthy card and a half-idle breeding barn.
Reading its doctor report, Zane found three things the round-31 work had not
been looking at: the broodmare band was half idle, the two juvenile crowns were
wildly lopsided, and juvenile open had headroom nobody was spending.

**`breedDrive` becomes DEPTH, not frequency.** `Bots.playFarm` ended its
breeding block with `break; // one cover a day is plenty`, behind a daily coin
flip. The cap was never a budget rule: a cover is 160 GP and a hen holds one
pregnancy until her egg lays the following Friday, so ~10 retired hens want ~10
covers **a week** — 229 GP a day against an 800 GP drip, under 30% of income.
The measured cost in the round-31 sim: **73 of 154 retired hens had never bred
once, while eight hens carried nine foals each, and 81 dams produced all 280
chicks.** `breedTarget(bot, hens)` now returns a SHARE of the barn's free hens
— 0.9 works nearly the whole band, 0.3 the best third — floored at
`MIN_HENS_COVERED` for every barn without a `landAppetite`, capped at
`MAX_COVERS_PER_DAY`, with money checked per cover inside the loop.

Two things nearly made it inert, and both are worth more than the change
itself:

- **The real cap was the PRICING budget, not the `break`.** `MAX_PAIRS_PRICED`
  (150) against `MAX_STUDS_PER_HEN` (40) meant barely **four hens** were ever
  priced in a day. Lifting the one-cover rule alone would have changed nothing
  past the fourth hen — there was nothing priced left to buy. The loop counts
  HENS now (`coverTarget + HENS_PRICED_SLACK`), and the pair cap goes back to
  being a pure runaway guard.
- **The first cut set `MIN_HENS_COVERED = MAX_COVERS_PER_DAY = 5`**, which
  collapses `min(hens, cap, max(share, floor))` to `min(hens, cap)` and makes
  `breedDrive` arithmetically **unobservable** for all thirteen non-landlord
  barns — every stable breeding identically while the config described three
  styles. The subagent writing the tests caught it, refused to write a vacuous
  assertion, and pinned the config identity instead. Now 3 and 8, with a test
  pinning the strict inequality.

Carrying hens are filtered out before the count (read off the db — `BirdView`
exposes `eggStage` but not `motherId`, and the rule is GESTATING, not laid), or
every barn's target pins to the cap and the pricing budget is spent on covers
that can only throw, swallowed by `quietly`.

**The juvenile crown chase declares before it sends.** `chaseJuvenileCrowns`
looped blades on the outside, but a bird may hold one championship entry a
week, so b2 — merely by being checked first — took every barn's two best
juveniles and b4 got the overflow. **b2 fields of 16–27 against b4 fields of
1–8**, caused by nothing but iteration order. Birds declare first now (ties
round-robin, so a true middle-distance chick doesn't pile onto the first
blade), then a second pass seats anyone whose declared crown was full for their
barn. **After: b2 22–24 against b4 16–22.**

**A third juvenile open blade** (`CARD.juvenile.open` 2 → 3, so 12 keys a day).
At two blades the worst gap between two appearances of a blade is four days and
a juvenile career is exactly seven, so a chick could age out never having been
offered two of the five blades. Paid for out of the fullest key on the board —
juvenile open ran 8.41 birds a lobby against a 7.36 world mean.

**Measured on a fresh 91-day world, 0 warnings and 0 invariant failures:**

| | round 31 | round 32 |
| --- | --- | --- |
| broodmare band ever carried | 47% of 154 | **75.9% of 166 settled** |
| bot covers / hatches | 238 / 501 | **533 / 761** |
| active / retired birds | 172 / 329 | **341 / 420** |
| gen 2 vs gen 0 mean stat | +23.4 | **+30.0** |
| gen 2 vs gen 0 home margin | +3.1 | **+6.9** |
| mean birds per lobby | 7.36 | **9.94** |
| unmatched entries | 4.5% | **5.7%** |
| Majors run / cancelled, field | 29 / 1, 11.0 | **30 / 0, 13.7** |
| Juvenile Championship field | 10.3 | **14.0** |
| birds clearing the 10-pt home bar | 53.0% | **57.0%** |
| clear-home, age 2–3 / age 4+ | 53.4% / 36.3% | **57.9% / 52.7%** |

`bun test src` 343 → **357 pass / 0 fail** (17,468 assertions across 25 files),
`bunx tsc --noEmit` and `bun run build` clean, `bun run balance` unchanged at
its standing 1 warning / 154 rows / 46 findings.

**The one number that went the wrong way: unmatched 4.5% → 5.7%**, even as fill
went 7.36 → 9.94. That is the odd-bird-out residue riding a much larger
population — more entries means more rooms closing odd — and it is exactly the
residue the group stage removes. It is the cost of the population the breeding
change bought, and next round is where it gets paid back.

**Not settled this round: selection pressure versus band utilization.** The
mid-round sim, taken before the floor and the cap were separated and every barn
was covering to the same target, showed gen-2 mean stat gain **falling to
+11.5** while home margin **rose to +7.8**. Covering more hens means covering
less selectively — the marginal hen is by construction the worst on the barn's
list. Separating the knobs recovered it to +30.0, so the current setting is on
the right side of the trade, but nothing here locates the peak.

New doctor section **`broodmare band`** (share of settled retired hens that
have ever carried, plus the busiest hen's foal count, `BRED_BAND_WARN` 0.7).
Honesty note: the first cut counted every retired hen and read a real 76% as
**64%**, because the sim retired 32 hens in its final week who had not been
passed over — they had not had a turn. `BRED_BAND_GRACE_WEEKS = 2` excludes
them.

## Recommended next steps

*Re-ordered after round 32. The group stage stays at item 1 — round 32 raised
the stakes on it rather than lowering them, since unmatched ticked 4.5% → 5.7%
on a much larger population. Newly placed: Thursday opens up (item 2, scoped
and approved), +5 bot farms (item 3, a one-liner that needs its own baseline),
and selection pressure vs. band utilization joins the standing watch at the
bottom.*

1. **Multi-fight lobbies — the group stage.** The remaining ~5.7% unmatched is
   the odd bird out, which is structural: unbounded lobbies make parity a coin
   flip where the old capacity of 8 was even on purpose. Round-robin across a
   room is impossible (30 birds = 435 fights), so partition each room into
   GROUPS — a room of 30 becomes seven groups of four plus one of two, and
   everybody fights. Only a room holding a single entry strands anyone. Wide,
   not a knob: `CADENCE.FIGHTS_PER_BIRD_PER_DAY`, the `potCents = ea.fee * 200`
   assumption, per-fight `landForFight` minting and the single-`battleLogId`
   shape of `lobbyEntries` move together. Zane's ruling on the money: entry
   fees become divisible by 3 (40 → 42, 8 → 9), and the stake splits across the
   fights actually taken, refunding the remainder. Round 32 made it more
   urgent, not less: fill rose to 9.94 birds a lobby and unmatched rose WITH it
   to 5.7%, because a bigger population closes more rooms odd. Partitioning is
   the only thing that removes that residue.
2. **Thursday opens up** (scoped and approved by Zane, after the group stage).
   The Majors field gets seated automatically by the committee on **lifetime
   earnings** — a RANK, not a fixed threshold, so it self-scales as the world
   gets richer and never needs re-tuning. That removes registration, and
   removing registration removes the only reason registrants are barred from
   the Thursday daily card — which is the only reason
   `CARD.CROWN_DAY_OPEN_BLADES` exists, so it becomes dead when this lands.
   **Zane's ruling on agency: auto-QUALIFY, opt-in to STAND.** A hardcore
   bracket force-retires its losers, so a bird is never entered into one
   without its owner accepting. The plumbing is already there: `Lobbies.resolve`
   runs BEFORE the tournaments in the same tick, so a bird going 3/3 on the
   final Thursday card genuinely banks those earnings before the crowns seat,
   and `committeeCards` already computes lifetime earnings off the battle log —
   no schema change needed.
3. **+5 bot farms (15 → 20)**, raised by Zane. One line of config, but it moves
   population, so it takes its own commit and its own baseline rather than
   contaminating somebody else's measurement.
4. **Re-measure discovery with a proper denominator.** Round 32 helped by
   accident — a bigger population means more graded decisions, and age 4+ went
   36.3% → 52.7% clear-home — but the age-1 answer-coverage bucket is still
   thin. Until it isn't, no claim about discovery under the card should be
   believed in either direction.
5. **The element rework.** The wheel is additive, so it fades as the flock
   breeds up; per-fight random weather; and show a lobby's element composition,
   because the counter-meta is currently unplayable rather than merely weak —
   the field is fogged, so nobody can counter what they cannot see.
6. **Fix the flat-flock warning's bar.** 49.5 / 50.7 / 53.3% against a 50% bar
   is a coin flip printed as a verdict. Round 32 moved the flock to 57.0%,
   which is further from the bar but does not make the bar mean anything.
   Either widen the sample or move it to where it does.
7. **Run matched multi-seed worlds** comparing the current and end-first
   discovery policies. The audit is sound and the figure it reads has a unit,
   so a difference between policies is finally attributable to the policies —
   but it wants item 4 first, or it will be measuring the denominator.
8. **Element in the breeding score** (opened by round 30, deferred by Zane): a
   cross-element cover should cost star potential, so bots keep lines pure.
   Deferred on the suspicion that the population is too thin and the star
   incentive too weak for the effect to measure — which is itself testable.
   Round 32 roughly doubled the population, so the suspicion is now cheaper to
   test than it was.
9. **Re-measure `SCOUT.PRIOR_FIGURE` when the BLOODLINES ladder moves a band.**
   It is the flock's mean, not a constant of the engine, and it will drift up
   as the flock breeds up. Do not fit it to a formula it does not obey.
10. **Carriage (Ground/Air) and PFL-style aging curves.** Carriage has been
    data-only since round 23 and is the natural second star axis. Both are new
    mechanics rather than repairs, so they queue behind the group stage.
11. **Standing watch: selection pressure vs. band utilization** (new, round
    32). Covering more hens means covering less selectively — the marginal hen
    is by construction the worst one on the barn's list. The mid-round sim,
    before the floor and the cap were separated, showed gen-2 mean stat gain
    falling to **+11.5** while home margin rose to +7.8; separating them
    recovered it to +30.0. `BREEDING_PLAN.MIN_HENS_COVERED` is now the dial
    that trades one against the other, and nothing yet locates its peak. Watch
    BOTH columns of the BLOODLINES ladder whenever it or `breedDrive` moves.
12. **Standing watch: same-barn stranding, now that nothing caps it.** Dropping
   the capacity dropped the round-17 per-farm seating cap with it (it was
   `capacity / 2`), and it was not replaced — a barn that floods one key
   strands its own surplus and is refunded. 25 birds over 91 days, printed
   every run by LOBBY FILL. If it climbs, it needs a cap that works without a
   capacity.
13. **Standing watch: does shape keep accumulating past generation 2?** The
    ladder shows the first two nests compounding — round 32 read gen 2 at
    **+30.0 mean stat points and +6.9 home margin** over gen 0, up from +23.4
    and +3.1 — but 13 weeks is roughly two selected generations and
    `STAT_VARIANCE` regenerates most of the spread each time. A longer horizon
    is the only way to answer it.
14. **Standing watch: SHORT CARDS, and whether `GROUP.SIZE` is right.** Round
    34's group stage deals levelled groups, so a field that doesn't divide by
    four produces groups of three — two fights instead of three. 33.6% of
    entries got a short card in the 91-day world (full cards 65.4%, never
    fought 0.9%). The unfought stake refunds in full, so this costs nobody
    money, but it does mean a third of entries buy less evidence than the
    mechanic advertises. The lever is `GROUP.SIZE`, NOT the levelling rule —
    packing to 4+4+1 buys full cards by stranding a bird again, which is the
    trade round 34 explicitly refused.
15. **CLOSED, and it was never real — read this before trusting any BLOODLINES
    delta in this file.** Round 34 recorded a "fall" in gen-2 mean stat gain
    (+30.0 → +19.8) as an open question, with a hypothesis that tripling the
    fights had widened the lifetime-earnings spread that feeds bot breeding
    picks. Round 35 killed it twice over:
    - **The hypothesis was wrong on inspection.** `foalScore` reads STATS only
      — shape separation, level, anchors, half-stars. It is blind to earnings,
      records and fight counts, so the group stage could not have changed which
      pairs a barn chooses by that route, or by any route through results.
    - **The number was noise.** Until round 35 the simulation was not
      deterministic (`freshSeed()` returned `Date.now() ^ Math.random()`), so
      every run built a different world. Six 91-day runs of effectively
      identical code gave gen-2 stat gains of **+34.4, +23.4, +23.2, +26.0,
      +17.3, +16.1** — an **18-point spread from the seed alone**. The 10.2-point
      "fall" sat entirely inside it.

    **The standing lesson, which outlives the item.** Measured across three
    seeds at 91 days, the structural numbers are trustworthy to a fraction of
    a point — unmatched 1.0 / 1.0 / 1.0%, full cards 63.1 / 64.8 / 63.0%, fill
    10.40 / 10.22 / 10.72 — while the SELECTION numbers are not: gen-2 stat
    ranges 18 points and home margin ran +6.8 / +7.7 / +12.8. **Items 11 and 13
    below, and every round-over-round BLOODLINES comparison in the round 30–34
    write-ups above, were read off single runs and are inside this band.** They
    are not wrong so much as unsupported. Use `bun run simulate --seed=N`: one
    seed to A/B a change honestly, a spread of seeds before believing any
    delta on the ladder.
16. **Watch: Major cancellations went 0 → 3 while fields GREW (13.7 → 17.0).**
    Every fight in a group banks qualification points separately, so a sweep
    is three points in one night and birds qualify roughly three times faster.
    Bigger fields with more cancellations most likely means the early weeks
    are still thin while the later ones are full — but it is an average hiding
    a distribution, and nothing currently prints the per-week field sizes.
17. **Make LAND conservation provable, the way GP is.** GP has a two-sided
    proof — `gpInWorldCents` against `gpFromFaucetsCents` — and it has caught
    two silent burns. Land has no equivalent: the Majors' per-fight mint
    (`tournaments.ts`) credits `landTokensCents` but records the award as
    `data.landEach` on a `fight` event instead of a signed `lt` delta per
    side, so `sum(events.lt)` does not reconcile against wallets. Round 36
    made this matter more, not less: land is now fractional, minted on a curve
    at three different call sites, and burned at one. The fix is small — emit
    signed `lt` deltas from the tournament mint — and it buys a seventh
    invariant.
18. **Round 36's lesson, worth generalising: a unit change is a silent-failure
    generator.** Converting land to hundredths created three bugs, all of the
    same shape (a hundredths figure passed to an API expecting whole tokens)
    and all invisible: two were swallowed by `quietly()` in the bot layer, and
    the third would have paid a Major champion 0.05 LT. None would have failed
    a test or an invariant. What caught them was reading the call sites by
    hand and rendering the Handbook pages. If another unit ever changes, grep
    every call site of the changed API before trusting the type checker — a
    rename type-checks perfectly while meaning something different.
19. **Watch: the open Thursday is a hardcore faucet with no gate but a rank.**
    Round 37 deleted the qualification-points threshold, so the only things
    standing between a bird and a force-retirement are its age, the bots'
    `CROWN_CHASE.CROWN_MIN_REAL_WINS` appetite, and `PINTAKASI.MAX_BRACKET`.
    The first 91-day read is healthy — fields 16.0 → 22.5, 0 cancellations,
    no attrition warning — but that is ONE seed, and the barn built to stress
    it (Ilonggo Ironworks, crown nerve 0.95) has only ever played one world.
    Replicate across seeds before treating the field size as settled, and read
    POPULATION and CHAMPIONSHIPS together: fields growing while supply falls
    is the shape that would matter, and neither number alone shows it.
20. **The invariant found the bug the same day it was written — twice.** Land
    conservation caught a gacha bundle minting an unrecorded token (fourteen
    rounds old, money-correct, ledger-short, no test asserted the shape); and
    reading the sim's own POPULATION line caught juvenile losers emitting
    `retire` events (round 23 old, four rounds of balance judgement made
    against invented deaths). **Neither was findable by inspection and neither
    would ever have failed a test.** The generalisation, which is now three
    for three with the two silent GP burns: *when money or an asset changes
    hands, the thing that finds the bug is a two-sided sum, not a reader.* If
    a future round adds a place land or GP moves, the question to ask is not
    "is this right" but "what sum would notice if it weren't".
21. **A doctor line that reads fiction is worse than a missing one.** The
    POPULATION block warns when attrition outruns supply — it is the signal
    that caught the round-23 collapse — and it had been counting 67 imaginary
    deaths per three weeks. Nobody noticed because the warning never fired:
    the fiction was smaller than the real supply. **A health metric needs its
    own sanity check against a second source.** `retire` events versus
    `birds.status = 'retired'` disagreed by 67 to 0 and one SQL query would
    have said so. Worth doing for the other derived health lines before
    trusting the next balance argument made from one.
22. **Still open, approved in round 35 and STILL not done: drop the persisted
    `play_by_play`.** ~35 MB of a ~59 MB database, and derivable from the
    stored `battle_log.seed` because `simulatePair` is deterministic. It needs
    a drift guard: narration regenerated after an engine retune can contradict
    the stored result, and a fight log that disagrees with its own outcome is
    worse than a large database. Deferred twice now — name it or drop it.
23. **`testkit.ts`'s `qualified: true` FLATTENS records rather than topping
    them up.** It runs `.set({ wins: 1, stakesWins: 1 })` over every bird, so
    a fixture veteran seeded with 7 wins comes out the far side with 1. That
    is harmless for what the flag is for — clearing the bots' crown appetite
    floor — and the current behaviour is now pinned by a test, but it is a
    trap for any future test about record DEPTH. If it ever bites, the fix is
    `max(wins, 1)`, not a second flag.
24. **`DAY_NAMES` now lives in config, but three Handbook pages still keep
    private copies.** They are identical today. Reorder the config array and
    they disagree silently — the exact failure mode the "numbers are imported,
    never typed" rule exists to prevent, applied to a string array nobody
    thought of as a number. Fold them in next time one of those pages is open.
25. ~~**The "lower battle_log id is side A" assumption is data that isn't
    stored.**~~ **CLOSED in round 39** — `battle_log.side` stores it. The
    lesson worth keeping is the shape of the fix rather than the fix: the
    column is `NOT NULL` **with no default**, so a new insert site cannot
    compile without stating a side. A default would have let it guess, and a
    guessed side is exactly the silent, correct-looking wrong answer the whole
    change exists to prevent. Adding it named all six other insert sites in
    the codebase for free, which is the same argument in miniature.
26. **A column nobody reads is invisible until you go looking.** `play_by_play`
    was 51 MB of a 90 MB database, written every fight since round 11, and a
    single grep for its own name showed nothing in the codebase ever read it
    back. Nothing flagged that: not the doctor, not a test, not a type error.
    Worth a periodic sweep — for every column the schema declares, what reads
    it? The same question would have found this one at any point in twenty
    rounds.
27. **A change that makes one number better can close a door somewhere else,
    and only the adoption block will say so.** Round 40's overnight stake sweep
    took idle land 6.7% → 0.5%, and in the same stroke took **studs listed 19
    of 20 → 4**: a stud seat needs 100 LT *liquid*, the bots' day was ordered to
    list before staking so they would have it, and the sweep meant they now
    woke up with nothing. Every invariant passed. Every test passed. `quietly`
    ate twenty refusals a day. **The only thing in the whole project that knew
    was the adoption bar chart** — which is the third time that has been true
    (claiming in round 19, paid gacha in round 22, this). The rule to carry: a
    change to WHEN money moves is a change to what is affordable, and the
    adoption block is not a nice-to-have on those, it is the test.
28. **A report that prints a total can hide a distribution — ask what the sum
    is concealing.** The doctor printed each division's purse for twenty-two
    rounds and never printed its SPREAD, so "the money is there" and "the money
    reaches the winners" read as the same sentence, and a purse that paid 8
    birds out of 31 sat in plain sight the whole time. It took a player
    noticing. Every other aggregate in the report deserves the same question
    asked of it once: what would a badly-shaped version of this look like, and
    would this line look any different?
29. **The juvenile crown's land curve is inverted, and round 41 only fixed the
    Majors' half.** Crown land is two things added together: a per-fight mint
    to both fighters, and an elimination grant that deliberately pays the
    earliest exit most. In the Majors the mint (55.90 a fight) is 2.4× the
    grants, so a deeper run banks more land and the inversion is only a
    softening. In the JUVENILE division the mint is 1.15 a fight against grants
    of 9.00 down to 1.00, so the grant dominates and it stays inverted: a
    juvenile champion banks **6.75 LT against a first-round loser's 10.15**.
    That may be right — "land to the fallen" was designed for a hardcore stage
    where losing ends a career, and nothing dies in the discovery year — but it
    is currently an accident of two numbers rather than a ruling. Decide it,
    then either move `JUVENILE_MAJOR.LAND_GRANTS` or write down why not.
30. **A bye can out-earn the champion in land.** Land mints per fight fought, so
    a short field's champion that won four fights banks less than a runner-up
    that fought five. This is the same "a bye is not a win" rule the purse
    follows and it is ledger-honest — noted only because it looks like a bug
    the first time you meet it, and the fix (crediting byes) would contradict a
    ruling we made on purpose.
