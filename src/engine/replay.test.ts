import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { battleLog, birds } from "@/db/schema";
import { replayFidelity, replayFight } from "./replay";
import { expectConserved, onCard, world, type World } from "./testkit";
import type { LobbySpec } from "./lobbies";

/**
 * ── THE GUARD THAT LETS 51 MB BE THROWN AWAY (round 38) ────────────────────
 *
 * `battle_log.play_by_play` is gone. Every transcript in the game is now a
 * REGENERATION — `simulatePair` re-run from the seed on the row — and this
 * file is the only thing standing between that and a silent lie.
 *
 * The failure this suite is built around is not "replay throws". It is
 * "replay quietly returns a DIFFERENT fight than the one the archive settled
 * money on", which looks exactly like a working feature until a player reads
 * a transcript where the bird that lost wins. So the strongest assertion
 * available is used wherever it exists: the live resolution still hands back
 * an in-memory `playByPlay`, so a replay can be checked BYTE FOR BYTE against
 * the narration the fight actually produced, not merely against its result.
 */

// ── fixtures ────────────────────────────────────────────────────────────────

const REAL = (w: World): LobbySpec => onCard(w.db, { mode: "real", classType: "open" });

/**
 * One carded fight between the two barns' copies of the same starter slot,
 * returning the LIVE report — whose `playByPlay` is the ground truth every
 * replay in this file is measured against.
 *
 * Two birds is a group of two, so this is exactly one fight and exactly two
 * battle-log rows, which keeps "the mirrored pair" unambiguous.
 */
function duel(w: World, name = "Alab", seed = 7001) {
  const spec = REAL(w);
  w.dev.lobbies.enter(w.bird(name).id, spec, seed);
  w.rival.lobbies.enter(w.rivalSlot(name), spec);
  const tick = w.game.tickDay();
  const lobby = tick.card.find((l) => l.fights.length > 0)!;
  return lobby.fights[0];
}

/** Every battle-log row in the world, oldest first. */
const rowsOf = (w: World) => w.db.select().from(battleLog).all();

/**
 * A four-bird Major, run to a champion — three fights, six rows, and the only
 * code path in the game that writes a battle-log row with `lobbyId: null`.
 * The daily card and the crowns insert their pair from different files, so a
 * replay proved on one proves nothing about the other.
 */
function crownDay(w: World) {
  w.dev.tournaments.enter(w.bird("Sinag").id, "b1");
  w.dev.tournaments.enter(w.bird("Batong Buhay").id, "b1");
  w.rival.tournaments.enter(w.rivalSlot("Sinag"), "b1");
  w.rival.tournaments.enter(w.rivalSlot("Batong Buhay"), "b1");
  let tick!: ReturnType<World["game"]["tickDay"]>;
  for (let i = 0; i < 7; i++) tick = w.game.tickDay();
  return tick.pintakasi[0];
}

const headerOf = (playByPlay: string) => playByPlay.split("\n")[0];

// ── the claims ──────────────────────────────────────────────────────────────

