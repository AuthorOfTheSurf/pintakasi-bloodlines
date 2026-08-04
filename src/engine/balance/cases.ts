/**
 * THE CASE CATALOGUE — one measurement per question.
 *
 * `lab.ts` gives you fights; this gives you the FOURTEEN QUESTIONS worth asking
 * of them, each one held still except for the single variable it names. The
 * split matters: the primitives never decide what is interesting, and a case
 * never invents a fight loop. Adding a question means adding an entry to
 * `CASES` and nothing else.
 *
 * Three rules every case here obeys, learned the hard way:
 *
 *  1. HEADLINE NUMBERS ARE MIRRORED. Side A rolls first every turn and an
 *     exact tie is a coin flip, so any single-sided win rate carries a
 *     positional term of unknown size. `mirrored` cancels it.
 *  2. EVERY RATE SHIPS WITH ITS CI. A difference smaller than ±ci95 is not a
 *     difference. This is not pedantry — a 200-seed assertion in this repo
 *     passed while sitting on the wrong side of the true value.
 *  3. WATCH THE UNDERDOG GATE. It is the engine's one binary cliff, and it
 *     fires on TOTAL stats. Almost every "make one bird better and measure"
 *     design changes the total, so half of these cases are secretly measuring
 *     station unless they say otherwise. Where that bites, the case reports
 *     BOTH the naive number and a neutralised one, because the gap between
 *     them is usually the actual finding.
 *
 * Cases are pure: no DB, no I/O, no printing. They return tables; `report.ts`
 * decides what a table looks like.
 */
import {
  BATTLE,
  ELEMENTS,
  ELEMENT_BEATS,
  FIGURE,
  FORMATS,
  FORMAT_NAMES,
  PHASES,
  STARS,
  STATS,
  STAT_NAMES,
  type Element,
  type FightFormat,
  type StatName,
} from "@/engine/config";
import { simulatePair, type Combatant } from "@/engine/fight-sim";
import { mulberry32 } from "@/engine/rng";
import {
  clawbackOf,
  duel,
  flat,
  mirrored,
  shaped,
  statTotal,
  underdogOf,
  withKnob,
  type DuelResult,
} from "./lab";
import {
  EVERY_STAT_EVERYWHERE,
  GRADE_STEP,
  GRADE_TARGETS,
  STAR_INTENT,
  STAT_PRIORITY,
  SYMMETRY_TARGET,
  judgeRanking,
  judgeTarget,
  type MeasuredLift,
} from "./intent";
import type { BalanceCase, CaseOptions, Row } from "./types";

// ── Shared furniture ────────────────────────────────────────────────────────

/**
 * The control bird's level on every stat.
 *
 * Not a game rule and not in config — it is the lab's chosen vantage point,
 * matching `shaped()`'s default and the bird formats.test.ts has always used,
 * so every number produced here is comparable with every number already
 * written into a config comment. It sits just above the starter band
 * (STATS.STARTER_MIN..MAX) because a bird at the very bottom of the scale
 * makes every flat modifier look enormous.
 */
const BASE = 350;

const blades = (o: CaseOptions): FightFormat[] => (o.format ? [o.format] : FORMAT_NAMES);

/** Duel options threaded from the case options — sample size is never hardcoded. */
const runOpts = (o: CaseOptions, format: FightFormat, weather?: Element) => ({
  format,
  runs: o.runs,
  seedFrom: o.seedFrom,
  weather,
});

const pct = (x: number) => x.toFixed(1);
/** A win rate is never printed without the interval that says whether it is real. */
const rate = (r: DuelResult) => `${pct(r.winRate)} ±${pct(r.ci95)}`;
const bladeLabel = (f: FightFormat) => FORMATS[f].label;

/** A copy of a bird with one stat overridden — the sensitivity case's whole method. */
const bump = (level: number, stat: StatName, to: number, opts = {}) =>
  shaped({ [stat]: to }, { base: level, ...opts });

// ── 1. SYMMETRY ─────────────────────────────────────────────────────────────

const symmetry: BalanceCase = {
  name: "symmetry",
  question: "Two identical birds — is the engine fair, and what is each blade like?",
  run(o) {
    const rows: Row[] = [];
    for (const f of blades(o)) {
      const r = mirrored(flat(BASE, { name: "A" }), flat(BASE, { name: "B" }), runOpts(o, f));
      const v = judgeTarget(r.winRate, SYMMETRY_TARGET, r.ci95);
      rows.push({
        label: bladeLabel(f),
        cells: [
          String(FORMATS[f].maxTurns),
          rate(r),
          pct(r.meanTurns),
          pct(r.endings.ran),
          pct(r.endings.windOut),
          pct(r.endings.bell),
          pct(r.ranRateA),
          pct(r.meanFigureA),
        ],
        verdict: v.verdict,
        note: v.note,
      });
    }
    return [
      {
        title: "SYMMETRY — THE CONTROL",
        question:
          "Identical birds, both sides. Should read 50%; every other number in this report is read against it.",
        columns: [
          "blade",
          "max turns",
          "A win% ±95",
          "mean turns",
          "end: ran%",
          "end: wind%",
          "end: bell%",
          "A ran%",
          "mean figure",
        ],
        rows,
        findings: [
          // The endings mix is the real content of this table. A blade is not
          // characterised by its damage multiplier, it is characterised by how
          // its fights STOP: a knife that ends on an empty wind pool and a gaff
          // that ends on the bell are different games even at the same win rate.
          "The endings mix characterises each blade: which way fights STOP is the blade's identity, not its damage multiplier.",
        ],
      },
    ];
  },
};

// ── 2. ELEMENTS ─────────────────────────────────────────────────────────────

/** The attacker the element cases are written from, and its prey — read off the wheel, never typed. */
const ATTACKER: Element = ELEMENTS[0];
const PREY: Element = ELEMENT_BEATS[ATTACKER];
/** An element the attacker neither beats nor loses to — the clean control pairing. */
const NEUTRAL: Element = ELEMENTS.find(
  (e) => e !== ATTACKER && ELEMENT_BEATS[ATTACKER] !== e && ELEMENT_BEATS[e] !== ATTACKER
)!;

const relationTo = (opponent: Element): string =>
  ELEMENT_BEATS[ATTACKER] === opponent
    ? "edge"
    : ELEMENT_BEATS[opponent] === ATTACKER
      ? "counter"
      : opponent === ATTACKER
        ? "mirror"
        : "neutral";

