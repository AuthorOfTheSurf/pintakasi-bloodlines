/**
 * DESIGN INTENT, as data.
 *
 * Why this file is separate from the cases. A measurement is a fact; "that
 * number is wrong" is an opinion, and the two rot at different speeds. The
 * cases in `cases.ts` measure what the engine DOES and nothing more. What the
 * engine was SUPPOSED to do lives here, written down once, so the report can
 * print measured-next-to-intended instead of asking a reader to remember what
 * the target was.
 *
 * The rule that follows from that split: a row only gets a verdict when
 * something in this file declared an answer for it. Where intent is silent the
 * report stays silent too. Guessing a target from the measurement is how a
 * balance bug gets ratified — both of the ones that shipped at several times
 * their intended strength (WEATHER.EDGE, BATTLE.ELEMENT_EDGE) had a confident
 * comment sitting next to them describing the number as "slight".
 *
 * NOTHING HERE IS A TUNING TARGET YET. The stat priorities below are the game
 * designer's statement of what each blade is FOR, recorded so we can see how
 * far the engine is from it. More blade lengths are coming, and tuning the
 * four we have to hit these numbers before the shape of the ladder is settled
 * would be fitting the curve to three points.
 */
import { FORMAT_NAMES, STAT_NAMES, type FightFormat, type StatName } from "@/engine/config";

// ── Per-blade stat priority ─────────────────────────────────────────────────

export interface BladeIntent {
  /** The designer's own notation, verbatim. The single source for this entry. */
  notation: string;
  /** Ranked stats, strongest first. Parsed from `notation`. */
  order: StatName[];
  /**
   * How emphatic each ">" between neighbours was (1 for ">", 2 for ">>", …).
   * Kept because the designer's gaps are not uniform: on the long knife the
   * step from Stamina to Gameness is four chevrons wide and the step from
   * Agility to Sight is two, which is a statement about magnitude and not just
   * about order. Nothing consumes this yet — no case can currently measure a
   * gap SIZE against a target — but throwing the information away at parse
   * time would mean re-asking the designer later.
   */
  gaps: number[];
  /**
   * B3's special claim (round 27): no ranking at all — every distance stat is
   * supposed to buy the SAME lift, so the flat bird is the best bird there.
   * An even blade is judged on max−min spread instead of on order.
   */
  even?: boolean;
}

/**
 * Parse "Agility >> Sight >>> Stamina" into an order and its gaps.
 *
 * The notation is kept as the source of truth rather than a hand-written array
 * because the two would drift, and the notation is what the designer actually
 * said. An unknown stat name throws at module load, so a typo is a startup
 * crash rather than a stat that silently drops out of every ranking check.
 */
function parseIntent(notation: string): BladeIntent {
  const parts = notation.split(/\s*(>+)\s*/);
  const order = parts
    .filter((_, i) => i % 2 === 0)
    .map((s) => s.trim().toLowerCase() as StatName);
  const gaps = parts.filter((_, i) => i % 2 === 1).map((s) => s.length);
  for (const s of order) {
    if (!(STAT_NAMES as readonly string[]).includes(s)) {
      throw new Error(`intent.ts: "${s}" in "${notation}" is not one of ${STAT_NAMES.join(", ")}`);
    }
  }
  if (new Set(order).size !== order.length) {
    throw new Error(`intent.ts: duplicate stat in "${notation}"`);
  }
  return { notation, order, gaps };
}

/**
 * What each blade is supposed to reward, from the game designer.
 *
 * Read these as the "distance" dial the formats were built around: the short
 * blades are decided in the opening exchanges (so the stats that drive early
 * turns should dominate), the long ones are wars of attrition (so wind and
 * grit should). Station and condition are deliberately absent — they are the
 * two BEHAVIORAL anchors, they matter in every format and define none, so they
 * have no place in a per-blade ranking.
 */
// RE-RULED FOR ROUND 27 — the five-blade dial, one key stat per off-center
// blade (Zane's PFL symmetry: Agility=Start keys B1, Sight=Speed keys B2,
// Stamina keys B4, Gameness=Finish keys B5, and B3 — the exact middle — keys
// NOBODY). Neighbours share, the ends are opposites, and B2's order is B4's
// read through the mirror (agility↔gameness, sight↔stamina), same for B1/B5.
// Unlike the four-blade era these are no longer aspirations the engine
// misses: the round-27 weight matrix was tuned until the sensitivity case
// matched every row.
export const STAT_PRIORITY: Record<FightFormat, BladeIntent> = {
  b1: parseIntent("Agility >> Sight >>> Stamina > Gameness"),
  b2: parseIntent("Sight > Agility > Stamina > Gameness"),
  b3: { notation: "Agility = Sight = Stamina = Gameness", order: [], gaps: [], even: true },
  b4: parseIntent("Stamina > Gameness > Sight > Agility"),
  b5: parseIntent("Gameness > Stamina > Sight >> Agility"),
};

