import { describe, expect, test } from "bun:test";
import { battleLog } from "@/db/schema";
import { onCard, world, type World } from "@/engine/testkit";
import { birdFightRows } from "./bird-fights";

/**
 * The history pane reads one bird's career on demand (round 50). What it
 * replaced was every bird's fights in one array capped at the newest 6,000
 * rows — which told a 64-18 bird that had not fought for two weeks that it
 * "has never been in the pit". So the claim under test is the plain one: a
 * bird's history is ITS rows, all of them, whatever was fought afterwards.
 */
function duel(w: World, name: string, seed: number) {
  const spec = onCard(w.db, { mode: "real", classType: "open" });
  w.dev.lobbies.enter(w.bird(name).id, spec, seed);
  w.rival.lobbies.enter(w.rivalSlot(name), spec);
  w.game.tickDay();
}

describe("a bird's fight history", () => {
  test("is every row the bird wrote, with the opponent's figure read off the mirror", () => {
    const w = world();
    duel(w, "Alab", 7001);
    const alab = w.bird("Alab").id;
    const log = w.db.select().from(battleLog).all();
    const own = log.filter((r) => r.birdId === alab);
    const mirror = log.filter((r) => r.opponentBirdId === alab);
    expect(own.length).toBe(1);

    const rows = birdFightRows(w.db, alab);
    expect(rows.map((r) => r.logId)).toEqual(own.map((r) => r.id));
    expect(rows[0].figure).toBe(own[0].pitFigure);
    expect(rows[0].opponentFigure).toBe(mirror[0].pitFigure);
    expect(rows[0].result).toBe(own[0].result);
    expect(rows[0].opponent).toBe(own[0].opponentName);
    expect(rows[0].gp).toBe(own[0].gpDeltaCents / 100);
    // The two birds of one fight read each other's figures, crossed.
    const [theirs] = birdFightRows(w.db, own[0].opponentBirdId);
    expect([theirs.figure, theirs.opponentFigure]).toEqual([
      rows[0].opponentFigure,
      rows[0].figure,
    ]);
  });

  test("does not shrink when other birds fight afterwards", () => {
    const w = world();
    duel(w, "Alab", 7001);
    const alab = w.bird("Alab").id;
    const before = birdFightRows(w.db, alab);
    duel(w, "Sinag", 7002);
    duel(w, "Batong Buhay", 7003);
    expect(w.db.select().from(battleLog).all().length).toBeGreaterThan(2);
    expect(birdFightRows(w.db, alab)).toEqual(before);
  });

  test("is empty, not an error, for a bird that has not fought", () => {
    const w = world();
    expect(birdFightRows(w.db, w.bird("Sinag").id)).toEqual([]);
    expect(birdFightRows(w.db, "not-a-bird")).toEqual([]);
  });
});
