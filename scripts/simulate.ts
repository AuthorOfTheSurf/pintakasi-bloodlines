/**
 * The observable smoke run. EVERY run writes its own timestamped database
 * (data/sim-YYYYMMDD-HHMM.db) — iterate freely, nothing clashes, nothing
 * needs wiping. The world starts on a MONDAY (day 3 — the calendar's day 0
 * is a Friday): the dev farm plays a simple honest day, the six bot stables
 * play theirs inside the tick. View the newest run with `bun dev:sim` →
 * http://localhost:3435/admin.
 *
 *   bun run simulate [days=5] [--keep] [--db=path] [--force] [--start=friday]
 *
 * --keep   continue the NEWEST sim db (or --db target) instead of seeding new.
 * --db     target a specific database file.
 * --force  required to reseed a db holding registered player farms.
 * --start  friday to start the world on day 0 instead of Monday.
 */
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { createDb, latestSimDb } from "@/db/client";
import { farms, gameState } from "@/db/schema";
import { seedGame, DEV_FARM_ID } from "@/db/seed-data";
import { Bots } from "@/engine/bots";
import { Breeding } from "@/engine/breeding";
import { Game } from "@/engine/game";
import { Gacha } from "@/engine/gacha";
import { mulberry32 } from "@/engine/rng";
import type { LobbySpec } from "@/engine/lobbies";

const args = process.argv.slice(2);
const dayArg = args.find((a) => /^\d+$/.test(a));
// `simulate 0` is a real request: seed a fresh world and play NO days —
// the manual-play starting point (tick it yourself via the API).
const days = dayArg === undefined ? 5 : Number(dayArg);
const keep = args.includes("--keep");
const force = args.includes("--force");
const startFriday = args.includes("--start=friday");
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
  if (!startFriday) {
    // Day 0 is a Friday; Zane's sims start on a MONDAY (day 3). Nothing
    // happens on the skipped weekend — no check-ins, no cards.
    db.update(gameState).set({ dayIndex: 3 }).where(eq(gameState.id, 1)).run();
  }
  console.log(`Fresh world seeded at ${dbPath}${startFriday ? "" : " — starting Monday (day 3)"}\n`);
}

const game = new Game(db, DEV_FARM_ID);
const quietly = (fn: () => unknown) => {
  try {
    fn();
  } catch {
    /* the sim takes no for an answer, like the bots do */
  }
};

for (let day = 1; day <= days; day++) {
  // ── The dev farm's honest day ─────────────────────────────────────────
  quietly(() => game.farms.checkIn(DEV_FARM_ID));

  const gacha = new Gacha(db, DEV_FARM_ID, mulberry32(9000 + day));
  for (;;) {
    const farm = game.farms.rowById(DEV_FARM_ID);
    if (farm.freePulls <= 0) break;
    quietly(() => gacha.roll());
  }

  const flock = game.flock.all();

  quietly(() => {
    const farm = game.farms.rowById(DEV_FARM_ID);
    if (farm.landTokens > 0) game.farms.stake(DEV_FARM_ID, farm.landTokens);
  });

  const breeding = new Breeding(db, DEV_FARM_ID, mulberry32(500 + day));
  for (const rooster of flock.filter((b) => b.status === "retired" && b.sex === "male"))
    quietly(() => breeding.listStud(rooster.id));

  // One cover a day, first hen whose nest is empty (one egg per hen).
  for (const hen of flock.filter((b) => b.status === "retired" && b.sex === "female")) {
    let bred = false;
    quietly(() => {
      const barn = breeding.browseStuds(hen.id);
      if (barn.studs.length > 0) {
        breeding.breed(hen.id, barn.studs[0].birdId);
        bred = true;
      }
    });
    if (bred) break;
  }

  for (const bird of flock.filter((b) => b.status === "active")) {
    const spec: LobbySpec =
      bird.age >= 2
        ? { mode: "real", classType: "open", format: "shortKnife" }
        : { mode: "practice", classType: "open", format: "shortKnife" };
    quietly(() => game.lobbies.enter(bird.id, spec));
  }

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

console.log(`\nDone → ${dbPath}`);
console.log(`Run \`bun dev:sim\` and open http://localhost:3435/admin — it always shows the newest sim.`);
