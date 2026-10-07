"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useReducer,
  type CSSProperties,
  type ReactNode,
} from "react";
import { FORMATS } from "@/engine/config";
import type { BirdLook, Stable } from "@/engine/replay";
import type { Corner, FightTimeline, Pair, Side } from "@/engine/fight-timeline";
import { reelOf, type Beat } from "./fight-reel";
import { BirdSprite, ElementSprite } from "./sprites";

/**
 * ── THE PIT: A FIGHT, WATCHED FROM THE RAIL (round 65) ─────────────────────
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
 *
 * THE FIRST AND LAST BEATS ARE CARDS, NOT ACTION. The title beat is the game's
 * name alone in the ring, with no bird and no plate, so the walk-in on the next
 * beat is the first time anyone sees them. The summary beat is where the reel
 * comes to rest: the birds hold the pose the outro left them in and a recap
 * card sits over the ring. Neither card shows a die or a roll total. The owner
 * ruled those out of the picture, so the card counts blows and health.
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
      // The summary's timeout lands here too. It parks the reel instead of
      // wrapping, so the recap stays on screen until somebody asks again.
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

/** A beat with birds in the ring, which is every beat but the title card. */
type Staged = Exclude<Beat, { kind: "title" }>;

// The summary names the SAME act as the outro, on purpose: the recap has to
// show where the ending left each bird, and a second answer here could put a
// bird that ran back on its feet.
function actOf(beat: Staged, side: Side): Act {
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
@keyframes pit-gassed {
  0%, 30%, 60% { opacity: 1; }
  15%, 45% { opacity: 0.15; }
  100% { opacity: 0; }
}
@keyframes pit-title {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}
@keyframes pit-fade {
  from { opacity: 0; }
  to { opacity: 1; }
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

const SIDES: Pair<Side> = [0, 1];

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
function splatFor(beat: Staged, side: Side): ReactNode {
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
  gassed,
  side,
  drains,
  enters,
  stable,
}: {
  corner: Corner;
  stable: Stable;
  health: number;
  gassed: boolean;
  side: Side;
  /** A turn is on screen, so a change in width is a blow landing and is shown landing. */
  drains: boolean;
  /** The birds are walking in, so the plates arrive with them instead of popping. */
  enters: boolean;
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
        // Opacity only. The plate is centred with a transform, and a keyframe
        // that set one would knock it off its mark for the length of the fade.
        animation: enters ? "pit-fade calc(var(--beat) * 0.3) ease-out both" : undefined,
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
        {gassed ? <span style={{ marginLeft: "auto", color: "#c86a5a" }}>GASSED</span> : null}
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
  beat: Staged;
  cursor: number;
  side: Side;
  look: BirdLook;
}) {
  const stood = beat.kind === "turn" && beat.exchange.kind === "hit" && beat.exchange.stood;
  const struck = actOf(beat, side) === "flinch";
  const gassedNow = beat.kind === "turn" && beat.gassedNow[side];
  const called = beat.kind === "outro" || beat.kind === "summary";
  const dimmed = beat.after.gassed[side] && !called;
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
        style={
          {
            width: "100%",
            height: "100%",
            transformOrigin: "50% 100%",
            animation: ACT_ANIMATION[actOf(beat, side)],
            // The summary shows the END of the outro's act without playing it
            // again. Every act is timed in `--beat` and fills both ways, so a
            // beat of no length lands it on its last frame at once: a bird
            // that ran stays gone, a bird that dropped stays down. That is one
            // override instead of a second table of resting poses that would
            // have to be kept in step with the keyframes.
            "--beat": beat.kind === "summary" ? "0ms" : undefined,
          } as CSSProperties
        }
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
              // both birds gassed, and the hit flash still has to read through it.
              // Lifted once the fight is called, where a grey bird reads as the
              // beaten one and the winner of a long fight is usually gassed too.
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
        {gassedNow ? (
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
              animation: "pit-gassed var(--beat) linear both",
              zIndex: 4,
            }}
          >
            GASSED
          </div>
        ) : null}
      </div>
    </div>
  );
}

const GOLD = "#e8b64c";

function Title({ timeline }: { timeline: FightTimeline }) {
  const blade = FORMATS[timeline.format].label;
  // Every card the archive replays already ends in its blade ("OPEN · B1"),
  // and the header is the caller's to word, so the blade is added only when
  // the header left it out. Printed blind it read "OPEN · B1 · B1".
  const card = timeline.header.includes(blade) ? timeline.header : `${timeline.header} · ${blade}`;
  // Letter-spacing trails every letter, the last one too, which pushes a
  // centred word left by half a gap. The same indent on the left squares it.
  const spaced = (gap: string): CSSProperties => ({ letterSpacing: gap, paddingLeft: gap });
  // Three lines, each a little after the one above, so the name is read
  // before the card. They rise and STAY: a splash that faded out again would
  // leave an empty ring under a paused scrubber.
  const rise = (delay: number): CSSProperties => ({
    animation: `pit-title calc(var(--beat) * 0.3) ease-out calc(var(--beat) * ${delay}) both`,
  });
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 16px",
        background: "#171410",
        color: GOLD,
        fontFamily: MONO,
        textAlign: "center",
        zIndex: 5,
      }}
    >
      {/* Sized off the ring, so the name fills a narrow panel instead of spilling out of it. */}
      <div
        style={{
          fontSize: "min(46px, 9cqw)",
          fontWeight: 700,
          ...spaced("0.18em"),
          ...rise(0),
        }}
      >
        PINTAKASI
      </div>
      <div style={{ fontSize: "min(18px, 3.6cqw)", ...spaced("0.6em"), ...rise(0.15) }}>
        BLOODLINES
      </div>
      <div style={{ marginTop: 16, fontSize: 12, color: "#b8ad96", ...rise(0.35) }}>{card}</div>
    </div>
  );
}

