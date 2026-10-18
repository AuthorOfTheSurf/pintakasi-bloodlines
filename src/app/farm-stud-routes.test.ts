import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { birds, farms } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { COVERS, STUD_PRICE } from "@/engine/config";
import { world, type World } from "@/engine/testkit";
import type { FarmLogResponse } from "./api/farm/log/route";
import { GET as logGET } from "./api/farm/log/route";
import { POST as studPOST } from "./api/farm/stud/route";
import { FARM_COOKIE } from "./session";

/**
 * The farm page's stud control through the real route, with the session
 * cookie, in a world with two player farms: the failure that matters most is
 * one farm's browser pricing the other's rooster.
 */
const env = process.env as Record<string, string | undefined>;
const saved = { PINTAKASI_DB: env.PINTAKASI_DB, NODE_ENV: env.NODE_ENV };
const dir = mkdtempSync(path.join(tmpdir(), "pintakasi-farm-stud-routes-"));
const BASE = "http://test.local";
let w: World;
let devKey = "";
let rivalKey = "";
let stud = "";

const keyOf = (farmId: string) => {
  const row = w.db.select().from(farms).where(eq(farms.id, farmId)).get();
  if (!row) throw new Error(`no farm ${farmId}`);
  return row.apiKey;
};
const move = (cookie: string | null, body: unknown) =>
  studPOST(
    new Request(`${BASE}/api/farm/stud`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie: `${FARM_COOKIE}=${cookie}` } : {}),
      },
      body: JSON.stringify(body),
    })
  );
const roosterRow = (id: string) => {
  const row = w.db.select().from(birds).where(eq(birds.id, id)).get();
  if (!row) throw new Error(`no bird ${id}`);
  return row;
};
const landOf = (farmId: string) =>
  w.db.select().from(farms).where(eq(farms.id, farmId)).get()?.landTokensCents;
const logOf = async (cookie: string) => {
  const res = await logGET(
    new Request(`${BASE}/api/farm/log?limit=200`, {
      headers: { cookie: `${FARM_COOKIE}=${cookie}` },
    })
  );
  return ((await res.json()) as FarmLogResponse).entries;
};

beforeAll(() => {
  const file = path.join(dir, "world.db");
  w = world({ file });
  env.PINTAKASI_DB = file;
  devKey = keyOf(w.devId);
  rivalKey = keyOf(w.rivalId);
  stud = w.bird("Tandang Pula").id;
  w.db
    .update(farms)
    .set({ landTokensCents: COVERS.STUD_LISTING_LT * 2 })
    .where(eq(farms.id, w.devId))
    .run();
});

afterAll(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  rmSync(dir, { recursive: true, force: true });
});

describe("POST /api/farm/stud", () => {
  test("the owner lists at a price, changes it, pulls him, and lists him again free", async () => {
    const price = STUD_PRICE.FLOOR + 90;
    const listed = await move(devKey, { action: "list", birdId: stud, price });
    expect(listed.status).toBe(200);
    // Priced before he stood, so the price posted at once.
    expect(await listed.json()).toMatchObject({ listed: true, price, pendingPrice: null });
    expect(landOf(w.devId)).toBe(COVERS.STUD_LISTING_LT);

    const changed = await move(devKey, { action: "price", birdId: stud, price: price + 50 });
    expect(changed.status).toBe(200);
    // Standing, so the new price waits for the next tick.
    expect(await changed.json()).toMatchObject({ price, pendingPrice: price + 50 });
    expect(roosterRow(stud)).toMatchObject({ studPrice: price, studPriceNext: price + 50 });

    expect((await move(devKey, { action: "unlist", birdId: stud })).status).toBe(200);
    expect(roosterRow(stud).listedStud).toBe(0);

    const back = await move(devKey, { action: "list", birdId: stud });
    expect(await back.json()).toMatchObject({ listed: true, landSpent: 0 });
    expect(landOf(w.devId)).toBe(COVERS.STUD_LISTING_LT);
  });

  test("each move is on the farm log as you, via the web", async () => {
    const mine = (await logOf(devKey)).filter((e) =>
      ["stud_listed", "stud_unlisted", "stud_price"].includes(e.kind)
    );
    // Newest first: listed again, pulled, the price change, listed, the first price.
    expect(mine.map((e) => e.kind)).toEqual([
      "stud_listed",
      "stud_unlisted",
      "stud_price",
      "stud_listed",
      "stud_price",
    ]);
    for (const e of mine) expect([e.who, e.via]).toEqual(["you", "web"]);
  });

  test("a price outside the bounds, or not whole, is refused before anything changes", async () => {
    const before = roosterRow(stud);
    for (const price of [STUD_PRICE.FLOOR - 1, STUD_PRICE.CAP + 1, STUD_PRICE.FLOOR + 0.5]) {
      const res = await move(devKey, { action: "price", birdId: stud, price });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toContain(
        `${STUD_PRICE.FLOOR} to ${STUD_PRICE.CAP}`
      );
    }
    expect((await move(devKey, { action: "price", birdId: stud })).status).toBe(400);
    expect((await move(devKey, { action: "sell", birdId: stud })).status).toBe(400);
    expect(roosterRow(stud)).toEqual(before);
  });

  test("another farm's key cannot list, price or pull your rooster", async () => {
    const before = roosterRow(stud);
    for (const body of [
      { action: "price", birdId: stud, price: STUD_PRICE.CAP },
      { action: "unlist", birdId: stud },
      { action: "list", birdId: stud, price: STUD_PRICE.CAP },
    ])
      expect((await move(rivalKey, body)).status).toBe(400);
    expect(roosterRow(stud)).toEqual(before);
  });

  test("a hen or a fighting bird is refused by the engine's own rule", async () => {
    const hen = await move(devKey, { action: "list", birdId: w.bird("Dalisay").id });
    expect(hen.status).toBe(400);
    expect(((await hen.json()) as { error: string }).error).toContain("hen");
    const active = await move(devKey, { action: "list", birdId: w.bird("Kidlat").id });
    expect(active.status).toBe(400);
  });

  test("a listing refused for want of land takes its price back with it", async () => {
    const bagwis = w.bird("Bagwis").id;
    w.db.update(farms).set({ landTokensCents: 0 }).where(eq(farms.id, w.devId)).run();
    const res = await move(devKey, { action: "list", birdId: bagwis, price: STUD_PRICE.CAP });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("LT");
    expect(roosterRow(bagwis)).toMatchObject({ listedStud: 0, studPrice: null });
    const notes = (await logOf(devKey)).filter(
      (e) => e.kind === "stud_price" && e.message.includes("Bagwis")
    );
    expect(notes).toHaveLength(0);
  });

  test("no key and no cookie is a 401 in production, even in a world with one farm", async () => {
    const file = path.join(dir, "sole.db");
    seedGame(createDb(file));
    const shared = env.PINTAKASI_DB;
    env.PINTAKASI_DB = file;
    try {
      env.NODE_ENV = "production";
      expect((await move(null, { action: "unlist", birdId: "starter-1" })).status).toBe(401);
      // A malformed body is a 401 too: who is asking comes first.
      expect((await move(null, { nonsense: true })).status).toBe(401);
      // …and outside production the same call opens the sole farm, so the
      // 401 above is the gate and not some other refusal.
      env.NODE_ENV = "development";
      expect((await move(null, { action: "unlist", birdId: "starter-1" })).status).toBe(200);
    } finally {
      env.NODE_ENV = saved.NODE_ENV;
      env.PINTAKASI_DB = shared;
    }
  });
});
