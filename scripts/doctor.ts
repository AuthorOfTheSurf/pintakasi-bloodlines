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

const report = diagnose(createDb(target), path.relative(process.cwd(), target));

console.log(
  args.includes("--json")
    ? JSON.stringify(report, null, 2)
    : formatReport(report, { quiet: args.includes("--quiet") })
);

process.exit(report.ok ? 0 : 1);