const elements: BalanceCase = {
  name: "elements",
  question: `What is the ${ATTACKER} bird's matchup worth, across the wheel and across the blades?`,
  run(o) {
    const bs = blades(o);
    // Full stars on BOTH birds since the 2026-08-04 rework: stars are the
    // element's volume knob, so this case measures the wheel at its ceiling
    // — the strongest any matchup can be. The star LADDER between there and
    // zero is the stars case's job, not this one's.
    const rows: Row[] = ELEMENTS.map((opponent) => {
      const cells = bs.map((f) => {
        const r = mirrored(
          flat(BASE, { name: "A", element: ATTACKER, halfStars: STARS.MAX_HALF_STARS }),
          flat(BASE, { name: "B", element: opponent, halfStars: STARS.MAX_HALF_STARS }),
          runOpts(o, f)
        );
        return rate(r);
      });
      return {
        label: `${ATTACKER} vs ${opponent}`,
        cells: [relationTo(opponent), ...cells],
      };
    });
    return [
      {
        title: "ELEMENTS — THE WHEEL, AT FULL STARS",
        question: `${ATTACKER} against all five elements, both birds ${STARS.MAX_HALF_STARS / 2}★ (the ceiling — a lower-star bird's edge scales down from these rows). ${ATTACKER} overcomes ${PREY}; ${ELEMENTS.find((e) => ELEMENT_BEATS[e] === ATTACKER)} overcomes ${ATTACKER}.`,
        columns: ["matchup", "relation", ...bs.map(bladeLabel)],
        rows,
        findings: [
          // ELEMENT_EDGE is flat, but the blades are not: a flat bonus is worth
          // more where more turns compound it against the wind pool.
          "A flat roll bonus is not worth the same at every distance — the blades weigh the same edge differently.",
          "Mirror and neutral rows are a second read on symmetry: they should sit at the control's 50%.",
        ],
      },
    ];
  },
};

// ── 3. STARS ────────────────────────────────────────────────────────────────

/**
 * Stars are the element's VOLUME KNOB (reworked 2026-08-04): both edges
 * multiply by halfStars/10, and the old flat stat boost — the confound that
 * once made a 5★ bird measure WORSE than its 0★ twin by tripping the
 * underdog gate — is gone. Two invariants define the mechanic, and each gets
 * a table:
 *
 *  1. AT A FAVORABLE MATCHUP the ladder should climb from exactly the
 *     no-star baseline (0★ = the wheel counts for nothing) to the full
 *     ELEMENT_EDGE ceiling at 5.0★, with every half-step a real rung.
 *  2. WITHOUT A MATCHUP stars must do nothing at all — a star bird against
 *     its own element is a pure coin flip at every star level. This is the
 *     row set that catches stars ever leaking back into raw power.
 */
const stars: BalanceCase = {
  name: "stars",
  question: "Stars scale the element edge — does the ladder climb, and is 0★ truly mute?",
  run(o) {
    const bs = blades(o);
    const steps = Array.from({ length: STARS.MAX_HALF_STARS + 1 }, (_, i) => i);

    const matchupRows: Row[] = steps.map((h) => {
      const results = bs.map((f) =>
        mirrored(
          flat(BASE, { name: "Star", element: ATTACKER, halfStars: h }),
          flat(BASE, { name: "Prey", element: PREY }),
          runOpts(o, f)
        )
      );
      // Only the mute end carries a verdict: 0★ with the wheel advantage must
      // be indistinguishable from no advantage at all. The climb itself has
      // no numeric target — the ceiling is ELEMENT_EDGE's ruling, not ours.
      const muteBroken = h === 0 && results.some((r) => Math.abs(r.winRate - 50) > r.ci95);
      return {
        label: `${h / 2}★ (edge ×${(h / STARS.MAX_HALF_STARS).toFixed(1)})`,
        cells: results.map((r) => rate(r)),
        verdict: h === 0 ? (muteBroken ? "warn" : "ok") : undefined,
        note:
          h === 0
            ? muteBroken
              ? "a 0★ bird is getting element value it should not have"
              : "0★ mutes the wheel completely"
            : undefined,
      };
    });

    // The leak detector: same element, so no edge exists for stars to scale.
    // Coarser ladder (full stars) — the question is binary, not a curve.
    const leakRows: Row[] = steps
      .filter((h) => h % 2 === 0)
      .map((h) => {
        const results = bs.map((f) =>
          mirrored(
            flat(BASE, { name: "Star", element: ATTACKER, halfStars: h }),
            flat(BASE, { name: "Twin", element: ATTACKER }),
            runOpts(o, f)
          )
        );
        const leaks = results.some((r) => Math.abs(r.winRate - 50) > r.ci95);
        return {
          label: `${h / 2}★ vs 0★, same element`,
          cells: results.map((r) => rate(r)),
          verdict: leaks ? "warn" : "ok",
          note: leaks
            ? "stars are worth something WITHOUT a matchup — they are leaking into raw power again"
            : undefined,
        };
      });

    return [
      {
        title: "STARS — THE LADDER AT A FAVORABLE MATCHUP",
        question: `${ATTACKER} (starred) vs ${PREY} (0★): the wheel edge at each star level. The whole mechanic is this climb.`,
        columns: ["stars", ...bs.map(bladeLabel)],
        rows: matchupRows,
        findings: [
          `INTENT: ${STAR_INTENT.intended}`,
          `STATUS: ${STAR_INTENT.status}`,
          `The delivered edge is ELEMENT_EDGE × halfStars/10 — at today's ceiling (${BATTLE.ELEMENT_EDGE}) a 2.5★ bird plays round 24's old flat edge and only 5.0★ sees the full value.`,
        ],
      },
      {
        title: "STARS — NO MATCHUP, NO VALUE",
        question:
          "Same-element duels: with no edge to amplify, every star level must be a coin flip. This is the leak detector for stars re-entering raw power.",
        columns: ["stars", ...bs.map(bladeLabel)],
        rows: leakRows,
      },
    ];
  },
};

// ── 4. SHAPE ────────────────────────────────────────────────────────────────

/**
 * Is a SPECIALIST worth more than a generalist at the blade it was built for?
 *
 * The bird is built by moving points, never adding them: the blade's top two
 * intended stats go up by one grade step and its bottom two come down by the
 * same, so the total is untouched. That is not tidiness — an unequal total
 * trips the underdog gate, and the case would then be measuring station with a
 * shape-shaped hat on.
 *
 * The anti-specialist (the same trade, backwards) is run alongside because a
 * specialist beating 50% proves less than it looks: it could mean the blade
 * rewards its top stats, or it could mean the top stats are simply stronger
 * than the bottom ones everywhere. If shape is real, the two columns straddle
 * 50% by roughly the same distance.
 */
