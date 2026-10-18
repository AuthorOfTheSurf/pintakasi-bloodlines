import { NextResponse } from "next/server";
import { z } from "zod";
import { FIGHT_MODES, FORMAT_NAMES, LOBBIES, type FightFormat } from "@/engine/config";
import { db } from "@/db/client";
import { FarmNotes } from "@/engine/farm-notes";
import type { Game } from "@/engine/game";
import { game, playerVia } from "../shared";

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
  const entries = parsed.data.entries;
  // One press, one summary line on the farm log, with each entry linked to it.
  // The refusals matter most: they are the one part of a press that leaves no
  // ledger row, so without this line they vanish when the page reloads.
  const results = FarmNotes.run(
    db(),
    "card",
    { kind: "player", via: playerVia(req), farmId: g.farmId },
    () =>
      entries.map(({ birdId, key }): CardResult => {
        try {
          g.lobbies.enter(birdId, key);
          return { birdId, ok: true };
        } catch (err) {
          return { birdId, ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      }),
    (done) => ({ message: cardSentence(g, done), data: done })
  );
  return NextResponse.json({ results });
}

/** "Entered 7 of 8 birds on tonight's card. Kidlat was not entered: <the rule>." */
function cardSentence(g: Game, results: CardResult[]): string {
  const ok = results.filter((r) => r.ok).length;
  const head = `Entered ${ok} of ${results.length} bird${results.length === 1 ? "" : "s"} on tonight's card.`;
  const refused = results.flatMap((r) => {
    if (r.ok) return [];
    // Only this barn's birds get a name here; a bird id the player does not
    // own stays "a bird", so the line cannot become a way to look one up.
    const name = g.flock.all().find((b) => b.id === r.birdId)?.name ?? "A bird";
    return [`${name} was not entered: ${r.error}`];
  });
  return [head, ...refused].join(" ");
}
