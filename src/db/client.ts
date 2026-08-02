import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { DDL } from "./ddl";

// Runtime-switched driver: Bun segfaults loading better-sqlite3's native
// module (Bun 1.2.20), and bun:sqlite doesn't exist under Node — so tests and
// scripts (Bun) get bun:sqlite, while `next dev` (Node) gets better-sqlite3.
// Both drizzle adapters expose the same sync query API.
export type DB = BetterSQLite3Database<typeof schema>;

const req = createRequire(import.meta.url);

/** Open (and bootstrap) a database — ":memory:" for tests. */
export function createDb(file: string = defaultDbPath()): DB {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });

  if (process.versions.bun) {
    const { Database } = req("bun:sqlite");
    const sqlite = new Database(file);
    sqlite.run("PRAGMA journal_mode = WAL");
    for (const stmt of splitStatements(DDL)) sqlite.run(stmt);
    const { drizzle } = req("drizzle-orm/bun-sqlite");
    return drizzle(sqlite, { schema }) as unknown as DB;
  }

  const Database = req("better-sqlite3");
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(DDL);
  const { drizzle } = req("drizzle-orm/better-sqlite3");
  return drizzle(sqlite, { schema }) as DB;
}

function splitStatements(ddl: string): string[] {
  return ddl
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function defaultDbPath(): string {
  return process.env.PINTAKASI_DB ?? path.join(process.cwd(), "data", "game.db");
}

// Lazy singleton for the app (routes/MCP); tests always call createDb(":memory:").
let _db: DB | null = null;
export function db(): DB {
  if (!_db) _db = createDb();
  return _db;
}