const shape: BalanceCase = {
  name: "shape",
  question: "Does building for the blade beat building flat, at equal stat total?",
  run(o) {
    const rows: Row[] = [];
    for (const f of blades(o)) {
      const order = STAT_PRIORITY[f].order;
      const best = order.slice(0, 2);
      const worst = order.slice(-2);

      const build = (up: StatName[], down: StatName[], name: string): Combatant =>
        shaped(
          {
            ...Object.fromEntries(up.map((s) => [s, BASE + GRADE_STEP])),
            ...Object.fromEntries(down.map((s) => [s, BASE - GRADE_STEP])),
          },
          { base: BASE, name }
        );

      const spec = build(best, worst, "Spec");
      const anti = build(worst, best, "Anti");
      const control = flat(BASE, { name: "Flat" });

      const rSpec = mirrored(spec, control, runOpts(o, f));
      const rAnti = mirrored(anti, control, runOpts(o, f));
      const clean =
        statTotal(spec) === statTotal(control) && underdogOf(spec, control) === "neither";
      const real = rSpec.winRate - SYMMETRY_TARGET > rSpec.ci95;

      rows.push({
        label: bladeLabel(f),
        cells: [
          `+${GRADE_STEP} ${best.join("/")}, -${GRADE_STEP} ${worst.join("/")}`,
          rate(rSpec),
          rate(rAnti),
          clean ? "equal" : "UNEQUAL",
        ],
        verdict: real ? "ok" : "warn",
        note: real
          ? `blade rewards its intended top stats (${STAT_PRIORITY[f].notation})`
          : "specialist is indistinguishable from flat — the blade does not read its own priority",
      });
    }
    return [
      {
        title: "SHAPE — SPECIALIST vs FLAT",
        question:
          "Points MOVED, never added: the blade's top two stats up a grade, its bottom two down a grade, same total.",
        columns: ["blade", "build", "specialist win% ±95", "anti-specialist win% ±95", "totals"],
        rows,
        findings: [
          "Equal totals are load-bearing here: an unequal build trips the underdog gate and the case would be measuring station instead of shape.",
          "Specialist and anti-specialist should straddle 50% symmetrically. If both sit above it, the 'top' stats are just stronger everywhere and the blade isn't doing the work.",
        ],
      },
    ];
  },
};

// ── 5. STATION ──────────────────────────────────────────────────────────────

/**
 * Station under the SLOPE (rebuilt 2026-08-04). The old binary gate — this
 * case's own headline finding — is gone: the side with the smaller total now
 * claws back station/MAX × UNDERDOG_CLAWBACK of the gap's per-roll value on
 * every roll, smoothly from zero.
 *
 * The table walks the OLD cliff coordinates on purpose (159/160, 559/560 at
 * BASE 350) plus the extremes. Under the gate those rows jumped 16 points in
 * one stat point; under the slope adjacent rows must be statistically
 * indistinguishable. Keeping the old ladder makes this case the regression
 * test for the cliffs ever coming back.
 *
 * The second table is the payout curve when genuinely outmatched — the
 * mechanic's actual job — where more station must always buy more win rate,
 * and even 2000 station must stay short of flipping the favorite (the
 * clawback is capped below the gap, which is what makes breeding safe).
 */
const OLD_CLIFF_A = 159; // was: one point below closing your own gate
const OLD_CLIFF_B = 560; // was: the point that opened the OPPONENT's gate

const station: BalanceCase = {
  name: "station",
  question: "Station claws back a slice of the stat gap — is the slope smooth, and does it stay short of inverting?",
  run(o) {
    const bs = blades(o);
    const control = flat(BASE, { name: "Even" });

    // The old cliff coordinates, one point either side, plus extremes.
    const ladder = [
      STATS.MIN,
      OLD_CLIFF_A,
      OLD_CLIFF_A + 1,
      Math.round((OLD_CLIFF_A + OLD_CLIFF_B) / 2),
      OLD_CLIFF_B - 1,
      OLD_CLIFF_B,
      Math.round(OLD_CLIFF_B * 1.5),
      STATS.MAX,
    ];

    const parityRows: Row[] = ladder.map((s) => {
      const me = bump(BASE, "station", s, { name: "Stn" });
      const { A, B } = clawbackOf(me, control);
      // Raising station raises the OWN total, so the clawback here belongs to
      // the flat opponent — the row measures what over-buying station costs
      // now that there is no cliff: it should cost almost nothing.
      return {
        label: `station ${s}`,
        cells: [
          String(statTotal(me)),
          `${A > 0 ? "Stn" : B > 0 ? "Even" : "—"} +${(Math.max(A, B)).toFixed(2)}/roll`,
          ...bs.map((f) => rate(mirrored(me, control, runOpts(o, f)))),
        ],
      };
    });

    // The payout curve: genuinely outmatched (a flat bird one grade up), so
    // the clawback is live on every row and only station varies.
    const bigLevel = BASE + GRADE_STEP;
    const big = flat(bigLevel, { name: "Big" });
    const payRows: Row[] = ladder.map((s) => {
      const me = bump(BASE, "station", s, { name: "Small" });
      const claw = clawbackOf(me, big).A;
      return {
        label: `station ${s}`,
        cells: [
          `+${claw.toFixed(3)}/roll`,
          ...bs.map((f) => rate(mirrored(me, big, runOpts(o, f)))),
        ],
      };
    });

    return [
      {
        title: "STATION — THE OLD CLIFFS, REVISITED",
        question: `Station varied against an even ${BASE}-flat bird. The ladder sits on the old gate's cliff points (${OLD_CLIFF_A}/${OLD_CLIFF_A + 1} and ${OLD_CLIFF_B - 1}/${OLD_CLIFF_B}) — adjacent rows must now be statistically identical.`,
        columns: ["station", "own total", "clawback", ...bs.map(bladeLabel)],
        rows: parityRows,
        findings: [
          "Under the old gate these rows swung 16 points across one stat point, twice. If any adjacent pair separates by more than its combined CI, a cliff is back.",
          "Buying station past parity now costs only the opponent's tiny clawback on your surplus — more of a stat is never a mistake, which is the property the gate broke.",
        ],
      },
      {
        title: "STATION — THE PAYOUT WHEN OUTMATCHED",
        question: `The same ladder against a ${bigLevel}-flat bird (one full grade up), so the clawback is live on every row.`,
        columns: ["station", "clawback", ...bs.map(bladeLabel)],
        rows: payRows,
        findings: [
          `The clawback: station/${STATS.MAX} × ${BATTLE.UNDERDOG_CLAWBACK} × the per-roll value of the deficit (deficit/6/${BATTLE.ROLL_DIVISOR}), × form. Capped below the gap by construction — max station claws back half the lead, never all of it.`,
          "The curve must be monotone in station and the top row must still sit UNDER 50%: an underdog with maximum heart makes a real fight of it and remains the underdog. That is the whole ruling.",
        ],
      },
    ];
  },
};

// ── 6. CONDITION ────────────────────────────────────────────────────────────

