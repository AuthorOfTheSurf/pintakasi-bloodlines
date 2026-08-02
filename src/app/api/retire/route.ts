import { game, handle } from "../shared";

export async function POST(req: Request) {
  const body = await req.json();
  return handle(() => game(req).flock.retire(body.birdId));
}
