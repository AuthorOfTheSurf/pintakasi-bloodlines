import { NextResponse } from "next/server";
import { birdFightRows } from "@/app/admin/bird-fights";
import { db } from "@/db/client";

/**
 * ── ONE BIRD'S FIGHT HISTORY (round 65) ────────────────────────────────────
 *
 * The office asks for a career when a bird is opened, instead of carrying
 * every bird's fights in the page (see `birdFightRows` for what that cost).
 *
 * Unauthenticated for the same reason its sibling `/api/fight/[id]` is: it
 * acts for no farm, and every card it reads is already public on the Fights
 * tab. It opens the database through `db()` so the office and this route
 * cannot disagree about which world they are in.
 *
 * A bird with no rows — an egg, a chick, an id that is not a bird at all —
 * answers with an empty list rather than a 404. "No fights" is a true and
 * ordinary answer here, and the panel says it in a sentence.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json(birdFightRows(db(), id));
}
