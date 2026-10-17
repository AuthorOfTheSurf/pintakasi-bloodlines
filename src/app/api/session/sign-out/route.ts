import { NextResponse } from "next/server";
import { farmCookie } from "../../../session";

/** Forget the farm on this browser. The key itself still works everywhere else. */
export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/farm", req.url), 303);
  res.cookies.set(farmCookie(""));
  return res;
}
