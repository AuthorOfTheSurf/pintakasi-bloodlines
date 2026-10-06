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
 * The speed control is not here. It divides wall clock in the viewer; it
 * never rebuilds the reel, so these numbers are the whole rule.
 */
export const PACING = {
  /** The ceiling at 1×. Long gaff fights compress their turns to fit under it. */
  MAX_MS: 40_000,
  /** Both birds walk in; the wheel, the weather and the underdog are read out. */
  INTRO_MS: 2_000,
  /** The ending plays, then the winner and both Pit Figures. */
  OUTRO_MS: 3_000,
  /** What one exchange gets when nothing compresses it. */
  TURN_MS: 1_600,
} as const;

/** What the pit looks like once a beat has finished — enough to draw any beat cold. */
export interface PitState {
  readonly wind: Pair<number>;
  readonly blown: Pair<boolean>;
}

/**
 * One step of playback. `lines` are the transcript lines this beat reveals,
 * straight from the narrator, so a caption under the picture is the same
 * string the play-by-play prints.
 *
 * ONLY THE OUTRO CARRIES THE RESULT. A viewer that must not spoil a fight
 * plays from beat 0 and has nothing to hide until the last one.
 */
export type Beat = {
  readonly ms: number;
  readonly lines: readonly string[];
  readonly after: PitState;
} & (
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
      readonly figures: Pair<number>;
    }
);

export interface Reel {
  /** intro, one beat per fought turn, outro — so never empty. */
  readonly beats: readonly Beat[];
  /** The whole fight at 1×. */
  readonly totalMs: number;
}

export function reelOf(t: FightTimeline): Reel {
  const transcript = transcriptOf(t);
  const fixed = PACING.INTRO_MS + PACING.OUTRO_MS;
  const turnMs = Math.min(PACING.TURN_MS, (PACING.MAX_MS - fixed) / Math.max(1, t.turns.length));

  let pit: PitState = {
    wind: [t.corners[0].wind, t.corners[1].wind],
    blown: [false, false],
  };
  const beats: Beat[] = [
    { kind: "intro", ms: PACING.INTRO_MS, lines: transcript.opening, after: pit },
  ];

  t.turns.forEach((turn, i) => {
    const n = i + 1;
    const blewNow = [t.corners[0].blownOn === n, t.corners[1].blownOn === n] as const;
    pit = {
      wind: windAfter(pit.wind, turn.exchange),
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
    figures: t.figures,
  });
  return { beats, totalMs: fixed + turnMs * t.turns.length };
}

function windAfter(wind: Pair<number>, exchange: Exchange): Pair<number> {
  if (exchange.kind === "tie") return wind;
  const struck = otherSide(exchange.by);
  return struck === 0 ? [exchange.windAfter, wind[1]] : [wind[0], exchange.windAfter];
}