describe("a fought card replays exactly", () => {
  /**
   * THE CENTRAL CLAIM OF ROUND 38. If this passes, deleting the column cost
   * nothing: the bytes that used to be stored are the bytes that come back.
   * Anything weaker — "the winner matches", "the figures match" — would have
   * let a narration bug ship, and narration is the entire reason the column
   * existed.
   */
  test("the regenerated transcript is byte-identical to the fight that was settled", () => {
    const w = world();
    const fight = duel(w);
    const rows = rowsOf(w);
    expect(rows.length).toBe(2);

    const replay = replayFight(w.db, rows[0].id)!;
    expect(replay).not.toBeNull();
    expect(replay.playByPlay).toBe(fight.playByPlay);
    expect(replay.drifted).toBe(false);
    expect(replay.driftDetail).toBeUndefined();
    // The two figure arrays are the same statement made from two sources: one
    // recomputed tonight, one read off the archive. Equal is the whole point.
    expect(replay.figures).toEqual(replay.archivedFigures);
    expect(replay.figures).toEqual(fight.figures);
    // A replay is a pure read — it must not so much as touch the books.
    expectConserved(w.db);
  });

  /**
   * A bird is not the row it wrote. Both rows of one fight describe the SAME
   * event from opposite sides, so whichever one a caller happens to hold, the
   * transcript it rebuilds has to be the same transcript — otherwise the
   * office would show a player one story and their opponent another.
   *
   * The lead's lobbies.test.ts case makes this claim for the daily card; this
   * one makes it for the bracket, because the two write their pairs from
   * different files and only insertion order makes side A recoverable.
   */
  test("both mirrored rows of a crown fight rebuild one transcript, header and all", () => {
    const w = world();
    crownDay(w);
    const rows = rowsOf(w);
    expect(rows.length).toBe(6); // three fights, two rows each

    for (let i = 0; i < rows.length; i += 2) {
      const a = replayFight(w.db, rows[i].id)!;
      const b = replayFight(w.db, rows[i + 1].id)!;
      expect(rows[i].seed).toBe(rows[i + 1].seed);
      expect(a.playByPlay).toBe(b.playByPlay);
      expect(headerOf(a.playByPlay)).toBe(headerOf(b.playByPlay));
      expect(a.drifted).toBe(false);
      expect(b.drifted).toBe(false);
    }
  });

  /**
   * The header is decoration, and decoration is exactly what rots unnoticed.
   * A crown row stores no round number — the stage is recovered from the
   * LOSER's `eliminatedRound` — so this is the one part of the rebuild that is
   * inferred rather than read, and the one part that could quietly start
   * calling every bout a "Final".
   */
  test("a crown fight replays under its own bracket stage, not a generic title", () => {
    const w = world();
    const result = crownDay(w);
    expect(result.rounds.map((r) => r.name)).toEqual(["Semifinals", "Final"]);

    // Match each live report to the row that replays it — which proves the
    // exact-transcript claim on the tournament path at the same time.
    const stageOf = new Map<string, string>();
    for (const round of result.rounds)
      for (const f of round.fights) stageOf.set(f.playByPlay, round.name);
    expect(stageOf.size).toBe(3);

    const seen: string[] = [];
    for (const row of rowsOf(w)) {
      const replay = replayFight(w.db, row.id)!;
      const stage = stageOf.get(replay.playByPlay);
      expect(stage).toBeDefined(); // byte-identical to a fight that really ran
      expect(replay.drifted).toBe(false);
      expect(headerOf(replay.playByPlay)).toContain(`· ${stage}`);
      seen.push(stage!);
    }
    expect(seen.filter((s) => s === "Semifinals").length).toBe(4);
    expect(seen.filter((s) => s === "Final").length).toBe(2);
  });
});

