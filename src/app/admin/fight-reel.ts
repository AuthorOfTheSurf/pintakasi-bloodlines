import {
  otherSide,
  phaseOf,
  transcriptOf,
  winnerOf,
  type Ending,
  type Exchange,
  type FightTimeline,
  type Pair,
  type Side,
  type Turn,
} from "@/engine/fight-timeline";

/**
 * ── THE REEL: A FIGHT, CUT FOR PLAYBACK (round 50) ─────────────────────────
 *
 * A timeline says what happened. A reel says what is on screen at each step
 * and for how long. It is the one place the viewer's pacing lives, and it is
 * pure — no React, no clock — so the rule can be tested over real fights
 * instead of judged by watching forty of them.
 *
 * THE PACING RULE (ruled with the viewer): a fight should take roughly 10 to
 * 40 seconds to watch whatever its blade. A B1 knife is decided in at most 5
 * turns and a B5 gaff can go 45, so a fixed time per turn would make one a
 * blink and the other three minutes. Instead a turn gets `TURN_MS` unless
 * that would run the fight past `MAX_MS`, in which case the turns share what
 * is left. Short fights are NOT stretched to a floor: a one-turn knockout
 * held on screen for five seconds reads as a frozen page, so it simply ends
 * sooner.
 *
 * THE REEL IS BOOKENDED: title, intro, the turns, outro, summary. The title
 * card puts the game's name up before either bird is in the ring, and the
 * summary is where a finished fight comes to rest, so the last thing on screen
 * is what happened and not just who won. All four bookends are fixed lengths
 * and count against the ceiling, which leaves the turns what is left of it.
 *
 * The speed control is not here. It divides wall clock in the viewer; it
 * never rebuilds the reel, so these numbers are the whole rule.
 */
export const PACING = {
  /** The ceiling at 1×. Long gaff fights compress their turns to fit under it. */
  MAX_MS: 40_000,
  /** The game's name and the card, alone in the ring. Long enough to read, short enough to sit through forty times. */
  TITLE_MS: 1_400,
  /** Both birds walk in; the wheel, the weather and the underdog are read out. */
  INTRO_MS: 2_000,
  /** The ending plays, then the winner's name. The figures moved to the summary, so this is shorter than it was. */
  OUTRO_MS: 2_400,
  /**
   * The recap card fading in. The reel parks on its last beat, so this times
   * the fade and nothing else: the card stays up until somebody asks again.
   */
  SUMMARY_MS: 1_200,
  /** What one exchange gets when nothing compresses it. */
  TURN_MS: 1_600,
} as const;

/** What the pit looks like once a beat has finished — enough to draw any beat cold. */
export interface PitState {
  readonly health: Pair<number>;
  readonly blown: Pair<boolean>;
}

/**
 * One step of playback. `lines` are the transcript lines this beat reveals,
 * straight from the narrator in its PLAIN voice: the same lines the
 * play-by-play prints, minus the dice and bonuses beside each exchange. The
 * steward's record keeps the arithmetic; the picture does not show it.
 *
 * THE RESULT LIVES ON THE LAST TWO BEATS, the outro and the summary, and on
 * nothing before them. A viewer that must not spoil a fight plays from beat 0
 * and has nothing to hide until the outro.
 *
 * The title and the summary reveal no lines. Every transcript line is already
 * spoken once by the intro, the turns and the outro, and the summary's own
 * sentence is a field, not a caption, so it is never printed twice.
 */
export type Beat = {
  readonly ms: number;
  readonly lines: readonly string[];
  readonly after: PitState;
} & (
  | { readonly kind: "title" }
  | { readonly kind: "intro" }
  | {
      readonly kind: "turn";
      readonly n: number;
      readonly phase: ReturnType<typeof phaseOf>;
      readonly exchange: Exchange;
      /** Whose tank emptied on THIS turn — the one-off flash, not the standing state. */
      readonly blewNow: Pair<boolean>;
    }
  | {
      readonly kind: "outro";
      readonly ending: Ending;
      readonly winner: Side;
    }
  | {
      readonly kind: "summary";
      readonly ending: Ending;
      readonly winner: Side;
      readonly figures: Pair<number>;
      readonly tally: Pair<Tally>;
      /**
       * How it ended, in the narrator's words: the first line of the close.
       * Carried here so the card never grows a second way of saying "ran".
       */
      readonly headline: string;
    }
);

