import { game, handle } from "../../shared";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => {
    const g = game(req);
    return {
      bird: g.flock.byId(id),
      lineage: g.breeding.lineage(id),
      // The past-performance lines: record + Pit Figures per weapon format.
      formatRecords: g.lobbies.formatRecords(id),
    };
  });
}
