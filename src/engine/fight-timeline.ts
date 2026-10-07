import { FORMATS, PHASES, type Element, type FightFormat } from "./config";

/**
 * ── THE FIGHT, AS FACTS (round 50) ─────────────────────────────────────────
 *
 * Until this round a fight's only turn-by-turn record was PROSE: `simulatePair`
 * pushed narration lines as it went, and anything that wanted to know what
 * happened — the balance lab counting turns and runs, and now a viewer that
 * wants to draw the fight — had to read it back out of English with a regex.
 *
 * So the record is inverted. `simulatePair` writes a `FightTimeline` and never
 * builds a string; the play-by-play is `narrate(timeline)`, the ONLY function
 * in the codebase that turns a fight into words. Text and picture are two
 * renderings of one record and so cannot disagree, which is the same promise
 * the replay guard makes about the archive.
 *
 * THE SHAPE IS A TREE, NOT AN EVENT STREAM, on purpose. A flat list of events
 * would let a reader meet "blown" twice for one bird, or a morale check with
 * no hit before it, and would leave every reader to regroup events into turns.
 * Here a turn is one entry, a bird's once-per-fight facts live on its corner,
 * and the places a fight genuinely branches are unions: tie-or-hit, and the
 * three endings.
 *
 * NOTHING IS STORED TWICE. The winner is `winnerOf(ending)`. A turn's number
 * is its index. The phase is `phaseOf(turn)`. A bird that broke and ran is
 * `ending.kind === "ran"` and nowhere else.
 *
 * This file imports config and nothing more — no rng, no database — so the
 * office's client bundle can import it at runtime the way it already imports
 * config and grades.
 */

/** Which argument to `simulatePair` a bird was. Also the rng order — see battle_log.side. */
export type Side = 0 | 1;

/** Exactly two, indexed by Side. */
export type Pair<T> = readonly [T, T];

export const otherSide = (side: Side): Side => (side === 0 ? 1 : 0);

/**
 * Everything about one bird that is settled at the scale and holds for the
 * whole fight. The three edges are PER-ROLL CONSTANTS — the sim adds the same
 * number on every roll — so they are stored once here rather than 45 times on
 * the turns of a long gaff fight.
 */
export interface Corner {
  readonly name: string;
  readonly element: Element;
  readonly halfStars: number;
  /** Health at the opening bell — also the full width of a viewer's health bar. */
  readonly health: number;
  /** Station's per-roll clawback, before form. 0 for the bird that is ahead on paper. */
  readonly claw: number;
  /** The wheel edge this bird's rolls carry, already star- and blade-scaled. null = none. */
  readonly elemEdge: number | null;
  /** The same for the day's weather. null = not its element, or no stars to voice it. */
  readonly wxEdge: number | null;
  /** The turn this bird's tank ran dry, or null if the fight ended first. At most once. */
  readonly blownOn: number | null;
}

export interface Roll {
  readonly dice: Pair<number>;
  /** The bird was hurt enough that gameness propped up this roll. */
  readonly gameness: boolean;
}

/** A tie has no attacker, no damage and no morale check, so none of those exist on it. */
export type Exchange =
  | { readonly kind: "tie" }
  | {
      readonly kind: "hit";
      readonly by: Side;
      /** After the blade's multiplier and any crit. */
      readonly damage: number;
      /** The winning roll was doubles — a Tari Strike, and the blade's critMult applied. */
      readonly crit: boolean;
      /** The STRUCK bird's health afterwards, floored at 0 exactly as the transcript prints it. */
      readonly healthAfter: number;
      /**
       * This hit triggered the struck bird's one morale check and it HELD. A
       * check that failed is not recorded here: it ends the fight, so it is
       * the `ran` ending.
       */
      readonly stood: boolean;
    };

/** Turn number is `index + 1` — the sim never skips one, so it is not stored. */
export interface Turn {
  readonly rolls: Pair<Roll>;
  readonly exchange: Exchange;
}

