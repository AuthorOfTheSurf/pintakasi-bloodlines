import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/db/client";
import { battleLog, farms, gameState, lobbyEntries, tournamentEntries } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { Bots } from "./bots";
import { diagnose, formatReport } from "./doctor";
import { Game } from "./game";

/**
 * The point of this file: a health check nobody has watched FAIL is a green
 * light with no bulb in it. Every invariant here gets broken on purpose, and
 * the test asserts that the right one — and only the right one — goes red.
 */

/**
 * A small world with REAL play in it — the doctor's checks all read tables
 * that only fill up once birds actually fight, breed and claim.
 *
 * Four bots, not the full roster: these tests need a busy world, not a
 * representative one, and seeding fifteen stables for every case took the
 * suite from 4s to 13s on its own. The speculators are deliberately in —
 * the whale and the landlord are what exercise the gacha-bundle and
 * land-purchase paths the adoption report reads.
 */
const FAST_ROSTER = ["bot-1", "bot-3", "bot-10", "bot-11"];

function world(days = 0) {
  const db = createDb(":memory:");
  const dev = seedGame(db, { flock: "legacy" });
  Bots.seed(db, { flock: "legacy", only: FAST_ROSTER });
  const game = new Game(db, dev.farmId);
  for (let i = 0; i < days; i++) game.tickDay();
  return { db, game, devId: dev.farmId };
}

const check = (db: DB, name: string) => {
  const found = diagnose(db, ":memory:").invariants.find((i) => i.name === name);
  if (!found) throw new Error(`no invariant named "${name}"`);
  return found;
};
/** Every invariant EXCEPT the named one — used to prove a break is contained. */
const others = (db: DB, name: string) =>
  diagnose(db, ":memory:").invariants.filter((i) => i.name !== name);

describe("the doctor on a healthy world", () => {
  test("a freshly seeded world passes every invariant", () => {
    const w = world();
    const report = diagnose(w.db, ":memory:");
    expect(report.ok).toBe(true);
    for (const i of report.invariants) expect(i.passed).toBe(true);
  });

  test("…and still passes after the bots have played a week", () => {
    const w = world(7);
    const report = diagnose(w.db, ":memory:");
    // This is the assertion that would have caught both historical burns:
    // a week of real play, every flow exercised, conservation still exact.
    expect(report.ok).toBe(true);
    expect(report.health.find((h) => h.title === "CARD HEALTH")!.lines[0]).toMatch(/\d+ entries/);
  });

  test("the report names the numbers it proved, not just PASS", () => {
    const text = formatReport(diagnose(world(3).db, ":memory:"));
    expect(text).toContain("INVARIANTS");
    expect(text).toContain("GP conservation");
    expect(text).toMatch(/PASS\s+GP conservation\s+[\d,]+\.\d\d GP in world/);
    expect(text).not.toContain("FAIL");
  });
});

