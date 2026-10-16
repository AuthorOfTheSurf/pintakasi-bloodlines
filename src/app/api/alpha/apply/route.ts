import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { Alpha } from "@/engine/alpha";

/**
 * The /join form posts here. No key: in production this is the only door a
 * stranger can open, and all it does is leave a pending row for a steward.
 * Field rules (required, palette, length caps, name taken) live in
 * engine/alpha.ts; this only insists the body is strings.
 */
const Body = z.object({
  farmName: z.string(),
  handler: z.string(),
  contact: z.string(),
  country: z.string().optional(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  background: z.string().optional(),
  // The honeypot. Hidden from people by the form, filled in by form-stuffing
  // bots, which then get the same success reply and no row.
  website: z.string().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Please fill in the form and try again." }, { status: 400 });
  const { website, ...input } = parsed.data;
  if (website) return NextResponse.json({ ok: true });
  try {
    new Alpha(db()).apply(input);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