/**
 * Three endings, and they are not interchangeable (the balance lab counts them
 * separately for exactly this reason): a bird that RAN is a gameness failure,
 * an emptied health pool is a damage race, the bell is a fight nobody finished.
 * `side` is the bird it happened TO. A bell has no such bird, so it names its
 * winner and says whether the judges had to flip for it.
 */
export type Ending =
  | { readonly kind: "ran"; readonly side: Side }
  | { readonly kind: "healthOut"; readonly side: Side }
  | { readonly kind: "bell"; readonly winner: Side; readonly coinFlip: boolean };

export interface FightTimeline {
  /** The card's title, built by the caller. Decoration — it feeds no roll. */
  readonly header: string;
  readonly format: FightFormat;
  readonly corners: Pair<Corner>;
  /** Who holds the element wheel over the other, stars or no stars. */
  readonly wheel: Side | null;
  /** null = fought without weather (the lab). `home[side]` = that bird is of the day's element. */
  readonly weather: { readonly element: Element; readonly home: Pair<boolean> } | null;
  readonly turns: readonly Turn[];
  readonly ending: Ending;
  /** Pit Figures, [side A, side B] — on the record because the transcript prints them. */
  readonly figures: Pair<number>;
}

export function winnerOf(ending: Ending): Side {
  if (ending.kind === "bell") return ending.winner;
  return otherSide(ending.side);
}

/** The chapter a turn falls in. Narration and staging only — no roll reads it. */
export function phaseOf(turn: number): "break" | "open" | "deep" {
  if (turn <= PHASES.BREAK_THROUGH_TURN) return "break";
  if (turn <= PHASES.OPEN_THROUGH_TURN) return "open";
  return "deep";
}

/**
 * The narration, cut where a viewer reveals it: `turns[i]` is every line turn
 * i+1 produced, so a caption under the picture is the same string the
 * play-by-play prints, found by index instead of by counting lines.
 *
 * `close` carries the result. A reader that must not spoil a fight shows
 * `opening` and `turns` and holds `close` back.
 */
export interface Transcript {
  readonly opening: readonly string[];
  readonly turns: readonly (readonly string[])[];
  readonly close: readonly string[];
}

// Narration only — the clawback itself has no threshold. 0.05 per roll is
// where it stops being rounding error and starts being a story.
const OUTMATCHED_CLAW = 0.05;

/** What the winning roll looked like from the stands — doubles first, then the pip sum. */
function moveName(dice: Pair<number>, crit: boolean): string {
  if (crit) return `TARI STRIKE (double ${dice[0]}s!)`;
  const pips = dice[0] + dice[1];
  if (pips >= 10) return "high slash";
  if (pips <= 4) return "quick feint";
  return "clean hit";
}

/** One roll as the transcript shows it: the dice, then each thing the bird brought, in a fixed order. */
function detailOf(corner: Corner, roll: Roll): string {
  let detail = `${roll.dice[0]}+${roll.dice[1]}`;
  if (corner.elemEdge !== null) detail += `+${corner.elemEdge.toFixed(2)}elem`;
  if (corner.wxEdge !== null) detail += `+${corner.wxEdge.toFixed(2)}wx`;
  if (corner.claw > 0) detail += "+station";
  if (roll.gameness) detail += "+gameness";
  return detail;
}

