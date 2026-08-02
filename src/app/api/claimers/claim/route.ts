import { game, handle } from "../../shared";

/** Place a sealed claim on a pending entry (tag escrowed until the tick). */
export async function POST(req: Request) {
  const body = await req.json();
  return handle(() => game(req).claimers.claim(body.entryId));
}
