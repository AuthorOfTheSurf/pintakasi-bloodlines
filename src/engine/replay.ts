import { and, eq, ne } from "drizzle-orm";
import type { DB } from "@/db/client";
import { battleLog, birds, tournamentEntries, tournaments } from "@/db/schema";
import { FORMATS, weatherOfDay, type Element, type FightFormat } from "./config";
import { simulatePair, toCombatant } from "./fight-sim";
import { labelOf } from "./lobbies";
import { roundName } from "./tournaments";
import { mulberry32 } from "./rng";

/**
 * ── REPLAY: THE FIGHT LOG, REGENERATED INSTEAD OF STORED (round 38) ────────
 *
 * `battle_log.play_by_play` used to hold the full turn-by-turn narration of
 * every fight — ~1.8 KB a row, 51 MB of an 90 MB database, **and nothing in
 * the entire codebase ever read it back.** Not the office, not the API, not
 * the doctor. It was written 28,710 times a sim and read zero times.
 *
 * It is stored no longer, because it does not need to be: the fight is a PURE
 * FUNCTION of things already in the row.
 *
 *   simulatePair(A, B, format, mulberry32(seed), header, weather)
 *
 * Every argument survives. `seed` is on the row. `format` is on the row. The
 * weather is `weatherOfDay(dayIndex)`, a pure function of the day. And the
 * combatants are recoverable because of a design decision made long before
 * this one: **STATS ARE FIXED AT BIRTH.** There is no training in this game,
 * so a bird's combat slice is the same today as it was the night it fought,
 * which is exactly what makes an archive of seeds equivalent to an archive of
 * transcripts. A game with training could not do this.
 *
 * WHAT IS *NOT* GUARANTEED, stated plainly rather than discovered later:
 *
 *   1. **A renamed bird replays under its new name.** `name` is narration
 *      only — it feeds no roll — so the fight is identical and the text is
 *      not. That is arguably the better answer anyway (you want the bird you
 *      know), but it means the output is not byte-stable across a rename.
 *   2. **An engine retune orphans the archive.** If `simulatePair`, `FORMATS`,
 *      `BATTLE`, `FIGURE` or the rng change, replaying an old seed produces a
 *      DIFFERENT fight — possibly one the loser wins. A transcript that
 *      contradicts the result stored beside it is worse than no transcript,
 *      which is the whole reason this needed a guard before it could ship.
 *
 * THE GUARD. Every replay is checked against what the archive already knows:
 * both Pit Figures and who won are stored per row, so a regenerated fight that
 * disagrees is caught and reported rather than shown. `drifted` is the honest
 * answer — "this fight happened, here is its result, but the engine that
 * fought it no longer exists" — and it is never silently papered over.
 *
 * The doctor samples this (see `replayFidelity`) so an engine change that
 * orphans history shows up on the next run instead of the next bug report.
 */
export interface FightReplay {
  /** The regenerated narration. Present even when drifted — flagged, not hidden. */
  playByPlay: string;
  /** Pit Figures as the CURRENT engine produces them, [side A, side B]. */
  figures: [number, number];
  /** The archived figures, in the same order — what actually happened. */
  archivedFigures: [number, number];
  /**
   * TRUE = the engine no longer reproduces the archived result. Trust the
   * archive, not the transcript.
   */
  drifted: boolean;
  driftDetail?: string;
}

/**
 * Rebuild one fight from its battle-log row.
 *
 * Returns null when the fight cannot be reconstructed at all — a missing
 * mirror row, or a bird the flock no longer holds. Null means "unavailable",
 * `drifted` means "available but no longer trustworthy"; they are different
 * answers and a caller should say so differently.
 */
