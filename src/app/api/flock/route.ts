import { game, handle } from "../shared";

export async function GET() {
  return handle(() => game().flock.all());
}
