import { db } from "@/db/client";
import { playAllHonestDays } from "@/engine/auto-play";
import { game, handle } from "../../shared";

export async function POST(req: Request) {
  return handle(() => {
    // Sim-era rule (Zane, 2026-08-03): a tick plays ALL stables — every
    // player-owned farm gets its honest day before the day turns, so the
    // /admin buttons and the CLI sim produce the same kind of world.
    // Revisit when real players exist.
    const g = game(req);
    playAllHonestDays(db());
    return g.tickDay();
  });
}
