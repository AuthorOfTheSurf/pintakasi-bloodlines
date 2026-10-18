import { act } from "../../../shared";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  return act(req, (g) => g.flock.rename(id, body.name));
}
