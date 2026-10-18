import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq, max } from "drizzle-orm";
import { NextRequest } from "next/server";
import { createDb } from "@/db/client";
import { events, farms } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import type { HonestDayReport } from "@/engine/auto-play";
import { honestDaySentence } from "@/engine/day-summary";
import { makeBird, world, type World } from "@/engine/testkit";
import { tonightFor } from "@/engine/tonight";
import type { FarmLogResponse } from "./api/farm/log/route";
import { GET as logGET } from "./api/farm/log/route";
import { POST as autoplayPOST } from "./api/autoplay/route";
import { POST as namePOST } from "./api/birds/[id]/name/route";
import { POST as cardPOST } from "./api/card/route";
import { POST as checkinPOST } from "./api/checkin/route";
import { POST as mcpPOST } from "./api/mcp/route";
import { FARM_COOKIE } from "./session";

/**
 * The farm log through the real doors: who each door credits, and that the
 * log route shows a farm its own lines and nobody else's. Two player farms,
 * because the failure that matters is one barn reading the other's.
 */
const env = process.env as Record<string, string | undefined>;
const saved = { PINTAKASI_DB: env.PINTAKASI_DB, NODE_ENV: env.NODE_ENV };
const dir = mkdtempSync(path.join(tmpdir(), "pintakasi-farm-log-routes-"));
const BASE = "http://test.local";
let w: World;
let devKey = "";
let rivalKey = "";

const keyOf = (farmId: string) => {
  const row = w.db.select().from(farms).where(eq(farms.id, farmId)).get();
  if (!row) throw new Error(`no farm ${farmId}`);
  return row.apiKey;
};
type Door = { cookie: string } | { farmKey: string } | null;
const headersFor = (door: Door): Record<string, string> => {
  if (!door) return {};
  return "cookie" in door
    ? { cookie: `${FARM_COOKIE}=${door.cookie}` }
    : { "x-farm-key": door.farmKey };
};
const post = (url: string, door: Door, body?: unknown) =>
  new Request(`${BASE}${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headersFor(door) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const readLog = async (query: string, door: Door) => {
  const res = await logGET(
    new Request(`${BASE}/api/farm/log${query}`, { headers: headersFor(door) })
  );
  return { status: res.status, body: (await res.json()) as FarmLogResponse };
};
const fullLog = async (door: Door) => (await readLog("?limit=200", door)).body.entries;
const newestEventId = () =>
  w.db
    .select({ id: max(events.id) })
    .from(events)
    .get()?.id ?? 0;
/** The ledger id behind an entry's cursor ("ord.src.id"), or null for a note. */
const eventIdOf = (cursor: string) => {
  const [ord, src] = cursor.split(".").map(Number);
  return src === 0 ? ord : null;
};
const mcpCall = async (key: string, name: string, args: Record<string, unknown> = {}) => {
  const res = await mcpPOST(
    new NextRequest(`${BASE}/api/mcp?key=${key}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    })
  );
  return res.text();
};

beforeAll(() => {
  const file = path.join(dir, "world.db");
  w = world({ file });
  env.PINTAKASI_DB = file;
  devKey = keyOf(w.devId);
  rivalKey = keyOf(w.rivalId);
});

afterAll(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  rmSync(dir, { recursive: true, force: true });
});

describe("who each door credits", () => {
  test("a REST move with the session cookie is you, via the web", async () => {
    expect((await checkinPOST(post("/api/checkin", { cookie: devKey }))).status).toBe(200);
    const [line] = await fullLog({ cookie: devKey });
    expect([line.kind, line.who, line.via]).toEqual(["check_in", "you", "web"]);
  });

  test("the same move with the farm key is you, via the api", async () => {
    expect((await checkinPOST(post("/api/checkin", { farmKey: rivalKey }))).status).toBe(200);
    const [line] = await fullLog({ farmKey: rivalKey });
    expect([line.kind, line.who, line.via]).toEqual(["check_in", "you", "api"]);
  });

  test("an MCP tool call is you, via mcp", async () => {
    const bird = w.bird("Sinag");
    expect(await mcpCall(devKey, "name_bird", { id: bird.id, name: "Sinag ni Claude" })).toContain(
      "Sinag ni Claude"
    );
    const [line] = await fullLog({ cookie: devKey });
    expect(line).toMatchObject({
      kind: "named",
      who: "you",
      via: "mcp",
      message: "Named a bird Sinag ni Claude. It was called Sinag.",
    });
  });

  test("Enter card leaves one summary naming the refused bird, and its entries carry the press", async () => {
    const [a] = tonightFor(w.db, w.devId).filter((c) => c.suggestion);
    const before = newestEventId();
    const res = await cardPOST(
      post(
        "/api/card",
        { cookie: devKey },
        {
          entries: [
            { birdId: a.birdId, key: a.suggestion },
            { birdId: a.birdId, key: a.suggestion },
          ],
        }
      )
    );
    const { results } = (await res.json()) as { results: { ok: boolean; error?: string }[] };
    expect(results.map((r) => r.ok)).toEqual([true, false]);
    const name = w.dev.flock.all().find((b) => b.id === a.birdId)?.name;

    const log = await fullLog({ cookie: devKey });
    const summaries = log.filter((e) => e.kind === "card");
    expect(summaries).toHaveLength(1);
    const [summary] = summaries;
    expect(summary).toMatchObject({
      who: "you",
      via: "web",
      message: `Entered 1 of 2 birds on tonight's card. ${name} was not entered: ${results[1].error}`,
    });
    const moves = log.filter((e) => (eventIdOf(e.cursor) ?? 0) > before);
    expect(moves.map((e) => e.kind)).toContain("entry");
    for (const m of moves) expect([m.who, m.runId]).toEqual(["you", summary.runId]);
    expect(log.indexOf(summary)).toBeLessThan(Math.min(...moves.map((m) => log.indexOf(m))));
  });

  test("Play my day leaves one summary above its moves, and every move of the run carries it", async () => {
    const chick = makeBird(w.db, { named: 0, name: "Egg of Dev Hen", age: 2 });
    const before = newestEventId();
    const res = await autoplayPOST(post("/api/autoplay", { cookie: devKey }));
    expect(res.status).toBe(200);
    const report = (await res.json()) as HonestDayReport;

    const log = await fullLog({ cookie: devKey });
    const summaries = log.filter((e) => e.kind === "play_my_day");
    expect(summaries).toHaveLength(1);
    const [summary] = summaries;
    expect(summary).toMatchObject({
      who: "play_my_day",
      via: "button",
      message: honestDaySentence(report),
    });
    expect(summary.runId).not.toBeNull();
    // The summary heads its run: nothing of the run sorts above it.
    expect(log.find((e) => e.runId === summary.runId)).toBe(summary);
    const moves = log.filter((e) => (eventIdOf(e.cursor) ?? 0) > before);
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves)
      expect([m.who, m.via, m.runId]).toEqual(["play_my_day", "button", summary.runId]);
    // …and its notes too: the chick it named.
    const named = log.find((e) => e.kind === "named" && e.message.includes("Egg of Dev Hen"));
    expect(named).toMatchObject({ who: "play_my_day", runId: summary.runId });
    expect(report.named.map((n) => n.birdId)).toContain(chick.id);
  });

  test("the play_my_day tool is Play my day, via mcp", async () => {
    await mcpCall(rivalKey, "play_my_day");
    const log = await fullLog({ farmKey: rivalKey });
    const summary = log.find((e) => e.kind === "play_my_day");
    expect(summary).toMatchObject({ who: "play_my_day", via: "mcp" });
    expect(summary?.message).toMatch(/^Played the day\./);
  });
});

