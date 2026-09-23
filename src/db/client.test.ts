import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb } from "./client";

// A real file, not ":memory:". An in-memory database cannot be in WAL mode,
// so it would not test the combination the live world runs.
test("every database is WAL and fsyncs on every commit", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "pintakasi-client-"));
  try {
    const db = createDb(path.join(dir, "t.db"));
    const client = (
      db as unknown as { $client: { query(sql: string): { get(): Record<string, unknown> } } }
    ).$client;
    expect(client.query("PRAGMA journal_mode").get()).toEqual({ journal_mode: "wal" });
    // 2 = FULL. 1 (NORMAL) loses committed ticks when the host restarts (tworduel#47).
    expect(client.query("PRAGMA synchronous").get()).toEqual({ synchronous: 2 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
