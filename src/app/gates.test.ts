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
import { POST as declinePOST } from "./api/alpha/applications/[id]/decline/route";
import { POST as registerPOST } from "./api/farms/register/route";
import { POST as mcpPOST } from "./api/mcp/route";
import { POST as liveTickPOST } from "./api/tick/live/route";

/**
 * Every door that production closes, exercised through the real route
 * handlers with production settings. Each of these gates once passed the
 * whole suite while replaced by `return true`; these tests are what fails now.
 */

// The admin page reads request headers for its claim links; outside a request
// there are none, so the test supplies some. Mocked before the page loads.
mock.module("next/headers", () => ({ headers: async () => new Headers({ host: "test.local" }) }));
// Lazy so the mock is in place first, and loaded BEFORE NODE_ENV flips to
// production: React's dev JSX runtime exports nothing once it has.
const { default: Admin } = await import("./admin/page");

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
let pendingId = 0;

beforeAll(() => {
  const file = path.join(dir, "world.db");
  const db = createDb(file);
  seedGame(db);
  Bots.seed(db, { only: ["bot-10"] });
  const alpha = new Alpha(db);
  claimToken = alpha.approve(alpha.apply(APPLICANT).id).claimToken;
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
});
