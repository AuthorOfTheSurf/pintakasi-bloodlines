/**
 * ── THE FARM SESSION — a farm key in a cookie ──────────────────────────────
 *
 * The farm page is the first door a player walks through with a browser
 * instead of Claude, and a browser cannot add `?key=` to every request. So the
 * key rides in a cookie the page's own scripts can never read (httpOnly), that
 * another site's form can never send (SameSite=Lax), and that only travels
 * over HTTPS in production. It is the same credential the MCP URL carries;
 * this only changes where it is kept.
 */
export const FARM_COOKIE = "pk_farm";

/** Long enough to outlast an alpha, short enough that a lost phone expires. */
const MAX_AGE_S = 60 * 60 * 24 * 90;

export function farmCookie(value: string) {
  return {
    name: FARM_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: value ? MAX_AGE_S : 0,
  };
}

/** The farm key out of a raw Cookie header, for route handlers given a plain Request. */
export function keyFromCookieHeader(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== FARM_COOKIE) continue;
    // A mangled cookie (a stray "%") is a signed-out browser, not a 500.
    try {
      return decodeURIComponent(rest.join("=")) || null;
    } catch {
      return null;
    }
  }
  return null;
}
