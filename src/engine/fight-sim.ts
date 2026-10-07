import {
  BATTLE,
  ELEMENT_BEATS,
  FIGURE,
  FORMATS,
  STARS,
  STATS,
  WEATHER,
  type Element,
  type FightFormat,
} from "./config";

type BladeFormat = (typeof FORMATS)[FightFormat];
import {
  narrate,
  winnerOf,
  type Corner,
  type Ending,
  type FightTimeline,
  type Roll,
  type Turn,
} from "./fight-timeline";
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

/**
 * A bird row → its combat slice. Lives here, beside `Combatant`, because THREE
 * callers need it and until round 38 there were two byte-identical private
 * copies (lobbies.ts and tournaments.ts) with a third about to be written for
 * replay. Structurally typed rather than importing the schema: fight-sim is
 * the one engine file that touches no database, and it should stay that way.
 *
 * Note what is NOT copied — records, age, farm, status. None of them enter a
 * fight. That is what makes a fight replayable from a seed years later.
 */
export function toCombatant(row: {
  name: string;
  agility: number;
  sight: number;
  stamina: number;
  gameness: number;
  station: number;
  condition: number;
  element: string;
  halfStars: number;
}): Combatant {
  return {
    name: row.name,
    stats: {
      agility: row.agility,
      sight: row.sight,
      stamina: row.stamina,
      gameness: row.gameness,
      station: row.station,
      condition: row.condition,
    },
    element: row.element as Element,
    halfStars: row.halfStars,
  };
}

export interface SimResult {
  winner: 0 | 1;
  figures: [number, number]; // per-side Pit Figures — each fogged separately
  /** What happened, as facts — the record the play-by-play and the viewer both render. */
  timeline: FightTimeline;
  /**
   * `narrate(timeline)`, built when read (round 65). A getter because a sim
   * settles ~28,000 fights and reads the text of none of them: until this
   * round every one of those fights formatted its whole transcript and threw
   * it away.
   */
  readonly playByPlay: string;
}

interface Fighter {
  name: string;
  stats: BirdStats; // base stats, untouched — stars stopped boosting them (2026-08-04)
  element: Element;
  halfStars: number;
  health: number;
  maxHealth: number;
  fuelTurns: number; // how many turns of full output the tank holds (round 27)
  gassedOn: number | null; // the turn the tank ran dry — past it, the bird is walled
  clawPerRoll: number; // station's slope — set once at the scale, pre-form
  // The wheel and weather edges, star- and blade-scaled. Like the clawback
  // they are the same number on every roll, so they are judged once at the
  // scale. null = this bird carries none.
  elemEdge: number | null;
  wxEdge: number | null;
  quitChecked: boolean; // the once-per-fight morale check
  ran: boolean;
  dealt: number; // damage bookkeeping
  // The Pit Figure's night term (round 30): the total NON-DICE addition this
  // bird actually rolled, summed over the turns it fought. Everything the
  // bird brought — form, the element wheel, the weather, station's clawback,
  // gameness late, and the fuel wall eating its speed stats — lands here, and
  // the dice deliberately do not. See FIGURE in config.
  bonusRolled: number;
}

/**
 * The weighted stat blend — what a blade actually tests, in stat points.
 * Every format's weights sum to exactly 1.00 (pinned in formats.test.ts), so
 * a FLAT bird blends the same number at all five blades and a SHAPED one
 * blends higher at the blades its pair keys. This is the whole Pit Figure
 * spine, and the reason blade fit is multiplicative without a fit term.
 */
export function blendOf(stats: BirdStats, fmt: BladeFormat): number {
  const w = fmt.weights;
  return (
    stats.agility * w.agility +
    stats.sight * w.sight +
    stats.stamina * w.stamina +
    stats.gameness * w.gameness
  );
}

