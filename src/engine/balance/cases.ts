/**
 * THE CASE CATALOGUE — one measurement per question.
 *
 * `lab.ts` gives you fights; this gives you the ELEVEN QUESTIONS worth asking
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
  duel,
  flat,
  mirrored,
  shaped,
  statTotal,
  underdogOf,
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
    const rows: Row[] = ELEMENTS.map((opponent) => {
      const cells = bs.map((f) => {
        const r = mirrored(
          flat(BASE, { name: "A", element: ATTACKER }),
          flat(BASE, { name: "B", element: opponent }),
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
        title: "ELEMENTS — THE WHEEL",
        question: `${ATTACKER} against all five elements. ${ATTACKER} overcomes ${PREY}; ${ELEMENTS.find((e) => ELEMENT_BEATS[e] === ATTACKER)} overcomes ${ATTACKER}.`,
        columns: ["matchup", "relation", ...bs.map(bladeLabel)],
        rows,
        findings: [
          // ELEMENT_EDGE is flat, but the blades are not: a flat bonus is worth
          // more where fewer turns decide the fight, because there are fewer
          // chances for the dice to average it away.
          "A flat roll bonus is not worth the same at every distance — fewer turns means fewer chances for the dice to average it out.",
          "Mirror and neutral rows are a second read on symmetry: they should sit at the control's 50%.",
        ],
      },
    ];
  },
};

// ── 3. STARS ────────────────────────────────────────────────────────────────

/**
 * THE CONFOUNDED CASE, and the reason the lab exists at all.
 *
 * Stars boost every stat (fight-sim.ts:56), and the underdog gate reads the
 * BOOSTED totals (fight-sim.ts:89-92, despite its comment saying "base"). So a
 * starred bird crosses BATTLE.UNDERDOG_RATIO against its plain opponent and
 * hands that opponent a station bonus — the naive measurement is
 * "stars, MINUS the station they trigger in the other bird", and station is
 * worth more per point than stars are.
 *
 * Both columns are run and printed side by side. The controlled column zeroes
 * STATION on both birds: the gate still opens, but the bonus it opens is worth
 * nothing, so stars are measured alone. The GAP between the columns is the
 * finding — it is the size of the correction the naive number needed, and
 * nobody had ever measured it.
 */
