/**
 * Part 2 demo: the Sentry story. `Cashier` carries a realistic bug — a
 * legal payload whose case the developer never handled. The layer turns
 * the resulting crash into a typed UnexpectedError plus a report rich
 * enough that a coding agent can read it and produce the patch.
 */
import { actor, onUnexpected, type UnexpectedReport } from "./layer.ts";

const PAYOUTS: Record<string, { amount: number }> = {
  win: { amount: 100 },
  draw: { amount: 50 },
};

export const Cashier = actor("Cashier", {
  state: { paidOut: 0 },
  handle: {
    Payout: async ({ result }: { result: "win" | "draw" | "loss" }, { state }) => {
      const payout = PAYOUTS[result]!; // the developer believed every result was covered
      state.paidOut += payout.amount;
      return { amount: payout.amount, paidOut: state.paidOut };
    },

    Balance: async (_: void, { state }) => state.paidOut,
  },
});

/** In-process monitor: collects every unexpected-error report. */
export function monitor() {
  const reports: UnexpectedReport[] = [];
  const stop = onUnexpected((r) => reports.push(r));
  return { reports, stop };
}

/** The agent-patchable report block. */
export function format(r: UnexpectedReport): string {
  return [
    `UNEXPECTED ERROR ${r.reportId}`,
    `actor:   ${r.actor} · action: ${r.action} · at: ${new Date(r.at).toISOString()}`,
    `error:   ${r.error.name}: ${r.error.message}`,
    `payload: ${JSON.stringify(r.payload)}`,
    `state:   ${JSON.stringify(r.state)}`,
    r.error.stack ?? "(no stack)",
  ].join("\n");
}
