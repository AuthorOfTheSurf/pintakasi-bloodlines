import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { createDb } from "@/db/client";
import { seedGame } from "@/db/seed-data";
import { Alpha, type ApplyInput } from "@/engine/alpha";
import { Bots } from "@/engine/bots";
import { POST as approvePOST } from "./api/alpha/applications/[id]/approve/route";
import { POST as autoplayPOST } from "./api/autoplay/route";
import { POST as declinePOST } from "./api/alpha/applications/[id]/decline/route";
import { GET as fightsGET } from "./api/farm/fights/route";
import { POST as registerPOST } from "./api/farms/register/route";
import { POST as mcpPOST } from "./api/mcp/route";
import { POST as liveTickPOST } from "./api/tick/live/route";
import { POST as sessionPOST } from "./api/session/route";
import { FARM_COOKIE } from "./session";

/**
 * Every door that production closes, exercised through the real route
 * handlers with production settings. Each of these gates once passed the
 * whole suite while replaced by `return true`; these tests are what fails now.
 */

// The admin page reads request headers for its claim links; outside a request
// there are none, so the test supplies some. Mocked before the page loads.
// The farm page reads its session cookie the same way; `farmCookie` is what
// the test's browser is holding.
let farmCookie: string | undefined;
mock.module("next/headers", () => ({
  headers: async () => new Headers({ host: "test.local" }),
  cookies: async () => ({
    get: (name: string) =>
      name === FARM_COOKIE && farmCookie !== undefined ? { name, value: farmCookie } : undefined,
  }),
}));
// Lazy so the mock is in place first, and loaded BEFORE NODE_ENV flips to
// production: React's dev JSX runtime exports nothing once it has.
const { default: Admin } = await import("./admin/page");
const { default: FarmPage } = await import("./farm/page");

const STEWARD_KEY = "steward-test-key";
const BASE = "http://test.local";
const APPLICANT: ApplyInput = {
  farmName: "Talisay Gamefarm",
  handler: "Lolo Ben",
  contact: "ben@example.com",
  country: "🇵🇭",
  primaryColor: "green",
  secondaryColor: "gold",
};

const env = process.env as Record<string, string | undefined>;
const saved = {
  NODE_ENV: env.NODE_ENV,
  PINTAKASI_DB: env.PINTAKASI_DB,
  PINTAKASI_STEWARD_KEY: env.PINTAKASI_STEWARD_KEY,
  PINTAKASI_LIVE_START: env.PINTAKASI_LIVE_START,
};
const dir = mkdtempSync(path.join(tmpdir(), "pintakasi-gates-"));
let claimToken = "";
let farmKey = "";
let farmName = "";
let pendingId = 0;

beforeAll(() => {
  const file = path.join(dir, "world.db");
  const db = createDb(file);
  seedGame(db);
  Bots.seed(db, { only: ["bot-10"] });
  const alpha = new Alpha(db);
  claimToken = alpha.approve(alpha.apply(APPLICANT).id).claimToken;
  const found = alpha.byClaimToken(claimToken);
  if (!found) throw new Error("the approved application should resolve its claim token");
  farmKey = found.farm.apiKey;
  farmName = found.farm.name;
  pendingId = alpha.apply({ ...APPLICANT, farmName: "Second Gamefarm" }).id;
  env.NODE_ENV = "production";
  env.PINTAKASI_DB = file;
  env.PINTAKASI_STEWARD_KEY = STEWARD_KEY;
  // In the future, so a broken gate answers 200 at once instead of ticking
  // years of days: the test fails on the status, not on a timeout.
  env.PINTAKASI_LIVE_START = "2999-01-01";
});

afterAll(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  rmSync(dir, { recursive: true, force: true });
});

const post = (url: string, init: { headers?: Record<string, string>; body?: string } = {}) =>
  new NextRequest(`${BASE}${url}`, { method: "POST", ...init });
const idParams = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });
const NEW_FARM = JSON.stringify({ name: "Sneaky", primaryColor: "red", secondaryColor: "gold" });

