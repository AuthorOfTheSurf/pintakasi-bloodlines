import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { replayFight } from "@/engine/replay";

/**
 * ── ONE FIGHT, REGENERATED ON DEMAND (round 38) ────────────────────────────
 *
 * The narration is no longer stored (see `src/engine/replay.ts`) — it is
 * rebuilt from the row's seed when somebody actually asks for one, which is
 * the only reason it can be this cheap: the office reads ~29,000 fight rows a
 * sim and wants the text of maybe three of them.
 *
 * Unauthenticated on purpose, unlike everything else under `/api`. The other
 * routes ACT for a farm and so must know which farm; this one only reads a
 * fight that already happened, in a world where every card is public — the
 * office's Fights tab already shows every barn's results to anyone who loads
 * the page. Requiring a farm key here would lock the Stewards' Office out of
 * its own archive on any world with more than one farm.
 *
 * ⚠ It opens the database through `db()`, the same lazy singleton the office
 * page uses, so `PINTAKASI_DB` (and `bun dev:sim`'s `latest-sim`) resolves
 * identically for both. Opening our own handle here would let the office and
 * this route disagree about which WORLD they are in, and the symptom would be
 * a 404 on a fight visibly listed one grid above.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Number("") is 0 and Number("12abc") is NaN, so the integer test has to be
  // on the parsed value rather than on parseInt, which would happily accept
  // "12abc" and look up fight 12.
  const battleLogId = Number(id);
  if (!Number.isInteger(battleLogId) || battleLogId <= 0)
    return NextResponse.json({ error: `Not a battle-log id: ${id}` }, { status: 400 });

  // null is "cannot be reconstructed" — a missing sibling row or a bird the
  // flock no longer holds — which is a genuine 404: the fight is gone, not
  // broken. `drifted` is NOT an error and returns 200 with the transcript; the
  // caller is expected to mark it, not hide it.
  const replay = replayFight(db(), battleLogId);
  if (!replay)
    return NextResponse.json(
      { error: `Fight #${battleLogId} cannot be replayed — the archive is missing a bird or the other half of the bout.` },
      { status: 404 }
    );

  return NextResponse.json(replay);
}
