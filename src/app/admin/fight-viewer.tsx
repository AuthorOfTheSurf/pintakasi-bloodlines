"use client";

import { useEffect, useMemo, useReducer, type CSSProperties, type ReactNode } from "react";
import type { BirdLook, Stable } from "@/engine/replay";
import type { Corner, FightTimeline, Pair, Side } from "@/engine/fight-timeline";
import { reelOf, type Beat } from "./fight-reel";
import { BirdSprite, ElementSprite } from "./sprites";

/**
 * ── THE PIT: A FIGHT, WATCHED FROM THE RAIL (round 50) ─────────────────────
 *
 * A side view of the ring. This file decides what a beat LOOKS like and
 * nothing about how long it lasts: every duration below is a fraction of
 * `--beat`, the current beat's `ms` divided by the speed, so the pacing rule
 * stays in `fight-reel.ts` where it is tested.
 *
 * THERE IS NO FRAME LOOP. One timeout per beat moves the cursor, and the
 * motion is CSS keyframes on elements KEYED BY THE CURSOR: a new beat is a new
 * element, so its animation starts from zero without anyone resetting it. That
 * is also what makes the scrubber free, because landing on a beat cold and
 * arriving at it by playing are the same render.
 *
 * The health bars are the one thing NOT keyed. They persist across beats so a
 * width change is a transition from where the bar already was.
 */

interface Playback {
  readonly cursor: number;
  readonly playing: boolean;
  readonly speed: Speed;
}

const SPEEDS = [1, 2, 4] as const;
type Speed = (typeof SPEEDS)[number];

// `last` rides on the actions that need it rather than living in state: it is
// a fact about the reel, and a copy in state could disagree with the reel.
type Action =
  | { readonly type: "advance"; readonly last: number }
  | { readonly type: "toggle"; readonly last: number }
  | { readonly type: "seek"; readonly cursor: number }
  | { readonly type: "speed"; readonly speed: Speed }
  | { readonly type: "restart" };

function step(state: Playback, action: Action): Playback {
  switch (action.type) {
    case "advance":
      // The outro's timeout lands here too. It parks the reel instead of
      // wrapping, so the result stays on screen until somebody asks again.
      if (state.cursor >= action.last) return { ...state, playing: false };
      return { ...state, cursor: state.cursor + 1 };
    case "toggle":
      // Play on a finished reel means "again", not "resume at the end".
      if (!state.playing && state.cursor >= action.last)
        return { ...state, cursor: 0, playing: true };
      return { ...state, playing: !state.playing };
    case "seek":
      return { ...state, cursor: action.cursor };
    case "speed":
      return { ...state, speed: action.speed };
    case "restart":
      return { ...state, cursor: 0, playing: true };
  }
}

/** What one bird is doing during one beat. Exactly one, so it is a name and not a set of flags. */
type Act = "enter" | "lunge" | "flinch" | "circle" | "flee" | "drop" | "crow" | "stand";

function actOf(beat: Beat, side: Side): Act {
  if (beat.kind === "intro") return "enter";
  if (beat.kind === "turn") {
    if (beat.exchange.kind === "tie") return "circle";
    return beat.exchange.by === side ? "lunge" : "flinch";
  }
  const { ending } = beat;
  if (ending.kind === "ran" && ending.side === side) return "flee";
  if (ending.kind === "healthOut" && ending.side === side) return "drop";
  return beat.winner === side ? "crow" : "stand";
}

// The hit lands at about a third of the beat. The lunge peaks there, the
// flinch, the splat and the health bar all start there, so the four read as one
// blow even when a long gaff fight has squeezed the beat to a fraction of a second.
const ACT_ANIMATION: Record<Act, string | undefined> = {
  enter: "pit-enter calc(var(--beat) * 0.6) ease-out both",
  lunge: "pit-lunge var(--beat) ease-in-out both",
  flinch: "pit-flinch var(--beat) ease-out both",
  circle: "pit-circle var(--beat) ease-in-out both",
  flee: "pit-flee calc(var(--beat) * 0.45) ease-in both",
  drop: "pit-drop calc(var(--beat) * 0.3) ease-in both",
  // Held back until the result is on screen: a winner hopping before the
  // banner would give the fight away half a second early.
  crow: "pit-crow calc(var(--beat) * 0.4) ease-out calc(var(--beat) * 0.55) both",
  stand: undefined,
};

