/**
 * The observable smoke run. EVERY run writes its own timestamped database
 * (data/sim-YYYYMMDD-HHMM.db) — iterate freely, nothing clashes, nothing
 * needs wiping. The world starts on day 0, a Friday (Zane's ruling,
 * 2026-08-03): the dev farm plays a simple honest day, the six bot stables
 * play theirs inside the tick. View the newest run with `bun dev:sim` →
 * http://localhost:3435/admin.
 *
 *   bun run simulate [days=5] [--keep] [--db=path] [--force]
 *
 * --keep   continue the NEWEST sim db (or --db target) instead of seeding new.
 * --db     target a specific database file.
 * --force  required to reseed a db holding registered player farms.
 */
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { createDb, latestSimDb } from "@/db/client";
import { farms } from "@/db/schema";
import { seedGame, DEV_FARM_ID } from "@/db/seed-data";
import { playAllHonestDays } from "@/engine/auto-play";
import { diagnose, formatReport } from "@/engine/doctor";
import { Bots } from "@/engine/bots";
import { Game } from "@/engine/game";

const args = process.argv.slice(2);
const dayArg = args.find((a) => /^\d+$/.test(a));
// `simulate 0` is a real request: seed a fresh world and play NO days —
// the manual-play starting point (tick it yourself via the API).
const days = dayArg === undefined ? 5 : Number(dayArg);
const keep = args.includes("--keep");
const force = args.includes("--force");
const dbArg = args.find((a) => a.startsWith("--db="))?.slice(5);

function stamp(): string {
  const t = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}`;
}

const dbPath = path.resolve(
  dbArg ?? (keep ? latestSimDb() : path.join(process.cwd(), "data", `sim-${stamp()}.db`))
);

if (!keep && existsSync(dbPath)) {
  // The wipe guard: a database holding farms that were REGISTERED (not
  // seeded — the dev farm and the bots don't count) is somebody's world.
  const existing = createDb(dbPath)
    .select()
    .from(farms)
    .all()
    .filter((f) => f.isBot === 0 && f.id !== DEV_FARM_ID);
  if (existing.length > 0 && !force) {
    console.error(
      `REFUSING to wipe ${dbPath} — it holds ${existing.length} registered player farm(s): ` +
        existing.map((f) => f.name).join(", ")
    );
    console.error(`Pass --force if you truly mean it, or --keep to simulate on top.`);
    process.exit(1);
  }
  for (const suffix of ["", "-wal", "-shm"]) {
    if (existsSync(dbPath + suffix)) rmSync(dbPath + suffix);
  }
}
const db = createDb(dbPath);
if (!keep) {
  seedGame(db);
  Bots.seed(db);
  console.log(`Fresh world seeded at ${dbPath} — day 0, Friday\n`);
}

const game = new Game(db, DEV_FARM_ID);

for (let day = 1; day <= days; day++) {
  // ── Every player-owned stable plays its honest day ───────────────────
  playAllHonestDays(db);

  // ── The day turns: bots play, the card goes off, staking pays ────────
  const tick = game.tickDay();
  const fights = tick.card.reduce((s, l) => s + l.fights.length, 0);
  const unmatched = tick.card.reduce((s, l) => s + l.unmatched.length, 0);
  const claims = tick.card.reduce((s, l) => s + l.claims.length, 0);
  console.log(
    `Day ${tick.clock.dayIndex} (${tick.clock.date.split(",")[0]}): ${fights} fights, ${unmatched} unmatched, ` +
      `${claims} claims settled, staking paid ${tick.staking.paidGp.toFixed(2)} GP to ${tick.staking.stakers} stakers` +
      (tick.fridays.length ? ` — HATCH FRIDAY (${tick.fridays[0].hatched.length} hatched)` : "")
  );
}

// Every run ends with a check-up (round 24). Before this, a sim printed four
// numbers a day and asserted nothing — which is how two GP burns shipped.
const report = diagnose(db, path.relative(process.cwd(), dbPath));
console.log("\n" + formatReport(report));

console.log(`\nDone → ${dbPath}`);
console.log(`Run \`bun dev:sim\` and open http://localhost:3435/admin — it always shows the newest sim.`);
// LAST, so the path is still on screen when it fails — a broken world is
// exactly the one you want to open.
if (!report.ok) process.exit(1);
