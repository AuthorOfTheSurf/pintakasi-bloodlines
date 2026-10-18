import { act } from "../../shared";

export async function POST(req: Request) {
  const body = await req.json();
  return act(req, (g) => g.farms.buyLand(g.farmId, body.amount));
}