/** One bird's fight, counted. Everything here is read off the exchanges, so it cannot disagree with them. */
export interface Tally {
  /** Exchanges this bird won. */
  readonly hits: number;
  /**
   * Health it took off the other bird, as the blade dealt it. The last blow of
   * a damage race usually overshoots an almost-empty bar, so this can be more
   * than the bar lost.
   */
  readonly damage: number;
  /** Hits that were Tari Strikes. */
  readonly tari: number;
  /** Its largest single hit, 0 if it never landed one. */
  readonly biggest: number;
}

function tallyFor(turns: readonly Turn[], side: Side): Tally {
  const landed = turns.flatMap(({ exchange }) =>
    exchange.kind === "hit" && exchange.by === side ? [exchange] : []
  );
  return {
    hits: landed.length,
    damage: landed.reduce((sum, hit) => sum + hit.damage, 0),
    tari: landed.filter((hit) => hit.crit).length,
    biggest: landed.reduce((most, hit) => Math.max(most, hit.damage), 0),
  };
}

export function tallyOf(turns: readonly Turn[]): Pair<Tally> {
  return [tallyFor(turns, 0), tallyFor(turns, 1)];
}

export interface Reel {
  /** title, intro, one beat per fought turn, outro, summary — so never empty. */
  readonly beats: readonly Beat[];
  /** The whole fight at 1×. */
  readonly totalMs: number;
}

export function reelOf(t: FightTimeline): Reel {
  const transcript = transcriptOf(t, "plain");
  const fixed = PACING.TITLE_MS + PACING.INTRO_MS + PACING.OUTRO_MS + PACING.SUMMARY_MS;
  const turnMs = Math.min(PACING.TURN_MS, (PACING.MAX_MS - fixed) / Math.max(1, t.turns.length));

  let pit: PitState = {
    health: [t.corners[0].health, t.corners[1].health],
    blown: [false, false],
  };
  const beats: Beat[] = [
    { kind: "title", ms: PACING.TITLE_MS, lines: [], after: pit },
    { kind: "intro", ms: PACING.INTRO_MS, lines: transcript.opening, after: pit },
  ];

  t.turns.forEach((turn, i) => {
    const n = i + 1;
    const blewNow = [t.corners[0].blownOn === n, t.corners[1].blownOn === n] as const;
    pit = {
      health: healthAfter(pit.health, turn.exchange),
      blown: [pit.blown[0] || blewNow[0], pit.blown[1] || blewNow[1]],
    };
    beats.push({
      kind: "turn",
      ms: turnMs,
      lines: transcript.turns[i],
      after: pit,
      n,
      phase: phaseOf(n),
      exchange: turn.exchange,
      blewNow,
    });
  });

  beats.push({
    kind: "outro",
    ms: PACING.OUTRO_MS,
    lines: transcript.close,
    after: pit,
    ending: t.ending,
    winner: winnerOf(t.ending),
  });
  beats.push({
    kind: "summary",
    ms: PACING.SUMMARY_MS,
    lines: [],
    after: pit,
    ending: t.ending,
    winner: winnerOf(t.ending),
    figures: t.figures,
    tally: tallyOf(t.turns),
    headline: transcript.close[0],
  });
  return { beats, totalMs: fixed + turnMs * t.turns.length };
}

function healthAfter(health: Pair<number>, exchange: Exchange): Pair<number> {
  if (exchange.kind === "tie") return health;
  const struck = otherSide(exchange.by);
  return struck === 0 ? [exchange.healthAfter, health[1]] : [health[0], exchange.healthAfter];
}
