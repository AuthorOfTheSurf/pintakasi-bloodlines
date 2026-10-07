import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db/client";
import { battleLog, farms, tournamentEntries, tournaments } from "@/db/schema";
import { FORMATS } from "@/engine/config";
import { roundName } from "@/engine/tournaments";
import type { BirdFightRowUI } from "./grids";

/**
 * The card's name for a lobby: mode·class, with "REAL" left unsaid (round
 * 20 — real stakes are the default, so only juvenile and hardcore announce
 * themselves). A plain real/open card just reads OPEN.
 */
export function cardLabel(mode: string, classType: string): string {
  const parts = [
    ...(mode === "real" ? [] : [mode.toUpperCase()]),
    ...(classType === "open" ? [] : [classType.toUpperCase()]),
  ];
  return parts.length ? parts.join("·") : "OPEN";
}

/**
 * ── ONE BIRD'S WHOLE CAREER, READ WHEN IT IS ASKED FOR (round 65) ──────────
 *
 * The Birds grid's detail panel used to be fed from the page itself: every
 * bird's fights serialized into one array, capped at the newest 6,000 rows to
 * keep the page a sane weight. The cap was the bug. A 92-day world holds
 * 38,000 rows, so the panel knew the fights of fewer than half the birds that
 * had fought — and told the season's top earner, 64-18 and last carded two
 * weeks back, that it "has never been in the pit".
 *
 * No cap is the right size, because the array grows with the world and the
 * panel only ever shows one bird. So the page ships none of them and the panel
 * asks for the one career it is looking at. `battle_log(bird_id, day_index)`
 * is indexed, which makes this a few dozen rows off an index instead of a
 * slice of the whole log.
 *
 * One row per battle_log row — the bird's OWN side of each fight, oldest
 * first.
 */
export function birdFightRows(d: DB, birdId: string): BirdFightRowUI[] {
  const rows = d
    .select()
    .from(battleLog)
    .where(eq(battleLog.birdId, birdId))
    .orderBy(battleLog.id)
    .all();
  if (rows.length === 0) return [];

  // The opponent's Pit Figure lives on the opponent's own row. Single
  // elimination in the Majors and one meeting per group on the daily card
  // (round 34) make (lobby|tournament, bird) unique among the rows that name
  // THIS bird as the opponent, so the reciprocal row is addressable exactly.
  // Narrowed by bird_id first because that is the column with an index.
  const opponentIds = [...new Set(rows.map((r) => r.opponentBirdId))];
  const mirrors = d
    .select()
    .from(battleLog)
    .where(and(inArray(battleLog.birdId, opponentIds), eq(battleLog.opponentBirdId, birdId)))
    .all();
  const boutKey = (r: { lobbyId: number | null; tournamentId: number | null }, bird: string) =>
    `${r.lobbyId}|${r.tournamentId}|${bird}`;
  const opponentFigure = new Map(mirrors.map((r) => [boutKey(r, r.birdId), r.pitFigure]));

  const farmById = new Map(
    d
      .select()
      .from(farms)
      .all()
      .map((f) => [f.id, f])
  );

  const tournamentIds = [...new Set(rows.flatMap((r) => (r.tournamentId ? [r.tournamentId] : [])))];
  const brackets = tournamentIds.length
    ? d.select().from(tournaments).where(inArray(tournaments.id, tournamentIds)).all()
    : [];
  const bracketSize = new Map(brackets.map((t) => [t.id, t.bracketSize]));
  // Which round of a bracket a fight was: a bird's `eliminatedRound` is the
  // round of the fight that beat it, so the LOSER's number names the bout for
  // both sides — and the champion, who never has one, reads off its victims.
  const entries = tournamentIds.length
    ? d
        .select()
        .from(tournamentEntries)
        .where(inArray(tournamentEntries.tournamentId, tournamentIds))
        .all()
    : [];
  const eliminatedRound = new Map(
    entries.map((e) => [`${e.tournamentId}|${e.birdId}`, e.eliminatedRound])
  );

  const stageOf = (r: (typeof rows)[number]): string => {
    if (!r.tournamentId) return "";
    const loserId = r.result === "win" ? r.opponentBirdId : r.birdId;
    const size = bracketSize.get(r.tournamentId);
    const round = eliminatedRound.get(`${r.tournamentId}|${loserId}`);
    return size && round ? ` · ${roundName(round, Math.log2(size), size)}` : "";
  };

  return rows.map((r) => {
    const opponentFarm = farmById.get(r.opponentFarmId);
    return {
      // Carried so the pane can ask the server to replay this exact fight.
      logId: r.id,
      birdId: r.birdId,
      day: r.dayIndex,
      card: r.tournamentId
        ? `🏆 ${FORMATS[r.format].label} PINTAKASI${stageOf(r)}`
        : `${FORMATS[r.format].label} · ${cardLabel(r.mode, r.lobby)}${r.claimPrice ? ` @${r.claimPrice}` : ""}`,
      opponent: r.opponentName,
      opponentFarm: opponentFarm?.name ?? r.opponentFarmId,
      opponentFarmP: opponentFarm?.primaryColor ?? "",
      opponentFarmS: opponentFarm?.secondaryColor ?? "",
      result: r.result,
      figure: r.pitFigure,
      // Null rather than 0 when the mirror is missing — a Pit Figure of zero
      // is a legal (terrible) fight, and inventing one would read as a rout.
      opponentFigure: opponentFigure.get(boutKey(r, r.opponentBirdId)) ?? null,
      // The signed net for THIS bird, rake already deducted by the engine.
      // Pintakasi rows carry 0 — the purse settles on the tournament entry,
      // not per fight.
      gp: r.gpDeltaCents / 100,
    };
  });
}
