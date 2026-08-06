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

/**
 * Round 35, alongside the indexes and the per-tick transaction.
 *
 * `synchronous = NORMAL` is the one that matters: under WAL it stops fsyncing
 * on every commit and syncs at checkpoints instead. The durability it trades
 * away is narrow and, for this project, already accepted — a power cut can
 * cost the most recent commits, but NOT integrity, because WAL still recovers
 * a consistent database. Sim worlds are explicitly disposable (house rule),
 * and the live world is one hand-played game we can re-tick.
 *
 * The cache is 64 MB rather than SQLite's 2 MB default; the working set is a
 * 60 MB database being scanned repeatedly, so this is the difference between
 * reading the battle log from memory and reading it from disk.
 */
const SPEED_PRAGMAS = ["synchronous = NORMAL", "cache_size = -64000", "temp_store = MEMORY"];

/** Open (and bootstrap) a database — ":memory:" for tests. */
export function createDb(file: string = defaultDbPath()): DB {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });

  if (process.versions.bun) {
    const { Database } = req("bun:sqlite");
    const sqlite = new Database(file);
    sqlite.run("PRAGMA journal_mode = WAL");
    for (const p of SPEED_PRAGMAS) sqlite.run(`PRAGMA ${p}`);
    for (const stmt of splitStatements(DDL)) sqlite.run(stmt);
    const { drizzle } = req("drizzle-orm/bun-sqlite");
    return drizzle(sqlite, { schema }) as unknown as DB;
  }

  const Database = req("better-sqlite3");
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  for (const p of SPEED_PRAGMAS) sqlite.pragma(p);
  sqlite.exec(DDL);
  const { drizzle } = req("drizzle-orm/better-sqlite3");
  return drizzle(sqlite, { schema }) as DB;
}

/**
 * Split the DDL into statements for bun:sqlite, which runs one at a time
 * (better-sqlite3's `exec` takes the whole script and needs none of this).
 *
 * ⚠ COMMENTS ARE STRIPPED FIRST, and that is not tidiness — it is a bug fix.
 * This used to split the raw text on ";", so a semicolon inside a `--` comment
 * ended a "statement" early and left the rest of the comment as a chunk with
 * no SQL in it, which bun:sqlite rejects as an empty query. Round 35 hit it
 * immediately: the new index block explains WHY each index exists, per the
 * house comment rule, and one of those sentences contained a semicolon.
 *
 * Given how densely this codebase comments, the DDL had to become commentable
 * rather than the comment become semicolon-free. Safe because no string
 * literal in the DDL contains "--" (the CHECK constraints are all single words
 * in quotes), so there is nothing for the strip to eat by mistake.
 */
function splitStatements(ddl: string): string[] {
  return ddl
    .replace(/--[^\n]*/g, "")
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
 * PINTAKASI_DB=latest-sim (what `bun dev:sim` sets) resolves to the newest.
 *
 * ⚠ ORDERED BY MTIME SINCE ROUND 30, not by name. The names sort
 * chronologically only while every file is the `sim-YYYYMMDD-HHMM` the script
 * generates — and a hand-named keeper does not play along. A
 * `sim-20260806-season-c.db` sorts AFTER `sim-20260806-1636.db`, so the
 * doctor silently reported on a world three schema versions old, and because
 * SQLite renders a double-quoted unknown identifier as a string literal, a
 * column added that day printed as its own NAME for all 530 birds rather than
 * erroring. Nothing looked broken. mtime is what "newest" was always meant
 * to say; now it says it.
 */
export function latestSimDb(): string {
  const dir = path.join(process.cwd(), "data");
  const sims = (existsSync(dir) ? readdirSync(dir) : [])
    .filter((f) => /^sim-.*\.db$/.test(f))
    .map((f) => path.join(dir, f))
    .sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
  if (sims.length === 0)
    throw new Error("No simulation databases in data/ — run `bun run simulate` first");
  return sims[sims.length - 1];
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