/**
 * Condition raises the FLOOR of a per-turn form roll and never the ceiling
 * (fight-sim.ts:236) — every stat-derived term is multiplied by something in
 * [floor, 1]. So it can only ever scale a bird DOWNWARD, and a bird with more
 * of it is not stronger, it is less often weaker.
 *
 * That means the mean win rate is the wrong headline. Two things are measured
 * instead: whether a favourite CONVERTS more reliably as its condition rises
 * (a small mean lift), and what happens to the SHAPE of the outcome
 * distribution when both birds share a condition (mean pinned at 50% by
 * construction — everything interesting is in the endings and the spread).
 *
 * Station is zeroed on both sides throughout: raising condition raises the
 * total, which would otherwise open the gate and pay the wrong bird.
 */
const CONDITION_LADDER = [0, 0.25, 0.5, 0.75, 1].map((q) => Math.round(STATS.MAX * q));

const condition: BalanceCase = {
  name: "condition",
  question: "Does condition make a bird better, or just less variable?",
  run(o) {
    const bs = blades(o);
    const plain = shaped({ station: STATS.MIN }, { base: BASE, name: "Plain" });

    const meanRows: Row[] = CONDITION_LADDER.map((c) => {
      const fav = shaped(
        { station: STATS.MIN, condition: c },
        { base: BASE + GRADE_STEP, name: "Fav" }
      );
      return {
        label: `condition ${c}`,
        cells: bs.map((f) => {
          const r = mirrored(fav, plain, runOpts(o, f));
          return rate(r);
        }),
      };
    });

    // The shape table. Identical birds, so the win rate is 50% by construction
    // and carries no information at all — the content is how the fights RUN.
    const shapeRows: Row[] = CONDITION_LADDER.map((c) => {
      const a = shaped({ station: STATS.MIN, condition: c }, { base: BASE, name: "A" });
      const b = shaped({ station: STATS.MIN, condition: c }, { base: BASE, name: "B" });
      const per = bs.map((f) => duel(a, b, runOpts(o, f)));
      const avg = (pick: (r: DuelResult) => number) =>
        per.reduce((x, r) => x + pick(r), 0) / per.length;
      return {
        label: `condition ${c} (both birds)`,
        cells: [
          pct(avg((r) => r.meanTurns)),
          pct(avg((r) => r.endings.ran)),
          pct(avg((r) => r.endings.windOut)),
          pct(avg((r) => r.endings.bell)),
          pct(avg((r) => r.meanFigureA)),
          // Spread of the mean figure ACROSS blades is not the point; the
          // per-blade figure gap between the two birds is. Identical birds, so
          // any gap is pure variance leaking into the discovery signal.
          pct(avg((r) => Math.abs(r.meanFigureA - r.meanFigureB))),
        ],
      };
    });

    return [
      {
        title: "CONDITION — DOES IT BOOST?",
        question: `A favourite (+${GRADE_STEP} on every stat) with condition varied, against a flat ${BASE} bird. Station zeroed both sides so the gate stays shut.`,
        columns: ["condition", ...bs.map(bladeLabel)],
        rows: meanRows,
        findings: [
          `Form floor = ${BATTLE.WORST_FORM} + ${BATTLE.FORM_RANGE} × condition/${STATS.MAX}: at ${STATS.MAX} a bird never has an off-turn, at ${BASE} roughly a third of its book can go missing on any given turn.`,
          "Condition scales stat-derived terms downward only. A favourite gains from it; a bird with nothing to protect does not.",
        ],
      },
      {
        title: "CONDITION — WHAT IT ACTUALLY CHANGES",
        question:
          "Identical birds at each condition level (win rate is 50% by construction — read the distribution instead).",
        columns: [
          "condition",
          "mean turns",
          "end: ran%",
          "end: wind%",
          "end: bell%",
          "mean figure",
          "figure spread",
        ],
        rows: shapeRows,
        findings: [
          "The finding to look for is STABILISATION, not a boost: fights that run to the same place with less scatter, and a Pit Figure that means more because it fogged less.",
        ],
      },
    ];
  },
};

// ── 7 & 8. GRADE ────────────────────────────────────────────────────────────

/**
 * What a whole grade of bred stats buys — the progression curve itself, and
 * the number that decides whether breeding is worth doing.
 *
 * Reported naive AND station-neutralised, but for the opposite reason to the
 * stars case: here the gate firing is CORRECT. A graded bird is supposed to be
 * outmatching its opponent, and station is supposed to claw some of that back
 * — that is the mechanic's entire job. The naive column is therefore the
 * headline and the neutralised one is the diagnostic: the gap between them is
 * how much of the grade ladder station is currently flattening.
 */
function gradeCase(target: (typeof GRADE_TARGETS)[number], name: string): BalanceCase {
  return {
    name,
    question: `What is +${target.delta} on every stat worth? (intent: ~${target.winRate}%)`,
    run(o) {
      const rows: Row[] = [];
      for (const f of blades(o)) {
        const up = flat(BASE + target.delta, { name: "Graded" });
        const control = flat(BASE, { name: "Plain" });
        const r = mirrored(up, control, runOpts(o, f));
        const rn = mirrored(
          shaped({ station: STATS.MIN }, { base: BASE + target.delta, name: "Graded" }),
          shaped({ station: STATS.MIN }, { base: BASE, name: "Plain" }),
          runOpts(o, f)
        );
        const v = judgeTarget(r.winRate, target.winRate, r.ci95);
        rows.push({
          label: bladeLabel(f),
          cells: [
            rate(r),
            rate(rn),
            `${rn.winRate - r.winRate > 0 ? "+" : ""}${pct(rn.winRate - r.winRate)}`,
            `${target.winRate}%`,
          ],
          verdict: v.verdict,
          note: v.note,
        });
      }
      // The check that turned this case into round 25's headline: under the
      // old gate the graded bird LOST outright on all four blades. The slope
      // makes that structurally impossible (clawback < gap), so this filter
      // surviving as a permanent regression tripwire costs nothing.
      const inverted = rows.filter((r) => Number(r.cells[0].split(" ")[0]) < SYMMETRY_TARGET);
      return [
        {
          title: `GRADE +${target.delta} — ${target.delta / GRADE_STEP} STEP${target.delta / GRADE_STEP === 1 ? "" : "S"} OF BREEDING`,
          question: `+${target.delta} on all six stats against a flat ${BASE} bird. The station clawback is EXPECTED to be live here — that is the mechanic doing its job.`,
          columns: ["blade", "win% ±95", "station-neutral ±95", "station cost", "intent"],
          rows,
          findings: [
            "The 'station cost' column is how much of this grade step the clawback is giving back to the weaker bird — bounded by design at half the gap's value, at maximum station.",
            inverted.length
              ? `⚠ INVERSION on ${inverted.length}/${rows.length} blades: the graded bird LOSES. The clawback is supposed to make this impossible — if this fires, the cap is broken.`
              : "Graded birds win on every blade; station softens the ladder without reversing it.",
          ],
        },
      ];
    },
  };
}

