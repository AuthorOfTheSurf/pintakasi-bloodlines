/**
 * Smoke for the stagecraft port of the barn (stagecraft#1): a real local
 * rivet-engine via testEngine(), a fake decider instead of Ollama, and the
 * three behaviors that make the barn a barn — career memory accumulates,
 * tune changes standing orders, failure is a typed error whose bookkeeping
 * survives the discarded draft.
 */
import { afterAll, expect, test } from "bun:test";
import { testEngine } from "@authorofthesurf/stagecraft";
import type { BotAction, BotView } from "@/engine/bot-brain";
import { Barn, setDeciderFactory, stagecraftBarnDecider } from "./barn-stagecraft";

const TIMEOUT = 120_000;

const fakeView = (farmId: string, day: number): BotView =>
  ({
    day,
    farm: { id: farmId, name: `Farm ${farmId}`, gp: 100 },
  }) as unknown as BotView;

// The fake thinks instantly and proposes two actions; "spam" in the model
// name makes it throw, to exercise the failure path.
setDeciderFactory((opts: any) => {
  const stats = { calls: 0, failures: 0, droppedActions: 1, proposedActions: 2, totalMs: 5 };
  const decide = async (view: BotView): Promise<BotAction[]> => {
    if (opts.model === "always-fails") throw new Error("ollama exploded");
    opts.sink?.({
      farmId: view.farm.id, day: view.day, model: opts.model,
      briefTokens: 10, proposed: [], dropped: [], ms: 5,
    });
    return [{ do: "check_in" }, { do: "roll_gacha" }];
  };
  return Object.assign(decide, { stats }) as any;
});

const engine = testEngine(Barn);
afterAll(() => engine.dispose());

const fresh = (label: string) => `${label}-${crypto.randomUUID()}`;

test(
  "takeTurn accumulates career memory across days",
  async () => {
    const world = fresh("world");
    const decider = stagecraftBarnDecider(engine.client(Barn), world, { model: "fake" });

    const day1 = await decider(fakeView("bot-1", 1));
    expect(day1.map((a) => a.do)).toEqual(["check_in", "roll_gacha"]);
    await decider(fakeView("bot-1", 2));

    const barn = engine.client(Barn).getOrCreate(`${world}/bot-1`);
    const career = await barn.career(undefined);
    expect(career.daysPlayed).toBe(2);
    expect(career.lastDay).toBe(2);
    expect(career.proposedActions).toBe(4);
    expect(career.farmName).toBe("Farm bot-1");
    expect(decider.stats.calls).toBe(2);
  },
  TIMEOUT,
);

test(
  "tune sets standing orders; clearing them works",
  async () => {
    const world = fresh("world");
    const barn = engine.client(Barn).getOrCreate(`${world}/bot-2`);

    const tuned = await barn.tune({ strategy: "  buy land every day  " });
    expect(tuned.strategy).toBe("buy land every day");
    const cleared = await barn.tune({ strategy: null });
    expect(cleared.strategy).toBeNull();
  },
  TIMEOUT,
);

test(
  "a failed turn is a typed error and the failure counter survives",
  async () => {
    const world = fresh("world");
    const decider = stagecraftBarnDecider(engine.client(Barn), world, { model: "always-fails" });

    try {
      await decider(fakeView("bot-3", 1));
      throw new Error("should have thrown");
    } catch (e) {
      if (!Barn.is.TurnFailed(e)) throw e;
      expect((e as any).reason).toBe("ollama exploded");
    }

    const barn = engine.client(Barn).getOrCreate(`${world}/bot-3`);
    const career = await barn.career(undefined);
    expect(career.failures).toBe(1);
    expect(career.daysPlayed).toBe(0); // the failed draft was discarded
    expect(decider.stats.failures).toBe(1);
  },
  TIMEOUT,
);
