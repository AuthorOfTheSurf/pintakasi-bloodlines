import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { playMyDay } from "@/engine/auto-play";
import { game } from "../shared";

/**
 * "Play my day for me": the honest day, for the CALLING farm only, once, now.
 * Never every player farm: `playAllHonestDays` is the sim's loop and the live
 * tick deliberately does not run it (alpha-1: ticks play only bot farms).
 */
export async function POST(req: Request) {
  let farmId: string;
  try {
    farmId = game(req).farmId;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 401 }
    );
  }
  return NextResponse.json(playMyDay(db(), farmId));
}
