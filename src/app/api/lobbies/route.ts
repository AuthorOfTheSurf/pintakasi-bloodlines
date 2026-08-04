import { game, handle } from "../shared";

/** The public board — every open lobby and its (fogged) entries. */
export async function GET(req: Request) {
  return handle(() => game(req).lobbies.board());
}

/** Enter a bird on tonight's card (binding; fee escrowed). */
export async function POST(req: Request) {
  const body = await req.json();
  return handle(() =>
    game(req).lobbies.enter(body.birdId, {
      mode: body.mode ?? "real",
      classType: body.classType ?? "open",
      format: body.format ?? "b2",
      price: body.price,
    })
  );
}
