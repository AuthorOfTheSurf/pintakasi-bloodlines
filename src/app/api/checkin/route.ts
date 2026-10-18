import { act } from "../shared";

export async function POST(req: Request) {
  return act(req, (g) => g.farms.checkIn(g.farmId));
}
