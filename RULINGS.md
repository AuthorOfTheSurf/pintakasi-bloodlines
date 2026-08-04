# RULINGS

A ledger of WHAT was ruled and WHEN — rounds ~14 through 23. The *reasoning*
lives in the dated comment blocks in `src/engine/config.ts` (and, for a few
items, in the test files that pin the behavior); this file exists so an
agent can see a knob's history without reading that whole file first.
Append-only — when a rule is reversed or re-tuned, add a new line, don't
edit the old one. Round numbers and dates come from `git log --oneline`
(rounds 14–19 landed 2026-08-03, rounds 20–23 landed 2026-08-04).

## Reversals at a glance

Knobs that were set, reversed, and re-set — the ones worth double-checking
before assuming "current value = only value this ever was":

| Knob | Round 14–19 | Round 20–21 | Round 22 | Round 23 |
|---|---|---|---|---|
| `STAKER_FLOWS.FIGHT_RAKE` | 0 (round 16: "a PURE POT... win +entry, lose −entry") | 0 | **0.02** (2%, part of the LT-flywheel widening) | **0** again ("BACK TO ZERO" — 3,657 GP/mo to stakers was "enough... it seems") |
| `ECONOMY.GACHA_ROLL_PRICE` | 80 GP | 80 GP | **16 GP** (cut so bots would finally buy) | **80 GP** again (gacha out-supplied breeding 8:1 at 16 — "stables [should be] primarily breeding to create birds") |
| Gacha egg tiers (`GACHA_BIRDS`) | Blue + Purple + Gold all drop eggs (round 14 constrained their STATS, not which tiers drop) | same | same | **Blue removed** — Purple/Gold only; halves the egg rate (16/100 → 6/100) |
| Claimer sale on an unmatched (odd-bird-out) entry | sells anyway, no fight required | same | same | **reversed** — "no fight, no claim": an unmatched claimer refunds instead (fee + every claim) |
| `PINTAKASI.ENTRY_FEE` | 200 GP (round 18 launch) | 200 GP | **0 — FREE**, qualification-by-fighting replaces payment | 0 (held) |

## Round-by-round

**Round 14** (2026-08-03) — the naming law: no bird fights under an auto-name. Gacha egg-drop weights retuned (2 free pulls/day × a 23% egg rate was out-producing the breeding barn — "Mystery Egg (Blue) VIII" in the feed was the tell); ~16 eggs/100 rolls after. Gacha birds' stats CONSTRAINED so no tier's `statMax` beats the starter ceiling by more than a whisker (the old Gold tier at 350–700 strictly dominated gen-1 breeding) — the gacha's jackpot is STARS, never raw stats. Pixel-art coats added (base coat + element-tinted trim); a bred chick inherits a parent's base coat with a small mutation chance (placeholder genetics). **Paid gacha rolls start feeding the juice pool** — this closes the first of the two silent-burn incidents AGENTS.md's "GP is never printed or burned" rule calls out: gacha spend used to vanish rather than route anywhere (the second incident is `buyLand`, not fixed until round 22 — see below).

**Round 15** (2026-08-03) — cold start: every stable begins with 4 age-0 eggs, nobody fights week one. ONE lifetime record (round 9's practice/juvenile split collapses back into a single win/loss column that counts everywhere). Ages freeze at retirement. Colored letter grades (O/O+ tiers) in the Birds table. "Studding" status added.

**Round 16** (2026-08-03) — topline diffs (a snapshot per tick, day or week span) power the admin's before/after cards. THE FIGHT ECONOMY PRINCIPLE is stated here for the first time in these terms: standard fights print no GP — pure pot, win +entry / lose −entry, the subsidy is Land Tokens not GP. This is the "round 16 ruled" baseline that round 22's fight rake later breaks and round 23 restores (see Reversals table).

**Round 17** (2026-08-03) — The Card schedule view. Cancellation fixes: a per-farm lobby cap, and auto-play cards by style (shared logic with the bots, `formatScores`/`bestFormat` in `bots.ts`).

**Round 18** (2026-08-03, ruled 2026-08-03) — **THE PINTAKASI** launches: three weekly blade championships, one per "distance" (Long Knife + Short Gaff always run; the middle blade rotates Short Knife / Long Gaff by week parity). Hardcore throughout, age 3+, entry fee 200 GP (`LAND_BASIS` still carries this number today, held as "the stake the crowns represent" even though round 22 made entry free). Committee-seeded bracket (1v16, 8v9…) ranked by earnings → wins → avg figure; byes to the top seeds; the Selection Committee live-bumps a full field's weakest entrant. GP to the top (purse = the week's juice-pool share, first-round losers zeroed), land to the fallen (elimination grants pay the earliest-out the most). One bird per stable per week at launch (see round 19).

**Round 19** (2026-08-03) — demo polish. **One bird per CROWN, not one per stable** — the round-18 rule stopped after a single weekly entry, which starved a three-crown week down to one field of seven across ten farms; now a barn declares a specialist per blade. Class ladder reads STAKES wins (not lifetime wins) so maidens exist again — the discovery year doesn't graduate anybody. Player-side claiming. Starter TALENT SPIKE: each stat gets a small chance to roll above the starter band, so ~a third of birds show a green grade somewhere on day one (the six-stat average still sits in B/B+ — raising the whole bird stays breeding's job).

