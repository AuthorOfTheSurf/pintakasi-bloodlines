import { game, handle } from "../shared";

export async function POST(req: Request) {
  const body = await req.json();
  return handle(() =>
    game().battle.fight(body.birdId, body.mode ?? "real", body.format ?? "shortKnife", body.seed)
  );
}