/**
 * The overarching rule, and the one most likely to be violated quietly: a stat
 * may be LAST on a blade, but it may never be WORTH NOTHING on it. A stat with
 * zero measured effect at some blade length is a stat that a player can safely
 * ignore when picking that blade, which collapses the six-stat matrix into
 * whatever subset the phase windows happen to reach.
 *
 * This is what makes the `reach` case load-bearing rather than trivia: turn
 * phases are ABSOLUTE windows while each blade has its own turn ceiling, so a
 * blade can be structurally incapable of reaching a stat's phase at all. That
 * is a violation of this rule that no amount of re-tuning a divisor can fix.
 */
export const EVERY_STAT_EVERYWHERE =
  "Every blade stat should have SOME effect at EVERY blade length.";

/**
 * The BREEDING rule, ruled by Zane after round 28 and the reason the `pairs`
 * case exists at all.
 *
 * The hypothesis, in his own example: a bird bred `[450, 450, 350, 350]` — a
 * full grade on two stats, nothing on the other two — "should do well at B1
 * and B2, and still good at B3 vs a flat bird". That is a claim about RANGE.
 * A pair is meant to be a plan with TWO HOMES on the blade ladder plus a
 * respectable middle, which is a different bird from a single spike (tall at
 * one blade, ordinary everywhere else) — and the PFL precedent is that both
 * lines are worth breeding, for different reasons.
 *
 * NOT a claim about which is better. Zane ruled that separately: balancing
 * single-stat spikes is its own concern, and a spike is a fine line anyway
 * because stars, station and condition are still on the table. The first
 * version of the `pairs` case measured pair-vs-spike at equal totals and
 * warned about the result; that question was never asked. The control is a
 * FLAT bird.
 *
 * Measurable form, and what the case checks: a pair's two BEST blades should
 * be the two blades its stats key (derived from the weight matrix, so a
 * re-weighting moves the prediction with it), and the pair should still be
 * clearly ahead of a flat bird at B3.
 */
export const PAIR_INTENT =
  "A stat PAIR should buy RANGE: strongest at the two blades its two stats key, and still clearly ahead of a flat bird in the middle.";

// ── Numeric targets ─────────────────────────────────────────────────────────

/**
 * The control. Two identical birds, so anything other than a coin flip is a
 * bug in the engine or in the lab — side-ordering bias is the specific fear
 * (side A rolls first every turn), which is why every headline number in the
 * lab is measured with `mirrored`.
 */
export const SYMMETRY_TARGET = 50;

/**
 * How far a measurement may sit from its target before the report calls it.
 * Deliberately generous: these are design targets stated to the nearest round
 * number, not tolerances anyone committed to. The verdict helper also widens
 * this to the measurement's own CI, because a target inside the noise cannot
 * be missed in any meaningful sense.
 */
export const TARGET_TOLERANCE = 5;

/**
 * GRADE — what a whole level of bred stats should be worth.
 *
 * The unit is "+delta to every stat", which is also the lab's unit of stat
 * currency (cases build their birds out of it rather than inventing numbers).
 * The shape the designer asked for is steep and deliberate: one grade is a
 * strong favourite, two is nearly a formality. It is the argument for breeding
 * — if two grades of stats lost to a coin flip of birth element, nobody would
 * ever bother, which is exactly the failure ELEMENT_EDGE shipped with.
 */
export const GRADE_TARGETS = [
  { delta: 100, winRate: 80 },
  { delta: 200, winRate: 98 },
] as const;

/** The lab's unit of stat currency: one full grade level on one stat. */
export const GRADE_STEP = GRADE_TARGETS[0].delta;

/**
 * STARS — declared intent, and it does NOT describe the shipped mechanic.
 *
 * Today a full star adds STARS.BOOST_PER_FULL_STAR to all six stats, which
 * makes stars a flat power level: a second, blunter grade ladder running
 * alongside the real one. The designer's intent is different in kind — stars
 * should scale the ELEMENTAL advantage, so a 5.0★ Fire bird gets the maximum
 * edge over Metal and a 0★ Fire bird gets none at all. Stars would then be a
 * multiplier on the matchup game rather than a stat block, and a starless bird
 * would be a bird with no rock-paper-scissors, not a weak bird.
 *
 * Recorded here NOW, before the rework, for two reasons. The `stars` case can
 * print measured-vs-intended immediately, and when the rework lands there is a
 * baseline measurement of the old mechanic to compare it against — which is
 * precisely what did not exist for the two edges that shipped wrong.
 *
 * DO NOT IMPLEMENT FROM THIS. It is a declaration, not a spec.
 */
