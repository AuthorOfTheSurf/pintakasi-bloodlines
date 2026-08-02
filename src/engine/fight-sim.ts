import {
  BATTLE,
  ELEMENT_BEATS,
  FIGURE,
  FORMATS,
  PHASES,
  STARS,
  STATS,
  type Element,
  type FightFormat,
} from "./config";
import { randInt, roll2d6, type Rng } from "./rng";

export type BirdStats = {
  agility: number;
  sight: number;
  stamina: number;
  gameness: number;
  station: number;
  condition: number;
};

/** One side of a PvP fight — a real bird's combat-relevant slice. */
export interface Combatant {
  name: string;
  stats: BirdStats;
  element: Element;
  halfStars: number;
}

export interface SimResult {
  winner: 0 | 1;
  playByPlay: string;
  figures: [number, number]; // per-side Pit Figures — each fogged separately
}

interface Fighter {
  name: string;
  stats: BirdStats; // star-boosted base
  element: Element;
  halfStars: number;
  wind: number;
  maxWind: number;
  underdog: boolean; // station's trigger — set once at the scale
  quitChecked: boolean; // the once-per-fight morale check
  ran: boolean;
  dealt: number; // damage bookkeeping for the Pit Figures
}

function toFighter(c: Combatant): Fighter {
  // Star baseline boost: +BOOST_PER_FULL_STAR effective points on every
  // stat — format-agnostic, which is the whole point of stars.
  const boost = Math.floor(c.halfStars / 2) * STARS.BOOST_PER_FULL_STAR;
  const boosted = Object.fromEntries(
    Object.entries(c.stats).map(([k, v]) => [k, Math.min(STATS.MAX, v + boost)])
  ) as BirdStats;
  const maxWind = Math.round(BATTLE.BASE_WIND + boosted.stamina * BATTLE.WIND_PER_STAMINA);
  return {
    name: c.name,
    stats: boosted,
    element: c.element,
    halfStars: c.halfStars,
    wind: maxWind,
    maxWind,
    underdog: false,
    quitChecked: false,
    ran: false,
    dealt: 0,
  };
}

/**
 * One PvP fight, fully symmetric — both sides are real birds and the
 * narration is neutral. Deterministic per (combatants, format, rng seed).
 */