const KEYFRAMES = `
@keyframes pit-enter {
  from { transform: translateX(calc(var(--dir) * -30cqw)); opacity: 0; }
  to { transform: none; opacity: 1; }
}
@keyframes pit-lunge {
  0% { transform: none; }
  18% { transform: translateX(calc(var(--dir) * -10px)); }
  34% { transform: translate(calc(var(--dir) * (33cqw - 100px)), -14px); }
  48% { transform: translateX(calc(var(--dir) * (33cqw - 108px))); }
  100% { transform: none; }
}
@keyframes pit-flinch {
  0%, 33% { transform: none; filter: none; }
  40% { transform: translateX(calc(var(--dir) * -16px)) rotate(calc(var(--dir) * -10deg)); filter: brightness(2.4); }
  52% { transform: translateX(calc(var(--dir) * -10px)); filter: none; }
  70%, 100% { transform: none; filter: none; }
}
@keyframes pit-shake {
  0%, 58%, 100% { transform: none; }
  64%, 76%, 88% { transform: translateX(-4px); }
  70%, 82%, 94% { transform: translateX(4px); }
}
@keyframes pit-circle {
  0%, 100% { transform: none; }
  25% { transform: translate(calc(var(--dir) * 7cqw), -12px); }
  50% { transform: translate(calc(var(--dir) * 11cqw), 4px); }
  75% { transform: translate(calc(var(--dir) * 4cqw), 10px); }
}
@keyframes pit-flee {
  0% { transform: none; opacity: 1; }
  25% { transform: scaleX(-1); opacity: 1; }
  100% { transform: translateX(calc(var(--dir) * -45cqw)) scaleX(-1); opacity: 0; }
}
@keyframes pit-drop {
  0% { transform: none; }
  100% { transform: translateY(-30px) rotate(calc(var(--dir) * -90deg)); }
}
@keyframes pit-crow {
  0%, 50%, 100% { transform: none; }
  25% { transform: translateY(-18px); }
  75% { transform: translateY(-9px); }
}
@keyframes pit-splat {
  0%, 30% { transform: scale(0); opacity: 0; }
  36% { transform: scale(1.35); opacity: 1; }
  44% { transform: scale(1); opacity: 1; }
  100% { transform: translateY(-26px) scale(1); opacity: 1; }
}
@keyframes pit-blown {
  0%, 30%, 60% { opacity: 1; }
  15%, 45% { opacity: 0.15; }
  100% { opacity: 0; }
}
@keyframes pit-result {
  0%, 42% { opacity: 0; transform: translate(-50%, 8px); }
  52%, 100% { opacity: 1; transform: translate(-50%, 0); }
}
`;

const SPRITE_PX = 96;
const RING_HEIGHT = 262;
const FLOOR_HEIGHT = 78;
// Feet stand INSIDE the sand band, not on its top edge, or the birds read as
// perched on the pit wall.
const FEET_FROM_BOTTOM = 26;
const MONO = "ui-monospace, Menlo, monospace";

/** Where a bird stands, as a share of the ring's width. Side A left, side B right. */
const STANCE: Pair<string> = ["33.33%", "66.67%"];

const SPLAT_TONES = {
  hit: { fill: "#b3161b", ink: "#ffffff", px: 40 },
  crit: { fill: "#e8b64c", ink: "#ffffff", px: 58 },
  miss: { fill: "#2f6fd0", ink: "#ffffff", px: 34 },
} as const;
type SplatTone = keyof typeof SPLAT_TONES;

// A sixteen-point burst, alternating a long and a short radius. Built once
// from the rule instead of typed as thirty-two magic percentages.
const SPLAT_SHAPE = `polygon(${Array.from({ length: 16 }, (_, i) => {
  const radius = i % 2 === 0 ? 50 : 34;
  const angle = (i / 16) * Math.PI * 2;
  return `${(50 + radius * Math.sin(angle)).toFixed(1)}% ${(50 - radius * Math.cos(angle)).toFixed(1)}%`;
}).join(", ")})`;