export function replayFight(db: DB, battleLogId: number): FightReplay | null {
  const row = db.select().from(battleLog).where(eq(battleLog.id, battleLogId)).get();
  if (!row) return null;

  // ⚠ THE OTHER HALF OF THE FIGHT. One fight writes TWO rows — one per bird,
  // each holding its own figure and its own result — so a replay needs the
  // sibling. Matched on the bout the two share (lobby or bracket) plus the
  // reciprocal bird ids, which is unique: the group stage lets two birds meet
  // at most once in a lobby, and single elimination at most once in a bracket.
  const sibling = db
    .select()
    .from(battleLog)
    .where(
      and(
        eq(battleLog.birdId, row.opponentBirdId),
        eq(battleLog.opponentBirdId, row.birdId),
        eq(battleLog.dayIndex, row.dayIndex),
        eq(battleLog.seed, row.seed),
        ne(battleLog.id, row.id)
      )
    )
    .get();
  if (!sibling) return null;

  // ⚠ WHICH SIDE WAS A. `simulatePair` shares ONE rng between the two
  // combatants, so the argument order decides who gets which roll — replaying
  // with the sides swapped produces a different fight, not a mirrored one.
  // The engines insert their two rows in side order (see the `for (const [i,
  // side] of sides.entries())` loops), so the LOWER id is side A. That is an
  // insertion-order assumption rather than stored data, which is precisely
  // why the drift guard checks the figures per side: get the order wrong and
  // the figures cross over, and the replay is refused rather than shown
  // backwards.
  const [a, b] = row.id < sibling.id ? [row, sibling] : [sibling, row];

  const birdA = db.select().from(birds).where(eq(birds.id, a.birdId)).get();
  const birdB = db.select().from(birds).where(eq(birds.id, b.birdId)).get();
  if (!birdA || !birdB) return null;

  const sim = simulatePair(
    toCombatant(birdA),
    toCombatant(birdB),
    a.format as FightFormat,
    mulberry32(a.seed),
    headerFor(db, a, b),
    weatherOfDay(a.dayIndex) as Element
  );

  const archivedFigures: [number, number] = [a.pitFigure, b.pitFigure];
  const drift: string[] = [];
  if (sim.figures[0] !== a.pitFigure || sim.figures[1] !== b.pitFigure)
    drift.push(
      `figures replay ${sim.figures[0]}/${sim.figures[1]}, archive says ${a.pitFigure}/${b.pitFigure}`
    );
  const archivedWinner = a.result === "win" ? 0 : 1;
  if (sim.winner !== archivedWinner)
    drift.push(`the replay is won by ${sim.winner === 0 ? birdA.name : birdB.name}, the archive by ${archivedWinner === 0 ? birdA.name : birdB.name}`);

  return {
    playByPlay: sim.playByPlay,
    figures: sim.figures,
    archivedFigures,
    drifted: drift.length > 0,
    driftDetail: drift.length > 0 ? drift.join(" · ") : undefined,
  };
}

/**
 * The narration's title line, rebuilt.
 *
 * Decoration only — it is printed above the fight and feeds no roll — so
 * getting it slightly wrong would cost cosmetics, not correctness. It is
 * rebuilt exactly anyway, because a log line that misnames the card it came
 * off is the kind of small lie this codebase has now been bitten by twice.
 */
function headerFor(
  db: DB,
  a: typeof battleLog.$inferSelect,
  b: typeof battleLog.$inferSelect
): string {
  if (a.lobbyId !== null)
    return labelOf({
      mode: a.mode as "juvenile" | "real",
      classType: a.lobby,
      format: a.format as FightFormat,
      price: a.claimPrice,
    });

  const crown = `${FORMATS[a.format as FightFormat].label} Championship`;
  if (a.tournamentId === null) return crown;
  const t = db.select().from(tournaments).where(eq(tournaments.id, a.tournamentId)).get();
  if (!t?.bracketSize) return crown;
  // The stage is recoverable from the LOSER's entry: `eliminatedRound` is the
  // round it went out in, which is the round this fight was.
  const loser = a.result === "win" ? b : a;
  const entry = db
    .select()
    .from(tournamentEntries)
    .where(
      and(eq(tournamentEntries.tournamentId, t.id), eq(tournamentEntries.birdId, loser.birdId))
    )
    .get();
  if (!entry?.eliminatedRound) return crown;
  return `${crown} · ${roundName(entry.eliminatedRound, Math.log2(t.bracketSize), t.bracketSize)}`;
}

/**
 * WHAT SHARE OF THE ARCHIVE STILL REPLAYS? — the doctor's drift alarm.
 *
 * Sampled, not exhaustive: replaying 28,000 fights would cost more than the
 * whole rest of the report, and the failure mode this watches for is not
 * subtle. An engine retune orphans EVERY fight before it, so a sample of a
 * couple of hundred either comes back clean or comes back obviously broken.
 * A number between the two means something stranger and is worth the dig.
 *
 * Spread evenly across the world's history rather than taken from the end,
 * because the interesting case is exactly the one where recent fights replay
 * and old ones no longer do.
 */
export function replayFidelity(
  db: DB,
  sample: number
): { checked: number; drifted: number; unavailable: number; examples: string[] } {
  const ids = db
    .select({ id: battleLog.id })
    .from(battleLog)
    .all()
    .map((r) => r.id);
  const step = Math.max(1, Math.floor(ids.length / sample));
  const examples: string[] = [];
  let checked = 0;
  let drifted = 0;
  let unavailable = 0;
  for (let i = 0; i < ids.length; i += step) {
    const r = replayFight(db, ids[i]);
    if (!r) {
      unavailable++;
      continue;
    }
    checked++;
    if (r.drifted) {
      drifted++;
      if (examples.length < 3) examples.push(`log #${ids[i]}: ${r.driftDetail}`);
    }
  }
  return { checked, drifted, unavailable, examples };
}
