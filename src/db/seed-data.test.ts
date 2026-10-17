import { describe, expect, test } from "bun:test";
import { Bots } from "@/engine/bots";
import { Farms, newFarmKey } from "@/engine/farms";
import { createDb } from "./client";
import { farms } from "./schema";
import { DEV_FARM_KEY, seedGame } from "./seed-data";

describe("seeding keys", () => {
  test("the default seed keeps the fixed dev keys that tests and local play use", () => {
    const db = createDb(":memory:");
    expect(seedGame(db).apiKey).toBe(DEV_FARM_KEY);
    Bots.seed(db, { only: ["bot-10"] });
    expect(new Farms(db).byKey("fk_bot-10").id).toBe("bot-10");
  });

  test("a live seed leaves no guessable key on any farm", () => {
    const db = createDb(":memory:");
    seedGame(db, { apiKey: newFarmKey() });
    Bots.seed(db, { apiKey: () => newFarmKey() });
    const keys = db.select().from(farms).all();
    for (const f of keys) {
      expect(f.apiKey).toMatch(/^fk_[0-9a-f]{32}$/);
      expect(f.apiKey).not.toBe(`fk_${f.id}`);
    }
    expect(new Set(keys.map((f) => f.apiKey)).size).toBe(keys.length);
    expect(() => new Farms(db).byKey(DEV_FARM_KEY)).toThrow();
    expect(() => new Farms(db).byKey("fk_bot-10")).toThrow();
  });
});