const grade = gradeCase(GRADE_TARGETS[0], "grade");
const grade2 = gradeCase(GRADE_TARGETS[1], "grade2");

// ── 9. SENSITIVITY ──────────────────────────────────────────────────────────

/**
 * THE CENTREPIECE. Four blades × six stats: hold everything still, add one
 * grade step ×2 to exactly ONE stat, and measure what it buys.
 *
 * This is the matrix the per-blade design intent is actually a claim ABOUT,
 * and until now nothing in the repo could produce it. Every stat comment in
 * config describes a mechanism ("stamina's second job", "gameness's teeth")
 * and none of them says what the stat is WORTH at each distance.
 *
 * The underdog confound is checked, not assumed: +delta on one stat is +delta
 * on the total, which is a ratio of (6·BASE + delta)/(6·BASE). Whether that
 * clears BATTLE.UNDERDOG_RATIO depends on config, so the case computes it and
 * flags any row where the gate opened rather than quietly reporting a number
 * that is half station.
 */
const SENS_DELTA = GRADE_TARGETS[1].delta;

const sensitivity: BalanceCase = {
  name: "sensitivity",
  question: `Per blade, per stat: what does +${SENS_DELTA} on ONE stat buy?`,
  run(o) {
    const bs = blades(o);
    const control = flat(BASE, { name: "Flat" });

    const lifts = new Map<string, DuelResult>();
    for (const f of bs) {
      for (const s of STAT_NAMES) {
        lifts.set(
          `${f}:${s}`,
          mirrored(bump(BASE, s, BASE + SENS_DELTA, { name: "Bump" }), control, runOpts(o, f))
        );
      }
    }

    // The bumped bird's surplus hands the flat opponent a small clawback —
    // quantified here so the matrix's fine print can say exactly how much
    // station term each row contains instead of pretending it is zero.
    const probe = bump(BASE, STAT_NAMES[0], BASE + SENS_DELTA, { name: "Bump" });
    const oppClaw = clawbackOf(probe, control).B;

    const matrix: Row[] = STAT_NAMES.map((s) => ({
      label: s,
      cells: bs.map((f) => rate(lifts.get(`${f}:${s}`)!)),
    }));

    const rankRows: Row[] = bs.map((f) => {
      const measured: MeasuredLift[] = STAT_NAMES.map((s) => {
        const r = lifts.get(`${f}:${s}`)!;
        return { stat: s, lift: r.winRate - SYMMETRY_TARGET, ci95: r.ci95 };
      });
      const order = [...measured].sort((a, b) => b.lift - a.lift);
      const v = judgeRanking(f, measured);
      return {
        label: bladeLabel(f),
        cells: [
          order.map((m) => m.stat).join(" > "),
          STAT_PRIORITY[f].notation,
        ],
        verdict: v?.verdict,
        note: v?.note,
      };
    });

    return [
      {
        title: "SENSITIVITY — THE MATRIX",
        question: `Win rate of a bird with +${SENS_DELTA} on ONE stat against a flat ${BASE} bird. 50% means the stat did nothing at that distance.`,
        columns: ["stat", ...bs.map(bladeLabel)],
        rows: matrix,
        findings: [
          `The clawback contamination in every row: the flat opponent claws back ${oppClaw.toFixed(3)}/roll off the bump's surplus (vs the bump's own ${(SENS_DELTA / BATTLE.ROLL_DIVISOR).toFixed(2)}/roll when its stat drives). Small and IDENTICAL across rows, so the ranking is clean even though the levels carry a hair of station.`,
          `A row at 50% ±ci across all blades is a stat a player can ignore — the violation of: ${EVERY_STAT_EVERYWHERE}`,
        ],
      },
      {
        title: "SENSITIVITY — MEASURED vs INTENDED RANKING",
        question: "Stats ordered by the lift they actually bought, next to what the blade was designed to reward.",
        columns: ["blade", "measured (all six, by lift)", "intended"],
        rows: rankRows,
        findings: [
          "The intended ranking covers the four phase/fuel stats only — station and condition are behavioural anchors and are deliberately unranked, so they are expected to appear anywhere in the measured order.",
          "These are targets to MEASURE against, not to tune to: more blade lengths are coming and fitting four points to this curve now would be premature.",
        ],
      },
    ];
  },
};

// ── 10. WEATHER ─────────────────────────────────────────────────────────────

/**
 * The day's ascendant element. Boost-only, flat, and stacking on the
 * head-to-head wheel edge — which is exactly the combination that made it the
 * single most decisive term in the fight when it shipped at +1.
 *
 * Four scenarios, each with its no-weather control run beside it so the
 * weather's contribution is a subtraction rather than a memory:
 *   alone     — weather-matched bird vs a neutral element
 *   stacked   — weather-matched bird that ALSO beats its opponent on the wheel
 *   mirrored  — both birds match the weather; must cancel EXACTLY, because
 *               damage is the roll MARGIN and the same bonus on both sides
 *               drops out. Anything other than an identical result is a bug.
 *   figure    — the Pit Figure inflation, which is the quiet one: a weather
 *               edge that leaks into the figure relabels the BIRD, and no form
 *               line can show a reader that the day did it.
 */