export const STAR_INTENT = {
  intended:
    "Stars scale the ELEMENTAL advantage: 5.0★ = maximum elemental edge, 0.5★ = minimal, 0★ = no elemental edge at all.",
  status:
    "IMPLEMENTED 2026-08-04 — both edges (wheel and weather) multiply by halfStars/10; the old flat stat boost is gone.",
} as const;

// ── Verdicts ────────────────────────────────────────────────────────────────

export interface Verdict {
  verdict: "ok" | "warn";
  note: string;
}

export interface MeasuredLift {
  stat: StatName;
  /** Win-rate points above the flat baseline, from the sensitivity case. */
  lift: number;
  /** The measurement's own 95% half-width. A lift inside it is not a lift. */
  ci95: number;
}

/**
 * Compare a measured stat ranking to the declared one for a blade.
 *
 * Returns `undefined` — not a passing verdict — when there is no intent to
 * judge against, or when the measurement doesn't cover every ranked stat. A
 * partial ranking can look perfectly ordered while the stat that was left out
 * is the inverted one.
 *
 * Two failure modes get called out separately because they need different
 * fixes. An INVERSION (the engine ranks B above A where intent says A above B)
 * is a tuning problem — a divisor is wrong. A DEAD stat (a lift that can't be
 * told apart from zero) usually is not: it means the stat never gets read at
 * that blade length at all, which is a structural miss and the thing
 * EVERY_STAT_EVERYWHERE exists to catch.
 */
export function judgeRanking(format: FightFormat, measured: MeasuredLift[]): Verdict | undefined {
  const intent = STAT_PRIORITY[format];
  if (!intent) return undefined;

  // An EVEN blade (B3) has no order to check — the claim is that the four
  // distance stats buy the same lift. Judged on max−min spread, widened to
  // the measurements' own noise: two stats a CI apart cannot be told apart,
  // so they cannot be unequal in any meaningful sense either.
  if (intent.even) {
    const distance = measured.filter((m) => !["station", "condition"].includes(m.stat));
    if (distance.length < 4) return undefined;
    const lifts = distance.map((m) => m.lift);
    const spread = Math.max(...lifts) - Math.min(...lifts);
    const window = Math.max(3, 2 * Math.max(...distance.map((m) => m.ci95)));
    return spread <= window
      ? { verdict: "ok", note: `even to ${spread.toFixed(1)} pts (${intent.notation})` }
      : {
          verdict: "warn",
          note: `spread ${spread.toFixed(1)} pts — the middle blade is supposed to be flat (${intent.notation})`,
        };
  }

  const byStat = new Map(measured.map((m) => [m.stat, m]));
  const ranked = intent.order.map((s) => byStat.get(s)).filter((m): m is MeasuredLift => !!m);
  if (ranked.length !== intent.order.length) return undefined;

  const place = (s: StatName) => intent.order.indexOf(s);
  const measuredOrder = [...ranked].sort((a, b) => b.lift - a.lift).map((m) => m.stat);

  const inversions: string[] = [];
  for (let i = 0; i < measuredOrder.length; i++) {
    for (let j = i + 1; j < measuredOrder.length; j++) {
      // measuredOrder[i] beat measuredOrder[j]; intent says otherwise.
      if (place(measuredOrder[i]) > place(measuredOrder[j])) {
        inversions.push(`${measuredOrder[i]} over ${measuredOrder[j]}`);
      }
    }
  }
  const dead = ranked.filter((m) => Math.abs(m.lift) <= m.ci95).map((m) => m.stat);

  const notes: string[] = [];
  if (inversions.length) notes.push(`inverted: ${inversions.join(", ")}`);
  if (dead.length) notes.push(`no measurable effect: ${dead.join(", ")}`);
  if (!notes.length) notes.push(`matches intent (${intent.notation})`);

  return { verdict: inversions.length || dead.length ? "warn" : "ok", note: notes.join(" · ") };
}

/**
 * Judge a single measured percentage against a declared target.
 *
 * The tolerance widens to the measurement's own CI on purpose: asserting a
 * 5-point window on a number carrying ±8 points of noise is how a 200-seed
 * test in this repo produced a documented FALSE PASS. If the sample can't
 * resolve the question, the answer is "not measured yet", not "warn".
 */
export function judgeTarget(
  measured: number,
  target: number,
  ci95 = 0,
  tolerance = TARGET_TOLERANCE
): Verdict {
  const window = Math.max(tolerance, ci95);
  const off = measured - target;
  return Math.abs(off) <= window
    ? { verdict: "ok", note: `target ${target}%` }
    : {
        verdict: "warn",
        note: `target ${target}% — ${off > 0 ? "+" : ""}${off.toFixed(1)} off`,
      };
}

/** Every blade the intent table covers — a guard against a new format silently going unjudged. */
export function bladesWithIntent(): FightFormat[] {
  return FORMAT_NAMES.filter((f) => !!STAT_PRIORITY[f]);
}
