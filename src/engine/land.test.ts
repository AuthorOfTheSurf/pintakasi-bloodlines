import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { events, farms } from "@/db/schema";
import { COVERS, LAND, LT_CENTS, PINTAKASI } from "./config";
import { Gacha } from "./gacha";
import { mulberry32 } from "./rng";
import { onCard, world } from "./testkit";

/**
 * LT CONSERVATION (round 37) — the land twin of testkit's `expectConserved`.
 *
 * GP has had a conservation proof since round 11 and it has caught two silent
 * burns. Land had none, and the reason was structural: the Majors minted land
 * per fight but reported it as `data.landEach` on a world-level `fight` event
 * — unsigned, belonging to no farm — so there was nothing to sum against.
 * Round 37 gives that mint its own signed per-farm `crown_land` row, which is
 * what makes the claim below checkable at all:
 *
 *   sum(events.lt)  ==  sum(farms.landTokensCents + farms.stakedLandCents)
 *
 * Land is simpler to prove than GP: there are no escrows and no pools, so
 * there is no timing window in which the books are legitimately out. A
 * mismatch is a bug, always.
 *
 * Deliberately the same SHAPE as `expectConserved`: ABSOLUTE, never a
 * before/after delta. A delta comparison passes when both sides fall
 * together, which is precisely the shape of an unrecorded mint.
 */
function expectLandConserved(db: DB): void {
  const held = db
    .select()
    .from(farms)
    .all()
    // Both piles. Staking moves a farm's land between its own two columns and
    // writes NO `lt` — it is not a transfer, so summing only the liquid pile
    // would read a staked world as a burned one.
    .reduce((s, f) => s + f.landTokensCents + f.stakedLandCents, 0);
  const ledgered = db
    .select()
    .from(events)
    .all()
    .reduce((s, e) => s + (e.lt ?? 0), 0);
  expect(ledgered).toBe(held);
}

const landOf = (db: DB, farmId: string) => {
  const f = db.select().from(farms).where(eq(farms.id, farmId)).get()!;
  return f.landTokensCents + f.stakedLandCents;
};

/**
 * A crown's LAND rows: since round 42 the pot settles on the same `purse_payout`
 * event the GP shares use, carrying `lt` instead of `gpCents` (the old
 * `crown_land` type belonged to the deleted per-fight mint).
 */
const crownLandRows = (db: DB) =>
  db.select().from(events).all().filter((e) => e.type === "purse_payout" && (e.lt ?? 0) !== 0);

