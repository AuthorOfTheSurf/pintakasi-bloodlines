import { db } from "@/db/client";
import { catchUp, parseLiveStart, type CatchUp } from "@/engine/live-clock";
import type { TickView } from "@/engine/game";

/**
 * The server side of the live clock (engine/live-clock.ts has the rule). One
 * env var turns it on: PINTAKASI_LIVE_START, the Manila date of day 0. Unset
 * means no clock at all, so `bun dev`, `bun dev:sim`, sims and tests behave
 * exactly as before.
 */
export function liveStart(): string | null {
  return process.env.PINTAKASI_LIVE_START?.trim() || null;
}

/** How often the server asks whether a day is due. A day turns at most a minute late. */
export const LIVE_CLOCK_INTERVAL_MS = 60_000;

// ⚠ ON globalThis, NOT A MODULE VARIABLE. Next bundles instrumentation.ts and
// each route separately, so a module-level flag would give the timer and
// POST /api/tick/live a flag each and guard nothing.
const guard = globalThis as typeof globalThis & {
  __pintakasiLiveClock?: { running: boolean; timer?: ReturnType<typeof setInterval> };
};
const state = (guard.__pintakasiLiveClock ??= { running: false });

function logTick(tick: TickView): void {
  const fights = tick.card.reduce((s, l) => s + l.fights.length, 0);
  const entered = tick.bots.reduce((s, b) => s + b.entered.length, 0);
  console.log(
    `[live-clock] day ${tick.clock.dayIndex} (${tick.clock.date}) ticked: ` +
      `${tick.bots.length} house stables entered ${entered}, ${fights} fights, ` +
      `staking paid ${tick.staking.paidGp.toFixed(2)} GP`
  );
}

export type LiveRun = { ran: false; reason: string } | ({ ran: true } & Omit<CatchUp, "ticks">);

/**
 * Run the catch-up unless one is already running. The tick is synchronous, so
 * two runs cannot interleave inside one process today; the flag is what keeps
 * that true if anything here ever starts awaiting between days.
 */
export function runLiveCatchUp(now: Date = new Date()): LiveRun {
  const start = liveStart();
  if (!start) return { ran: false, reason: "PINTAKASI_LIVE_START is not set; no live clock" };
  if (state.running) return { ran: false, reason: "a catch-up is already running" };
  state.running = true;
  try {
    const { ticks, ...rest } = catchUp(db(), start, now, logTick);
    if (ticks.length > 0)
      console.log(`[live-clock] caught up ${rest.from} -> ${rest.to} (target ${rest.target})`);
    return { ran: true, ...rest };
  } finally {
    state.running = false;
  }
}

/** Boot the timer once per process. Called from instrumentation.ts. */
export function startLiveClock(): void {
  const start = liveStart();
  if (!start || state.timer) return;
  parseLiveStart(start); // fail the boot on a malformed date, not the first tick
  const tick = () => {
    try {
      runLiveCatchUp();
    } catch (err) {
      // A failed day rolls back whole (one tick is one transaction), so the
      // next interval retries it from a clean world. Log, don't crash.
      console.error("[live-clock] catch-up failed:", err);
    }
  };
  console.log(`[live-clock] on: day 0 = ${start} (Manila), checking every 60 s`);
  tick();
  state.timer = setInterval(tick, LIVE_CLOCK_INTERVAL_MS);
}
