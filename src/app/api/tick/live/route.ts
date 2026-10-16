import { NextResponse } from "next/server";
import { stewardAllowed, stewardKeyOf } from "@/app/doors";
import { runLiveCatchUp } from "@/app/live-clock";
import { handle } from "../../shared";

/**
 * A steward's nudge for the live clock: runs the same catch-up the timer runs.
 * It can only bring the world UP TO the day the calendar calls for, never past
 * it, so pressing it twice is the same as pressing it once.
 */
export async function POST(req: Request) {
  if (!stewardAllowed(stewardKeyOf(req)))
    return NextResponse.json({ error: "Stewards only." }, { status: 401 });
  return handle(() => runLiveCatchUp());
}
