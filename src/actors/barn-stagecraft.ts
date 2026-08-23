/**
 * ── THE BARN, PORTED TO STAGECRAFT (issue stagecraft#1) ────────────────────
 *
 * The same barn as barn.ts — career memory, takeTurn / tune / career — but
 * defined against @authorofthesurf/stagecraft instead of raw rivetkit. The
 * port is the graduation test for the SDK: what survives 1:1, what has to
 * bend, and what is flatly missing gets recorded here and filed upstream.
 *
 * WHAT BENT IN THE PORT (vs. barn.ts):
 *  - `options: { actionTimeout, noSleep }` — GONE. @rivetkit/effect only
 *    forwards `name`/`icon` to rivetkit, so stagecraft cannot express them
 *    yet. Fine for a smoke; NOT fine for the 19-barn Ollama fleet (wake
 *    stampede + 60s default timeout). Filed as a stagecraft issue.
 *  - Registry `maxIncoming/OutgoingMessageSize` (bot-14's 64KB bounce) —
 *    also not expressible. Same issue.
 *  - Composite key `[world, farmId]` → single string `${world}/${farmId}`
 *    (stagecraft getOrCreate takes one string).
 *  - `throw new UserError(msg)` → a DECLARED error (`fail.TurnFailed`),
 *    which is the stagecraft-native version of the same move: the sim-side
 *    log says WHAT failed, and the error is typed instead of string-matched.
 *  - State draft is commit-on-success, so the failure branch's
 *    `state.failures++` bookkeeping must happen in a SEPARATE action
 *    (`recordFailure`) called by the client-side decider — a thrown
 *    declared error discards the draft, counters included. Design note for
 *    stagecraft: barn.ts mutates state AND throws; stagecraft cannot.
 */
import { actor, type Ctx } from "@authorofthesurf/stagecraft";
import type { BotAction, BotDecider, BotView } from "@/engine/bot-brain";
import {
  ollamaDecider,
  type BrainCallLog,
  type DeciderStats,
  type OllamaOptions,
} from "@/engine/decider-ollama";

/** The barn's career memory — everything it knows about itself so far. */
export interface BarnMemory {
  farmName: string | null;
  daysPlayed: number;
  lastDay: number;
  proposedActions: number;
  droppedActions: number;
  failures: number;
  thinkingMs: number;
  strategy: string | null;
}

/**
 * Injectable decider factory so the smoke test can run without Ollama.
 * Production leaves this alone.
 */
export let deciderFactory: typeof ollamaDecider = ollamaDecider;
export function setDeciderFactory(f: typeof ollamaDecider) {
  deciderFactory = f;
}

type TurnReply = { actions: BotAction[]; log: BrainCallLog | null };

export const Barn = actor("barn", {
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
  errors: {
    TurnFailed: {} as { reason: string; ms: number },
  },
  handle: {
    /** One game-day: read the view, think, reply with intentions. */
    takeTurn: async (
      { view, opts }: { view: BotView; opts: Omit<OllamaOptions, "sink"> },
      { state, fail }
    ): Promise<TurnReply> => {
      let log: BrainCallLog | null = null;
      const decide = deciderFactory({
        ...opts,
        strategy: state.strategy ?? undefined,
        sink: (l) => (log = l),
      });
      state.farmName = view.farm.name;
      try {
        const actions = await decide(view);
        state.daysPlayed++;
        state.lastDay = view.day;
        state.proposedActions += decide.stats.proposedActions;
        state.droppedActions += decide.stats.droppedActions;
        state.thinkingMs += decide.stats.totalMs;
        return { actions, log };
      } catch (err) {
        // Cannot bump failure counters here — a thrown declared error
        // discards the whole draft. The decider calls recordFailure.
        throw fail.TurnFailed({
          reason: err instanceof Error ? err.message : String(err),
          ms: decide.stats.totalMs,
        });
      }
    },
    /** Failure bookkeeping, split out because throw = draft discarded. */
    recordFailure: async (
      { ms }: { ms: number },
      { state }
    ): Promise<void> => {
      state.failures++;
      state.thinkingMs += ms;
    },
    /** Set (or clear, with null) the owner's standing orders. */
    tune: async (
      { strategy }: { strategy: string | null },
      { state }
    ): Promise<BarnMemory> => {
      state.strategy = strategy && strategy.trim() ? strategy.trim() : null;
      return { ...state };
    },
    /** The career so far — durable across runs, which is the demo. */
    career: async (_: undefined, { state }: Ctx<BarnMemory, {}, {}>): Promise<BarnMemory> => ({
      ...state,
    }),
  },
});

/** Same-shape client as barn.ts's barnDecider, but over a stagecraft engine. */
export function stagecraftBarnDecider(
  client: { getOrCreate: (key: string) => any },
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
    const handle = client.getOrCreate(`${world}/${view.farm.id}`);
    const { sink, ...wireOpts } = opts;
    try {
      const { actions, log } = (await handle.takeTurn({ view, opts: wireOpts })) as TurnReply;
      if (log) sink?.(log);
      stats.proposedActions += actions.length;
      stats.totalMs += Date.now() - started;
      return actions;
    } catch (err) {
      stats.failures++;
      stats.totalMs += Date.now() - started;
      if (Barn.is.TurnFailed(err)) {
        await handle.recordFailure({ ms: (err as any).ms ?? 0 }).catch(() => {});
      }
      throw err;
    }
  };
  return Object.assign(decide, { stats });
}
