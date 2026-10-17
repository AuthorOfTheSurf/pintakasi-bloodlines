import { NextResponse } from "next/server";
import { CLOSED_REGISTRATION_MESSAGE, openRegistrationEnabled } from "@/app/doors";
import { db } from "@/db/client";
import { seedStarterFlock } from "@/db/seed-data";
import { Farms } from "@/engine/farms";
import { freshSeed } from "@/engine/rng";

// The keyless way a farm comes to exist, on dev worlds. Production closes it
// for the alpha (see app/doors.ts); there a farm comes from an approved
// application instead (engine/alpha.ts).
export async function POST(req: Request) {
  if (!openRegistrationEnabled())
    return NextResponse.json({ error: CLOSED_REGISTRATION_MESSAGE }, { status: 403 });
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
