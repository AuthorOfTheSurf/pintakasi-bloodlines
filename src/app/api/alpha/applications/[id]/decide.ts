import { NextResponse } from "next/server";
import { originOf, stewardAllowed, stewardKeyOf } from "@/app/doors";
import { db } from "@/db/client";
import { Alpha } from "@/engine/alpha";

/**
 * A steward's verdict on one application, shared by the approve and decline
 * routes. Approve answers with the claim link to send the player; the farm
 * key itself never leaves through this route, only through that page.
 */
export async function decide(
  req: Request,
  params: Promise<{ id: string }>,
  verdict: "approve" | "decline"
): Promise<NextResponse> {
  if (!stewardAllowed(stewardKeyOf(req)))
    return NextResponse.json(
      { error: "Stewards only: missing or wrong steward key" },
      { status: 401 }
    );
  const { id } = await params;
  const appId = Number(id);
  if (!Number.isInteger(appId) || appId <= 0)
    return NextResponse.json({ error: `Not an application id: ${id}` }, { status: 400 });

  try {
    const alpha = new Alpha(db());
    if (verdict === "decline") return NextResponse.json({ application: alpha.decline(appId) });
    const { application, farm, claimToken } = alpha.approve(appId);
    return NextResponse.json({
      application,
      farm,
      claimUrl: `${originOf(req.headers)}/join/claim/${claimToken}`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
