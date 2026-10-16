import { timingSafeEqual } from "node:crypto";

/**
 * Who may walk through which door, in one place, beside the tick gate in
 * ./ticks.ts and on the same pattern: local development stays open with no
 * environment file, and production opts in explicitly.
 */

/**
 * Open registration (POST /api/farms/register, the MCP register_farm tool).
 * The alpha closes it in production: a farm there comes from an approved
 * application on /join, after the buy-in. PINTAKASI_OPEN_REGISTRATION=1
 * reopens it for a deployment that wants the old beta behaviour.
 */
export function openRegistrationEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.PINTAKASI_OPEN_REGISTRATION === "1";
}

export const CLOSED_REGISTRATION_MESSAGE =
  "Registration is closed during the alpha. Apply for a farm at /join on this site; " +
  "the stewards will reach out, and once approved you get a welcome page with your farm key.";

/**
 * The stewards' key gates deciding alpha applications and seeing applicants'
 * contact details. In production it must match PINTAKASI_STEWARD_KEY, and an
 * unset variable means NOBODY passes, never everybody. Constant-time compare,
 * because this is the one secret an attacker gets unlimited guesses at.
 */
export function stewardAllowed(provided: string | null | undefined): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const expected = process.env.PINTAKASI_STEWARD_KEY;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The key a route request carries: `x-steward-key` header or `?steward=`. */
export function stewardKeyOf(req: Request): string | null {
  return req.headers.get("x-steward-key") ?? new URL(req.url).searchParams.get("steward");
}

/**
 * The site's public origin as the player's browser sees it. Behind a reverse
 * proxy the Host header can be the internal one, so the forwarded headers win.
 */
export function originOf(headers: Headers): string {
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3434";
  const proto =
    headers.get("x-forwarded-proto")?.split(",")[0].trim() ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host.split(",")[0].trim()}`;
}
