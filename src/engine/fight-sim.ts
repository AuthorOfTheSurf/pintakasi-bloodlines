import {
  BATTLE,
  ELEMENT_BEATS,
  FIGURE,
  FORMATS,
  PHASES,
  STARS,
  STATS,
  WEATHER,
  type Element,
  type FightFormat,
} from "./config";

type BladeFormat = (typeof FORMATS)[FightFormat];
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
  stats: BirdStats; // base stats, untouched — stars stopped boosting them (2026-08-04)
  element: Element;
  halfStars: number;
  wind: number;
  maxWind: number;
  fuelTurns: number; // how many turns of full output the tank holds (round 27)
  walled: boolean; // has the wall been narrated yet
  clawPerRoll: number; // station's slope — set once at the scale, pre-form
  quitChecked: boolean; // the once-per-fight morale check
  ran: boolean;
  dealt: number; // damage bookkeeping for the Pit Figures
}

function toFighter(c: Combatant): Fighter {
  // Stars no longer touch the stat block (2026-08-04 rework): a star is an
  // amplifier on the bird's ELEMENT, applied where the element applies — in
  // turnRoll. The old +20/star boost also inflated totals into the underdog
  // comparison, which is how a 5★ bird measured worse than its 0★ twin.
  //
  // Wind is UNIFORM since round 27 — stamina buys fuel turns, not hit points.
  return {
    name: c.name,
    stats: { ...c.stats },
    element: c.element,
    halfStars: c.halfStars,
    wind: BATTLE.WIND,
    maxWind: BATTLE.WIND,
    fuelTurns: BATTLE.FUEL.BASE_TURNS + c.stats.stamina * BATTLE.FUEL.TURNS_PER_STAMINA,
    walled: false,
    clawPerRoll: 0,
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
  header: string,
  weather?: Element
): SimResult {
  const fmt = FORMATS[format];
  const a = toFighter(aIn);
  const b = toFighter(bIn);

  // Station's slope, judged once at the scale (rebuilt 2026-08-04 — see the
  // UNDERDOG_CLAWBACK ruling in config). The outmatched bird claws back a
  // fraction of the GAP ITSELF: deficit/6/ROLL_DIVISOR is the per-roll value
  // of the stat lead it is facing, and station decides how much of that —
  // up to UNDERDOG_CLAWBACK at 2000 station — it takes back on every roll.
  // Smooth from zero (no gate, no cliffs) and capped below the gap, so the
  // better bird of two same-shaped ones is always still favored.
  //
  // Station itself is EXCLUDED from both totals: it is heart, not class.
  // Counted in (as the old gate did), buying station inflated a bird's own
  // total, shrank its own deficit, and cancelled itself — the lab measured
  // a station-2000 build at 45% AT PARITY because its big total handed the
  // flat opponent a clawback against fighting stats it didn't have.
  const total = (f: Fighter) =>
    Object.values(f.stats).reduce((x, y) => x + y, 0) - f.stats.station;
  const claw = (self: Fighter, other: Fighter) => {
    const deficit = Math.max(0, total(other) - total(self));
    const gapPerRoll = deficit / 6 / BATTLE.ROLL_DIVISOR;
    return (self.stats.station / STATS.MAX) * BATTLE.UNDERDOG_CLAWBACK * gapPerRoll;
  };
  a.clawPerRoll = claw(a, b);
  b.clawPerRoll = claw(b, a);

  const lines: string[] = [
    `⚔ ${header} · ${fmt.label} — ${a.name} (${a.halfStars / 2}★ ${a.element}) vs ${b.name} (${b.halfStars / 2}★ ${b.element})`,
    `Wind: ${a.name} ${a.wind} · ${b.name} ${b.wind}`,
  ];
  // The wheel only matters as loudly as the advantaged bird's stars say
  // (2026-08-04): a 0★ bird's matchup is decorative, and the narration must
  // not imply an edge the roll never sees.
  const wheelLine = (adv: Fighter, prey: Fighter) =>
    adv.halfStars === 0
      ? `${adv.element} overcomes ${prey.element} on the wheel — but ${adv.name} carries no stars, so it counts for nothing.`
      : `${adv.element} overcomes ${prey.element} — ${adv.name} presses a ${adv.halfStars / 2}★ element edge.`;
  if (ELEMENT_BEATS[a.element] === b.element) lines.push(wheelLine(a, b));
  else if (ELEMENT_BEATS[b.element] === a.element) lines.push(wheelLine(b, a));
  if (weather) {
    const aMatch = a.element === weather;
    const bMatch = b.element === weather;
    if (aMatch && bMatch) {
      // Both matched cancels EXACTLY: damage is the roll MARGIN, so the same
      // bonus on both sides drops out and the fight is bit-identical to a
      // no-weather one. Say that, rather than implying the day did something.
      lines.push(`Today's element is ${weather} — both birds call it home, so it settles nothing.`);
    } else if (aMatch || bMatch) {
      const who = aMatch ? a.name : b.name;
      lines.push(`Today's element is ${weather} — ${who} carries the weather edge.`);
    } else {
      lines.push(`Today's element is ${weather} — neither bird calls it home.`);
    }
  }
  // Narration only — the slope itself has no threshold. 0.05 per roll is
  // where the clawback stops being rounding error and starts being a story.
  if (a.clawPerRoll >= 0.05) lines.push(`${a.name} is outmatched on paper — station will tell.`);
  if (b.clawPerRoll >= 0.05) lines.push(`${b.name} is outmatched on paper — station will tell.`);

  let turnsFought = 0;
  for (let turn = 1; turn <= fmt.maxTurns; turn++) {
    if (a.wind <= 0 || b.wind <= 0 || a.ran || b.ran) break;
    turnsFought = turn;

    // Narration only since round 27 — the weight matrix rolls every stat on
    // every turn, but the fight still has chapters worth naming.
    const phase =
      turn <= PHASES.BREAK_THROUGH_TURN ? "break" : turn <= PHASES.OPEN_THROUGH_TURN ? "open" : "deep";

    // The fuel wall: a bird past its tank delivers only WALL_FACTOR of its
    // agility and sight from here on. Narrated once, the turn it blows.
    for (const f of [a, b]) {
      if (!f.walled && turn > f.fuelTurns) {
        f.walled = true;
        lines.push(`${f.name} is blown — the tank is empty, running on heart now.`);
      }
    }

    const ra = turnRoll(a, b, fmt, rng, weather);
    const rb = turnRoll(b, a, fmt, rng, weather);

    if (ra.total === rb.total) {
      lines.push(`T${turn} [${phase}] Both circle — ${ra.detail} vs ${rb.detail}. No blood.`);
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
      `T${turn} [${phase}] ${winner.name} lands a ${move} — ${damage} wind. (${w.detail} vs ${l.detail}) ${loser.name}: ${Math.max(0, loser.wind)}`
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

  // ── The Pit Figures (rebuilt round 20 — the ghost standard) ───────────────
  // The winner is timed against an invisible maxed-out bird: its damage
  // output per turn, normalized by the blade so figures compare across
  // distances, as a fraction of GHOST_PACE. The loser is scored DOWN from
  // the winner by the finishing margin — the fight's beaten lengths. One
  // noise roll for the whole fight (the track variant), so the fog can
  // never put a loser above the bird that beat it.
  const won = winner === 0 ? a : b;
  const lost = winner === 0 ? b : a;
  const variant = randInt(rng, -FIGURE.NOISE, FIGURE.NOISE);
  const band = (raw: number) =>
    Math.max(0, Math.min(FIGURE.MAX, Math.round((raw + variant) / FIGURE.BAND) * FIGURE.BAND));

  const pace = won.dealt / Math.max(1, turnsFought) / fmt.damageMult;
  // …plus the class of the bird that was beaten (see config): pace alone
  // can't tell a monster from a maiden, because every turn is decided by
  // the DIFFERENCE between two rolls.
  const avg = (s: BirdStats) => Object.values(s).reduce((x, y) => x + y, 0) / 6;
  const beatenClass = (avg(lost.stats) - FIGURE.CLASS_BASE) / FIGURE.CLASS_DIVISOR;
  const winnerRaw =
    (pace / FIGURE.GHOST_PACE[format]) * FIGURE.GHOST_FIGURE + beatenClass;
  // Beaten lengths: the gap in wind left at the end, as a fraction of the
  // loser's own pool. A bird that ran, or emptied, was beaten by the length
  // of the pit; a bird that lost on wind at the bell was beaten by inches.
  const remaining = (f: Fighter) => Math.max(0, f.wind) / f.maxWind;
  const margin = lost.ran ? 1 : Math.min(1, Math.max(0, remaining(won) - remaining(lost)));
  const beaten = Math.max(FIGURE.MIN_BEATEN, margin * FIGURE.BEATEN_SCALE);

  // The winner never posts below one band: a bell decision with almost no
  // blood can band a WIN to 0 (commoner at uniform 100 wind), and a 0-figure
  // winner would tie the loser's floor — the one inversion the ghost
  // standard promises can't happen.
  const winnerFigure = Math.max(FIGURE.BAND, band(winnerRaw));
  // The loser is scored down from the winner's CLAMPED performance, not the
  // raw one — at ROLL_DIVISOR 85 a blowout's raw pace can sail far past
  // FIGURE.MAX, and subtracting the beaten lengths from the unclamped number
  // used to leave the flattened bird at 145 (a maiden crushed by a monster
  // posted a near-elite figure). The Math.max floor closes the mirror bug,
  // recorded in BALANCE.md, where a winner banding to 0 pushed the loser to
  // −5, below the documented [0, MAX] range.
  const loserFigure = Math.max(
    0,
    Math.min(winnerFigure - FIGURE.BAND, band(Math.min(winnerRaw, FIGURE.MAX) - beaten))
  );
  const figures: [number, number] =
    winner === 0 ? [winnerFigure, loserFigure] : [loserFigure, winnerFigure];

  lines.push(`🏆 ${winner === 0 ? a.name : b.name} WINS.`);
  lines.push(`Pit Figures: ${a.name} ${figures[0]} · ${b.name} ${figures[1]} (${fmt.label})`);
  return { winner, playByPlay: lines.join("\n"), figures };
}

function turnRoll(
  self: Fighter,
  other: Fighter,
  fmt: BladeFormat,
  rng: Rng,
  weather?: Element
): { total: number; dice: [number, number]; doubles: boolean; detail: string } {
  const dice = roll2d6(rng);
  const parts = [`${dice[0]}+${dice[1]}`];

  // Condition — day-of-fight form, rolled fresh every turn. High condition
  // pins form near 100%; low condition means some turns arrive badly.
  const formFloor = BATTLE.WORST_FORM + BATTLE.FORM_RANGE * (self.stats.condition / STATS.MAX);
  const form = formFloor + rng() * (1 - formFloor);

  // The blade's weight matrix (round 27): every distance stat contributes on
  // every turn, blended by what THIS blade tests. Past the fuel wall the
  // bird's speed stats (agility/sight) deliver only WALL_FACTOR of
  // themselves; stamina and gameness never wall — the tank IS stamina's
  // mechanic, and grit is mental.
  const wall = self.walled ? BATTLE.FUEL.WALL_FACTOR : 1;
  const { weights, statScale } = fmt;
  const s = self.stats;
  const blend =
    (s.agility * weights.agility + s.sight * weights.sight) * wall +
    s.stamina * weights.stamina +
    s.gameness * weights.gameness;

  // statScale — the loudness dial (round 27): every term the BIRD brings is
  // scaled per blade so a stat gap buys roughly the same win rate whether
  // the fight samples it 5 times or 45. Only the dice go unscaled.
  let total = dice[0] + dice[1] + (blend * form * statScale) / BATTLE.ROLL_DIVISOR;

  // Stars are the element's VOLUME (2026-08-04): both edges scale by
  // halfStars/10, so 5.0★ delivers the full ceiling and 0★ mutes the
  // matchup entirely. Every half-step is a real rung.
  const starScale = self.halfStars / STARS.MAX_HALF_STARS;
  if (starScale > 0 && ELEMENT_BEATS[self.element] === other.element) {
    total += BATTLE.ELEMENT_EDGE * starScale * statScale;
    parts.push(`+${(BATTLE.ELEMENT_EDGE * starScale * statScale).toFixed(2)}elem`);
  }
  // The day's ascendant element (round 24): a bird OF the weather's element
  // gets the weather edge at the same star volume, stacking with the
  // head-to-head RPS edge above.
  if (starScale > 0 && weather && self.element === weather) {
    total += WEATHER.EDGE * starScale * statScale;
    parts.push(`+${(WEATHER.EDGE * starScale * statScale).toFixed(2)}wx`);
  }
  // Station — the rivalry stat: the outmatched bird claws back a station-
  // sized fraction of the gap on every roll (see the scale, above).
  if (self.clawPerRoll > 0) {
    total += self.clawPerRoll * form * statScale;
    parts.push("+station");
  }
  // Gameness holds a hurt bird's performance together late.
  if (self.wind < self.maxWind * BATTLE.QUIT_WIND_FRACTION) {
    total += ((self.stats.gameness * form) / BATTLE.GAMENESS_DIVISOR) * statScale;
    parts.push("+gameness");
  }
  return { total, dice, doubles: dice[0] === dice[1], detail: parts.join("") };
}