function Splat({ tone, children }: { tone: SplatTone; children: ReactNode }) {
  const { fill, ink, px } = SPLAT_TONES[tone];
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: -px / 2,
        marginLeft: -px / 2,
        width: px,
        height: px,
        animation: "pit-splat var(--beat) ease-out both",
        zIndex: 3,
        // The dark rim lives on a filter because a clip-path would cut a border off.
        filter: "drop-shadow(0 2px 0 #1a1512) drop-shadow(0 -1px 0 #1a1512)",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          background: fill,
          clipPath: SPLAT_SHAPE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: ink,
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: px * 0.36,
          textShadow:
            "1px 1px 0 #1a1512, -1px 1px 0 #1a1512, 1px -1px 0 #1a1512, -1px -1px 0 #1a1512",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** The splat over this bird this beat, if it was the one struck. */
function splatFor(beat: Beat, side: Side): ReactNode {
  if (beat.kind !== "turn" || beat.exchange.kind !== "hit" || beat.exchange.by === side)
    return null;
  return <Splat tone={beat.exchange.crit ? "crit" : "hit"}>{beat.exchange.damage}</Splat>;
}

// A blow reads in two steps, the way a fighting game shows it. At the moment
// of impact the live bar SNAPS to the new health, and the stretch it just lost
// stays behind as a faded ghost: the size of the hit, readable at a glance.
// Then the ghost drains away. One bar sliding down says the same thing later
// and blurrier, because the eye has to wait for it to stop to know the damage.
const IMPACT = "calc(var(--beat) * 0.34)";
const BAR_SNAP = `width 0s linear ${IMPACT}, background-color 0s linear ${IMPACT}`;
// The ghost keeps the colour the bar WAS until it has finished draining, so a
// hit that tips the bar from green to amber fades out as green.
const GHOST_DRAIN =
  "width calc(var(--beat) * 0.3) ease-in calc(var(--beat) * 0.6), background-color 0s linear calc(var(--beat) * 0.9)";

function healthColor(share: number): string {
  if (share > 0.5) return "#6fbf73";
  if (share > 0.25) return "#e0b52c";
  return "#c93a26";
}

function Plate({
  corner,
  health,
  blown,
  side,
  drains,
  stable,
}: {
  corner: Corner;
  stable: Stable;
  health: number;
  blown: boolean;
  side: Side;
  /** A turn is on screen, so a change in width is a blow landing and is shown landing. */
  drains: boolean;
}) {
  const share = corner.health > 0 ? Math.max(0, Math.min(1, health / corner.health)) : 0;
  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        left: STANCE[side],
        width: "30%",
        minWidth: 150,
        transform: "translateX(-50%)",
        background: "#171410",
        border: "2px solid #3a342a",
        padding: "4px 6px 5px",
        fontFamily: MONO,
        fontSize: 11.5,
        color: "#e8e0d0",
        zIndex: 2,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
        <ElementSprite element={corner.element} size={14} />
        <b style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{corner.name}</b>
        <span style={{ color: "#e8b64c", marginLeft: "auto" }}>{corner.halfStars / 2}★</span>
      </div>
      <div
        className="farm-chip"
        style={{ marginTop: 2, color: "#b8ad96", overflow: "hidden", textOverflow: "ellipsis" }}
      >
        <span
          className="dot"
          style={{ background: stable.primaryColor, borderColor: stable.secondaryColor }}
        />
        {stable.name}
      </div>
      <div
        style={{
          marginTop: 4,
          position: "relative",
          height: 10,
          background: "#2a251d",
          border: "1px solid #0f0d0a",
        }}
      >
        {/* The ghost sits UNDER the live bar and is the same width at rest, so
            it only shows as the stretch the live bar has just given up. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${share * 100}%`,
            background: healthColor(share),
            opacity: 0.55,
            transition: drains ? GHOST_DRAIN : "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${share * 100}%`,
            background: healthColor(share),
            // Waits for the blow, so the bar moves WITH the splat. Off a turn
            // both layers jump: a restart that refilled the bar on the same
            // delay left a red bar under "health 100/100" for most of a second.
            transition: drains ? BAR_SNAP : "none",
          }}
        />
      </div>
      <div style={{ marginTop: 2, display: "flex", color: "#9a8f78" }}>
        <span>
          health {health}/{corner.health}
        </span>
        {blown ? <span style={{ marginLeft: "auto", color: "#c86a5a" }}>BLOWN</span> : null}
      </div>
    </div>
  );
}

function Bird({
  beat,
  cursor,
  side,
  look,
}: {
  beat: Beat;
  cursor: number;
  side: Side;
  look: BirdLook;
}) {
  const stood = beat.kind === "turn" && beat.exchange.kind === "hit" && beat.exchange.stood;
  const struck = actOf(beat, side) === "flinch";
  const blewNow = beat.kind === "turn" && beat.blewNow[side];
  const dimmed = beat.after.blown[side] && beat.kind !== "outro";
  // Side A walks right toward its opponent, side B walks left. Every keyframe
  // multiplies by this, so there is one set of motions and not a mirrored pair.
  const dir = side === 0 ? 1 : -1;
  return (
    <div
      style={
        {
          position: "absolute",
          left: STANCE[side],
          bottom: FEET_FROM_BOTTOM,
          width: SPRITE_PX,
          height: SPRITE_PX,
          marginLeft: -SPRITE_PX / 2,
          "--dir": dir,
        } as CSSProperties
      }
    >
      <div
        key={`act-${cursor}`}
        style={{
          width: "100%",
          height: "100%",
          transformOrigin: "50% 100%",
          animation: ACT_ANIMATION[actOf(beat, side)],
        }}
      >
        {/* The shake is its own layer: two animations on one element would
            fight over `transform`, and the flinch would lose. */}
        <div
          style={{
            animation: stood && struck ? "pit-shake var(--beat) linear both" : undefined,
          }}
        >
          <div
            style={{
              // BirdSprite draws facing right, so only side B is turned around.
              transform: side === 1 ? "scaleX(-1)" : undefined,
              // Dimmed, not ghosted: a gaff fight spends most of its length with
              // both birds blown, and the hit flash still has to read through it.
              // Lifted for the outro, where a grey bird reads as the beaten one
              // and the winner of a long fight is usually blown too.
              opacity: dimmed ? 0.72 : 1,
              filter: dimmed ? "grayscale(0.5)" : undefined,
              transition: "opacity 200ms linear, filter 200ms linear",
            }}
          >
            <BirdSprite {...look} size={SPRITE_PX} />
          </div>
        </div>
      </div>
      <div key={`fx-${cursor}`}>
        {splatFor(beat, side)}
        {blewNow ? (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: -30,
              transform: "translateX(-50%)",
              padding: "1px 6px",
              background: "#1a1512",
              border: "2px solid #c86a5a",
              color: "#f0b0a0",
              fontFamily: MONO,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1,
              animation: "pit-blown var(--beat) linear both",
              zIndex: 4,
            }}
          >
            BLOWN
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Result({
  beat,
  corners,
}: {
  beat: Extract<Beat, { kind: "outro" }>;
  corners: Pair<Corner>;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: 94,
        padding: "6px 14px",
        background: "#171410",
        border: "2px solid #e8b64c",
        color: "#e8e0d0",
        fontFamily: MONO,
        textAlign: "center",
        whiteSpace: "nowrap",
        animation: "pit-result var(--beat) ease-out both",
        zIndex: 5,
      }}
    >
      <div style={{ color: "#e8b64c", fontWeight: 700, fontSize: 15 }}>
        {corners[beat.winner].name} WINS
      </div>
      <div style={{ fontSize: 11.5, marginTop: 2 }}>
        Pit Figures · {corners[0].name} <b>{beat.figures[0]}</b> · {corners[1].name}{" "}
        <b>{beat.figures[1]}</b>
      </div>
    </div>
  );
}

