/**
 * ── THE SCOREBOARD (round 53, the 10v10) ────────────────────────────────────
 *
 * The experiment's verdict tool, and the coach's opening query: every farm
 * ranked on NET WORTH — GP plus land valued at the game's own purchase price
 * (LAND.GP_PER_100_TOKENS: 80 GP buys 100 LT, so 0.8 GP per token). Using the
 * buy price is deliberate honesty: it's what the position actually cost to
 * acquire, and land never sells back, so any higher valuation would be
 * marking-to-hope.
 *
 * The scripted-vs-llm group rows at the bottom are the whole experiment in
 * two lines.
 *
 *   bun run scoreboard [path/to/sim.db]     (default: newest sim db)
 */
import { Database } from "bun:sqlite";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { LAND, LT_CENTS } from "@/engine/config";

const dbArg = process.argv[2];
const dbPath =
  dbArg ??
  (() => {
    const dir = "data";
    // "Newest" means simulate's own sim-YYYYMMDD-HHMM stamp, not a bare
    // lexical sort: hand-named dbs like sim-r44-112-s2.db sort after every
    // timestamped run and would shadow fresh worlds forever. (mtime is no
    // better — a bulk copy of data/ rewrites every mtime at once.) The
    // fixed-width stamp makes lexical order chronological within the
    // stamped set; mtime is only the fallback when nothing is stamped.
    const stamped = /^sim-\d{8}-\d{4}(?:-\d+)?\.db$/;
    const all = readdirSync(dir).filter((f) => f.startsWith("sim-") && f.endsWith(".db"));
    if (!all.length) throw new Error("no sim databases in data/");
    const candidates = all.filter((f) => stamped.test(f));
    const pick = candidates.length
      ? candidates.sort().at(-1)!
      : all.sort(
          (a, b) => statSync(path.join(dir, a)).mtimeMs - statSync(path.join(dir, b)).mtimeMs
        ).at(-1)!;
    return path.join(dir, pick);
  })();
if (!existsSync(dbPath)) {
  console.error(`no database at ${dbPath}`);
  process.exit(1);
}

// Not { readonly: true }: a WAL database whose last writer was killed needs
// recovery on open, and a readonly handle can't perform it ("unable to open
// database file"). The queries below are all SELECTs regardless.
const db = new Database(dbPath);
const GP_PER_LT = LAND.GP_PER_100_TOKENS / 100; // 0.8 — the game's own price

interface Row {
  id: string;
  name: string;
  brain: string;
  gp: number;
  lt: number;
  crowns: number;
  crown_gp: number;
}

const rows = db
  .query(
    `SELECT f.id, f.name, f.brain, f.gp,
            (f.land_tokens_cents + f.staked_land_cents) / ${LT_CENTS}.0 AS lt,
            COALESCE(t.crowns, 0) AS crowns,
            COALESCE(t.crown_gp, 0) AS crown_gp
     FROM farms f
     LEFT JOIN (
       SELECT farm_id, COUNT(*) crowns, SUM(gp_won_cents) / 100.0 crown_gp
       FROM tournament_entries WHERE status = 'champion' GROUP BY farm_id
     ) t ON t.farm_id = f.id
     WHERE f.is_bot = 1`
  )
  .all() as Row[];

const worth = (r: Row) => r.gp + r.lt * GP_PER_LT;
rows.sort((a, b) => worth(b) - worth(a));

const day = (db.query(`SELECT MAX(day_index) d FROM sim_timings`).get() as { d: number } | null)?.d;
console.log(`\n  ${dbPath} — through day ${day ?? "?"} · net worth = GP + ${GP_PER_LT}·LT\n`);

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
console.log(
  "  rank  farm                        brain      GP         LT      net worth  crowns (GP won)"
);
rows.forEach((r, i) => {
  console.log(
    `  ${String(i + 1).padStart(4)}  ${r.name.padEnd(26)}  ${r.brain.padEnd(8)}  ${fmt(r.gp).padStart(9)}  ${fmt(r.lt).padStart(7)}  ${fmt(worth(r)).padStart(9)}  ${r.crowns ? `${r.crowns} (${fmt(r.crown_gp)})` : "—"}`
  );
});

// The experiment in two lines.
const groups = new Map<string, Row[]>();
for (const r of rows) {
  const key = r.brain === "scripted" ? "scripted" : "llm";
  groups.set(key, [...(groups.get(key) ?? []), r]);
}
console.log();
for (const [key, members] of groups) {
  const total = members.reduce((s, r) => s + worth(r), 0);
  const crowns = members.reduce((s, r) => s + r.crowns, 0);
  console.log(
    `  ${key.padEnd(8)} (${members.length}): total net worth ${fmt(total)} · avg ${fmt(total / members.length)} · crowns ${crowns}`
  );
}
console.log();
