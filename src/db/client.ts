import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
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
  const env = process.env.PINTAKASI_DB;
  if (env === "latest-sim") return latestSimDb();
  return env ?? path.join(process.cwd(), "data", "game.db");
}

/**
 * Every simulation run writes its own timestamped file (data/sim-*.db).
 * PINTAKASI_DB=latest-sim (what `bun dev:sim` sets) resolves to the newest
 * one — the names sort chronologically.
 */
export function latestSimDb(): string {
  const dir = path.join(process.cwd(), "data");
  const sims = (existsSync(dir) ? readdirSync(dir) : []).filter((f) => /^sim-.*\.db$/.test(f)).sort();
  if (sims.length === 0)
    throw new Error("No simulation databases in data/ — run `bun run simulate` first");
  return path.join(dir, sims[sims.length - 1]);
}

// Lazy singleton for the app (routes/MCP), keyed by the resolved path AND the
// file's inode — so a dev:sim server picks up a NEWER sim run on the next
// request, and a connection never survives the file being deleted+recreated
// under the same name (a reseed while the server runs). Without the inode
// check, writes keep landing on the deleted file's orphaned inode: ticks
// "work" and return results, but the world on disk never changes.
let _db: DB | null = null;
let _dbPath = "";
let _dbIno = -1;

function inoOf(p: string): number {
  try {
    return Number(statSync(p).ino);
  } catch {
    return -1; // not there yet — createDb will make it
  }
}

export function db(): DB {
  const p = defaultDbPath();
  const ino = inoOf(p);
  if (!_db || p !== _dbPath || ino !== _dbIno) {
    _db = createDb(p);
    _dbPath = p;
    _dbIno = inoOf(p);
  }
  return _db;
}
