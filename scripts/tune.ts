/**
 * Reach into a running world and change how a barn plays (round 51, phase 3).
 *
 *   bun run tune bot-3 "Enter no fights this week. Breed and check in only."
 *   bun run tune bot-3 --clear
 *   bun run tune bot-3                      # just show the career + orders
 *   bun run tune bot-3 "..." --world=sim-20260814-2157
 *
 * The point of this script is WHO CAN RUN IT: anyone, from anywhere, while
 * the sim is mid-run in another terminal. The barn is an addressable actor —
 * the world does not pause, nothing restarts, and the barn simply plays its
 * next morning under the new standing orders. This is the moment the sim
 * stops being a batch job and becomes a live world you can reach into.
 *
 * Defaults to the newest sim database's world name, because that is almost
 * always the world you mean.
 */
import path from "node:path";
import { createClient } from "rivetkit/client";
import { latestSimDb } from "@/db/client";
import { registry, RIVET_ENDPOINT } from "@/actors/barn";

const args = process.argv.slice(2);
const farmId = args.find((a) => !a.startsWith("--"));
const orders = args.filter((a) => !a.startsWith("--"))[1];
const clear = args.includes("--clear");
const worldArg = args.find((a) => a.startsWith("--world="))?.slice("--world=".length);

if (!farmId) {
  console.error(`usage: bun run tune <farm-id> ["standing orders" | --clear] [--world=<name>]`);
  process.exit(1);
}

const world = worldArg ?? path.basename(latestSimDb(), ".db");

// Registering our own envoy means this works whether or not a sim is up —
// if one IS running, the engine may serve the actor through either envoy;
// the state is the same record either way.
await registry.startAndWait();
const client = createClient<typeof registry>(RIVET_ENDPOINT);
const handle = client.barn.getOrCreate([world, farmId]);

// Same rebind window barnDecider retries through (BRAINS.md, phase 2): an
// actor created by another process bounces for ~30-40s after our envoy
// registers. A bounced letter gets resent.
async function withRetry<T>(call: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await call();
    } catch (err) {
      lastErr = err;
      if (!/no_envoys|failed to start|actor_ready_timeout|scheduling/i.test(String(err))) throw err;
      if (attempt < 3) {
        console.log(`  (barn not rebound yet — retry ${attempt}/2 in ${10 * attempt}s)`);
        await new Promise((r) => setTimeout(r, 10_000 * attempt));
      }
    }
  }
  throw lastErr;
}

const memory = await withRetry(() =>
  clear || orders !== undefined ? handle.tune(clear ? null : orders) : handle.career()
);

console.log(`\n  ${farmId} @ ${world}`);
console.log(
  `  career: ${memory.daysPlayed} day(s) played · last day ${memory.lastDay} · ` +
    `${memory.proposedActions} proposed, ${memory.droppedActions} dropped · ` +
    `${(memory.thinkingMs / 1000).toFixed(1)}s thinking`
);
console.log(`  standing orders: ${memory.strategy ?? "(none — house style)"}\n`);

await registry.shutdown();
process.exit(0);
