/**
 * Part 2 demo: the Sentry story. `Referee` scores rock-paper-scissors
 * rounds and carries a realistic bug — the developer handled both winners
 * but forgot that `winnerOf` can also return "draw". A fully legal payload
 * explodes the handler; the layer turns the crash into a typed
 * UnexpectedError plus a report rich enough that a coding agent can read
 * it and produce the patch.
 */
import { actor, onUnexpected, type UnexpectedReport } from "./layer.ts";

export type Choice = "rock" | "paper" | "scissors";

const BEATS: Record<Choice, Choice> = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
};

const winnerOf = (a: Choice, b: Choice) =>
  BEATS[a] === b ? "a" : BEATS[b] === a ? "b" : "draw";

// The bug: this table quietly swallows "draw" — someone always wins, right?
const PLAYER: Record<string, "Alice" | "Bob"> = { a: "Alice", b: "Bob" };

export const Referee = actor("Referee", {
  state: { scores: { Alice: { wins: 0 }, Bob: { wins: 0 } } },
  handle: {
    Play: async (
      { alice, bob }: { alice: Choice; bob: Choice },
      { state },
    ) => {
      const player = PLAYER[winnerOf(alice, bob)]!;
      state.scores[player].wins += 1;
      return { winner: player, scores: state.scores };
    },

    Scores: async (_: void, { state }) => state.scores,
  },
});

/** In-process monitor: collects every unexpected-error report. */
export function monitor() {
  const reports: UnexpectedReport[] = [];
  const stop = onUnexpected((r) => reports.push(r));
  return { reports, stop };
}

export { format } from "./adapters.ts";