function Result({ name }: { name: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: 94,
        padding: "6px 14px",
        background: "#171410",
        border: `2px solid ${GOLD}`,
        color: GOLD,
        fontFamily: MONO,
        fontWeight: 700,
        fontSize: 15,
        textAlign: "center",
        whiteSpace: "nowrap",
        animation: "pit-result var(--beat) ease-out both",
        zIndex: 5,
      }}
    >
      {name} WINS
    </div>
  );
}

const TALLY_CELL: CSSProperties = { padding: "0 4px", textAlign: "right", fontWeight: 400 };
const TALLY_NAME: CSSProperties = {
  ...TALLY_CELL,
  fontWeight: 700,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function Summary({
  beat,
  timeline,
}: {
  beat: Extract<Beat, { kind: "summary" }>;
  timeline: FightTimeline;
}) {
  const { corners } = timeline;
  const perBird = (cell: (side: Side) => ReactNode): Pair<ReactNode> => [cell(0), cell(1)];
  const rows: readonly (readonly [string, Pair<ReactNode>])[] = [
    ["hits landed", perBird((side) => beat.tally[side].hits)],
    ["damage dealt", perBird((side) => beat.tally[side].damage)],
    ["Tari Strikes", perBird((side) => beat.tally[side].tari)],
    ["biggest hit", perBird((side) => beat.tally[side].biggest)],
    ["health left", perBird((side) => `${beat.after.health[side]}/${corners[side].health}`)],
    ["Pit Figure", perBird((side) => beat.figures[side])],
  ];
  return (
    <div
      style={{
        position: "absolute",
        top: 4,
        // Centred by margins, not a transform, so the fade can be the same
        // opacity-only keyframe the plates use.
        left: 0,
        right: 0,
        margin: "0 auto",
        // As wide as the two plates together, and solid, so it REPLACES them.
        // The card repeats what they say, and a narrower or see-through one
        // left their names and bars poking out from behind the tally.
        width: "min(max(66%, 340px), calc(100% - 16px))",
        boxSizing: "border-box",
        padding: "3px 8px 4px",
        background: "#171410",
        border: `2px solid ${GOLD}`,
        color: "#e8e0d0",
        fontFamily: MONO,
        fontSize: 11,
        // Tight on purpose. Every line here is a line lower the card reaches,
        // and it has to stop above the head of the bird left standing.
        lineHeight: "13px",
        textAlign: "center",
        animation: "pit-fade calc(var(--beat) * 0.6) ease-out both",
        zIndex: 5,
      }}
    >
      <div style={{ color: GOLD, fontWeight: 700, fontSize: 14, lineHeight: "17px" }}>
        {corners[beat.winner].name} WINS
      </div>
      <div>{beat.headline}</div>
      <table
        style={{
          width: "100%",
          margin: "3px 0 0",
          borderCollapse: "collapse",
          // Fixed, so a long name is cut with an ellipsis instead of pushing
          // the other bird's column out of the card.
          tableLayout: "fixed",
        }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid #3a342a" }}>
            <td style={{ ...TALLY_CELL, width: "34%", textAlign: "left", color: "#9a8f78" }}>
              {timeline.turns.length} of {FORMATS[timeline.format].maxTurns} turns
            </td>
            {corners.map((corner, side) => (
              <th
                key={side}
                scope="col"
                style={{ ...TALLY_NAME, color: side === beat.winner ? GOLD : "#e8e0d0" }}
              >
                {corner.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, cells]) => (
            <tr key={label}>
              <th scope="row" style={{ ...TALLY_CELL, textAlign: "left", color: "#9a8f78" }}>
                {label}
              </th>
              <td style={TALLY_CELL}>{cells[0]}</td>
              <td style={TALLY_CELL}>{cells[1]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Where the reel is, in words that never say who is ahead. */
function beatLabel(beat: Beat): string {
  switch (beat.kind) {
    case "title":
      return "the bill";
    case "intro":
      return "the scale";
    case "turn":
      return `T${beat.n} · ${beat.phase}`;
    case "outro":
      return "the call";
    case "summary":
      return "the tally";
  }
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
const BUTTON_ON: CSSProperties = { ...BUTTON, border: `2px solid ${GOLD}`, color: GOLD };

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
        {beat.kind === "title" ? (
          <Title timeline={timeline} />
        ) : (
          // One branch for every staged beat, so the plates stay mounted from
          // the walk-in to the tally and their bars keep transitioning.
          SIDES.map((side) => (
            <Fragment key={side}>
              <Plate
                corner={timeline.corners[side]}
                health={beat.after.health[side]}
                gassed={beat.after.gassed[side]}
                side={side}
                drains={beat.kind === "turn"}
                enters={beat.kind === "intro"}
                stable={stables[side]}
              />
              <Bird beat={beat} cursor={cursor} side={side} look={looks[side]} />
            </Fragment>
          ))
        )}
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
          <Result key={`result-${cursor}`} name={timeline.corners[beat.winner].name} />
        ) : null}
        {beat.kind === "summary" ? <Summary beat={beat} timeline={timeline} /> : null}
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
