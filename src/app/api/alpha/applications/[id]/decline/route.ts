import { decide } from "../decide";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return decide(req, params, "decline");
}
