import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { Farms } from "@/engine/farms";

// The public scoreboard — identities only, no keys.
export async function GET() {
  return NextResponse.json(new Farms(db()).all());
}