describe("every Land Token in the world got there through a ledger row", () => {
  test("a fresh world starts at zero on both sides", () => {
    // The base case is worth pinning: if seeding ever handed a farm land the
    // way it hands out a starting purse, every other test here would pass
    // while the invariant was already broken at day zero.
    const w = world();
    expectLandConserved(w.db);
    expect(landOf(w.db, w.devId)).toBe(0);
  });

  test("a world that fights, breeds, buys, stakes, stands a stud and rolls keeps its books", () => {
    const w = world();

    // ── the daily card: land mints on both sides of a real fight ───────────
    const spec = onCard(w.db, { mode: "real", classType: "open" });
    w.dev.lobbies.enter(w.bird("Alab").id, spec, 4242);
    w.rival.lobbies.enter(w.rivalSlot("Alab"), spec);
    w.game.tickDay();
    expect(landOf(w.db, w.devId)).toBeGreaterThan(0);
    expectLandConserved(w.db);

    // ── the gacha: a single roll, and the eleven-roll bundle ───────────────
    const gacha = new Gacha(w.db, w.devId, mulberry32(77));
    gacha.roll();
    gacha.bundle();
    expectLandConserved(w.db);

    // ── buying land with GP (the round-22 burn's home) ─────────────────────
    w.farms.buyLand(w.devId, 200);
    expectLandConserved(w.db);

    // ── staking: land moves between the farm's own two piles ───────────────
    const beforeStake = landOf(w.db, w.devId);
    w.farms.stake(w.devId, 100);
    expect(landOf(w.db, w.devId)).toBe(beforeStake); // the TOTAL cannot move
    expectLandConserved(w.db);

    // ── the stud seat: the one path that takes land OUT of the world ───────
    const seatBefore = landOf(w.db, w.devId);
    w.dev.breeding.listStud(w.bird("Tandang Pula").id);
    expect(landOf(w.db, w.devId)).toBe(seatBefore - COVERS.STUD_LISTING_LT);
    expectLandConserved(w.db);

    // ── breeding: a cover moves GP, and must move no land at all ───────────
    const bredBefore = landOf(w.db, w.devId);
    w.dev.breeding.breed(w.bird("Dalisay").id, w.bird("Tandang Pula").id);
    expect(landOf(w.db, w.devId)).toBe(bredBefore);
    expectLandConserved(w.db);

    // …and a week of ticks on top of all of it, staking payouts included.
    w.game.tickWeek();
    expectLandConserved(w.db);
  });

  /**
   * The hole that made the invariant impossible before round 37. A crown fight
   * pays BOTH barns, and the `fight` event it used to be reported on carries no
   * farmId — so there was no honest way to attribute it. One signed per-farm row
   * per participant is the fix, and this is what pins it.
   *
   * ⚠ ROUND 42 MOVED THE ROW, NOT THE RULE. The `crown_land` event type is gone
   * with the per-fight mint that emitted it; a crown now settles ONE FIXED POT at
   * the end of the bracket, logged on the same `purse_payout` row the GP shares
   * use (carrying `lt` instead of `gpCents`). The lesson that produced the row
   * survives verbatim and is the reason this test still exists: an `lt` movement
   * that is not attributed to a farm is invisible to `sum(events.lt)`, and an
   * untestable faucet is how two silent GP burns once shipped.
   */
  test("a championship pays its land pot as signed, per-farm ledger rows", () => {
    const w = world();
    w.dev.tournaments.enter(w.bird("Sinag").id, "b1");
    w.rival.tournaments.enter(w.rivalSlot("Batong Buhay"), "b1");
    for (let i = 0; i < 7; i++) w.game.tickDay(); // through Thursday

    const crownLand = crownLandRows(w.db);
    expect(crownLand.length).toBe(2); // a straight final: two participants paid
    // Every one of them names a farm. An `lt` delta with no farmId can never
    // reconcile against a per-farm balance, which is why the doctor flags
    // orphans before it blames anybody.
    expect(crownLand.every((e) => e.farmId !== null && (e.lt ?? 0) > 0)).toBe(true);
    expect(new Set(crownLand.map((e) => e.farmId)).size).toBe(2);
    // The pot, whole: the two birds of a one-fight bracket split all of it, and
    // the champion carries the flooring dust.
    expect(crownLand.reduce((s, e) => s + (e.lt ?? 0), 0)).toBe(PINTAKASI.LAND_POT);
    expectLandConserved(w.db);
  });

  test("ONE row per participant, and the pot they add up to is the ruled one", () => {
    // A four-bird bracket. This used to assert TWO families of rows — six
    // per-fight mints plus four elimination grants — because a crown paid land
    // twice on two scales that were never priced against each other, and at the
    // juvenile crown they had inverted (champion 6.75 LT, first-round loser
    // 10.15). One pot means one row a bird, and the comparison that matters is no
    // longer "are both families present" but "does the one family sum to the pot".
    const w = world();
    w.dev.tournaments.enter(w.bird("Sinag").id, "b1");
    w.dev.tournaments.enter(w.bird("Batong Buhay").id, "b1");
    w.rival.tournaments.enter(w.rivalSlot("Sinag"), "b1");
    w.rival.tournaments.enter(w.rivalSlot("Batong Buhay"), "b1");
    for (let i = 0; i < 7; i++) w.game.tickDay();

    const crownLand = crownLandRows(w.db);
    expect(crownLand.length).toBe(4); // four entries, four fights fought, four rows
    expect(crownLand.reduce((s, e) => s + (e.lt ?? 0), 0)).toBe(PINTAKASI.LAND_POT);
    // The GP shares ride on the same event type and must not be double-counted as
    // land: a purse row carries one currency or the other, never both.
    const gpRows = w.db
      .select()
      .from(events)
      .all()
      .filter((e) => e.type === "purse_payout" && (e.gpCents ?? 0) !== 0);
    expect(gpRows.every((e) => (e.lt ?? 0) === 0)).toBe(true);
    expectLandConserved(w.db);
  });

  test("an unrecorded mint is exactly what this refuses", () => {
    // The proof that the proof works — the same standard doctor.test.ts holds
    // every invariant to. Hand a farm a token behind the ledger's back (which
    // is what a gacha bundle did for many rounds) and the books must part.
    const w = world();
    const victim = w.db.select().from(farms).all()[0];
    w.db
      .update(farms)
      .set({ landTokensCents: victim.landTokensCents + LT_CENTS })
      .where(eq(farms.id, victim.id))
      .run();
    expect(() => expectLandConserved(w.db)).toThrow();
  });
});

describe("the land a bird earns follows the bird, not the barn that entered it", () => {
  test("a crown's land row is stamped with the bird that earned it", () => {
    // Land is per-BIRD, so the row has to say which body earned it or the office
    // cannot show a bird what its own career paid. Cheap to assert and easy to
    // lose in a refactor that only cares about the farm total. (Round 42: the row
    // is a `purse_payout` carrying `lt` — the pot settles with the purse now.)
    const w = world();
    w.dev.tournaments.enter(w.bird("Sinag").id, "b3");
    w.rival.tournaments.enter(w.rivalSlot("Sinag"), "b3");
    for (let i = 0; i < 7; i++) w.game.tickDay();
    const rows = crownLandRows(w.db);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((e) => e.birdId !== null)).toBe(true);
  });

  test("a gacha roll's land is one row, one farm, one token", () => {
    const w = world();
    const before = landOf(w.db, w.devId);
    new Gacha(w.db, w.devId, mulberry32(3)).roll();
    expect(landOf(w.db, w.devId)).toBe(before + LAND.PER_GACHA_ROLL);
    const rolls = w.db
      .select()
      .from(events)
      .all()
      .filter((e) => e.type === "gacha" && (e.lt ?? 0) !== 0);
    expect(rolls.length).toBe(1);
    expect(rolls[0].lt).toBe(LAND.PER_GACHA_ROLL);
    expectLandConserved(w.db);
  });
});
