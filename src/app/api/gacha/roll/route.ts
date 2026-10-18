import { act } from "../../shared";

export async function POST(req: Request) {
  return act(req, (g) => g.gacha.roll());
}
