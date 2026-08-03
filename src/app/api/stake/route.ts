import { game, handle } from "../shared";

/** POST { amount, action: "stake" | "unstake" } — THE land staking pool. */
export async function POST(req: Request) {
  const body = await req.json();
  return handle(() => {
    const g = game(req);
    return body.action === "unstake"
      ? g.farms.unstake(g.farmId, body.amount)
      : g.farms.stake(g.farmId, body.amount);
  });
}