describe("GET /api/farm/log", () => {
  test("shows each farm its own lines and none of the other's", async () => {
    const res = await namePOST(
      post(
        `/api/birds/${w.rivalSlot("Kidlat")}/name`,
        { farmKey: rivalKey },
        { name: "Kidlat ng Karibal" }
      ),
      { params: Promise.resolve({ id: w.rivalSlot("Kidlat") }) }
    );
    expect(res.status).toBe(200);
    const rivalRename = "Named a bird Kidlat ng Karibal.";
    const devRename = "Named a bird Sinag ni Claude.";

    const devLines = (await fullLog({ cookie: devKey })).map((e) => e.message);
    const rivalLines = (await fullLog({ farmKey: rivalKey })).map((e) => e.message);
    expect(devLines.some((m) => m.startsWith(devRename))).toBe(true);
    expect(devLines.some((m) => m.startsWith(rivalRename))).toBe(false);
    expect(rivalLines.some((m) => m.startsWith(rivalRename))).toBe(true);
    expect(rivalLines.some((m) => m.startsWith(devRename))).toBe(false);
    // An explicit key beats the browser's cookie: the key's farm is read.
    const both = await readLog("?limit=200", { farmKey: rivalKey });
    const withCookieToo = await logGET(
      new Request(`${BASE}/api/farm/log?limit=200`, {
        headers: { "x-farm-key": rivalKey, cookie: `${FARM_COOKIE}=${devKey}` },
      })
    );
    expect(((await withCookieToo.json()) as FarmLogResponse).entries).toEqual(both.body.entries);
  });

  test("pages strictly older, with no line twice and none skipped", async () => {
    const all = await fullLog({ cookie: devKey });
    expect(all.length).toBeGreaterThan(7);
    const paged: typeof all = [];
    let cursor: string | undefined;
    for (;;) {
      const { status, body } = await readLog(`?limit=3${cursor ? `&before=${cursor}` : ""}`, {
        cookie: devKey,
      });
      expect(status).toBe(200);
      paged.push(...body.entries);
      expect(body.more).toBe(paged.length < all.length);
      if (!body.more) break;
      cursor = body.entries[body.entries.length - 1].cursor;
    }
    expect(paged).toEqual(all);
    expect(new Set(paged.map((e) => e.cursor)).size).toBe(paged.length);
  });

  test("who narrows the log to one label, and the counts agree", async () => {
    const all = await fullLog({ cookie: devKey });
    const { body } = await readLog("?limit=200&who=play_my_day", { cookie: devKey });
    expect(body.entries.length).toBeGreaterThan(0);
    expect(body.entries).toEqual(all.filter((e) => e.who === "play_my_day"));
    expect(body.counts.play_my_day).toBe(body.entries.length);
    expect(body.counts.you).toBe(all.filter((e) => e.who === "you").length);
  });

  test("a bad cursor or label is a 400", async () => {
    for (const q of ["?before=abc", "?before=1.2", "?who=nobody", "?limit=0"])
      expect((await readLog(q, { cookie: devKey })).status).toBe(400);
  });

  test("no key and no cookie is a 401 in production, even in a world with one farm", async () => {
    const file = path.join(dir, "sole.db");
    seedGame(createDb(file));
    const shared = env.PINTAKASI_DB;
    env.PINTAKASI_DB = file;
    try {
      env.NODE_ENV = "production";
      expect((await readLog("", null)).status).toBe(401);
      // …and outside production the same call opens the sole farm, so the
      // 401 above is the gate and not some other refusal.
      env.NODE_ENV = "development";
      expect((await readLog("", null)).status).toBe(200);
    } finally {
      env.NODE_ENV = saved.NODE_ENV;
      env.PINTAKASI_DB = shared;
    }
  });
});
