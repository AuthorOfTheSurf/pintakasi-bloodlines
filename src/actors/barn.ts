/**
 * ── THE BARN BECOMES AN ACTOR (round 50, phase 2) ──────────────────────────
 *
 * Phase 1 proved a local model can play a stable. This file changes WHERE
 * that brain lives: each llm barn is now a Rivet Actor — a small, durable,
 * addressable process with its own persistent state — and the sim talks to
 * it the way any client talks to any actor: by name, over a message.
 *
 * The inversion this completes (see bot-brain.ts): the engine no longer
 * calls a function that happens to be a bot. It mails a barn its view of the
 * morning; the barn — whoever or whatever is behind it — mails back the
 * day's intentions. The engine cannot tell a Rivet Actor from a human with a
 * UI, and that is the entire architectural point.
 *
 * ⚠ WHAT THE ACTOR OWNS vs. WHAT THE WORLD OWNS. The game database remains
 * the single source of truth for everything IN the world — GP, birds,
 * entries. The actor's durable state holds only what the BARN knows about
 * itself: how many days it has played, what it proposed, what got dropped,
 * how long it has spent thinking. Career memory, not game state. Nothing in
 * here can contradict the database because nothing in here duplicates it.
 *
 * ⚠ THE ACTOR OUTLIVES THE RUN. `getOrCreate` with the same key returns the
 * SAME actor, state intact — stop the sim, start it again with --keep, and
 * daysPlayed keeps counting from where it was. That persistence is the
 * feature being demonstrated, and it is also why the key includes the WORLD
 * (the sim db's filename): bot-1 of one world and bot-1 of another are
 * different careers, and sharing an actor between them would blur both.
 */
import { actor, setup, UserError } from "rivetkit";
import type { Client } from "rivetkit/client";
import type { BotAction, BotDecider, BotView } from "@/engine/bot-brain";
import {
  ollamaDecider,
  type BrainCallLog,
  type DeciderStats,
  type OllamaOptions,
} from "@/engine/decider-ollama";

/** The barn's career memory — everything it knows about itself so far. */
interface BarnMemory {
  farmName: string | null;
  daysPlayed: number;
  lastDay: number;
  proposedActions: number;
  droppedActions: number;
  failures: number;
  thinkingMs: number;
  /**
   * The owner's standing orders (round 51, phase 3) — the first per-barn
   * personality. Set by `tune`, read into every takeTurn's prompt, durable
   * like everything else here. null = play the house style.
   */
  strategy: string | null;
}

