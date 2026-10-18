import { NextResponse } from "next/server";
import { z } from "zod";
import { FIGHT_MODES, FORMAT_NAMES, LOBBIES, type FightFormat } from "@/engine/config";
import { game } from "../shared";

/**
 * Enter a whole card in one press — the farm page's "Enter card" bar.
 *
 * Each entry goes through `Lobbies.enter` on its own, so every rule (the card,
 * the ladder, the fee, one card a day, the naming law, whose bird it is) is the
 * door's and not this route's. One refusal does not stop the rest: a player
 * who carded eight birds and was broke for the eighth should still have seven
 * birds entered and one sentence saying why the eighth is not.
 */
const Body = z.object({
  entries: z
    .array(
      z.object({
        birdId: z.string().min(1),
        key: z.object({
          mode: z.enum(FIGHT_MODES),
          classType: z.enum(LOBBIES),
          format: z.custom<FightFormat>((v) => FORMAT_NAMES.some((f) => f === v)),
          price: z.number().int().positive().optional(),
        }),
      })
    )
    .min(1),
});

export interface CardResult {
  birdId: string;
  ok: boolean;
  error?: string;
}

export async function POST(req: Request) {
  // Who is asking before what they sent: a stranger learns nothing about the
  // body's shape, and gets the same 401 whatever they post.
  let g;
  try {
    g = game(req);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 401 }
    );
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Send { entries: [{ birdId, key: { mode, classType, format, price? } }] }" },
      { status: 400 }
    );
  const results: CardResult[] = parsed.data.entries.map(({ birdId, key }) => {
    try {
      g.lobbies.enter(birdId, key);
      return { birdId, ok: true };
    } catch (err) {
      return { birdId, ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  return NextResponse.json({ results });
}
