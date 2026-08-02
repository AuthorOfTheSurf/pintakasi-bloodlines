import { game, handle } from "../../shared";

export async function POST() {
  return handle(() => game().tickDay());
}
