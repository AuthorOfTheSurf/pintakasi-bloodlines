import { game, handle } from "../../../shared";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  return handle(() => game().flock.rename(id, body.name));
}
