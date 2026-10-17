import type { DB } from "@/db/client";
import { DEV_FARM_ID } from "@/db/seed-data";
import { Game, type TickView } from "./game";
import { GameClock } from "./game-clock";

/**
 * THE LIVE CLOCK (alpha-1, 2026-10). A sim world turns when someone presses a
 * button; the live world turns once per real day, at midnight UTC. The owner
 * ruled UTC over Manila midnight (2026-10-16): it is 8:00 in the morning in
 * the Philippines, which suits the owner, and one UTC clock is simpler than an
 * offset.
 *
 * ⚠ THE TARGET IS A PURE FUNCTION OF NOW, never "one tick per timer fire".
 * A timer that ticks when it fires double-ticks after a restart and skips
 * days across downtime. Asking "which day should it be?" and ticking until
 * the world gets there makes a restart, an outage, a second trigger or a
 * manual nudge all converge on the same world: missed days run back to back,
 * in order, and a world already on its target does nothing.
 */

const DAY_MS = 86_400_000;

/**
 * The hour the live day turns, on a Philippine clock: UTC midnight is 08:00 in
 * Manila, which is UTC+8 all year with no daylight saving. The clock itself
 * never reads this; it exists so player-facing copy can name the hour, and the
 * tests pin it to the clock's real boundary.
 */
export const DAY_TURNS_PH_HOUR = 8;

/**
 * Parse PINTAKASI_LIVE_START: the UTC calendar date of day 0. Returns the
 * date as a UTC-midnight timestamp, the unit `liveTargetDay` counts from.
 * Throws on anything that is not a real YYYY-MM-DD date, because a typo here
 * would otherwise tick a world years forward on boot.
 */
export function parseLiveStart(value: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) throw new Error(`PINTAKASI_LIVE_START must be YYYY-MM-DD, got "${value}"`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const ms = Date.UTC(y, mo, d);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo || back.getUTCDate() !== d)
    throw new Error(`PINTAKASI_LIVE_START is not a calendar date: "${value}"`);
  return ms;
}

/**
 * The dayIndex the world should be on at `now`: how many UTC midnights have
 * passed since the start date began. Day 0 runs through the start date and
 * ends at the first midnight. Never negative, so a start date in the future
 * holds the world at day 0 rather than erroring.
 */
export function liveTargetDay(start: string, now: Date): number {
  const elapsed = now.getTime() - parseLiveStart(start);
  return Math.max(0, Math.floor(elapsed / DAY_MS));
}

/**
 * One live day: the bots play, the card goes off, staking pays, and nobody
 * else is touched. The tick deliberately skips `playAllHonestDays` and passes
 * `players: "hands-off"`, so a real player's farm only changes the way any
 * tick changes it (hatching, settling its own entries, its staking share).
 *
 * The Game's farm id only decides whose hatches the report lists; the tick
 * itself is world-wide.
 */
export function liveTickDay(db: DB): TickView {
  return new Game(db, DEV_FARM_ID).tickDay({ players: "hands-off" });
}

export interface CatchUp {
  from: number;
  to: number;
  target: number;
  ticks: TickView[];
}

/**
 * Tick until the world reaches the day `now` calls for. Re-reads the world's
 * day before every tick, so it is safe to call as often as anyone likes.
 * `onTick` is the caller's hook for logging each day as it lands.
 */
export function catchUp(
  db: DB,
  start: string,
  now: Date,
  onTick?: (tick: TickView) => void
): CatchUp {
  const target = liveTargetDay(start, now);
  const clock = new GameClock(db);
  const from = clock.currentDay();
  const ticks: TickView[] = [];
  while (clock.currentDay() < target) {
    const tick = liveTickDay(db);
    ticks.push(tick);
    onTick?.(tick);
  }
  return { from, to: clock.currentDay(), target, ticks };
}