**Round 20** (2026-08-04) — **Pit Figure REBUILT, PFL-true.** The old figure scored each bird against its opponent, which let a loser out-figure the winner of the same fight; now the winner's figure is absolute (measured against a maxed-out ghost pace) and the loser is scored down from the winner by beaten lengths — a loser can never figure above the bird that beat it. Crown day **moves Wednesday → Thursday** (a bird gets one more ordinary card first). **MAX_PER_BARN: 1 → 3** — a deep barn may load one championship with three specialists, not one. Juveniles fight juveniles only (previously mixed into the open-age lobbies). Eggs hide their stats on the board and just read "Egg". 1 free gacha pull/day. World genesis seeds the juice pool with `SEED_JUICE` = 2,400 GP (3 days of drip) so the first championships are worth entering before breed fees fill the pool.

**Round 21** (2026-08-04) — the Staking tab: total LT staked and GP earned via staking, per barn and world-wide. This is a measurement round, not a rule change — but the numbers it exposed (ten barns, 10,627 LT staked, 55.96 GP earned across 35 days — breed fees were the pool's *only* inflow) are the direct cause of round 22's LT-flywheel ruling.

**Round 22** (2026-08-04) — **the LT flywheel**: every way GP changes hands now pays the land stakers a slice of the gross, in centi-GP. `STAKER_FLOWS`: fight pots 2% (reverses round 16 — see Reversals table), claim tags 2%, gacha spend 10%, breed fees doubled 2.5% → 5% (2.5% was round 10's original rate), land purchases 100% (previously silently burned — the second of the two silent-burn bugs AGENTS.md calls out). Gacha repriced 80 → 16 GP with bots/auto-play finally buying paid rolls. **The Pintakasi goes free-entry**: `ENTRY_FEE` 200 → 0, qualification earned by fighting instead (`POINTS_FOR`: juvenile 0 / real 1 / hardcore 2 per win; `QUALIFYING_POINTS` = 3). The Selection Committee's bump-line ranking switches to POINTS-first (previously earnings-first) — campaigning beats a fat wallet.

**Round 23** (2026-08-04) — the biggest round in the range, several reversals at once (see Reversals table for the full before/after):
- Fight pots **back to 0% rake** ("we are getting enough LT yield it seems" — round 22's 2% took monthly staking income from 56 GP to 3,657). The claim rake (2%) *survived* — a sale is a different thing from a fight.
- Gacha **back to 80 GP** and Blue no longer drops an egg (Purple/Gold only) — gacha was out-supplying the breeding barn 8:1 at 16 GP; the roll is a luxury again, not the cheap way to fill a barn.
- **100 LT to stand a stud** (`COVERS.STUD_LISTING_LT`) — the first LAND SINK. Round 22 gave land a strong yield with nowhere to spend it; this gives the yield a price to be measured against.
- Starter stars **nerfed**: `STARTER_MAX_HALF` caps day-one stock at 1.5★ (was uncapped enough that a 4★ bird could appear in week one). The gacha's Purple/Gold tiers and breeding are now the only way to 2★+.
- **CARRIAGE added** (`CARRIAGES`, `carriage`, `carriageHalfStars`) — the Ground/Air preference axis, PFL-style (dirt/turf, but here pang-baba/pang-itaas). Data layer only: seeded, inherited (`BREEDING.CARRIAGE_LEAN_STRONGER` = 0.75, higher than the element lean since carriage is meant to be selectable), rolled in the gacha — **not yet wired into the fight engine** (Zane's explicit scope call). See `src/engine/juvenile.test.ts`/`carriage.test.ts` for the round-23 coverage this file's job was to close.
- **The Juvenile Championship** (`JUVENILE_MAJOR`) — a full discovery-year ladder (maiden → stakes → claimer, gated on juvenile wins since a one-year-old has no stakes record) plus a non-hardcore weekly crown. Two blades (one knife, one gaff, lengths alternating by week), runs Wednesday, the day before the Majors. **NOT hardcore** — the one deliberate exception to "every championship force-retires its losers" in the whole game, because ending careers at age one would strangle the population the Majors are meant to inherit. Takes `JUICE_SHARE` = 20% of the juice pool, split across its two crowns; the Majors take whatever's left. A juvenile win does not bank a `stakesWins` (it's still the discovery year — round 19's "the discovery year doesn't graduate anybody" rule, held).
- **No fight, no claim** (reverses prior behavior — see Reversals table): an unmatched claimer used to sell anyway; now it refunds instead, fee and every claim.
- Cousin bot stables added with handler names (`bot-marco`, `bot-reno`, `bot-kevin`) alongside two new speculator styles — the whale (gacha bundles) and the landlord (maxes the daily land-buy cap) — giving both the gacha and the land market bots with an appetite for them (AGENTS.md's "bots and auto-play need teaching" rule: a door nobody has an appetite for measures zero in simulation, as happened twice before — claiming in round 19, paid gacha rolls in round 22).
- AGENTS.md gains the rule that pins the Handbook (`src/app/wiki/`) to move with the code in the same unit of work as any rule change.
