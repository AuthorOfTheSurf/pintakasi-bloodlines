/**
 * ── THE REWARD DEMO (stagecraft#1) ─────────────────────────────────────────
 *
 * Ten barns on a real local rivet-engine, defined via stagecraft, taking
 * turns on a loop — watched live on the stagecraft panel: activity rows per
 * barn, Sentry-style issue grouping when a brain misbehaves, the failure
 * feed streaming.
 *
 *   bun scripts/stagecraft-panel-demo.ts
 *   → open http://localhost:4949
 *
 * The deciders are fakes (no Ollama): each barn thinks for a random
 * 200–1500ms; one barn is a chronic failer (typed TurnFailed — shows as a
 * declared error, NOT an issue) and one gets malformed views from its "sim"
 * (undeclared crash → the unexpected channel → issue + failure feed).
 * Ctrl-C to stop.
 */
import { issueTracker, testEngine } from "@authorofthesurf/stagecraft";
import { startPanel } from "@authorofthesurf/stagecraft/panel";
import type { BotAction, BotView } from "@/engine/bot-brain";
import { Barn, setDeciderFactory, stagecraftBarnDecider } from "@/actors/barn-stagecraft";

const FLEET = 10;
const WORLD = "panel-demo";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

setDeciderFactory((opts: any) => {
  const stats = { calls: 0, failures: 0, droppedActions: 0, proposedActions: 2, totalMs: 0 };
  const decide = async (view: BotView): Promise<BotAction[]> => {
    const thinking = 200 + Math.random() * 1300;
    await sleep(thinking);
    stats.totalMs = thinking;
    if (opts.model === "chronic-failer" && Math.random() < 0.7)
      throw new Error("model timed out");            // → declared TurnFailed
    return [{ do: "check_in" }, { do: "roll_gacha" }];
  };
  return Object.assign(decide, { stats }) as any;
});

const tracker = issueTracker();
const engine = testEngine(Barn);
startPanel({ tracker, quietAfterMs: 15_000 });
console.log("panel: http://localhost:4949");

const modelFor = (i: number) => (i === 7 ? "chronic-failer" : "fake-brain");

const view = (farmId: string, day: number): BotView =>
  ({ day, farm: { id: farmId, name: farmId, gp: 100 } }) as unknown as BotView;

let day = 1;
while (true) {
  await Promise.all(
    Array.from({ length: FLEET }, async (_, i) => {
      const farmId = `bot-${i + 1}`;
      const decider = stagecraftBarnDecider(engine.client(Barn), WORLD, { model: modelFor(i) });
      await sleep(Math.random() * 2000); // stagger the morning
      // bot-4 has a buggy SIM: some mornings its view arrives without a
      // farm. The handler crashes on view.farm.name — an UNDECLARED error,
      // which is exactly what the unexpected channel / issue grouping /
      // failure feed exist to catch. Everyone else fails declared, if at all.
      if (i === 3 && Math.random() < 0.4) {
        await engine
          .client(Barn)
          .getOrCreate(`${WORLD}/${farmId}`)
          .takeTurn({ view: { day } as any, opts: { model: "fake-brain" } })
          .catch(() => {});
        return;
      }
      await decider(view(farmId, day)).catch(() => {}); // failures are the show
    })
  );
  day++;
  await sleep(1000);
}