const weather: BalanceCase = {
  name: "weather",
  question: "What does the day's element buy — alone, stacked, and in the Pit Figure?",
  run(o) {
    const bs = blades(o);
    // Full stars on both sides: since the 2026-08-04 rework the day only
    // speaks as loudly as a bird's stars, so this measures the weather at
    // its ceiling. A 0★ bird's weather day is a no-op by construction (the
    // stars case owns that invariant).
    const A = (e: Element) => flat(BASE, { name: "A", element: e, halfStars: STARS.MAX_HALF_STARS });
    const B = (e: Element) => flat(BASE, { name: "B", element: e, halfStars: STARS.MAX_HALF_STARS });

    const scenarios = [
      { key: "alone", label: `${ATTACKER} vs ${NEUTRAL}, ${ATTACKER} day`, a: ATTACKER, b: NEUTRAL, wx: ATTACKER },
      { key: "alone-ctl", label: `${ATTACKER} vs ${NEUTRAL}, no weather`, a: ATTACKER, b: NEUTRAL, wx: undefined },
      { key: "stacked", label: `${ATTACKER} vs ${PREY}, ${ATTACKER} day`, a: ATTACKER, b: PREY, wx: ATTACKER },
      { key: "rps", label: `${ATTACKER} vs ${PREY}, no weather`, a: ATTACKER, b: PREY, wx: undefined },
      { key: "both", label: `${ATTACKER} vs ${ATTACKER}, ${ATTACKER} day`, a: ATTACKER, b: ATTACKER, wx: ATTACKER },
      { key: "both-ctl", label: `${ATTACKER} vs ${ATTACKER}, no weather`, a: ATTACKER, b: ATTACKER, wx: undefined },
    ] as const;

    const got = new Map<string, DuelResult>();
    for (const s of scenarios) {
      for (const f of bs) {
        got.set(`${s.key}:${f}`, mirrored(A(s.a), B(s.b), runOpts(o, f, s.wx)));
      }
    }

    const rows: Row[] = scenarios.map((s) => ({
      label: s.label,
      cells: bs.map((f) => rate(got.get(`${s.key}:${f}`)!)),
    }));

    // The exact-cancellation check. Not "close enough" — identical.
    const cancels = bs.every(
      (f) => got.get(`both:${f}`)!.winRate === got.get(`both-ctl:${f}`)!.winRate
    );
    rows.push({
      label: "both matched — cancellation",
      cells: bs.map((f) =>
        got.get(`both:${f}`)!.winRate === got.get(`both-ctl:${f}`)!.winRate ? "exact" : "DIFFERS"
      ),
      verdict: cancels ? "ok" : "warn",
      note: cancels
        ? "identical to the no-weather run, bit for bit — the bonus drops out of the roll margin"
        : "a shared weather bonus changed the fight; it should be algebraically impossible",
    });

    const figureRows: Row[] = bs.map((f) => {
      const wx = got.get(`alone:${f}`)!;
      const dry = got.get(`alone-ctl:${f}`)!;
      const stackWx = got.get(`stacked:${f}`)!;
      const stackDry = got.get(`rps:${f}`)!;
      return {
        label: bladeLabel(f),
        cells: [
          pct(dry.meanFigureA),
          pct(wx.meanFigureA),
          `${wx.meanFigureA - dry.meanFigureA > 0 ? "+" : ""}${pct(wx.meanFigureA - dry.meanFigureA)}`,
          `${pct(wx.winRate - dry.winRate)}`,
          `${pct(stackWx.winRate - stackDry.winRate)}`,
        ],
      };
    });

    return [
      {
        title: "WEATHER — THE ASCENDANT ELEMENT",
        question: `Each weather scenario with its no-weather control beside it. The edge stacks on the wheel; ${ATTACKER} overcomes ${PREY} and ${NEUTRAL} is neutral to both.`,
        columns: ["scenario", ...bs.map(bladeLabel)],
        rows,
      },
      {
        title: "WEATHER — PIT FIGURE INFLATION",
        question:
          "What the day does to the DISCOVERY signal. A figure that moves with the weather is a bird being mis-labelled.",
        columns: [
          "blade",
          "figure (no wx)",
          "figure (wx)",
          "inflation",
          "win% added, alone",
          "win% added, stacked",
        ],
        rows: figureRows,
        findings: [
          "Inflation is only harmless while it stays inside the fog already there (±FIGURE.NOISE). Beyond that the day leaks into the bird's form line permanently.",
          "Weather adds LESS when stacked on the wheel edge than it does alone — both edges push into the same saturating win-rate curve.",
        ],
      },
    ];
  },
};

// ── 11. REACH ───────────────────────────────────────────────────────────────

/**
 * The structural case, and mostly ARITHMETIC rather than simulation.
 *
 * Turn phases are ABSOLUTE windows (PHASES: turns 1..BREAK drive on agility,
 * BREAK+1..OPEN on sight, OPEN+1.. on gameness) while every blade sets its own
 * turn ceiling. Those two facts were written independently and their product
 * was never checked: a blade whose ceiling sits below a phase's first turn can
 * NEVER read that phase's stat, at any stat value, for any bird. No divisor
 * can be tuned to fix that.
 *
 * So this case computes, per blade: which stats can drive a turn at all, how
 * many turns each one gets, and — from a real turn-length distribution, since
 * a fight can stop long before the ceiling — how often fights actually get
 * there. Every window is read from PHASES and FORMATS; nothing is typed.
 */

/**
 * The ladder as fight-sim.ts:127 applies it. The mapping from a turn to a
 * driving stat lives in the engine rather than in config, so it is restated
 * here — the only restatement in this module, and the reason it is acceptable
 * is that the BOUNDARIES all come from PHASES. If a phase is added, this
 * breaks visibly rather than silently reporting three phases forever.
 */
const PHASE_LADDER = [
  { stat: "agility" as StatName, from: 1, through: PHASES.BREAK_THROUGH_TURN },
  { stat: "sight" as StatName, from: PHASES.BREAK_THROUGH_TURN + 1, through: PHASES.OPEN_THROUGH_TURN },
  { stat: "gameness" as StatName, from: PHASES.OPEN_THROUGH_TURN + 1, through: Infinity },
];

/**
 * Turn-length histogram for a blade.
 *
 * `duel` reports a MEAN turn count, and a mean cannot answer "how often does a
 * fight reach turn 11" — a 30-turn blade averaging 9 turns might reach the
 * deep phase in half its fights or in none of them. So this walks the same
 * seed window `duel` uses and keeps the distribution instead of collapsing it.
 * Local rather than in lab.ts because reach is the only question that has ever
 * needed it; if a second case wants it, it should move.
 */
function turnLengths(a: Combatant, b: Combatant, f: FightFormat, o: CaseOptions): number[] {
  const out: number[] = [];
  for (let seed = o.seedFrom; seed < o.seedFrom + o.runs; seed++) {
    const sim = simulatePair(a, b, f, mulberry32(seed), "LAB");
    out.push(Math.max(0, ...[...sim.playByPlay.matchAll(/^T(\d+) /gm)].map((m) => Number(m[1]))));
  }
  return out;
}