describe("production gates", () => {
  test("POST /api/farms/register is closed", async () => {
    const res = await registerPOST(post("/api/farms/register", { body: NEW_FARM }));
    expect(res.status).toBe(403);
  });

  test("MCP register_farm is closed", async () => {
    const res = await mcpPOST(
      post("/api/mcp?key=fk_dev", {
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "register_farm", arguments: JSON.parse(NEW_FARM) },
        }),
      })
    );
    const body = await res.text();
    expect(body).toContain("Registration is closed");
    expect(body).not.toContain("apiKey");
  });

  test("approve and decline refuse no key and a wrong key", async () => {
    for (const handler of [approvePOST, declinePOST]) {
      expect((await handler(post("/x"), idParams(pendingId))).status).toBe(401);
      const wrong = post("/x", { headers: { "x-steward-key": "nope" } });
      expect((await handler(wrong, idParams(pendingId))).status).toBe(401);
    }
  });

  test("approve accepts the steward key", async () => {
    const right = post("/x", { headers: { "x-steward-key": STEWARD_KEY } });
    const res = await approvePOST(right, idParams(pendingId));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { claimUrl: string }).claimUrl).toContain("/join/claim/");
  });

  test("POST /api/tick/live refuses without the steward key", async () => {
    expect((await liveTickPOST(post("/api/tick/live"))).status).toBe(401);
    const wrong = post("/api/tick/live", { headers: { "x-steward-key": "nope" } });
    expect((await liveTickPOST(wrong)).status).toBe(401);
  });

  test("/admin without the steward key ships no contacts, claim tokens or stats", async () => {
    // What the server sends is the element tree's props (client components
    // receive their data as serialized props), so the JSON is the payload.
    const publicPage = JSON.stringify(await Admin({ searchParams: Promise.resolve({}) }));
    expect(publicPage).not.toContain(APPLICANT.contact);
    expect(publicPage).not.toContain(claimToken);
    expect(publicPage).not.toContain('"agility"');

    // …and the same check passes for a steward, so the assertions can see data.
    const steward = JSON.stringify(
      await Admin({ searchParams: Promise.resolve({ steward: STEWARD_KEY }) })
    );
    expect(steward).toContain(APPLICANT.contact);
    expect(steward).toContain('"agility"');
  });

  test("/farm without a valid session shows the sign-in form and no farm data", async () => {
    // The element tree is the payload, as for /admin above: a client
    // component's data rides in its props.
    // Elements made outside a render can carry a cyclic owner link, so a
    // repeated object is written once; every string still appears.
    const render = async () => {
      const seen = new WeakSet<object>();
      return JSON.stringify(await FarmPage({ searchParams: Promise.resolve({}) }), (_k, v) => {
        if (typeof v !== "object" || v === null) return v;
        if (seen.has(v)) return undefined;
        seen.add(v);
        return v;
      });
    };
    for (const cookie of [undefined, "fk_not_a_farm"]) {
      farmCookie = cookie;
      const page = await render();
      expect(page).toContain("Open your farm");
      expect(page).toContain('"action":"/api/session"');
      expect(page).not.toContain(farmName);
      expect(page).not.toContain(farmKey);
      expect(page).not.toContain('"gp"');
    }
    // …and the same render with the farm's own key opens that farm, so the
    // assertions above are looking at a page that can show data.
    farmCookie = farmKey;
    const signedIn = await render();
    expect(signedIn).toContain(farmName);
    expect(signedIn).toContain('"gp"');
    expect(signedIn).not.toContain(farmKey);
    farmCookie = undefined;
  });

  test("a world with one farm does not hand it to a caller with no key", async () => {
    // Its own world: the shared one has several farms, where the shortcut
    // never applied and this test could not fail.
    const file = path.join(dir, "sole.db");
    seedGame(createDb(file));
    const sharedDb = env.PINTAKASI_DB;
    env.PINTAKASI_DB = file;
    try {
      expect((await autoplayPOST(post("/api/autoplay"))).status).toBe(401);
      expect((await fightsGET(new NextRequest(`${BASE}/api/farm/fights`))).status).toBe(401);
      // …and outside production the same call is let through, so the 401s
      // above are the gate and not some other refusal.
      env.NODE_ENV = "development";
      expect((await fightsGET(new NextRequest(`${BASE}/api/farm/fights`))).status).toBe(200);
    } finally {
      env.NODE_ENV = "production";
      env.PINTAKASI_DB = sharedDb;
    }
  });

  test("POST /api/session sets a secure httpOnly cookie only for a real key", async () => {
    const form = (key: string) => {
      const body = new FormData();
      body.set("key", key);
      return new Request(`${BASE}/api/session`, { method: "POST", body });
    };
    const bad = await sessionPOST(form("fk_not_a_farm"));
    expect(bad.status).toBe(303);
    expect(bad.headers.get("set-cookie")).toBeNull();
    expect(bad.headers.get("location")).not.toContain("fk_not_a_farm");

    const good = await sessionPOST(form(farmKey));
    expect(good.status).toBe(303);
    const cookie = good.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${FARM_COOKIE}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
  });
});
