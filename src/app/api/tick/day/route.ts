import { game, handle } from "../../shared";

export async function POST(req: Request) {
  return handle(() => game(req).tickDay());
}