describe("the drift guard", () => {
  /**
   * ⚠ THE MOST IMPORTANT TEST IN THE FILE.
   *
   * The archive is now a seed, and a seed is only worth what the engine that
   * reads it says. Retune `simulatePair`, `FORMATS`, `BATTLE`, `FIGURE` or the
   * rng and every historical fight regenerates into a DIFFERENT fight — one
   * the loser may win. `drifted` is what stops that being shown as history.
   *
   * A test cannot retune the engine, so it tampers with the ARCHIVE instead
   * and asks the same question from the other side: given a row the current
   * engine does not reproduce, does the guard fire? Figures and result are two
   * INDEPENDENT checks in `replayFight`, and a guard that only watches one is
   * half a guard — a retune that moved the banding without moving a single
   * outcome would sail straight past a result-only check.
   */
  test("a tampered FIGURE is caught, and the detail names both sides", () => {
    const w = world();
    duel(w);
    const [a, b] = rowsOf(w);
    const bumped = a.pitFigure + 5;
    w.db.update(battleLog).set({ pitFigure: bumped }).where(eq(battleLog.id, a.id)).run();

    const replay = replayFight(w.db, a.id)!;
    expect(replay.drifted).toBe(true);
    expect(replay.driftDetail).toContain("figures replay");
    // Both numbers, both sides: a detail that printed only the mismatched one
    // would leave a reader unable to tell which engine is being described.
    expect(replay.driftDetail).toContain(`${replay.figures[0]}/${replay.figures[1]}`);
    expect(replay.driftDetail).toContain(`${bumped}/${b.pitFigure}`);
    // The archive is still reported honestly — flagged, not hidden, not
    // replaced by what the engine now believes.
    expect(replay.archivedFigures).toEqual([bumped, b.pitFigure]);
    expect(replay.playByPlay.length).toBeGreaterThan(0);
  });

  /**
   * The other direction, and the one that actually costs a player something:
   * the archive says one bird won and the regenerated fight says the other
   * did. A transcript that contradicts the settled result is worse than no
   * transcript, because the money already moved on the archive's answer.
   */
  test("a tampered RESULT is caught, and the detail names the two birds", () => {
    const w = world();
    duel(w);
    const [a, b] = rowsOf(w);
    // Flip only side A's verdict — the figures stay untouched, so this fires
    // the winner check ALONE and proves it is not riding on the figure check.
    const flipped = a.result === "win" ? "loss" : "win";
    w.db.update(battleLog).set({ result: flipped }).where(eq(battleLog.id, a.id)).run();

    const replay = replayFight(w.db, a.id)!;
    expect(replay.drifted).toBe(true);
    expect(replay.figures).toEqual(replay.archivedFigures); // figures agree — only the verdict doesn't
    expect(replay.driftDetail).not.toContain("figures replay");
    expect(replay.driftDetail).toContain("the replay is won by");
    const nameOf = (id: string) => w.db.select().from(birds).where(eq(birds.id, id)).get()!.name;
    expect(replay.driftDetail).toContain(nameOf(a.birdId));
    expect(replay.driftDetail).toContain(nameOf(b.birdId));
  });

  /**
   * NULL AND DRIFTED ARE DIFFERENT ANSWERS. "This fight cannot be rebuilt" and
   * "this fight rebuilds into something else" want different words in front of
   * a player, and the one thing neither may become is a plausible-looking
   * guess. One fight is two rows; without its mirror there is no way to know
   * which side was A, and getting that wrong silently swaps the combatants.
   */
  test("an unrebuildable fight returns null rather than a guess", () => {
    const w = world();
    duel(w);
    const [a, b] = rowsOf(w);
    w.db.delete(battleLog).where(eq(battleLog.id, b.id)).run();
    expect(replayFight(w.db, a.id)).toBeNull();
    // And a row that never existed is unavailable, not a crash.
    expect(replayFight(w.db, a.id + 9999)).toBeNull();
  });

  /**
   * A bird the flock no longer holds is the second unavailable case, and it is
   * the one a caller will actually meet: the transcript survives the bird only
   * as long as the row does.
   */
  test("a missing bird is unavailable too — the fight needs both combatants", () => {
    const w = world();
    duel(w);
    const [a] = rowsOf(w);
    w.db.delete(birds).where(eq(birds.id, a.birdId)).run();
    expect(replayFight(w.db, a.id)).toBeNull();
  });
});

/**
 * ⚠ THE ONE PLACE THE OUTPUT IS DELIBERATELY NOT BYTE-STABLE, pinned so it
 * cannot be "fixed" by somebody who meets it as a surprise.
 *
 * `replay.ts` states the caveat in prose: a renamed bird replays under its NEW
 * name, because `name` is narration and feeds no roll. Both halves matter and
 * they pull opposite ways — the text MUST change (you want to read about the
 * bird you know today) and the fight MUST NOT (the night is settled). Without
 * a test, the changed text reads like a replay bug and the obvious "fix" is to
 * start storing names on the row, which is how 51 MB grows back.
 */
describe("the rename caveat", () => {
  test("a renamed bird replays under its new name — and the fight is untouched", () => {
    const w = world();
    const fight = duel(w);
    const [a] = rowsOf(w);
    const before = replayFight(w.db, a.id)!;
    expect(before.playByPlay).toBe(fight.playByPlay);

    const old = w.db.select().from(birds).where(eq(birds.id, a.birdId)).get()!.name;
    w.db.update(birds).set({ name: "Bagong Pangalan" }).where(eq(birds.id, a.birdId)).run();

    const after = replayFight(w.db, a.id)!;
    expect(after.playByPlay).toContain("Bagong Pangalan");
    expect(after.playByPlay).not.toContain(old);
    expect(after.playByPlay).not.toBe(before.playByPlay); // the caveat, made visible
    // …and nothing about the NIGHT moved: same figures, same verdict, no drift.
    expect(after.drifted).toBe(false);
    expect(after.figures).toEqual(before.figures);
    expect(after.archivedFigures).toEqual(before.archivedFigures);
  });
});

