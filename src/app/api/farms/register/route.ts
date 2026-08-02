import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { seedStarterFlock } from "@/db/seed-data";
import { Farms } from "@/engine/farms";
import { freshSeed } from "@/engine/rng";

// The one route that needs NO key — how a farm comes to exist.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const database = db();
    const { farm, apiKey } = new Farms(database).register(body);
    seedStarterFlock(database, farm.id, { seed: freshSeed() });
    return NextResponse.json({ farm, apiKey, note: "Save the apiKey — it is your login." });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
