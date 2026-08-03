/**
 * The observable smoke run: fresh-seed the real database, then play N days —
 * the dev farm plays a simple honest day here, the six bot stables play
 * theirs inside the tick. Everything lands on the unified ledger, so when
 * it's done, `bun dev` and open http://localhost:3434/admin to see all of it.
 *
 *   bun run scripts/simulate.ts [days=5] [--keep]
 *
 * --keep plays on top of the existing database instead of reseeding.
 */
import { existsSync, rmSync } from "node:fs";
import { createDb, defaultDbPath } from "@/db/client";
import { seedGame, DEV_FARM_ID } from "@/db/seed-data";
import { Bots } from "@/engine/bots";
import { Breeding } from "@/engine/breeding";
import { Game } from "@/engine/game";
import { Gacha } from "@/engine/gacha";
import { mulberry32 } from "@/engine/rng";
import type { LobbySpec } from "@/engine/lobbies";

const args = process.argv.slice(2);
const days = Number(args.find((a) => /^\d+$/.test(a))) || 5;
const keep = args.includes("--keep");

const dbPath = defaultDbPath();
if (!keep) {
  for (const suffix of ["", "-wal", "-shm"]) {
    if (existsSync(dbPath + suffix)) rmSync(dbPath + suffix);
  }
}
const db = createDb(dbPath);
if (!keep) {
  seedGame(db);
  Bots.seed(db);
  console.log(`Fresh world seeded at ${dbPath}\n`);
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
  for (const chick of flock.filter((b) => b.status === "active" && b.age === 1)) {
    const stats = ["agility", "sight", "stamina", "gameness", "station", "condition"] as const;
    const lowest = stats.reduce((lo, s) => (chick[s] < chick[lo] ? s : lo), stats[0]);
    for (let i = 0; i < 3; i++) quietly(() => game.flock.train(chick.id, lowest));
  }

  quietly(() => {
    const farm = game.farms.rowById(DEV_FARM_ID);
    if (farm.landTokens > 0) game.farms.stake(DEV_FARM_ID, farm.landTokens);
  });

  const breeding = new Breeding(db, DEV_FARM_ID, mulberry32(500 + day));
  for (const rooster of flock.filter((b) => b.status === "retired" && b.sex === "male"))
    quietly(() => breeding.listStud(rooster.id));
  quietly(() => {
    const hen = flock.find((b) => b.status === "retired" && b.sex === "female");
    if (!hen) return;
    const barn = breeding.browseStuds(hen.id);
    if (barn.studs.length > 0) breeding.breed(hen.id, barn.studs[0].birdId);
  });

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
    `Day ${tick.clock.dayIndex}: ${fights} fights, ${unmatched} unmatched, ${claims} claims settled, ` +
      `staking paid ${tick.staking.paidGp.toFixed(2)} GP to ${tick.staking.stakers} stakers` +
      (tick.fridays.length ? ` — HATCH FRIDAY (${tick.fridays[0].hatched.length} hatched)` : "")
  );
}

console.log(`\nDone. Run \`bun dev\` and open http://localhost:3434/admin to see every line of it.`);
