import { game, handle } from "../shared";

/** POST { motherId, fatherId, maxPrice? }: maxPrice is the price the buyer
 *  read off browse_studs, and the cover is refused rather than charged above it. */
export async function POST(req: Request) {
  const body = await req.json();
  return handle(() => {
    const { maxPrice } = body;
    if (maxPrice !== undefined && !(Number.isInteger(maxPrice) && maxPrice > 0))
      throw new Error(`maxPrice must be a whole number of GP — got ${JSON.stringify(maxPrice)}`);
    return game(req).breeding.breed(body.motherId, body.fatherId, { maxPrice });
  });
}