const reach: BalanceCase = {
  name: "reach",
  question: "Which stats can a blade physically reach, and how often do fights get there?",
  run(o) {
    const bs = blades(o);
    const lengths = new Map<FightFormat, number[]>(
      bs.map((f) => [
        f,
        turnLengths(flat(BASE, { name: "A" }), flat(BASE, { name: "B" }), f, o),
      ])
    );

    const rows: Row[] = [];
    for (const f of bs) {
      const max = FORMATS[f].maxTurns;
      const obs = lengths.get(f)!;
      for (const p of PHASE_LADDER) {
        const last = Math.min(p.through, max);
        const available = Math.max(0, last - p.from + 1);
        const reached = obs.filter((t) => t >= p.from).length / obs.length;
        const window = available === 0 ? "unreachable" : `T${p.from}–T${last}`;
        rows.push({
          label: `${bladeLabel(f)} · ${p.stat}`,
          cells: [
            String(max),
            window,
            String(available),
            pct((available / max) * 100),
            pct(reached * 100),
          ],
          // A phase the blade cannot reach is the concrete violation of the
          // one rule that spans all blades, so it is called out as a warn even
          // though nothing is "broken" — the engine is behaving as written.
          verdict: available === 0 ? "warn" : reached === 0 ? "warn" : "ok",
          note:
            available === 0
              ? `${p.stat} can never drive a turn at this blade — the phase starts after the last turn`
              : reached === 0
                ? `${p.stat}'s phase exists but no fight in the sample lasted that long`
                : undefined,
        });
      }
    }

    const driving = new Set(PHASE_LADDER.map((p) => p.stat));
    const nonDriving = STAT_NAMES.filter((s) => !driving.has(s));

    const pathRows: Row[] = nonDriving.map((s) => ({
      label: s,
      cells: [
        "never",
        s === "stamina"
          ? `the wind pool (${BATTLE.BASE_WIND} + stamina × ${BATTLE.WIND_PER_STAMINA}) and decay resistance`
          : s === "station"
            ? `claws back up to ${BATTLE.UNDERDOG_CLAWBACK} of the stat gap's roll value when outmatched`
            : `the per-turn form multiplier on every other stat`,
      ],
    }));

    return [
      {
        title: "REACH — PHASE WINDOWS vs BLADE LENGTH",
        question:
          "Phases are absolute turn windows; blades set their own ceilings. This is the intersection, and how often fights actually get there.",
        columns: ["blade · phase stat", "max turns", "window", "turns available", "% of ceiling", "% of fights reaching"],
        rows,
        findings: [
          `Phase windows: agility T1–T${PHASES.BREAK_THROUGH_TURN}, sight T${PHASES.BREAK_THROUGH_TURN + 1}–T${PHASES.OPEN_THROUGH_TURN}, gameness T${PHASES.OPEN_THROUGH_TURN + 1}+. Blade ceilings: ${FORMAT_NAMES.map((f) => `${FORMATS[f].label} ${FORMATS[f].maxTurns}`).join(", ")}.`,
          "'Turns available' is the structural ceiling; '% of fights reaching' is the practical one. A blade can have a phase on paper and never visit it.",
          EVERY_STAT_EVERYWHERE,
        ],
      },
      {
        title: "REACH — THE STATS NO PHASE EVER DRIVES",
        question: "Three of the six stats never drive a turn in ANY format. How does each one reach a fight instead?",
        columns: ["stat", "drives a turn?", "route into the fight"],
        rows: pathRows,
        findings: [
          "STAMINA is the one worth staring at: the per-blade intent ranks it explicitly (2nd or 3rd on every blade) yet it is never a phase stat in any format. It reaches a fight only through the wind pool and decay resistance — indirectly, on a blade-length-dependent curve nobody has measured until this lab.",
        ],
      },
    ];
  },
};

// ── 12. FUEL — stamina's two routes, separated ──────────────────────────────

/**
 * Stamina never drives a turn (see `reach`), so its entire measured lift
 * arrives through two side doors: the wind pool (BASE_WIND + stamina ×
 * WIND_PER_STAMINA — more HP) and decay resistance (physical stats fade
 * slower as wind burns). Nobody has ever known the split, and the split
 * matters: the intent ranks stamina 2nd or 3rd on every blade, so when the
 * phase weights get reworked, whoever does it needs to know how much of
 * stamina's value is already there and WHICH DOOR it comes through — a knob
 * turned on the wrong door doubles one route while leaving the deficit alone.
 *
 * Method: kill one route at a time with `withKnob` and re-measure the same
 * +SENS_DELTA stamina duel. DECAY_PER_TURN=0 removes decay entirely, so the
 * resistance route has nothing to resist — what remains is the pool route.
 * WIND_PER_STAMINA=0 equalises the pools — what remains is the decay route.
 * The two parts need not sum to the whole; the residual is the interaction,
 * and reporting it is honester than hiding it in either column.
 */
const fuel: BalanceCase = {
  name: "fuel",
  question: "Stamina never drives a turn — which of its two routes carries its value?",
  run(o) {
    const control = flat(BASE, { name: "Flat" });
    const rows: Row[] = blades(o).map((f) => {
      // +SENS_DELTA on one stat is a 1.095x total — under the 1.1x gate, so
      // these are clean stamina measurements, same as the sensitivity case.
      const bumped = bump(BASE, "stamina", BASE + SENS_DELTA, { name: "Stam" });
      const measure = () => mirrored(bumped, control, runOpts(o, f));

      const whole = measure();
      const poolOnly = withKnob("BATTLE.DECAY_PER_TURN", 0, measure);
      const decayOnly = withKnob("BATTLE.WIND_PER_STAMINA", 0, measure);

      const lift = (r: DuelResult) => r.winRate - 50;
      const residual = lift(whole) - (lift(poolOnly) + lift(decayOnly));
      return {
        label: bladeLabel(f),
        cells: [
          rate(whole),
          `+${pct(lift(poolOnly))}`,
          `+${pct(lift(decayOnly))}`,
          `${residual >= 0 ? "+" : ""}${pct(residual)}`,
        ],
      };
    });

    return [
      {
        title: "FUEL — WHERE STAMINA'S LIFT COMES FROM",
        question: `+${SENS_DELTA} stamina vs a flat ${BASE} bird, then the same duel with one route disabled at a time. Lifts are win-rate points over 50.`,
        columns: ["blade", "win% ±95 (both routes)", "wind pool alone", "decay resistance alone", "interaction"],
        rows,
        findings: [
          `The pool route: maxWind = ${BATTLE.BASE_WIND} + stamina × ${BATTLE.WIND_PER_STAMINA}, so +${SENS_DELTA} stamina is +${SENS_DELTA * BATTLE.WIND_PER_STAMINA} wind — a fixed head start whose value the table shows growing with blade length, because long fights give the deeper pool more turns to matter.`,
          "The decay route: physical stats fade by DECAY_PER_TURN × (1 − stamina/2000) per turn, so it can only matter in fights that go long — the opposite blade-length curve from the pool.",
          "If either column reads ~0 on every blade, that route is decorative and the phase-weight rework can ignore it.",
        ],
      },
    ];
  },
};

// ── 13. CRIT — how much of a blade is the Tari Strike ───────────────────────

/**
 * Doubles on the 2d6 multiply the turn's damage by the blade's critMult, and
 * the config sells this as each blade's identity: "Knife formats are SWINGY
 * (big crits — upsets happen); gaff formats are true tests (crits barely
 * matter)." That sentence has never had a number attached. Two measurements
 * put one on it:
 *
 *  1. THE CRIT TAX — a real favourite's win rate with crits as shipped vs
 *     critMult forced to 1. The difference is what the mechanic charges the
 *     better bird for the upset drama.
 *  2. OUTCOME FLIPS — identical birds, same seeds, crits on vs off, counted
 *     fight by fight. Averages can agree while individual fights swap
 *     winners; this is the fraction of fights where the crit WAS the fight.
 */
