import { game, handle } from "../shared";

export async function POST(req: Request) {
  return handle(() => {
    const g = game(req);
    return g.farms.checkIn(g.farmId);
  });
}