function openingLines(t: FightTimeline): string[] {
  const [a, b] = t.corners;
  const lines = [
    `⚔ ${t.header} · ${FORMATS[t.format].label} — ${a.name} (${a.halfStars / 2}★ ${a.element}) vs ${b.name} (${b.halfStars / 2}★ ${b.element})`,
    `Health: ${a.name} ${a.health} · ${b.name} ${b.health}`,
  ];
  if (t.wheel !== null) {
    const adv = t.corners[t.wheel];
    const prey = t.corners[otherSide(t.wheel)];
    // The wheel only matters as loudly as the advantaged bird's stars say
    // (2026-08-04): a 0★ bird's matchup is decorative, and the narration must
    // not imply an edge the roll never sees.
    lines.push(
      adv.halfStars === 0
        ? `${adv.element} overcomes ${prey.element} on the wheel — but ${adv.name} carries no stars, so it counts for nothing.`
        : `${adv.element} overcomes ${prey.element} — ${adv.name} presses a ${adv.halfStars / 2}★ element edge.`
    );
  }
  if (t.weather) lines.push(weatherLine(t, t.weather));
  for (const corner of t.corners)
    if (corner.claw >= OUTMATCHED_CLAW)
      lines.push(`${corner.name} is outmatched on paper — station will tell.`);
  return lines;
}

function weatherLine(t: FightTimeline, weather: NonNullable<FightTimeline["weather"]>): string {
  const [aHome, bHome] = weather.home;
  // Both matched cancels EXACTLY: damage is the roll MARGIN, so the same
  // bonus on both sides drops out and the fight is bit-identical to a
  // no-weather one. Say that, rather than implying the day did something.
  if (aHome && bHome)
    return `Today's element is ${weather.element} — both birds call it home, so it settles nothing.`;
  if (aHome || bHome)
    return `Today's element is ${weather.element} — ${t.corners[aHome ? 0 : 1].name} carries the weather edge.`;
  return `Today's element is ${weather.element} — neither bird calls it home.`;
}

function turnLines(t: FightTimeline, turn: Turn, n: number): string[] {
  const lines: string[] = [];
  for (const corner of t.corners)
    if (corner.blownOn === n)
      lines.push(`${corner.name} is blown — the tank is empty, running on heart now.`);

  const phase = phaseOf(n);
  const details = [
    detailOf(t.corners[0], turn.rolls[0]),
    detailOf(t.corners[1], turn.rolls[1]),
  ] as const;
  const { exchange } = turn;
  if (exchange.kind === "tie") {
    lines.push(`T${n} [${phase}] Both circle — ${details[0]} vs ${details[1]}. No blood.`);
    return lines;
  }
  const struck = otherSide(exchange.by);
  const move = moveName(turn.rolls[exchange.by].dice, exchange.crit);
  lines.push(
    `T${n} [${phase}] ${t.corners[exchange.by].name} lands a ${move} — ${exchange.damage} damage. (${details[exchange.by]} vs ${details[struck]}) ${t.corners[struck].name}: ${exchange.healthAfter}`
  );
  if (exchange.stood) lines.push(`${t.corners[struck].name} is badly hurt but stands its ground.`);
  return lines;
}

function closeLines(t: FightTimeline): string[] {
  const [a, b] = t.corners;
  const { ending } = t;
  const winner = t.corners[winnerOf(ending)];
  const lines: string[] = [];
  if (ending.kind === "ran")
    lines.push(`${t.corners[ending.side].name} breaks and RUNS — no gameness left in it.`);
  else if (ending.kind === "healthOut")
    lines.push(`${t.corners[ending.side].name} is out of health — the sentensyador calls it.`);
  else lines.push(`Time is called — ${winner.name} kept more health.`);
  lines.push(`🏆 ${winner.name} WINS.`);
  lines.push(
    `Pit Figures: ${a.name} ${t.figures[0]} · ${b.name} ${t.figures[1]} (${FORMATS[t.format].label})`
  );
  return lines;
}

export function transcriptOf(t: FightTimeline): Transcript {
  return {
    opening: openingLines(t),
    turns: t.turns.map((turn, i) => turnLines(t, turn, i + 1)),
    close: closeLines(t),
  };
}

/** The whole play-by-play: every transcript line, in order. */
export function narrate(t: FightTimeline): string {
  const { opening, turns, close } = transcriptOf(t);
  return [...opening, ...turns.flat(), ...close].join("\n");
}