export const barn = actor({
  options: {
    // A barn-day is an LLM call: ~14s warm, worse cold, and at full fleet
    // (19 barns) mostly QUEUE — Ollama batches a few and the tail waits its
    // turn behind everyone else's. The default action timeout is 60s, which
    // is one bad batch away from killing a healthy turn; the decider carries
    // its own fleet-scaled AbortController, so the honest budget lives
    // there — this just has to stay comfortably above it.
    actionTimeout: 600_000,
    // The flagship 19-barn run found the wake stampede: barns sleep between
    // game-days, then all 19 wake at once each morning on a machine already
    // saturated by Ollama — and the engine's 5s wake-signal deadline starts
    // missing (days 59–60 collapsed to 8/19 barns, every failure a wake or
    // HTTP timeout). A barn's whole life is one sim run; keep it awake for
    // the duration and let the envoy drain retire it.
    noSleep: true,
  },
  state: {
    farmName: null,
    daysPlayed: 0,
    lastDay: -1,
    proposedActions: 0,
    droppedActions: 0,
    failures: 0,
    thinkingMs: 0,
    strategy: null,
  } as BarnMemory,
  actions: {
    /**
     * One game-day: read the view that arrived in the mail, think, reply
     * with intentions. The Ollama call happens HERE, inside the actor —
     * the sim never talks to the model any more, only to the barn.
     */
    takeTurn: async (
      c,
      view: BotView,
      opts: OllamaOptions
    ): Promise<{ actions: BotAction[]; log: BrainCallLog | null }> => {
      // A fresh decider per turn is deliberate: the expensive state (the
      // loaded model) lives in the Ollama server, not in this closure, so
      // recreating it costs nothing — and the stats it collects get folded
      // into the actor's durable memory, which is the copy that matters.
      //
      // The paper trail RETURNS with the reply rather than being written
      // here: the world database has one writer (the sim), and a callback
      // cannot cross the actor's serialization boundary — but a return
      // value crosses it for free.
      let log: BrainCallLog | null = null;
      // The barn's own standing orders ride into the prompt here — the one
      // place actor state feeds the model. This is what makes tuning a barn
      // mid-world change its NEXT morning without touching the sim.
      const decide = ollamaDecider({
        ...opts,
        strategy: c.state.strategy ?? undefined,
        sink: (l) => (log = l),
      });
      c.state.farmName = view.farm.name;
      try {
        const actions = await decide(view);
        c.state.daysPlayed++;
        c.state.lastDay = view.day;
        c.state.proposedActions += decide.stats.proposedActions;
        c.state.droppedActions += decide.stats.droppedActions;
        c.state.thinkingMs += decide.stats.totalMs;
        return { actions, log };
      } catch (err) {
        c.state.failures++;
        c.state.thinkingMs += decide.stats.totalMs;
        // Rethrow so the client-side decider rejects and collectProposals
        // sits this barn out — the same honest outcome as phase 1. Wrapped
        // in UserError (round 63) because rivetkit masks a plain throw as
        // "An internal error occurred", which cost the first options-brief
        // actor smoke its diagnosis — the sim-side log should say WHAT
        // failed, not that something did.
        throw new UserError(`takeTurn: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    /**
     * Set (or clear, with null) the owner's standing orders — from ANY
     * client, at ANY time, including mid-run from a second terminal. That
     * reachability is the phase-3 demo: the world does not pause, the sim
     * is not restarted, and the barn simply plays its next morning under
     * the new orders. `bun run tune <farm> "<orders>"`.
     */
    tune: (c, strategy: string | null): BarnMemory => {
      c.state.strategy = strategy && strategy.trim() ? strategy.trim() : null;
      return { ...c.state };
    },
    /** The career so far — durable across runs, which is the demo. */
    career: (c): BarnMemory => ({ ...c.state }),
  },
});

export const registry = setup({
  use: { barn },
  // A morning view grows with the world — roster, card, claim board — and
  // bot-14's crossed rivetkit's default 64 KB message limit on the flagship
  // run, bouncing it out of every single day (the retry can't absorb a
  // payload that is the same size every attempt). 8 MB is "never think
  // about this again" territory for a JSON brief.
  maxIncomingMessageSize: 8 * 1024 * 1024,
  maxOutgoingMessageSize: 8 * 1024 * 1024,
  // The sim's terminal is the sim's; the engine speaks when spoken to.
  noWelcome: true,
  logging: { level: "warn" },
});

/** Where the embedded engine listens. One place, because two files need it. */
export const RIVET_ENDPOINT = "http://127.0.0.1:6420";

/**
 * A `BotDecider` that routes through the actor instead of calling Ollama
 * directly. Same signature and same `stats` shape as `ollamaDecider`, so
 * simulate.ts cannot tell which brain it was handed — which keeps the A/B
 * between "direct" and "actors" honest by construction.
 *
 * `world` scopes the actor key: `[world, farmId]`. Same world + same farm =
 * same actor = same career, across every run that names them.
 */
export function barnDecider(
  client: Client<typeof registry>,
  world: string,
  opts: OllamaOptions
): BotDecider & { stats: DeciderStats } {
  const stats: DeciderStats = {
    calls: 0,
    failures: 0,
    droppedActions: 0,
    proposedActions: 0,
    totalMs: 0,
  };
  const decide = async (view: BotView): Promise<BotAction[]> => {
    const started = Date.now();
    stats.calls++;
    try {
      const handle = client.barn.getOrCreate([world, view.farm.id]);
      // The sink is a function and functions cannot ride an HTTP body — the
      // actor returns the log instead, and it is re-emitted here.
      const { sink, ...wireOpts } = opts;
      // ⚠ THE REBIND WINDOW. An actor that a PREVIOUS sim process created
      // stays bound to that process's (now-drained) envoy for a while after
      // a new process registers its own — and a takeTurn sent in that window
      // fails "no_envoys" even though the same actor answers fine a minute
      // later (measured: the career readout 30s after a failed takeTurn
      // succeeded). Fresh actors never hit this; only reused ones do. So:
      // retry. This is also just what mailing a durable correspondent IS —
      // a bounced letter gets resent, it does not mean the recipient died.
      let lastErr: unknown;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { actions, log } = await handle.takeTurn(view, wireOpts);
          if (log) sink?.(log);
          stats.proposedActions += actions.length;
          stats.totalMs += Date.now() - started;
          return actions;
        } catch (err) {
          lastErr = err;
          const msg = String(err);
          // Only the binding failure is worth retrying — a model error or a
          // timeout inside the actor is a real answer, not a bounced letter.
          // "wake signal" joined the list after the flagship run: a loaded
          // machine can miss the engine's 5s wake deadline even when the
          // actor is healthy. noSleep makes it rare; the retry makes it free.
          if (!/no_envoys|failed to start|actor_ready_timeout|wake signal/i.test(msg)) throw err;
          if (attempt < 3) await new Promise((r) => setTimeout(r, 10_000 * attempt));
        }
      }
      throw lastErr;
    } catch (err) {
      stats.failures++;
      stats.totalMs += Date.now() - started;
      throw err;
    }
  };
  return Object.assign(decide, { stats });
}
