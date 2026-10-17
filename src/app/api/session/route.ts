import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { Farms } from "@/engine/farms";
import { farmCookie } from "../../session";

/**
 * Sign in to the farm page: a plain form POST of `key` (the farm key), from
 * the /farm sign-in form or the claim page's "Open my farm" button. A plain
 * form rather than fetch so it works before any script has loaded, and a 303
 * so the browser lands on /farm with a GET and a reload never re-posts.
 *
 * A wrong key sets nothing and says so on the sign-in form. It never echoes
 * the key back: a URL with a key in it ends up in history and in logs.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const key = String(form?.get("key") ?? "").trim();
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url), 303);
  if (!key) return to("/farm?signin=empty");
  try {
    new Farms(db()).byKey(key);
  } catch {
    return to("/farm?signin=unknown");
  }
  const res = to("/farm");
  res.cookies.set(farmCookie(key));
  return res;
}
