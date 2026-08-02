import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { Game } from "@/engine/game";

export function game(): Game {
  return new Game(db());
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
