import { NextResponse } from "next/server";
import { publicTicksEnabled } from "@/app/ticks";
import { db } from "@/db/client";
import { playAllHonestDays } from "@/engine/auto-play";
import { game, handle } from "../../shared";

export async function POST(req: Request) {
  if (!publicTicksEnabled())
    return NextResponse.json(
      { error: "World ticking is disabled on this public deployment." },
      { status: 403 }
    );
  return handle(() => {
    // Same sim-era rule as the day tick: all stables play before the jump.
    // tickWeek's semantics are one closing day + one card, not seven —
    // so one honest day is the matching amount of play.
    const g = game(req);
    playAllHonestDays(db());
    return g.tickWeek();
  });
}
