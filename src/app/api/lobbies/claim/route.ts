import { game, handle } from "../../shared";

/** Place a sealed claim on a pending claimer entry (tag escrowed until post time). */
export async function POST(req: Request) {
  const body = await req.json();
  return handle(() => game(req).lobbies.claim(body.entryId));
}
