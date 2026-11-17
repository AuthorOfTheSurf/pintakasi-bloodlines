import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { STUD_PRICE } from "@/engine/config";
import { act, game } from "../../shared";

/**
 * The farm page's stud control: stand a retired rooster at stud, price him,
 * or pull him. The same three moves Claude makes with list_stud,
 * set_stud_price and unlist_stud, through the same engine doors, so every
 * rule (whose bird it is, retired roosters only, the seat's land, a listed
 * stud's price waiting for the next tick) is the engine's and not this
 * route's. act() credits the move to the player, so the farm log reads "you".
 *
 * The bounds are checked here too, against the same config, so a bad price
 * is a 400 that names them before anything is read or written.
 */
const Price = z.number().int().min(STUD_PRICE.FLOOR).max(STUD_PRICE.CAP);
const Body = z.discriminatedUnion("action", [
  // A price sent with the listing is set first. On a rooster not standing yet
  // it posts at once, so he stands at that price from his first cover.
  z.object({ action: z.literal("list"), birdId: z.string().min(1), price: Price.optional() }),
  z.object({ action: z.literal("price"), birdId: z.string().min(1), price: Price }),
  z.object({ action: z.literal("unlist"), birdId: z.string().min(1) }),
]);
export type StudMove = z.infer<typeof Body>;

export async function POST(req: Request) {
  // Who is asking before what they sent, as the card route does: a stranger
  // gets the same 401 whatever they post.
  try {
    game(req);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 401 }
    );
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      {
        error:
          `Send { action: "list" | "price" | "unlist", birdId, price? } — a price is a whole ` +
          `number of GP from ${STUD_PRICE.FLOOR} to ${STUD_PRICE.CAP}`,
      },
      { status: 400 }
    );
  const move = parsed.data;
  return act(req, (g) => {
    if (move.action === "unlist") return g.breeding.unlistStud(move.birdId);
    if (move.action === "price") return g.breeding.setStudPrice(move.birdId, move.price);
    // One transaction: a listing refused (no land for the seat) takes its
    // price and the price's log line back with it, so a 400 changed nothing.
    return db().transaction(() => {
      if (move.price !== undefined) g.breeding.setStudPrice(move.birdId, move.price);
      return g.breeding.listStud(move.birdId);
    });
  });
}