describe("…and on a broken one", () => {
  test("a GP burn is caught, sized, and handed a drift series to read", () => {
    const w = world(3);
    // Exactly the shape of the round-22 `buyLand` bug: money leaves a wallet
    // and is routed nowhere.
    const victim = w.db.select().from(farms).all()[0];
    w.db.update(farms).set({ gp: victim.gp - 5 }).where(eq(farms.id, victim.id)).run();

    const invariant = check(w.db, "GP conservation");
    expect(invariant.passed).toBe(false);
    expect(invariant.detail).toContain("MISSING");
    expect(invariant.detail).toContain("5.00");
    // It must hand over something to READ — a bare "conservation broke" only
    // tells you what you already knew. Deliberately not a single blamed day:
    // purses settling across the clock boundary swing the daily drift by
    // thousands, so a confident bisect would name the wrong day.
    expect(invariant.offenders!.join(" ")).toContain("drift series");
    const report = diagnose(w.db, ":memory:");
    expect(report.ok).toBe(false);
    expect(report.driftSeries!.length).toBeGreaterThan(0);
  });

  test("printed GP is caught too, not just missing GP", () => {
    const w = world(1);
    const victim = w.db.select().from(farms).all()[0];
    w.db.update(farms).set({ gp: victim.gp + 12 }).where(eq(farms.id, victim.id)).run();
    expect(check(w.db, "GP conservation").detail).toContain("PRINTED");
  });

  test("a negative pool is caught, and nothing else is", () => {
    const w = world(1);
    w.db.update(gameState).set({ stakerPoolCents: -1 }).where(eq(gameState.id, 1)).run();
    expect(check(w.db, "no negative balances").passed).toBe(false);
    // A negative pool also unbalances conservation, so the only claim we can
    // make about containment is that the UNRELATED invariants hold.
    for (const i of others(w.db, "no negative balances"))
      if (i.name !== "GP conservation") expect(i.passed).toBe(true);
  });

  test("cents outside a whole GP are caught — someone bypassed creditCents", () => {
    const w = world(1);
    const victim = w.db.select().from(farms).all()[0];
    w.db.update(farms).set({ gpCents: 150 }).where(eq(farms.id, victim.id)).run();
    const invariant = check(w.db, "no negative balances");
    expect(invariant.passed).toBe(false);
    expect(invariant.offenders!.join(" ")).toContain("150 cents");
  });

  test("a pit figure inversion is caught", () => {
    const w = world(4);
    const log = w.db.select().from(battleLog).all();
    // Pick a fight the loser actually figured in — the band clamps at 0, so
    // zeroing a winner whose opponent also figured 0 is a TIE, not an
    // inversion, and the check is deliberately `>=`.
    const win = log.find(
      (r) =>
        r.result === "win" &&
        (log.find((m) => m.birdId === r.opponentBirdId && m.opponentBirdId === r.birdId)
          ?.pitFigure ?? 0) > 0
    )!;
    const loserFigure = log.find(
      (m) => m.birdId === win.opponentBirdId && m.opponentBirdId === win.birdId
    )!.pitFigure;
    // Drop the winner below the bird it beat — the exact thing round 20 was
    // rebuilt to make impossible.
    w.db
      .update(battleLog)
      .set({ pitFigure: loserFigure - 1 })
      .where(eq(battleLog.id, win.id))
      .run();
    const invariant = check(w.db, "pit figures");
    expect(invariant.passed).toBe(false);
    expect(invariant.offenders!.join(" ")).toContain("winner");
    for (const i of others(w.db, "pit figures")) expect(i.passed).toBe(true);
  });

  test("an unmirrored fight row is caught by the same check", () => {
    const w = world(4);
    const loss = w.db.select().from(battleLog).all().find((r) => r.result === "loss")!;
    w.db.delete(battleLog).where(eq(battleLog.id, loss.id)).run();
    expect(check(w.db, "pit figures").offenders!.join(" ")).toContain("no mirrored loss");
  });

  test("a purse that doesn't settle is caught", () => {
    // Far enough for a crown day (Thursday, day 6) to have resolved.
    const w = world(8);
    const paid = w.db.select().from(tournamentEntries).all().find((e) => e.gpWonCents > 0);
    if (!paid) return; // no crown ran in this window — nothing to corrupt
    w.db
      .update(tournamentEntries)
      .set({ gpWonCents: paid.gpWonCents + 1 })
      .where(eq(tournamentEntries.id, paid.id))
      .run();
    const invariant = check(w.db, "purses settle");
    expect(invariant.passed).toBe(false);
    expect(invariant.offenders!.join(" ")).toContain("crown #");
  });

  test("a bird double-carded on one day is caught", () => {
    const w = world(2);
    const entry = w.db.select().from(lobbyEntries).all()[0];
    w.db
      .insert(lobbyEntries)
      .values({
        lobbyId: entry.lobbyId,
        birdId: entry.birdId,
        farmId: entry.farmId,
        fee: entry.fee,
        dayEntered: entry.dayEntered,
        status: "pending",
      })
      .run();
    const invariant = check(w.db, "one card per bird per day");
    expect(invariant.passed).toBe(false);
    expect(invariant.offenders!.join(" ")).toContain("2 entries");
  });

  test("a failing report says FAIL — the exit-code contract", () => {
    const w = world(1);
    const victim = w.db.select().from(farms).all()[0];
    w.db.update(farms).set({ gp: victim.gp - 1 }).where(eq(farms.id, victim.id)).run();
    const report = diagnose(w.db, ":memory:");
    expect(report.ok).toBe(false);
    expect(formatReport(report)).toContain("FAIL");
    expect(formatReport(report, { quiet: true })).toContain("FAIL");
  });
});

describe("the health report", () => {
  test("mechanic adoption names a door nobody used", () => {
    // A world nobody has played: every door is untouched, which is exactly
    // the signal that caught nothing twice before this existed.
    const w = world();
    const section = diagnose(w.db, ":memory:").health.find((h) =>
      h.title.startsWith("MECHANIC ADOPTION")
    )!;
    expect(section.warn).toContain("unused");
    expect(section.lines.join("\n")).toContain("NOBODY WALKED THROUGH");
  });

  test("health warnings never fail the run — they're judgement, not bugs", () => {
    const w = world();
    const report = diagnose(w.db, ":memory:");
    expect(report.health.some((h) => h.warn)).toBe(true);
    expect(report.ok).toBe(true); // warnings are loud, not fatal
  });
});
