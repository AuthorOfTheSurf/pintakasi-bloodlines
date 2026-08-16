# The Options Brief — design spec (Phase 1, 2026-08-16)

Status: **SPEC ONLY — no code changed.** Implementation is Phase 2, behind a
flag, after Zane signs off on the open decisions at the bottom.

## Why (one paragraph, then the receipts)

Eight experiments produced two laws, and both are symptoms of one design:
the brief asks a small model to **synthesize** (join `cardTonight` ×
`fighters` × ~20 prose rules) when small models are only reliable at
**selection**. The pipe law's seven gaps were all facts the join needed and
the mail didn't carry; the first-link law is the model refusing to
*originate* a chain-starting action (`retire`) that prose alone commands.
Every regression in the arc was fixed by a data field or a schema change —
**never once by prompt tuning or coaching.** So the generalization of all
eight experiments: pre-compute the join in the engine and hand the model
the result.

Receipts (all in BRAINS.md / the runs dirs):
- crown verb unused 560 straight calls → fixed by one data line
  (`majorsThisWeek`), not by the coach's repeated orders.
- juvenile crowns 640–0 across four experiments → fixed by
  `juvenileCrownsThisWeek`.
- exp6's 125 juvenile proposals, zero legal → fixed by one enum word.
- `retire` never fired from standing orders in eight experiments; fired
  119× the segment a coach named it as a dated imperative.

## The design in one sentence

Each fighter arrives with its **legal, pre-valued, sorted options attached**;
the barn arrives with its own options list for non-bird actions; the model's
reply collapses to **picks**, with one off-menu escape hatch.

## 1. The per-bird options block

Replaces the model's job of cross-referencing `cardTonight`, eligibility
flags, mode law, blade law, and fee math. Every row is **already legal**:
eligibility, mode, affordability, and one-lobby-per-day are enforced at
generation time by what appears.

```json
{ "id": "#3", "name": "Poultrygeist", "age": 1, "stars": 3.5,
  "record": "2-0", "bestBlade": "b2",
  "options": [
    { "pick": "A", "do": "crown juvenile b2", "fee": 48, "value": 9,
      "why": "discovery main event: purse + land + blade verdict, no career risk" },
    { "pick": "B", "do": "enter juvenile maiden b2", "fee": 10, "value": 6,
      "why": "cheap discovery, soft field" },
    { "pick": "C", "do": "rest", "value": 0,
      "why": "earns nothing, discovers nothing" }
  ] }
```

Rules of the block:
- **Sorted by value, descending.** Skipping the Major now means actively
  reading past `value: 9` — omission bias flips to our side.
- **`rest` is always the last row, always value 0.** Doing nothing becomes
  a visible choice with a visible cost, never a default.
- **Hardcore risk is a flag beside the value, never folded in:**
  `{ "pick": "A", "do": "crown major b1", "value": 8, "hardcore": true,
  "why": "biggest purse in the game; the loser's career ends tonight" }`.
  Risk appetite stays a persona decision — this is what keeps ten barns
  from collapsing into one argmax follower.
- **`retire` appears as a bird-attached option row** on age-3+ birds,
  valued by pipeline need (shed empty → high; roster thin → low):
  `{ "pick": "D", "do": "retire to breeding shed", "value": 7,
  "why": "worst record in the barn, shed is empty, a hen breeds weekly" }`.
  This is the first-link law test: chain initiation becomes selection.
- Pick letters are **scoped per bird** (A, B, C… restart on each bird).
  They live inside the bird's own object, so they cannot collide with
  `#N` handles or `b1–b5` formats (the HANDLE_PREFIX lesson, applied).

## 2. The barn-level options block

Non-bird actions get the same treatment, one flat list:

```json
"barnOptions": [
  { "pick": "@1", "do": "breed Henrietta (#9) x Cruel Beak [Ilonggo Ironworks]",
    "fee": 120, "value": 8,
    "why": "best legal pairing tonight; barn has space; chicks fight in 3 weeks" },
  { "pick": "@2", "do": "expand_barn", "cost": "3000 LT", "value": 7,
    "why": "barn 98/100 — a full barn blocks every egg" },
  { "pick": "@3", "do": "claim Thunderclap (entry 4412, tag 250)", "value": 5,
    "why": "4-1 record beats its price class" }
]
```

- **Breed rows are pre-paired**: engine names a specific legal hen × a
  specific legal stud (own or studMarket, fee shown). `unknown mother #1`
  becomes unrepresentable — the second half of the first-link fix. Offer
  the top 2–3 pairings, not a combinatorial explosion.
- Handle prefix `@` — collides with nothing the domain names.
- `roll_gacha` (freePulls > 0), `list_stud`, `buy_land`/`stake` rows appear
  only when currently legal and non-trivial.

## 3. Chores leave the decision space entirely

