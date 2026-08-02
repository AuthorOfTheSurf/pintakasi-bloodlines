import { game, handle } from "../../shared";

export async function POST(req: Request) {
  const body = await req.json();
  return handle(() => {
    const g = game(req);
    return g.farms.buyLand(g.farmId, body.amount);
  });
}
