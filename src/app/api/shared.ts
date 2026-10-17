import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { Farms } from "@/engine/farms";
import { Game } from "@/engine/game";
import { keyFromCookieHeader } from "../session";

/**
 * Resolve the calling farm — low-security beta auth by design:
 * a bearer key via `x-farm-key` header or `?key=` query param, and then the
 * farm page's session cookie (see session.ts), so a browser and an agent
 * reach the same routes. An explicit key wins over the cookie: a tool that
 * names a farm means that farm, whatever browser it runs in.
 * Dev convenience: when exactly ONE farm exists, no key is needed.
 */
export function game(req?: Request): Game {
  const database = db();
  const farmsApi = new Farms(database);
  const key =
    req?.headers.get("x-farm-key") ||
    (req ? new URL(req.url).searchParams.get("key") : null) ||
    keyFromCookieHeader(req?.headers.get("cookie") ?? null);
  if (key) return new Game(database, farmsApi.byKey(key).id);
  const sole = farmsApi.soleFarm();
  if (sole) return new Game(database, sole.id);
  throw new Error("Multiple farms exist — pass your farm key (?key=fk_… or x-farm-key header)");
}

/** Engine errors are rule violations — surface them as 400s with the rule. */
export function handle<T>(fn: () => T): NextResponse {
  try {
    return NextResponse.json(fn() as object);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
