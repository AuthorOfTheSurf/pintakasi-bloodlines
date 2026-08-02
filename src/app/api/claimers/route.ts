import { game, handle } from "../shared";

/** The public claiming board — every pending entry, fogged. */
export async function GET(req: Request) {
  return handle(() => game(req).claimers.board());
}

/** Enter a bird on today's claiming card (binding; fee escrowed). */
export async function POST(req: Request) {
  const body = await req.json();
  return handle(() => game(req).claimers.enter(body.birdId, body.format ?? "shortKnife", body.price));
}
