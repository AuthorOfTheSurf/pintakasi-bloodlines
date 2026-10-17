/**
 * Next runs register() once per server process at boot. The live clock lives
 * here because it must run whether or not anyone visits the site.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.PINTAKASI_LIVE_START) return;
  // Lazy because the clock pulls in SQLite and the engine, which the edge
  // runtime cannot load; only the nodejs branch may import it.
  const { startLiveClock } = await import("./app/live-clock");
  startLiveClock();
}
