import { game, handle } from "../shared";

/** GET ?hen=<birdId> — the barn from that hen's point of view. */
export async function GET(req: Request) {
  const henId = new URL(req.url).searchParams.get("hen");
  return handle(() => {
    if (!henId) throw new Error("Pass ?hen=<birdId> — the barn is browsed hen-first");
    return game(req).breeding.browseStuds(henId);
  });
}

/** POST { birdId, action: "list" | "unlist" } — stand or pull a stud. */
export async function POST(req: Request) {
  const body = await req.json();
  return handle(() =>
    body.action === "unlist"
      ? game(req).breeding.unlistStud(body.birdId)
      : game(req).breeding.listStud(body.birdId)
  );
}