export function simulatePair(
  aIn: Combatant,
  bIn: Combatant,
  format: FightFormat,
  rng: Rng,
  header: string
): SimResult {
  const fmt = FORMATS[format];
  const a = toFighter(aIn);
  const b = toFighter(bIn);

  // Station's trigger, judged once at the scale: total base stats.
  const total = (f: Fighter) => Object.values(f.stats).reduce((x, y) => x + y, 0);
  a.underdog = total(b) >= total(a) * BATTLE.UNDERDOG_RATIO;
  b.underdog = total(a) >= total(b) * BATTLE.UNDERDOG_RATIO;

  const lines: string[] = [
    `⚔ ${header} · ${fmt.label} — ${a.name} (${a.halfStars / 2}★ ${a.element}) vs ${b.name} (${b.halfStars / 2}★ ${b.element})`,
    `Wind: ${a.name} ${a.wind} · ${b.name} ${b.wind}`,
  ];
  if (ELEMENT_BEATS[a.element] === b.element)
    lines.push(`${a.element} overcomes ${b.element} — ${a.name} has the element edge.`);
  else if (ELEMENT_BEATS[b.element] === a.element)
    lines.push(`${b.element} overcomes ${a.element} — ${b.name} has the element edge.`);
  if (a.underdog) lines.push(`${a.name} is outmatched on paper — station will tell.`);
  if (b.underdog) lines.push(`${b.name} is outmatched on paper — station will tell.`);

  let turnsFought = 0;
  for (let turn = 1; turn <= fmt.maxTurns; turn++) {
    if (a.wind <= 0 || b.wind <= 0 || a.ran || b.ran) break;
    turnsFought = turn;

    // The distance curve: whose stat drives depends on how deep we are.
    const stat =
      turn <= PHASES.BREAK_THROUGH_TURN ? "agility" : turn <= PHASES.OPEN_THROUGH_TURN ? "sight" : "gameness";

    const ra = turnRoll(a, b, stat, turn, rng);
    const rb = turnRoll(b, a, stat, turn, rng);

    if (ra.total === rb.total) {
      lines.push(`T${turn} [${stat}] Both circle — ${ra.detail} vs ${rb.detail}. No blood.`);
      continue;
    }
    const [winner, loser, w, l] = ra.total > rb.total ? [a, b, ra, rb] : [b, a, rb, ra];
    // Damage = roll margin × the blade. Knives hit like trucks; gaffs chip.
    let damage = Math.max(1, Math.round((w.total - l.total) * fmt.damageMult));
    if (w.doubles) damage = Math.round(damage * fmt.critMult);
    loser.wind -= damage;
    winner.dealt += damage;
    const move = w.doubles
      ? `TARI STRIKE (double ${w.dice[0]}s!)`
      : w.dice[0] + w.dice[1] >= 10
        ? "high slash"
        : w.dice[0] + w.dice[1] <= 4
          ? "quick feint"
          : "clean hit";
    lines.push(
      `T${turn} [${stat}] ${winner.name} lands a ${move} — ${damage} wind. (${w.detail} vs ${l.detail}) ${loser.name}: ${Math.max(0, loser.wind)}`
    );

    // The morale check — gameness's teeth. Once per fight, when a bird is
    // first badly hurt, it decides whether to keep fighting or RUN.
    if (loser.wind > 0 && loser.wind < loser.maxWind * BATTLE.QUIT_WIND_FRACTION && !loser.quitChecked) {
      loser.quitChecked = true;
      const quitChance = BATTLE.QUIT_BASE_CHANCE * (1 - loser.stats.gameness / STATS.MAX);
      if (rng() < quitChance) {
        loser.ran = true;
        lines.push(`${loser.name} breaks and RUNS — no gameness left in it.`);
      } else {
        lines.push(`${loser.name} is badly hurt but stands its ground.`);
      }
    }
  }

  // Neutral decision: a run loses, an empty wind pool loses, otherwise the
  // deeper wind pool wins at the bell (dead-even wind = the judges flip).
  let winner: 0 | 1;
  if (a.ran) winner = 1;
  else if (b.ran) winner = 0;
  else if (b.wind <= 0) winner = 0;
  else if (a.wind <= 0) winner = 1;
  else if (a.wind !== b.wind) winner = a.wind > b.wind ? 0 : 1;
  else winner = rng() < 0.5 ? 0 : 1;

  if (a.ran || b.ran) {
    // Line already narrated at the moment of the break.
  } else if (a.wind <= 0 || b.wind <= 0) {
    lines.push(`${(a.wind <= 0 ? a : b).name} is out of wind — the sentensyador calls it.`);
  } else {
    lines.push(`Time is called — ${winner === 0 ? a.name : b.name} kept more wind.`);
  }

  // ── The Pit Figures ───────────────────────────────────────────────────────
  // Damage margin per turn, normalized by the blade's damage scale so
  // figures compare across formats, adjusted for opponent quality, then
  // fogged: separate noise per side + banding. A narrow loss to a monster
  // can out-figure an ugly win over a dud — the discovery signal working.
  const avg = (s: BirdStats) => Object.values(s).reduce((x, y) => x + y, 0) / 6;
  const figureFor = (self: Fighter, other: Fighter, selfAvg: number, otherAvg: number) => {
    const marginPerTurn = (self.dealt - other.dealt) / Math.max(1, turnsFought) / fmt.damageMult;
    const raw =
      FIGURE.BASE +
      marginPerTurn * FIGURE.MARGIN_SCALE +
      (otherAvg - selfAvg) / FIGURE.OPP_ADJ_DIVISOR +
      randInt(rng, -FIGURE.NOISE, FIGURE.NOISE);
    return Math.max(0, Math.min(FIGURE.MAX, Math.round(raw / FIGURE.BAND) * FIGURE.BAND));
  };
  const avgA = avg(aIn.stats);
  const avgB = avg(bIn.stats);
  const figures: [number, number] = [figureFor(a, b, avgA, avgB), figureFor(b, a, avgB, avgA)];

  lines.push(`🏆 ${winner === 0 ? a.name : b.name} WINS.`);
  lines.push(`Pit Figures: ${a.name} ${figures[0]} · ${b.name} ${figures[1]} (${fmt.label})`);
  return { winner, playByPlay: lines.join("\n"), figures };
}

function turnRoll(
  self: Fighter,
  other: Fighter,
  stat: "agility" | "sight" | "gameness",
  turn: number,
  rng: Rng
): { total: number; dice: [number, number]; doubles: boolean; detail: string } {
  const dice = roll2d6(rng);
  const parts = [`${dice[0]}+${dice[1]}`];

  // Condition — day-of-fight form, rolled fresh every turn. High condition
  // pins form near 100%; low condition means some turns arrive badly.
  const formFloor = BATTLE.WORST_FORM + BATTLE.FORM_RANGE * (self.stats.condition / STATS.MAX);
  const form = formFloor + rng() * (1 - formFloor);

  // Stamina's second job — physical stats (agility/sight) decay each turn;
  // big wind slows the fade. Gameness doesn't decay: grit is mental.
  const physical = stat !== "gameness";
  const decay = physical
    ? Math.max(BATTLE.DECAY_FLOOR, 1 - (turn - 1) * BATTLE.DECAY_PER_TURN * (1 - self.stats.stamina / STATS.MAX))
    : 1;

  let total = dice[0] + dice[1] + (self.stats[stat] * form * decay) / BATTLE.ROLL_DIVISOR;

  if (ELEMENT_BEATS[self.element] === other.element) {
    total += BATTLE.ELEMENT_EDGE;
    parts.push(`+${BATTLE.ELEMENT_EDGE}elem`);
  }
  // Station — the rivalry modifier: the underdog fights above its book.
  if (self.underdog) {
    total += (self.stats.station * form) / BATTLE.STATION_DIVISOR;
    parts.push("+station");
  }
  // Gameness holds a hurt bird's performance together late.
  if (self.wind < self.maxWind * BATTLE.QUIT_WIND_FRACTION) {
    total += (self.stats.gameness * form) / BATTLE.GAMENESS_DIVISOR;
    parts.push("+gameness");
  }
  return { total, dice, doubles: dice[0] === dice[1], detail: parts.join("") };
}