/**
 * `toCombatant` copies six stats, the element and the stars, and pointedly
 * NOTHING else — no record, no age, no farm, no status. That indifference is
 * not a detail of the helper, it is the reason an archive of seeds is worth
 * the same as an archive of transcripts: a bird's combat slice is fixed at
 * birth, so it is the same today as it was the night it fought.
 *
 * Nothing else in the suite pins it. Wire any of those columns into a roll and
 * every fight in the game's history quietly becomes unreplayable, and the only
 * symptom would be the doctor's drift line moving.
 */
describe("what a fight is made of", () => {
  test("a bird's later career, age, barn and retirement change nothing about its old fights", () => {
    const w = world();
    const fight = duel(w);
    const [a] = rowsOf(w);
    const before = replayFight(w.db, a.id)!;

    const row = w.db.select().from(birds).where(eq(birds.id, a.birdId)).get()!;
    // Everything a bird accumulates AFTER a fight, moved at once: it won ten
    // more and lost seven, it aged three years, it was sold to the rival barn
    // and it has since been retired.
    w.db
      .update(birds)
      .set({
        wins: row.wins + 10,
        losses: row.losses + 7,
        stakesWins: row.stakesWins + 10,
        birthWeek: row.birthWeek - 3,
        birthDay: row.birthDay - 21,
        farmId: w.rivalId,
        status: "retired",
        retiredBy: "manual",
        retiredWeek: 1,
      })
      .where(eq(birds.id, row.id))
      .run();

    const after = replayFight(w.db, a.id)!;
    expect(after.playByPlay).toBe(before.playByPlay);
    expect(after.playByPlay).toBe(fight.playByPlay);
    expect(after.drifted).toBe(false);
    expect(after.figures).toEqual(before.figures);
  });
});

/**
 * The doctor's drift alarm. Its job is to notice an engine retune orphaning
 * history BEFORE somebody reads a transcript that lies — so the number it
 * reports has to be trustworthy in both states, and the sampling stride has to
 * actually land on rows.
 */
describe("replayFidelity — the doctor's sample", () => {
  test("a healthy world reports every fight checked, none drifted, nothing to show", () => {
    const w = world();
    duel(w, "Alab", 7001);
    duel(w, "Sinag", 31);
    const rows = rowsOf(w);
    expect(rows.length).toBe(4);

    // A sample larger than the world strides by 1, so this is exhaustive: the
    // count is the claim, not a spot check.
    const report = replayFidelity(w.db, 500);
    expect(report.checked).toBe(rows.length);
    expect(report.drifted).toBe(0);
    expect(report.unavailable).toBe(0);
    // Examples are the doctor's evidence line. Clean means SILENT — a report
    // that always prints something trains the reader to stop looking.
    expect(report.examples).toEqual([]);
  });

  test("one poisoned row surfaces on the sample, both sides of it, with an example", () => {
    const w = world();
    duel(w, "Alab", 7001);
    duel(w, "Sinag", 31);
    const rows = rowsOf(w);
    const victim = rows[0];
    w.db
      .update(battleLog)
      .set({ pitFigure: victim.pitFigure + 5 })
      .where(eq(battleLog.id, victim.id))
      .run();

    const report = replayFidelity(w.db, 500);
    expect(report.checked).toBe(rows.length);
    // TWO, not one. A fight is a pair of rows and the figures are compared per
    // side, so poisoning either row makes BOTH of them replay wrong — which is
    // exactly the doubling the doctor's percentage has to be read through.
    expect(report.drifted).toBe(2);
    expect(report.examples.length).toBe(2);
    expect(report.examples[0]).toContain(`log #${victim.id}`);
    expect(report.examples[0]).toContain("figures replay");
  });

  test("a broken pair counts as unavailable, never as clean", () => {
    const w = world();
    duel(w, "Alab", 7001);
    duel(w, "Sinag", 31);
    const rows = rowsOf(w);
    w.db.delete(battleLog).where(eq(battleLog.id, rows[0].id)).run();

    const report = replayFidelity(w.db, 500);
    // Three rows survive; the widowed one cannot be rebuilt. Counting it as
    // checked-and-clean would let a corrupted archive read as a healthy one.
    expect(report.checked).toBe(2);
    expect(report.unavailable).toBe(1);
    expect(report.drifted).toBe(0);
  });
});

