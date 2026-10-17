import { NextResponse } from "next/server";
import { z } from "zod";
import { FARM_FIGHT_PAGE, farmFightPage } from "@/app/admin/bird-fights";
import { db } from "@/db/client";
import { game } from "../../shared";

/**
 * The farm page's Results view, a page at a time, newest first: GET
 * ?before=<log id>&limit=<n>. Farm-scoped by the session (or a farm key):
 * there is no farm parameter to point at somebody else's barn.
 */
const Query = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(FARM_FIGHT_PAGE.MAX)
    .default(FARM_FIGHT_PAGE.DEFAULT),
});

export async function GET(req: Request) {
  let farmId: string;
  try {
    farmId = game(req).farmId;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 401 }
    );
  }
  const params = new URL(req.url).searchParams;
  const parsed = Query.safeParse({
    before: params.get("before") ?? undefined,
    limit: params.get("limit") ?? undefined,
  });
  if (!parsed.success)
    return NextResponse.json(
      { error: `Send ?before=<log id>&limit=<1–${FARM_FIGHT_PAGE.MAX}>` },
      { status: 400 }
    );
  return NextResponse.json(farmFightPage(db(), farmId, parsed.data));
}

export type FarmFightPage = ReturnType<typeof farmFightPage>;