function toFighter(c: Combatant): Fighter {
  // Stars no longer touch the stat block (2026-08-04 rework): a star is an
  // amplifier on the bird's ELEMENT, applied where the element applies — in
  // turnRoll. The old +20/star boost also inflated totals into the underdog
  // comparison, which is how a 5★ bird measured worse than its 0★ twin.
  //
  // Health is UNIFORM since round 27 — stamina buys fuel turns, not hit points.
  return {
    name: c.name,
    stats: { ...c.stats },
    element: c.element,
    halfStars: c.halfStars,
    health: BATTLE.HEALTH,
    maxHealth: BATTLE.HEALTH,
    fuelTurns: BATTLE.FUEL.BASE_TURNS + c.stats.stamina * BATTLE.FUEL.TURNS_PER_STAMINA,
    gassedOn: null,
    clawPerRoll: 0,
    elemEdge: null,
    wxEdge: null,
    quitChecked: false,
    ran: false,
    dealt: 0,
    bonusRolled: 0,
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
  const total = (f: Fighter) => Object.values(f.stats).reduce((x, y) => x + y, 0) - f.stats.station;
  const claw = (self: Fighter, other: Fighter) => {
    const deficit = Math.max(0, total(other) - total(self));
    const gapPerRoll = deficit / 6 / BATTLE.ROLL_DIVISOR;
    return (self.stats.station / STATS.MAX) * BATTLE.UNDERDOG_CLAWBACK * gapPerRoll;
  };
  a.clawPerRoll = claw(a, b);
  b.clawPerRoll = claw(b, a);

  // Stars are the element's VOLUME (2026-08-04): both edges scale by
  // halfStars/10, so 5.0★ delivers the full ceiling and 0★ mutes the
  // matchup entirely. Every half-step is a real rung.
  const edges = (self: Fighter, other: Fighter) => {
    const starScale = self.halfStars / STARS.MAX_HALF_STARS;
    if (!(starScale > 0)) return;
    if (ELEMENT_BEATS[self.element] === other.element)
      self.elemEdge = BATTLE.ELEMENT_EDGE * starScale * fmt.statScale;
    // The day's ascendant element (round 24): a bird OF the weather's element
    // gets the weather edge at the same star volume, stacking with the
    // head-to-head RPS edge above.
    if (weather && self.element === weather) self.wxEdge = WEATHER.EDGE * starScale * fmt.statScale;
  };
  edges(a, b);
  edges(b, a);

  const turns: Turn[] = [];
  for (let turn = 1; turn <= fmt.maxTurns; turn++) {
    if (a.health <= 0 || b.health <= 0 || a.ran || b.ran) break;

    // The fuel wall: a bird past its tank delivers only WALL_FACTOR of its
    // agility and sight from here on.
    for (const f of [a, b]) if (f.gassedOn === null && turn > f.fuelTurns) f.gassedOn = turn;

    const ra = turnRoll(a, fmt, rng);
    const rb = turnRoll(b, fmt, rng);
    // Book the night BEFORE the roll is resolved — a bird's figure counts
    // what it brought to every turn it fought, win or lose the exchange.
    a.bonusRolled += ra.bonus;
    b.bonusRolled += rb.bonus;
    const rolls = [ra.roll, rb.roll] as const;

    if (ra.total === rb.total) {
      turns.push({ rolls, exchange: TIE });
      continue;
    }
    const aWon = ra.total > rb.total;
    const [winner, loser, w, l] = aWon ? [a, b, ra, rb] : [b, a, rb, ra];
    // Damage = roll margin × the blade. Knives hit like trucks; gaffs chip.
    let damage = Math.max(1, Math.round((w.total - l.total) * fmt.damageMult));
    const crit = w.roll.dice[0] === w.roll.dice[1];
    if (crit) damage = Math.round(damage * fmt.critMult);
    loser.health -= damage;
    winner.dealt += damage;

    // The morale check — gameness's teeth. Once per fight, when a bird is
    // first badly hurt, it decides whether to keep fighting or RUN.
    let stood = false;
    if (
      loser.health > 0 &&
      loser.health < loser.maxHealth * BATTLE.QUIT_HEALTH_FRACTION &&
      !loser.quitChecked
    ) {
      loser.quitChecked = true;
      const quitChance = BATTLE.QUIT_BASE_CHANCE * (1 - loser.stats.gameness / STATS.MAX);
      if (rng() < quitChance) loser.ran = true;
      else stood = true;
    }
    turns.push({
      rolls,
      exchange: {
        kind: "hit",
        by: aWon ? 0 : 1,
        damage,
        crit,
        healthAfter: Math.max(0, loser.health),
        stood,
      },
    });
  }
  const turnsFought = turns.length;

  const ending = endingOf(a, b, rng);
  const winner = winnerOf(ending);

  // ── The Pit Figures (rebuilt round 30 — spine × night) ────────────────────
  // See the FIGURE block in config for the full design note. In short: the
  // SPINE is the bird's weighted stat blend at this blade on a fixed scale
  // (PEG_STAT flat = PEG_FIGURE, dice-free, opponent-free, drift-proof), the
  // NIGHT is what it actually brought tonight, a loss is marked down by
  // beaten lengths as a share, and one shared track variant fogs both sides.
  const won = winner === 0 ? a : b;
  const lost = winner === 0 ? b : a;
  const variant = randInt(rng, -FIGURE.NOISE, FIGURE.NOISE);
  const band = (raw: number) =>
    Math.max(0, Math.round((raw + variant) / FIGURE.BAND) * FIGURE.BAND);

  // The reference form — what a NOMINAL_CONDITION bird averages per turn.
  // Derived from BATTLE's own curve so the two can never drift apart: form is
  // drawn uniformly from [floor, 1], so its mean is the midpoint.
  const nominalFormFloor =
    BATTLE.WORST_FORM + BATTLE.FORM_RANGE * (FIGURE.NOMINAL_CONDITION / STATS.MAX);
  const nominalForm = (1 + nominalFormFloor) / 2;

  const rawFigure = (self: Fighter) => {
    const spine = (blendOf(self.stats, fmt) / FIGURE.PEG_STAT) * FIGURE.PEG_FIGURE;
    // What a nominal-condition version of this same bird would have added to
    // each roll, with no wheel edge, no weather, no clawback and no wall.
    // statScale appears on both sides of the ratio and cancels, which is why
    // figures stay comparable across blades of different loudness.
    const nominalBonus =
      (blendOf(self.stats, fmt) * nominalForm * fmt.statScale) / BATTLE.ROLL_DIVISOR;
    const actualBonus = self.bonusRolled / Math.max(1, turnsFought);
    const night =
      nominalBonus <= 0
        ? 1
        : Math.min(
            1 + FIGURE.NIGHT_RANGE,
            Math.max(1 - FIGURE.NIGHT_RANGE, actualBonus / nominalBonus)
          );
    return spine * night;
  };
  const winnerRaw = rawFigure(won);
  const loserRaw = rawFigure(lost);
  // Beaten lengths: the gap in health left at the end, as a fraction of the
  // loser's own pool. A bird that ran, or emptied, was beaten by the length
  // of the pit; a bird that lost on health at the bell was beaten by inches.
  const remaining = (f: Fighter) => Math.max(0, f.health) / f.maxHealth;
  const margin = lost.ran ? 1 : Math.min(1, Math.max(0, remaining(won) - remaining(lost)));
  const beatenShare = Math.max(FIGURE.MIN_BEATEN_SHARE, margin * FIGURE.BEATEN_SHARE);

  // The winner never posts below one band: a bell decision between two very
  // weak birds can band a WIN to 0, and a 0-figure winner would tie the
  // loser's floor — the one inversion the ghost standard promises can't
  // happen.
  const winnerFigure = Math.max(FIGURE.BAND, band(winnerRaw));
  // The loser is independently spine-scored, then marked down by its actual
  // beaten lengths. Capping below the winner preserves that reading rule even
  // when a much better bird loses a close one — it can still post the second
  // figure of the night, but never the first.
  const loserFigure = Math.max(
    0,
    Math.min(winnerFigure - FIGURE.BAND, band(loserRaw * (1 - beatenShare)))
  );
  const figures: [number, number] =
    winner === 0 ? [winnerFigure, loserFigure] : [loserFigure, winnerFigure];

  const timeline: FightTimeline = {
    header,
    format,
    corners: [cornerOf(a), cornerOf(b)],
    wheel: wheelOf(a, b),
    weather: weather
      ? { element: weather, home: [a.element === weather, b.element === weather] }
      : null,
    turns,
    ending,
    figures,
  };
  let text: string | undefined;
  return {
    winner,
    figures,
    timeline,
    get playByPlay() {
      return (text ??= narrate(timeline));
    },
  };
}

// A tie carries nothing, so every tied turn of every fight shares this one.
const TIE = { kind: "tie" } as const;

function cornerOf(f: Fighter): Corner {
  return {
    name: f.name,
    element: f.element,
    halfStars: f.halfStars,
    health: f.maxHealth,
    claw: f.clawPerRoll,
    elemEdge: f.elemEdge,
    wxEdge: f.wxEdge,
    gassedOn: f.gassedOn,
  };
}

function wheelOf(a: Fighter, b: Fighter): 0 | 1 | null {
  if (ELEMENT_BEATS[a.element] === b.element) return 0;
  if (ELEMENT_BEATS[b.element] === a.element) return 1;
  return null;
}

/**
 * Neutral decision: a run loses, an empty health pool loses, otherwise the
 * deeper health pool wins at the bell (dead-even health = the judges flip). The
 * flip is the one draw here, and it is taken only on that last branch.
 */
function endingOf(a: Fighter, b: Fighter, rng: Rng): Ending {
  if (a.ran) return { kind: "ran", side: 0 };
  if (b.ran) return { kind: "ran", side: 1 };
  if (b.health <= 0) return { kind: "healthOut", side: 1 };
  if (a.health <= 0) return { kind: "healthOut", side: 0 };
  if (a.health !== b.health)
    return { kind: "bell", winner: a.health > b.health ? 0 : 1, coinFlip: false };
  return { kind: "bell", winner: rng() < 0.5 ? 0 : 1, coinFlip: true };
}

function turnRoll(
  self: Fighter,
  fmt: BladeFormat,
  rng: Rng
): { total: number; bonus: number; roll: Roll } {
  const dice = roll2d6(rng);

  // Condition — day-of-fight form, rolled fresh every turn. High condition
  // pins form near 100%; low condition means some turns arrive badly.
  const formFloor = BATTLE.WORST_FORM + BATTLE.FORM_RANGE * (self.stats.condition / STATS.MAX);
  const form = formFloor + rng() * (1 - formFloor);

  // The blade's weight matrix (round 27): every distance stat contributes on
  // every turn, blended by what THIS blade tests. Past the fuel wall the
  // bird's speed stats (agility/sight) deliver only WALL_FACTOR of
  // themselves; stamina and gameness never wall — the tank IS stamina's
  // mechanic, and grit is mental.
  const wall = self.gassedOn === null ? 1 : BATTLE.FUEL.WALL_FACTOR;
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

  // The wheel, then the weather — both judged at the scale (see `edges`).
  if (self.elemEdge !== null) total += self.elemEdge;
  if (self.wxEdge !== null) total += self.wxEdge;
  // Station — the rivalry stat: the outmatched bird claws back a station-
  // sized fraction of the gap on every roll (see the scale, above).
  if (self.clawPerRoll > 0) total += self.clawPerRoll * form * statScale;
  // Gameness holds a hurt bird's performance together late.
  const gameness = self.health < self.maxHealth * BATTLE.QUIT_HEALTH_FRACTION;
  if (gameness) total += ((self.stats.gameness * form) / BATTLE.GAMENESS_DIVISOR) * statScale;
  // `bonus` is everything except the dice — the Pit Figure's night term.
  return { total, bonus: total - dice[0] - dice[1], roll: { dice, gameness } };
}