/**
 * ── THE SIDE COLUMN (round 39) ──────────────────────────────────────────────
 *
 * `simulatePair` shares ONE rng between the two combatants, so the argument
 * order decides who gets which roll. Replay the pair swapped and you get a
 * DIFFERENT fight, not a mirrored one — which makes "who was side 0" load-
 * bearing for every transcript in the game.
 *
 * Round 38 inferred it: the lower battle_log id was side 0, true only because
 * both engines happened to insert one row per turn of a `sides.entries()`
 * loop. Nothing enforced that. Batching the two inserts into a single
 * `.values([a, b])` — a tidy-up any reasonable person might make — would have
 * broken every replay in the game while compiling clean, and the drift guard
 * would have reported it as "the fight engine was retuned": a true alarm with
 * the wrong cause on it, which is the expensive kind.
 *
 * These pin the order as DATA. The first one deliberately also asserts the old
 * insertion-order property still holds, so the two agree today and the day
 * they stop agreeing is a day nothing breaks.
 */
describe("which side was A is stored, not guessed", () => {
  test("both engines write one side 0 and one side 1 per fight", () => {
    const w = world();
    duel(w);
    crownDay(w);
    const rows = rowsOf(w);
    // A daily-card pair and at least one bracket pair — the two write their
    // rows from different files, so proving it on one proves nothing about
    // the other.
    expect(rows.some((r) => r.lobbyId !== null)).toBe(true);
    expect(rows.some((r) => r.tournamentId !== null)).toBe(true);

    const pairs = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = [r.dayIndex, r.seed, [r.birdId, r.opponentBirdId].sort().join("|")].join("/");
      pairs.set(key, [...(pairs.get(key) ?? []), r]);
    }
    expect(pairs.size).toBeGreaterThan(1);
    for (const pair of pairs.values()) {
      expect(pair.length).toBe(2);
      expect(pair.map((r) => r.side).sort()).toEqual([0, 1]);
      // Round 38's assumption, still true — and now merely a coincidence
      // rather than the thing holding the archive up.
      const [lower, higher] = [...pair].sort((x, y) => x.id - y.id);
      expect(lower.side).toBe(0);
      expect(higher.side).toBe(1);
    }
  });

  test("the replay reads the column, not the row ids", () => {
    const w = world();
    duel(w);
    const [a, b] = rowsOf(w);
    const truth = replayFight(w.db, a.id)!;
    expect(truth.drifted).toBe(false);

    // Relabel the sides without touching a single id. Under the old inference
    // this changed nothing at all; now it changes which bird is handed to
    // `simulatePair` first, and the archived figures come back in the other
    // order because the archive is read side-first.
    w.db.update(battleLog).set({ side: 1 }).where(eq(battleLog.id, a.id)).run();
    w.db.update(battleLog).set({ side: 0 }).where(eq(battleLog.id, b.id)).run();

    const swapped = replayFight(w.db, a.id)!;
    expect(swapped.archivedFigures).toEqual([truth.archivedFigures[1], truth.archivedFigures[0]]);
  });

  test("a pair that does not hold one of each side is unavailable, not a guess", () => {
    const w = world();
    duel(w);
    const [a, b] = rowsOf(w);
    // Two rows both claiming side 0 is corrupt, not drifted: there is no order
    // to replay in, so the honest answer is that the fight cannot be rebuilt.
    // Falling back to the ids here would be the round-38 assumption sneaking
    // back in through the error path.
    w.db.update(battleLog).set({ side: 0 }).where(eq(battleLog.id, b.id)).run();
    expect(replayFight(w.db, a.id)).toBeNull();
    expect(replayFight(w.db, b.id)).toBeNull();
    expect(replayFidelity(w.db, 500).unavailable).toBe(2);
  });
});