Precedent: the naming law (exp7) moved christening into `applyProposals` as
bookkeeping. Extend it:
- **`check_in` becomes apply-path bookkeeping.** Scripted bots and
  auto-play both treat it as a reflex; making the model spend a pick on it
  measures nothing. (Decision #3 below — this is a behavior change.)
- `list_stud` on any unlisted retired rooster: candidate for the same
  treatment (currently prose-commanded, reliably forgotten).

## 4. The reply schema

Dynamic JSON-schema keys don't constrain well, so picks are an array, not
a map:

```json
{ "picks":     [ { "bird": "#3", "pick": "A" }, { "bird": "#7", "pick": "B" } ],
  "barnPicks": [ "@1", "@2" ],
  "offMenu":   [ { "do": "enter", "bird": "#5", "classType": "open",
                   "format": "b3", "mode": "real" } ] }
```

- One pick per bird — one-lobby-per-day enforced by shape.
- **`offMenu` is the escape hatch**: the existing per-verb `anyOf` schema,
  unchanged. Without it we've built a scripted bot with extra steps. Its
  usage rate is itself a headline metric — how often does the model *want*
  off the menu, and do those moves outperform?
- Translation keeps DROP-DON'T-REPAIR: an unknown pick letter is counted
  and reported, never guessed.
- Expected side-benefit: a full-card day's reply shrinks from ~25 action
  objects to ~25 two-field picks. The `num_predict` gait ceiling (standing
  since exp3) loosens without touching the cap.

## 5. The value score (engine-side, deliberately coarse)

Integer **0–9** plus one `why` string. Components, all facts the engine
owns and the model can't derive:

| Component | Source |
|---|---|
| Discovery bonus | age === 1, decaying as fights-at-bestBlade accumulate |
| Blade-position prior | b1/b5 > b2/b4 > b3 |
| Class softness | maiden / low-claimer vs. open — read lobby fill or class priors |
| Win-probability proxy | scout score vs. the class's typical winning figure |
| Stakes math | fee vs. purse × p(win); Majors come out loudly positive |
| Pipeline need (retire/breed rows) | shed emptiness, barn space, roster age curve |

Guardrails:
- **Coarse on purpose.** A 0–9 integer with ties is an opinion; a float is
  an order. If the score is too good the barns become score-followers and
  the ten-persona experiment is wasted. The score is the scout's opinion;
  the persona decides.
- `hardcore` never inside the score — beside it.
- Deterministic and cheap (runs per barn per day inside `buildView`'s
  read path; no RNG, no db writes).

## 6. What shrinks: the SYSTEM prompt

The mode law, the crown-eligibility rules, the bestBlade rule, the fee
reserve rule — all become properties of *which rows appear*. The options
SYSTEM prompt should target **~10 lines**: you manage a stable; rows are
pre-checked and sorted by the scout's opinion; `value` is advice, not an
order; `hardcore` means the loser's career ends; your standing orders
outrank the scout. A GOOD DAY's ten bullets mostly die — their content now
lives in the data they governed.

Standing orders / persona creeds / coach tune channel: **unchanged.** The
A/B stays clean — same personas, same coaching protocol, different brief.

## 7. Instrumentation (the verdict tools)

New columns in `brain_log` (or derivable from `proposed` + a new
`offered` field logged per call):
- **EV capture rate** — fraction of birds where the taken pick was the
  top-value row. Per barn, per segment. The number the whole redesign is
  judged on, and the number that turns coaching effects measurable.
- **Off-menu rate** — offMenu actions / total actions.
- **Rest rate** — explicit rests vs. silent omissions (picks missing for a
  bird that had options).
- Drop rate should collapse to ~0; if it doesn't, the translation layer
  has a bug.

## 8. Exp9 protocol (Phase 3, unchanged from the agreed plan)

- One 91-day world, options brief, same 10v10 roster, same creeds, same
  coach cadence (28/56), same fail-fast gate at day 28.
- **Baseline is exp8b** — identical code otherwise; eight seasons of arc
  context behind it.
- Success criteria, pre-registered:
  1. `retire` fires **before coach #1** (by ~day 14) — if yes, the
     first-link law was an interface artifact, not a model limit.
  2. Eggs before day 28 without a dated imperative.
  3. Juvenile crown entries ≥ exp8 pace without the coach naming them.
  4. EV capture rate reported per segment (no target — first measurement).
  5. Ratio vs. 0.38–0.59 arc band — directional, not the headline.
- Coach sessions shift role: less "TODAY, retire X" (the rows carry that
  now), more strategy differentiation per creed — what coaching was for.

## 9. Implementation map (Phase 2, one flag)

| Where | Change |
|---|---|
| `scripts/simulate.ts` | `--brief=options` (default stays legacy) |
| `src/engine/bot-brain.ts` | `buildOptions(view)` — valuation + legality, exported so tests hit it directly |
| `src/engine/decider-ollama.ts` | `digestOptions()` beside `digest()`; `OPTIONS_SYSTEM` beside `SYSTEM`; picks reply schema + translation; brain_log gains `offered` |
| Tests | unit: option legality (never an illegal row), value determinism, pick translation, off-menu passthrough; smoke: 3-day world |

Nothing about collect/apply, `quietly`, fixed ORDER, or the actor plumbing
changes. Legacy brief stays fully runnable — the A/B is one flag.

## Open decisions (Zane)

1. **`check_in` chore-ification** — recommended yes (measures nothing),
   but it's a behavior change to the llm path, so it's called out.
2. **Claim rows in v1?** — spec includes them (`@` rows); could defer to
   keep v1 smaller. Recommended: include — the data already flows.
3. **How many option rows per bird?** — recommended cap 4 (top 3 + rest).
   More rows = more tokens and a muddier EV-capture metric.
4. **Breed pairings offered** — top 2–3 vs. just the single best.
   Recommended 2–3: leaves the persona a real choice.
