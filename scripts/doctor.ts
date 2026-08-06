/**
 * `bun run doctor` — is this world healthy?
 *
 * A thin shell. All the thinking lives in src/engine/doctor.ts, where the
 * test suite can reach it — `bun test` never looks inside scripts/.
 *
 *   bun run doctor [path] [--live] [--quiet] [--json]
 *
 *   (no args)  the newest data/sim-*.db — almost always the run you just did
 *   --live     data/game.db
 *   path       an explicit database file
 *   --quiet    the invariant block only, for pasting into a message
 *   --json     the raw report
 *
 * Exits 1 when an invariant fails, so it works in a pipeline.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { createDb, latestSimDb } from "@/db/client";
import { diagnose, formatReport } from "@/engine/doctor";

const args = process.argv.slice(2);
const explicit = args.find((a) => !a.startsWith("--"));

const target = explicit
  ? path.resolve(explicit)
  : args.includes("--live")
    ? path.join(process.cwd(), "data", "game.db")
    : latestSimDb();

// createDb() runs CREATE TABLE IF NOT EXISTS, so a mistyped path would be
// CREATED and then reported as a perfectly healthy empty world. Refuse first.
if (!existsSync(target)) {
  console.error(`No database at ${target}`);
  process.exit(1);
}

const db = createDb(target);

// …and a world built by an OLDER schema is the same trap wearing a disguise.
// Round 30 added birds.generation; running the doctor against a pre-round-30
// keeper printed the string "generation" as every bird's generation, for all
// 530 of them, without a single error — SQLite renders a double-quoted
// unknown identifier as a string literal rather than failing. A report that
// is confidently wrong is worse than no report, and this codebase remakes
// worlds instead of migrating them (see CLAUDE.md), so the only honest answer
// is to refuse and say what to do about it.
const columns = db
  .all<{ name: string }>(sql`SELECT name FROM pragma_table_info('birds')`)
  .map((r) => r.name);
const REQUIRED = ["generation"];
const missing = REQUIRED.filter((c) => !columns.includes(c));
if (missing.length > 0) {
  console.error(
    `${path.relative(process.cwd(), target)} was built by an older schema — birds is missing: ${missing.join(", ")}.\n` +
      "Sim databases are disposable by design. Run `bun run simulate` for a fresh world, or delete data/game.db and reseed."
  );
  process.exit(1);
}

const report = diagnose(db, path.relative(process.cwd(), target));

console.log(
  args.includes("--json")
    ? JSON.stringify(report, null, 2)
    : formatReport(report, { quiet: args.includes("--quiet") })
);

process.exit(report.ok ? 0 : 1);
