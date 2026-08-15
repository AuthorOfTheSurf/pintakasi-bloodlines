/**
 * ── MINIMAL REPRO: the envoy-rebind family of failures ─────────────────────
 *
 * Strips the game away entirely: a counter actor with one action, and one
 * "process generation" per invocation of this script. Run it several times
 * in a row (same keys) against one engine daemon and the three observed
 * failure shapes have room to appear, isolated from Ollama, briefs, and
 * everything else Pintakasi:
 *
 *   1. THE REBIND WINDOW — an actor created by a PREVIOUS process bounces
 *      `no_envoys` for a while after a new process registers its envoy,
 *      then answers. (Mild; a retry absorbs it.)
 *   2. THE POSITIONAL FIRST-CONTACT WEDGE — after a daemon generation
 *      change, the FIRST actor addressed wedges/fails once; later actors
 *      in the same batch bind clean. (Seen at every 10v10 coach session.)
 *   3. THE AGED-DAEMON NO-REBIND — after enough envoy generations against
 *      one daemon, old actors stop rebinding at all; only a daemon restart
 *      (same store!) cures it. (The real bug: state was never lost, only
 *      reachability.)
 *
 * Usage (one generation):
 *   bun run scripts/rivet-repro.ts --gen=1 --keys=a,b,c [--attempts=5]
 *
 * The driver loop lives in runs/<experiment>/rivet-repro-session.md — this
 * script deliberately does NOT retry-away failures; every attempt's result
 * is printed raw, because the failures ARE the data.
 */
import { actor, setup } from "rivetkit";
import { createClient } from "rivetkit/client";

const counter = actor({
  state: { n: 0 },
  actions: {
    bump: (c): number => ++c.state.n,
  },
});

export const registry = setup({ use: { counter }, noWelcome: true, logging: { level: "warn" } });

const args = process.argv.slice(2);
const gen = args.find((a) => a.startsWith("--gen="))?.slice(6) ?? "?";
const keys = (args.find((a) => a.startsWith("--keys="))?.slice(7) ?? "a,b").split(",");
const attempts = Number(args.find((a) => a.startsWith("--attempts="))?.slice(11) ?? 5);

await registry.startAndWait();
const client = createClient<typeof registry>("http://127.0.0.1:6420");

console.log(`gen=${gen} pid=${process.pid} keys=${keys.join(",")}`);
for (const key of keys) {
  const handle = client.counter.getOrCreate(["repro", key]);
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const t0 = Date.now();
    try {
      const n = await handle.bump();
      console.log(`  key=${key} attempt=${attempt} OK n=${n} ms=${Date.now() - t0}`);
      break;
    } catch (err) {
      const msg = String(err).split("\n")[0]!.slice(0, 120);
      console.log(`  key=${key} attempt=${attempt} FAIL ms=${Date.now() - t0} err=${msg}`);
      if (attempt < attempts) await new Promise((r) => setTimeout(r, 10_000));
    }
  }
}
await registry.shutdown();
process.exit(0);
