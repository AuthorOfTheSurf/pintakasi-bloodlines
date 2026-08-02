import { game, handle } from "../../shared";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => {
    const g = game();
    return { bird: g.flock.byId(id), lineage: g.breeding.lineage(id) };
  });
}
