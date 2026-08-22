/**
 * Part 2 proofs: an undeclared failure on a legal payload (1) reaches the
 * client as a typed UnexpectedError, (2) produces a context-rich report in
 * the monitor, and (3) leaves the actor alive with its state untouched.
 */
import { afterAll, expect, test } from "bun:test";
import { isUnexpected } from "./layer.ts";
import { Cashier, format, monitor } from "./monitor-demo.ts";
import { engine, release, retain } from "./test-harness.ts";

retain();
afterAll(() => release());

const TIMEOUT = 120_000;
const fresh = (label: string) => `${label}-${crypto.randomUUID()}`;

test(
  "a legal payload hitting an unhandled case: typed error, rich report, actor survives",
  async () => {
    const m = monitor();
    const cashier = engine.client(Cashier).getOrCreate(fresh("cashier"));

    await cashier.Payout({ result: "win" });

    try {
      await cashier.Payout({ result: "loss" }); // legal type, unhandled case
      throw new Error("should have thrown");
    } catch (e) {
      if (!isUnexpected(e)) throw e;
      expect(e.actor).toBe("Cashier");
      expect(e.action).toBe("Payout");
      expect(e.reportId).toMatch(/^[0-9a-f-]{36}$/);
    }

    expect(m.reports.length).toBe(1);
    const r = m.reports[0]!;
    expect(r.payload).toEqual({ result: "loss" });
    expect(r.state).toEqual({ paidOut: 100 });
    expect(r.error.message).toContain("undefined");
    expect(format(r)).toContain("Cashier");

    // The actor survived, and the failed handler committed nothing.
    expect(await cashier.Balance()).toBe(100);
    const { paidOut } = await cashier.Payout({ result: "draw" });
    expect(paidOut).toBe(150);

    m.stop();
  },
  TIMEOUT,
);
