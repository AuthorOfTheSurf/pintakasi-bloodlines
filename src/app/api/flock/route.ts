import { game, handle } from "../shared";

export async function GET(req: Request) {
  return handle(() => game(req).flock.all());
}
