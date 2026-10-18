import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import {
  FARM_LOG_PAGE,
  LOG_LABEL_KEYS,
  farmLogCounts,
  farmLogPage,
  type LogLabel,
} from "@/engine/farm-log";
import { game } from "../../shared";

/**
 * The farm page's "Your farm" log, a page at a time, newest first:
 * GET ?before=<cursor>&limit=<n>&who=<label>. Farm-scoped by the session (or
 * a farm key), like the Results route: there is no farm parameter, so no way
 * to point it at somebody else's barn.
 */
const Query = z.object({
  before: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .optional(),
  limit: z.coerce.number().int().positive().max(FARM_LOG_PAGE.MAX).default(FARM_LOG_PAGE.DEFAULT),
  who: z.enum(LOG_LABEL_KEYS as [LogLabel, ...LogLabel[]]).optional(),
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
    who: params.get("who") ?? undefined,
  });
  if (!parsed.success)
    return NextResponse.json(
      {
        error: `Send ?before=<cursor>&limit=<1–${FARM_LOG_PAGE.MAX}>&who=<${LOG_LABEL_KEYS.join("|")}>`,
      },
      { status: 400 }
    );
  const database = db();
  return NextResponse.json({
    ...farmLogPage(database, farmId, parsed.data),
    counts: farmLogCounts(database, farmId),
  });
}

export type FarmLogResponse = ReturnType<typeof farmLogPage> & {
  counts: ReturnType<typeof farmLogCounts>;
};
