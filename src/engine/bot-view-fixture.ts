/**
 * A complete, empty BotView for tests and demos that exercise the brain
 * plumbing (actors, deciders, the panel) without a world behind it.
 *
 * It exists so fakes stop reaching for `{ day } as unknown as BotView`: a
 * partial view cast to the full type compiles today and quietly lies the day
 * a decider starts reading a field the fake never set. Built out in full, a
 * new BotView field is a compile error here — one place — instead of a
 * runtime `undefined` in whichever fake hit it first.
 */
import type { BotView } from "./bot-brain";

export function emptyBotView(
  farm: { id: string; name?: string; gp?: number },
  day: number
): BotView {
  return {
    day,
    weather: { today: "Fire", tomorrow: "Water" },
    card: { today: [], tomorrow: [] },
    farm: {
      id: farm.id,
      name: farm.name ?? farm.id,
      gp: farm.gp ?? 100,
      landTokensCents: 0,
      stakedLandCents: 0,
      freePulls: 0,
      checkedInToday: false,
      barn: { count: 0, capacity: 100 },
    },
    flock: [],
    board: [],
    claimerBoard: [],
    scout: {},
    crowns: {
      weekFormats: [],
      eligibleBirdIds: [],
      juvenileFormats: [],
      juvenileEligibleBirdIds: [],
    },
    studMarket: [],
    ledger: { cardNetGp: 0, crownFeesGp: 0, crownWinningsGp: 0 },
  };
}