const crit: BalanceCase = {
  name: "crit",
  question: "What does the Tari Strike (doubles × critMult) actually decide, per blade?",
  run(o) {
    const fav = shaped({ station: STATS.MIN }, { base: BASE + GRADE_STEP, name: "Fav" });
    const flatBird = shaped({ station: STATS.MIN }, { base: BASE, name: "Flat" });

    const rows: Row[] = blades(o).map((f) => {
      const knob = `FORMATS.${f}.critMult`;
      const shipped = mirrored(fav, flatBird, runOpts(o, f));
      const disarmed = withKnob(knob, 1, () => mirrored(fav, flatBird, runOpts(o, f)));

      // Same seeds, winner recorded under each setting, compared per fight.
      // Identical birds, so every flip is pure crit — no favourite to mask it.
      const a = flat(BASE, { name: "A" });
      const b = flat(BASE, { name: "B" });
      const winners = (mult?: number): number[] => {
        const play = () => {
          const out: number[] = [];
          for (let seed = o.seedFrom; seed < o.seedFrom + o.runs; seed++) {
            out.push(simulatePair(a, b, f, mulberry32(seed), "LAB").winner);
          }
          return out;
        };
        return mult === undefined ? play() : withKnob(knob, mult, play);
      };
      const on = winners();
      const off = winners(1);
      const flips = on.filter((w, i) => w !== off[i]).length;

      return {
        label: bladeLabel(f),
        cells: [
          FORMATS[f].critMult.toFixed(1),
          rate(shipped),
          rate(disarmed),
          pct(disarmed.winRate - shipped.winRate),
          pct((flips / o.runs) * 100),
        ],
      };
    });

    return [
      {
        title: "CRIT — THE TARI STRIKE'S SHARE OF THE FIGHT",
        question: `Crit tax: a +${GRADE_STEP}-per-stat favourite (station shut) with crits as shipped vs critMult forced to 1. Flips: identical birds, same seeds, how often the winner changes when crits are removed.`,
        columns: ["blade", "critMult", "fav win% ±95, crits on", "crits off", "crit tax on the favourite", "outcome flips %"],
        rows,
        findings: [
          "Doubles odds are structural: 1-in-6 per roll per side, so ~30.6% of turns contain at least one crit — the multiplier, not the frequency, is what varies by blade.",
          "The config's claim on trial here: knives are meant to be SWINGY (upsets happen) and gaffs true tests (crits barely matter). The flip column is that sentence as a number.",
          "A flip is symmetric between equal birds — it does not favour anyone. The TAX column is where swinginess becomes a price, and the favourite is the one who pays it.",
        ],
      },
    ];
  },
};

// ── 14. FIGURE — does the discovery signal track the bird ───────────────────

/**
 * The whole game loop is discovery: stats are fixed at birth and hidden, and
 * the Pit Figure is the player's instrument for reading them. The weather and
 * condition cases already showed the figure moving when the BIRD didn't
 * (inflation). This case asks the opposite and more fundamental question:
 * when the bird IS better, does the figure say so — and by more than the fog
 * (±FIGURE.NOISE) it is wrapped in?
 *
 * Station is zeroed on both sides. The gate still opens at the bigger gaps —
 * unavoidable, the gap IS the total — but with station at 0 it opens onto
 * nothing, so the figures stay a clean read of the stat difference.
 */
const figure: BalanceCase = {
  name: "figure",
  question: "When a bird is genuinely better, does the Pit Figure move enough to see through its own fog?",
  run(o) {
    const gaps = [0, 50, GRADE_TARGETS[0].delta, GRADE_TARGETS[1].delta, GRADE_TARGETS[1].delta * 2];
    const control = shaped({ station: STATS.MIN }, { base: BASE, name: "Plain" });

    const rows: Row[] = gaps.map((gap) => {
      const better = shaped({ station: STATS.MIN }, { base: BASE + gap, name: "Grade" });
      const cells: string[] = [];
      let minGap = Infinity;
      for (const f of blades(o)) {
        const r = mirrored(better, control, runOpts(o, f));
        const dFig = r.meanFigureA - r.meanFigureB;
        minGap = Math.min(minGap, dFig);
        cells.push(`${dFig >= 0 ? "+" : ""}${dFig.toFixed(1)}`);
      }
      // gap 0 is the control: identical birds must read as identical. The
      // others get judged against the fog — a step the figure cannot lift
      // above ±NOISE is a step the player cannot see.
      const verdict: Row["verdict"] =
        gap === 0 ? (Math.abs(minGap) < 1 ? "ok" : "warn") : minGap < FIGURE.NOISE ? "warn" : "ok";
      return {
        label: gap === 0 ? "identical (control)" : `+${gap} every stat`,
        cells,
        verdict,
        note:
          gap === 0
            ? verdict === "ok"
              ? "identical birds post identical figures"
              : "identical birds are NOT posting identical figures — the instrument is broken"
            : verdict === "warn"
              ? `figure gap is under the ±${FIGURE.NOISE} fog on at least one blade — this much bird is invisible in the number`
              : undefined,
      };
    });

    return [
      {
        title: "FIGURE — DOES THE SIGNAL TRACK THE BIRD?",
        question: `Mean figure gap (better bird − plain ${BASE} bird) per blade, as the real stat gap grows. Fog is ±${FIGURE.NOISE}; a band is ${FIGURE.BAND}.`,
        columns: ["true stat gap", ...blades(o).map(bladeLabel)],
        rows,
        findings: [
          `The figure's fog is ±${FIGURE.NOISE} per reading and the public bands are ${FIGURE.BAND} wide — a gap under the fog needs repeat fights to detect, which is the discovery loop working as designed. A gap still under the fog at +${GRADE_TARGETS[0].delta} — a FULL breeding step — is a different matter: it means a generation of progress does not show in the number.`,
          "Read this against the weather and condition inflation tables: those measured the figure moving with NO bird difference. Signal (here) has to clear noise (there) or the number teaches nothing.",
        ],
      },
    ];
  },
};

// ── The catalogue ───────────────────────────────────────────────────────────

export const CASES: BalanceCase[] = [
  symmetry,
  elements,
  stars,
  shape,
  station,
  condition,
  grade,
  grade2,
  sensitivity,
  fuel,
  weather,
  crit,
  figure,
  reach,
];

export function caseByName(name: string): BalanceCase | undefined {
  return CASES.find((c) => c.name === name.toLowerCase());
}