/** Where the reel is, in words that never say who is ahead. */
function beatLabel(beat: Beat): string {
  if (beat.kind === "intro") return "the scale";
  if (beat.kind === "turn") return `T${beat.n} · ${beat.phase}`;
  return "the call";
}

const BUTTON: CSSProperties = {
  fontFamily: MONO,
  fontSize: 12,
  padding: "3px 9px",
  background: "#171410",
  color: "#e8e0d0",
  border: "2px solid #3a342a",
  borderRadius: 0,
  cursor: "pointer",
};
// `border` whole, not `borderColor`: React warns when a rerender swaps a
// shorthand for one of its longhands on the same element.
const BUTTON_ON: CSSProperties = { ...BUTTON, border: "2px solid #e8b64c", color: "#e8b64c" };

export function FightViewer({
  timeline,
  looks,
  stables,
}: {
  timeline: FightTimeline;
  looks: Pair<BirdLook>;
  stables: Pair<Stable>;
}) {
  const reel = useMemo(() => reelOf(timeline), [timeline]);
  const last = reel.beats.length - 1;
  const [{ cursor, playing, speed }, dispatch] = useReducer(step, {
    cursor: 0,
    playing: true,
    speed: 1,
  });
  const beat = reel.beats[cursor];
  const beatMs = beat.ms / speed;

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => dispatch({ type: "advance", last }), beatMs);
    return () => clearTimeout(timer);
  }, [cursor, playing, beatMs, last]);

  const tie = beat.kind === "turn" && beat.exchange.kind === "tie";
  return (
    <div style={{ maxWidth: 760, margin: "0 0 .6rem", "--beat": `${beatMs}ms` } as CSSProperties}>
      <style>{KEYFRAMES}</style>
      <div
        style={{
          position: "relative",
          height: RING_HEIGHT,
          overflow: "hidden",
          border: "2px solid #3a342a",
          // `cqw` in the keyframes is a share of THIS box, which is what lets a
          // lunge reach the other bird at any panel width.
          containerType: "inline-size",
          // Back wall, the pit's board rail, then sand. Hard stops, no blends:
          // the sprites are sixteen pixels wide and a soft gradient beside
          // them looks like a different game.
          background: `linear-gradient(to top,
            #b8965a 0, #b8965a 10px,
            #c9a868 10px, #c9a868 ${FLOOR_HEIGHT - 6}px,
            #d8b97a ${FLOOR_HEIGHT - 6}px, #d8b97a ${FLOOR_HEIGHT}px,
            #4a3520 ${FLOOR_HEIGHT}px, #4a3520 ${FLOOR_HEIGHT + 4}px,
            #6b4c2a ${FLOOR_HEIGHT + 4}px, #6b4c2a ${FLOOR_HEIGHT + 22}px,
            #4a3520 ${FLOOR_HEIGHT + 22}px, #4a3520 ${FLOOR_HEIGHT + 26}px,
            #1c1914 ${FLOOR_HEIGHT + 26}px)`,
        }}
      >
        <Plate
          corner={timeline.corners[0]}
          health={beat.after.health[0]}
          blown={beat.after.blown[0]}
          side={0}
          drains={beat.kind === "turn"}
          stable={stables[0]}
        />
        <Plate
          corner={timeline.corners[1]}
          health={beat.after.health[1]}
          blown={beat.after.blown[1]}
          side={1}
          drains={beat.kind === "turn"}
          stable={stables[1]}
        />
        <Bird beat={beat} cursor={cursor} side={0} look={looks[0]} />
        <Bird beat={beat} cursor={cursor} side={1} look={looks[1]} />
        {tie ? (
          <div
            key={`miss-${cursor}`}
            style={{
              position: "absolute",
              left: "50%",
              bottom: FEET_FROM_BOTTOM + SPRITE_PX - 10,
              width: 0,
              height: 0,
            }}
          >
            <Splat tone="miss">0</Splat>
          </div>
        ) : null}
        {beat.kind === "outro" ? (
          <Result key={`result-${cursor}`} beat={beat} corners={timeline.corners} />
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "6px 0" }}>
        <button style={BUTTON} onClick={() => dispatch({ type: "toggle", last })}>
          {playing ? "❚❚ pause" : "▶ play"}
        </button>
        <button style={BUTTON} onClick={() => dispatch({ type: "restart" })}>
          ⟲ restart
        </button>
        {SPEEDS.map((s) => (
          <button
            key={s}
            style={s === speed ? BUTTON_ON : BUTTON}
            aria-pressed={s === speed}
            onClick={() => dispatch({ type: "speed", speed: s })}
          >
            {s}×
          </button>
        ))}
        <input
          type="range"
          aria-label="Scrub through the fight"
          min={0}
          max={last}
          step={1}
          value={cursor}
          onChange={(e) => dispatch({ type: "seek", cursor: Number(e.target.value) })}
          style={{ flex: 1, accentColor: "#e8b64c" }}
        />
        <span
          style={{
            fontFamily: MONO,
            fontSize: 12,
            color: "#9a8f78",
            minWidth: 92,
            textAlign: "right",
          }}
        >
          {beatLabel(beat)}
        </span>
      </div>

      <div
        style={{
          // Tall enough for the longest intro, so the transcript below never
          // jumps as the captions change length.
          minHeight: 92,
          padding: ".4rem .6rem",
          background: "#1c1914",
          border: "1px solid #3a342a",
          color: "#e8e0d0",
          fontFamily: MONO,
          fontSize: 12.5,
          lineHeight: 1.45,
        }}
      >
        {beat.lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </div>
  );
}
