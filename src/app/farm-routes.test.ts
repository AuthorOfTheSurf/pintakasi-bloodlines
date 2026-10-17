import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { birds, farms, lobbyEntries } from "@/db/schema";
import { makeBird, world, type World } from "@/engine/testkit";
import { tonightFor } from "@/engine/tonight";
import { POST as autoplayPOST } from "./api/autoplay/route";
import { POST as namePOST } from "./api/birds/[id]/name/route";
import { POST as cardPOST } from "./api/card/route";
import { FARM_COOKIE } from "./session";

/**
 * The farm page's three write doors, driven through the real route handlers
 * with the session cookie, in a world with TWO player farms. Two, because the
 * failure these guard against is one farm's browser acting on the other's barn.
 */
const env = process.env as Record<string, string | undefined>;
const savedDb = env.PINTAKASI_DB;
const dir = mkdtempSync(path.join(tmpdir(), "pintakasi-farm-routes-"));
let w: World;
let devKey = "";

const keyOf = (farmId: string) => {
  const row = w.db.select().from(farms).where(eq(farms.id, farmId)).get();
  if (!row) throw new Error(`no farm ${farmId}`);
  return row.apiKey;
};
const req = (url: string, key: string | null, body?: unknown) =>
  new Request(`http://test.local${url}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(key ? { cookie: `${FARM_COOKIE}=${key}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const entriesOf = (farmId: string) =>
  w.db.select().from(lobbyEntries).where(eq(lobbyEntries.farmId, farmId)).all();

beforeAll(() => {
  const file = path.join(dir, "world.db");
  w = world({ file });
  env.PINTAKASI_DB = file;
  devKey = keyOf(w.devId);
});

afterAll(() => {
  if (savedDb === undefined) delete env.PINTAKASI_DB;
  else env.PINTAKASI_DB = savedDb;
  rmSync(dir, { recursive: true, force: true });
});

describe("POST /api/card", () => {
  test("enters several birds, reports each refusal, and never touches another farm's bird", async () => {
    const suggested = tonightFor(w.db, w.devId).filter((c) => c.suggestion);
    expect(suggested.length).toBeGreaterThanOrEqual(2);
    const [a, b] = suggested;
    const rivalBird = w.rivalSlot("Alab");
    const rivalBefore = entriesOf(w.rivalId).length;

    const res = await cardPOST(
      req("/api/card", devKey, {
        entries: [
          { birdId: a.birdId, key: a.suggestion },
          { birdId: rivalBird, key: a.suggestion },
          { birdId: b.birdId, key: b.suggestion },
        ],
      })
    );
    expect(res.status).toBe(200);
    const { results } = (await res.json()) as {
      results: { birdId: string; ok: boolean; error?: string }[];
    };
    expect(results.map((r) => [r.birdId, r.ok])).toEqual([
      [a.birdId, true],
      [rivalBird, false],
      [b.birdId, true],
    ]);
    expect(results[1].error).toContain("No bird with id");
    expect(entriesOf(w.rivalId).length).toBe(rivalBefore);
    expect(entriesOf(w.devId).map((e) => e.birdId)).toEqual(
      expect.arrayContaining([a.birdId, b.birdId])
    );

    // The same bird again is the door's refusal, read back per bird.
    const again = await cardPOST(
      req("/api/card", devKey, { entries: [{ birdId: a.birdId, key: a.suggestion }] })
    );
    const [repeat] = ((await again.json()) as { results: { ok: boolean; error?: string }[] })
      .results;
    expect(repeat.ok).toBe(false);
    expect(repeat.error).toContain("already on tonight's card");
  });

  test("refuses a caller with no farm", async () => {
    const res = await cardPOST(
      req("/api/card", null, { entries: [{ birdId: "x", key: { mode: "real" } }] })
    );
    expect(res.status).toBe(400);
    const anon = await cardPOST(
      req("/api/card", null, {
        entries: [{ birdId: "x", key: { mode: "real", classType: "open", format: "b1" } }],
      })
    );
    expect(anon.status).toBe(401);
  });
});

describe("POST /api/birds/[id]/name", () => {
  test("cannot rename another farm's bird", async () => {
    const rivalBird = w.rivalSlot("Alab");
    const before = w.db.select().from(birds).where(eq(birds.id, rivalBird)).get();
    const res = await namePOST(req(`/api/birds/${rivalBird}/name`, devKey, { name: "Stolen" }), {
      params: Promise.resolve({ id: rivalBird }),
    });
    expect(res.status).toBe(400);
    const after = w.db.select().from(birds).where(eq(birds.id, rivalBird)).get();
    expect(after?.name).toBe(before?.name);
  });
});

describe("POST /api/autoplay", () => {
  test("plays the caller's farm and leaves the other player farm alone", async () => {
    const rivalChick = makeBird(w.db, {
      farmId: w.rivalId,
      named: 0,
      name: "Egg of Rival Hen",
      age: 2,
    });
    const devChick = makeBird(w.db, { named: 0, name: "Egg of Dev Hen", age: 2 });
    const rivalRow = () => w.db.select().from(farms).where(eq(farms.id, w.rivalId)).get();
    const rivalBefore = rivalRow();
    const rivalEntries = entriesOf(w.rivalId).length;

    const res = await autoplayPOST(req("/api/autoplay", devKey));
    expect(res.status).toBe(200);
    const report = (await res.json()) as {
      checkedIn: boolean;
      birdsEntered: number;
      named: { birdId: string }[];
    };
    expect(report.checkedIn).toBe(true);
    expect(report.birdsEntered).toBeGreaterThan(0);
    expect(report.named.map((n) => n.birdId)).toContain(devChick.id);

    // The other player's barn: not checked in, not carded, chick still unnamed.
    const rivalAfter = rivalRow();
    expect(rivalAfter?.lastCheckInDay).toBe(rivalBefore?.lastCheckInDay ?? null);
    expect(rivalAfter?.freePulls).toBe(rivalBefore?.freePulls ?? -1);
    expect(entriesOf(w.rivalId).length).toBe(rivalEntries);
    const chick = w.db
      .select()
      .from(birds)
      .where(and(eq(birds.id, rivalChick.id), eq(birds.farmId, w.rivalId)))
      .get();
    expect(chick?.named).toBe(0);
  });
});
