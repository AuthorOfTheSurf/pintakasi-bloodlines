import { FORMATS, type FightFormat } from "@/engine/config";
import type { FightTimeline, Side } from "@/engine/fight-timeline";
import { simulatePair, toCombatant } from "@/engine/fight-sim";
import type { BirdLook, FightReplay, Stable } from "@/engine/replay";
import { mulberry32 } from "@/engine/rng";

/**
 * ── THE EXHIBITION BOUT ─────────────────────────────────────────────────────
 *
 * The front page promises a fight on day 0, when the world has fought none.
 * So it stages one: two hand-built birds and a fixed seed, run through the
 * same pure `simulatePair` the archive replays, packaged in the shape
 * /api/fight/[id] returns. The viewer animates it unchanged, and nothing is
 * read from the database.
 *
 * It is a real fight under today's engine, not a recording. Retune a blade
 * and the exhibition changes with it, which is the point: it can never show a
 * rule the game no longer has. The cost is that a retune can also make it a
 * dull fight. exhibition.test.ts fails when that happens, and EXHIBITION_SEED
 * is the knob to turn.
 */

export const EXHIBITION_FORMAT: FightFormat = "b3";

/**
 * Chosen by scanning seeds 1..5000 under goodShow, then picking by eye: 11
 * exchanges, three Tari Strikes, the lead changing hands five times, and
 * Kidlat winning with 13 health left. Pit Figures finish 135 to 130.
 */
export const EXHIBITION_SEED = 111;

// Two roosters with opposite plans. Kidlat ("lightning") wins the break on
// agility and sight; Bagyo ("storm") is built to last on stamina and
// gameness. Neither is a real bird in any world.
const KIDLAT = {
  name: "Kidlat",
  agility: 1500,
  sight: 1400,
  stamina: 1000,
  gameness: 1050,
  station: 1100,
  condition: 1200,
  element: "Fire",
  halfStars: 6,
};
const BAGYO = {
  name: "Bagyo",
  agility: 1050,
  sight: 1150,
  stamina: 1500,
  gameness: 1450,
  station: 1200,
  condition: 1150,
  element: "Water",
  halfStars: 6,
};

const LOOKS: [BirdLook, BirdLook] = [
  { sex: "male", baseCoat: "Grey", trimColor: "Red" },
  { sex: "male", baseCoat: "Brown", trimColor: "Blue" },
];

const EXHIBITION_STABLE: Stable = {
  name: "Exhibition",
  primaryColor: "#e8b64c",
  secondaryColor: "#4a3520",
};

export type WatchableReplay = Extract<FightReplay, { drifted: false }>;

export function exhibitionBout(seed: number = EXHIBITION_SEED): WatchableReplay {
  const sim = simulatePair(
    toCombatant(KIDLAT),
    toCombatant(BAGYO),
    EXHIBITION_FORMAT,
    mulberry32(seed),
    `Exhibition · ${FORMATS[EXHIBITION_FORMAT].label}`
  );
  return {
    drifted: false,
    timeline: sim.timeline,
    playByPlay: sim.playByPlay,
    figures: sim.figures,
    // Nothing archived it, so the fight is its own record.
    archivedFigures: sim.figures,
    looks: LOOKS,
    stables: [EXHIBITION_STABLE, EXHIBITION_STABLE],
  };
}

/**
 * What makes a fight worth showing a stranger: it goes several exchanges,
 * both birds land blows, one of them is knocked out, and the winner is hurt
 * badly too. The exhibition seed must pass this; the test holds it to that.
 */
export function goodShow(t: FightTimeline): boolean {
  if (t.ending.kind !== "healthOut") return false;
  const winner: Side = t.ending.side === 0 ? 1 : 0;
  const hits = t.turns.flatMap((turn) => (turn.exchange.kind === "hit" ? [turn.exchange] : []));
  const landed = (side: Side) => hits.filter((h) => h.by === side).length;
  const winnerHits = hits.filter((h) => h.by !== winner);
  const winnerLeft = winnerHits.length
    ? winnerHits[winnerHits.length - 1].healthAfter
    : t.corners[winner].health;
  return (
    t.turns.length >= 6 &&
    landed(0) >= 3 &&
    landed(1) >= 3 &&
    winnerLeft <= t.corners[winner].health * 0.35
  );
}
