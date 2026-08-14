/**
 * WORLD HASH — the cheap proof that a refactor changed nothing.
 *
 * Round 48 verified "same world to the byte" by hand: dump the normalized
 * event log and the final farms, birds and scout book out of two sim
 * databases and diff them. That works, but it is a fifteen-minute ritual
 * nobody remembers the shape of two months later, so it only ever got run
 * on the rounds somebody already suspected. This makes it one command:
 *
 *   bun run worldhash data/sim-A.db data/sim-B.db
 *
 * Give it ONE database and it prints that world's table hashes. Give it TWO
 * and it prints a per-table verdict and exits non-zero on any difference —
 * which is what makes it usable as a gate in a PR rather than a thing you
 * read and nod at.
 *
 * ⚠ THE SEEDS MUST MATCH. Two runs without `--seed=N` build two different
 * worlds and every line will differ for a reason that has nothing to do with
 * the code under test. The honest A/B is:
 *
 *   git stash && bun run simulate 92 --seed=1     # before
 *   git stash pop && bun run simulate 92 --seed=1 # after
 *   bun run worldhash data/sim-<before>.db data/sim-<after>.db
 *
 * 92 days runs in about a minute and a half and crosses thirteen full weeks
 * — enough card, breeding and championship traffic that a behaviour change
 * has nowhere to hide. The 182-day run is the BALANCE judgement, not the
 * identity check; there is no reason to spend twenty minutes proving that
 * things you expect to be identical are identical (Zane, 2026-08-14).
 *
 * ── ON --exclude ───────────────────────────────────────────────────────────
 * A round that ADDS a column to an existing table will differ on that table
 * for a trivially explainable reason. `--exclude=farms.brain` drops the named
 * column from the hash so the rest of the row still has to match exactly.
 * Prefer excluding one column over skipping a whole table: the point of the
 * exercise is that everything you did NOT mean to change is proven unchanged.
 */
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

// bun:sqlite, for the reason db/client.ts documents: Bun segfaults loading
// better-sqlite3's native module. Read-only and RAW — deliberately NOT
// `createDb`, which runs the DDL on open and would quietly add this round's
// new columns to the very baseline database we are trying to compare against.
const req = createRequire(import.meta.url);
const { Database } = req("bun:sqlite") as { Database: new (p: string, o?: object) => BunDb };
interface BunDb {
  prepare(sql: string): { all(): unknown[] };
  close(): void;
}

/**
 * `sim_timings` is wall-clock milliseconds — it differs between two runs of
 * IDENTICAL code and says nothing about the world. Nothing else in the
 * schema carries real time (checked round 49), which is why every other
 * table can be compared verbatim.
 */
const SKIP_TABLES = new Set(["sim_timings"]);

const args = process.argv.slice(2);
const excludeArg = args.find((a) => a.startsWith("--exclude="))?.slice("--exclude=".length);
const paths = args.filter((a) => !a.startsWith("--"));

/** "farms.brain,birds.foo" → { farms: Set{brain}, birds: Set{foo} } */
const excluded = new Map<string, Set<string>>();
for (const entry of excludeArg?.split(",").filter(Boolean) ?? []) {
  const [table, column] = entry.split(".");
  if (!table || !column) {
    console.error(`--exclude wants table.column pairs (got "${entry}")`);
    process.exit(2);
  }
  if (!excluded.has(table)) excluded.set(table, new Set());
  excluded.get(table)!.add(column);
}

if (paths.length === 0 || paths.length > 2) {
  console.error("usage: bun run worldhash <db> [<db>] [--exclude=table.col,...]");
  process.exit(2);
}
for (const p of paths) {
  if (!existsSync(p)) {
    console.error(`no such database: ${p}`);
    process.exit(2);
  }
}

interface TableHash {
  rows: number;
  hash: string;
}

/**
 * Hash one database, table by table.
 *
 * Every table is ordered by its full column list rather than by primary key:
 * rowid order is an implementation detail that a batched insert can legally
 * reshuffle (round 48 batched the ledger writes and did exactly that), and a
 * world whose rows are the same set in a different physical order is the
 * same world. Sorting by every column makes the hash depend on the CONTENT
 * and nothing else.
 */
function hashWorld(path: string): Map<string, TableHash> {
  const db = new Database(path, { readonly: true, create: false });
  const out = new Map<string, TableHash>();
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as { name: string }[];

  for (const { name } of tables) {
    if (SKIP_TABLES.has(name)) continue;
    const cols = (db.prepare(`PRAGMA table_info(${name})`).all() as { name: string }[])
      .map((c) => c.name)
      .filter((c) => !excluded.get(name)?.has(c));
    if (cols.length === 0) continue;

    const quoted = cols.map((c) => `"${c}"`).join(", ");
    const rows = db.prepare(`SELECT ${quoted} FROM "${name}" ORDER BY ${quoted}`).all() as Record<
      string,
      unknown
    >[];
    const sha = createHash("sha256");
    for (const row of rows) {
      // JSON of an explicit column list — key order is the SELECT's order, so
      // it is stable across runs, and null/number/string all round-trip
      // unambiguously (unlike a naive join, where 1|null and "1"|"" collide).
      sha.update(JSON.stringify(cols.map((c) => row[c])));
      sha.update("\n");
    }
    out.set(name, { rows: rows.length, hash: sha.digest("hex").slice(0, 16) });
  }
  db.close();
  return out;
}

const pad = (s: string, n: number) => s.padEnd(n);

if (paths.length === 1) {
  const world = hashWorld(paths[0]);
  console.log(`\n  ${paths[0]}\n`);
  for (const [table, { rows, hash }] of world)
    console.log(`  ${pad(table, 20)} ${String(rows).padStart(8)} rows  ${hash}`);
  console.log();
  process.exit(0);
}

const [a, b] = paths.map(hashWorld);
const names = [...new Set([...a.keys(), ...b.keys()])].sort();
let differences = 0;

console.log(`\n  A  ${paths[0]}\n  B  ${paths[1]}\n`);
for (const table of names) {
  const x = a.get(table);
  const y = b.get(table);
  if (!x || !y) {
    console.log(`  ${pad(table, 20)} ✗ present only in ${x ? "A" : "B"}`);
    differences++;
    continue;
  }
  const same = x.hash === y.hash;
  if (!same) differences++;
  const detail = same
    ? `${String(x.rows).padStart(8)} rows  ${x.hash}`
    : `A ${x.rows} rows ${x.hash}  vs  B ${y.rows} rows ${y.hash}`;
  console.log(`  ${same ? "✓" : "✗"} ${pad(table, 20)} ${detail}`);
}

if (differences === 0) {
  console.log(`\n  Same world — ${names.length} tables identical.\n`);
  process.exit(0);
}
console.log(`\n  ${differences} table${differences === 1 ? "" : "s"} DIFFER.\n`);
process.exit(1);