const stars: BalanceCase = {
  name: "stars",
  question: "What is a star worth — and how much of that is really the underdog gate firing?",
  run(o) {
    const bs = blades(o);
    const steps = Array.from({ length: STARS.MAX_HALF_STARS }, (_, i) => i + 1);

    // Measured once, read by three tables.
    const naive = new Map<string, DuelResult>();
    const ctrl = new Map<string, DuelResult>();
    for (const h of steps) {
      for (const f of bs) {
        naive.set(
          `${h}:${f}`,
          mirrored(
            flat(BASE, { name: "Star", halfStars: h }),
            flat(BASE, { name: "Plain" }),
            runOpts(o, f)
          )
        );
        ctrl.set(
          `${h}:${f}`,
          mirrored(
            shaped({ station: STATS.MIN }, { base: BASE, name: "Star", halfStars: h }),
            shaped({ station: STATS.MIN }, { base: BASE, name: "Plain" }),
            runOpts(o, f)
          )
        );
      }
    }

    const starOf = (h: number) => flat(BASE, { halfStars: h });
    const plain = flat(BASE, { name: "Plain" });
    const gateOpen = (h: number) => underdogOf(starOf(h), plain) !== "neither";

    const naiveRows: Row[] = steps.map((h) => ({
      label: `${h / 2}★ vs 0★`,
      cells: [gateOpen(h) ? "GATE OPEN" : "—", ...bs.map((f) => rate(naive.get(`${h}:${f}`)!))],
    }));

    const ctrlRows: Row[] = steps.map((h) => ({
      label: `${h / 2}★ vs 0★`,
      cells: [...bs.map((f) => rate(ctrl.get(`${h}:${f}`)!))],
    }));

    const gapRows: Row[] = steps.map((h) => {
      const gaps = bs.map((f) => {
        const n = naive.get(`${h}:${f}`)!;
        const c = ctrl.get(`${h}:${f}`)!;
        return { d: c.winRate - n.winRate, ci: Math.hypot(n.ci95, c.ci95) };
      });
      const real = gaps.some((g) => Math.abs(g.d) > g.ci);
      return {
        label: `${h / 2}★ vs 0★`,
        cells: [
          gateOpen(h) ? "GATE OPEN" : "—",
          ...gaps.map((g) => `${g.d > 0 ? "+" : ""}${pct(g.d)}`),
        ],
        // A verdict here is about MEASUREMENT INTEGRITY, not about design: the
        // star mechanic has no numeric target to judge against (see STAR_INTENT).
        verdict: real ? "warn" : "ok",
        note: real
          ? "naive number is understating stars — station is absorbing the difference"
          : "no measurable confound at this star level",
      };
    });

    return [
      {
        title: "STARS — NAIVE (as the engine plays them)",
        question: "Star bird's win rate against an identical 0★ bird, nothing controlled for.",
        columns: ["stars", "underdog gate", ...bs.map(bladeLabel)],
        rows: naiveRows,
      },
      {
        title: "STARS — STATION NEUTRALISED",
        question: `Same fights with station at ${STATS.MIN} on both birds: the gate still opens, but what it opens is worth nothing.`,
        columns: ["stars", ...bs.map(bladeLabel)],
        rows: ctrlRows,
      },
      {
        title: "STARS — THE CONFOUND",
        question: "Controlled minus naive, in win-rate points. This gap is what the gate was taking back.",
        columns: ["stars", "underdog gate", ...bs.map(bladeLabel)],
        rows: gapRows,
        findings: [
          `Gate maths: a 0★ bird totals ${statTotal(plain)}; each full star adds ${6 * STARS.BOOST_PER_FULL_STAR} to the boosted total the gate compares, and the gate opens at ${BATTLE.UNDERDOG_RATIO}x.`,
          `INTENT: ${STAR_INTENT.intended}`,
          `SHIPPED: ${STAR_INTENT.shipped}`,
          `STATUS: ${STAR_INTENT.status} — these rows measure the mechanic we have, as the before-picture.`,
        ],
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
 * The stat nothing has ever measured — and the only one in the game that can
 * be worth LESS THAN NOTHING.
 *
 * Station only joins a roll when its owner is the underdog: opponent's total
 * >= yours × BATTLE.UNDERDOG_RATIO. At parity it is unread. But it still
 * COUNTS toward the total the gate compares, so pouring points into station
 * pushes you AWAY from being the underdog — and then past the line in the
 * other direction, where it hands your opponent their station instead.
 *
 * The flip point is exact and computed, not guessed: with five stats at BASE
 * and station at s, the opponent (six stats at BASE) becomes the underdog when
 * 5·BASE + s >= 6·BASE · RATIO. Rows sit either side of it by one point.
 */
const FLIP_STATION = 6 * BASE * BATTLE.UNDERDOG_RATIO - 5 * BASE;
/**
 * …and the SECOND cliff, which is the one nobody expects. Below this station
 * value YOU are the underdog (the opponent's flat total clears your reduced
 * one), so your station is live. Buy one point past it and you have closed
 * your own gate: the stat switches itself off by making you too good.
 */
const SELF_CLOSE_STATION = (6 * BASE) / BATTLE.UNDERDOG_RATIO - 5 * BASE;

const station: BalanceCase = {
  name: "station",
  question: "Station is gated on being outmatched — so what is it worth, and where is the cliff?",
  run(o) {
    const bs = blades(o);
    const control = flat(BASE, { name: "Even" });

    // Either side of the line, plus the extremes. Ordered, deduped, integral.
    const ladder = [
      STATS.MIN,
      Math.floor(SELF_CLOSE_STATION),
      Math.floor(SELF_CLOSE_STATION) + 1,
      Math.round(FLIP_STATION / 2),
      Math.ceil(FLIP_STATION) - 1,
      Math.ceil(FLIP_STATION),
      Math.round(FLIP_STATION * 1.5),
      STATS.MAX,
    ];

    const cliffRows: Row[] = ladder.map((s) => {
      const me = bump(BASE, "station", s, { name: "Stn" });
      const who = underdogOf(me, control);
      return {
        label: `station ${s}`,
        cells: [
          String(statTotal(me)),
          who === "neither" ? "closed" : `open (${who === "A" ? "Stn" : "Even"})`,
          ...bs.map((f) => rate(mirrored(me, control, runOpts(o, f)))),
        ],
      };
    });

    // Once the gate IS open, what does the stat actually pay? The opponent is
    // built big enough that the gate stays open across the whole ladder —
    // otherwise the row that finally closes it would read as station failing.
    const bigLevel = Math.ceil(((5 * BASE + STATS.MAX) * BATTLE.UNDERDOG_RATIO) / 6) + 1;
    const big = flat(bigLevel, { name: "Big" });
    const payRows: Row[] = ladder.map((s) => {
      const me = bump(BASE, "station", s, { name: "Small" });
      const open = underdogOf(me, big) === "A";
      return {
        label: `station ${s}`,
        cells: [open ? "open" : "CLOSED", ...bs.map((f) => rate(mirrored(me, big, runOpts(o, f))))],
        verdict: open ? undefined : "warn",
        note: open ? undefined : "gate closed on this row — not a station measurement",
      };
    });

    return [
      {
        title: "STATION — THE CLIFF",
        question: `Station varied against an even ${BASE}-flat bird. Your own gate CLOSES above station ${Math.floor(SELF_CLOSE_STATION)}; the opponent's OPENS at ${Math.ceil(FLIP_STATION)}.`,
        columns: ["station", "own total", "gate", ...bs.map(bladeLabel)],
        rows: cliffRows,
        findings: [
          `Two cliffs, not one. Up to station ${Math.floor(SELF_CLOSE_STATION)} the low total keeps YOU the underdog and the stat is live; one point past that you have switched your own stat off by getting too good.`,
          `Between there and ${Math.ceil(FLIP_STATION)} station is an UNREAD stat: flat at 50% no matter how many points sit in it.`,
          `Past ${Math.ceil(FLIP_STATION)} it is worse than unread — the extra total makes the OPPONENT the underdog, and they collect their station on every roll.`,
        ],
      },
      {
        title: "STATION — WHAT IT PAYS WHEN THE GATE IS OPEN",
        question: `The same ladder against a ${bigLevel}-flat bird, chosen so the gate stays open on every row.`,
        columns: ["station", "gate", ...bs.map(bladeLabel)],
        rows: payRows,
        findings: [
          `Station joins the roll as station × form / ${BATTLE.STATION_DIVISOR} — the same divisor as the phase stats, so at the gate it is a full second stat, not a nudge.`,
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
      // The check that turns this from a table into a finding: if the graded
      // bird is losing OUTRIGHT, station is not clawing back part of a grade,
      // it is reversing it — and breeding, the game's whole progression, is a
      // net negative against an opponent carrying ordinary station.
      const inverted = rows.filter((r) => Number(r.cells[0].split(" ")[0]) < SYMMETRY_TARGET);
      return [
        {
          title: `GRADE +${target.delta} — ${target.delta / GRADE_STEP} STEP${target.delta / GRADE_STEP === 1 ? "" : "S"} OF BREEDING`,
          question: `+${target.delta} on all six stats against a flat ${BASE} bird. Underdog gate is EXPECTED to fire here — that is station doing its job.`,
          columns: ["blade", "win% ±95", "station-neutral ±95", "station cost", "intent"],
          rows,
          findings: [
            "The 'station cost' column is how much of this grade step the underdog mechanic is currently giving back to the weaker bird.",
            inverted.length
              ? `⚠ INVERSION on ${inverted.length}/${rows.length} blades: the graded bird LOSES. Station is not softening the grade ladder, it is reversing it — a ${target.delta}-point stat lead is worth ${target.delta / BATTLE.ROLL_DIVISOR} on a roll, while the opponent's ${BASE} station pays about ${(BASE / BATTLE.STATION_DIVISOR).toFixed(2)} × form on every roll of the fight.`
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

    const probe = bump(BASE, STAT_NAMES[0], BASE + SENS_DELTA, { name: "Bump" });
    const gate = underdogOf(probe, control);
    const ratio = statTotal(probe) / statTotal(control);

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
          gate === "neither"
            ? `Underdog gate stayed SHUT for every row: +${SENS_DELTA} on one stat is a ${ratio.toFixed(3)}x total, under the ${BATTLE.UNDERDOG_RATIO}x threshold. These are clean single-stat measurements.`
            : `⚠ Underdog gate OPENED (${ratio.toFixed(3)}x >= ${BATTLE.UNDERDOG_RATIO}x): every row in this matrix also contains a station term. Reduce the delta or zero station before quoting these.`,
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
    const A = (e: Element) => flat(BASE, { name: "A", element: e });
    const B = (e: Element) => flat(BASE, { name: "B", element: e });

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
            ? `only when the underdog gate is open (${BATTLE.UNDERDOG_RATIO}x)`
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
  weather,
  reach,
];

export function caseByName(name: string): BalanceCase | undefined {
  return CASES.find((c) => c.name === name.toLowerCase());
}
