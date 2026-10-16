import { BOT_FARMS } from "@/engine/bot-config";
import { Bots } from "@/engine/bots";
import { newFarmKey } from "@/engine/farms";
import { createDb, defaultDbPath } from "./client";
import { gameState } from "./schema";
import { seedGame } from "./seed-data";

// `--live` seeds a public world (alpha-1, 2026-10). The default seed keys the
// owner's farm `fk_dev` and each bot `fk_<id>`, which tests and local play rely
// on and which anyone could guess on a public server. A live seed gives every
// farm a random key, prints the owner's once, and prints no bot key at all:
// nobody plays a house stable from outside.
const live = process.argv.includes("--live");
const botKey = live ? () => newFarmKey() : undefined;

const db = createDb();
const existing = db.select().from(gameState).all();
if (existing.length > 0) {
  Bots.seed(db, { apiKey: botKey }); // idempotent — adds any bot stables missing from an older db
  console.log(
    `Already seeded (${defaultDbPath()}) — bot stables ensured. Delete the file to reseed.`
  );
  process.exit(0);
}
const owner = seedGame(db, live ? { apiKey: newFarmKey() } : {});
Bots.seed(db, { apiKey: botKey });
console.log(`Seeded starter flock + ${BOT_FARMS.length} bot stables + ${defaultDbPath()}`);
if (live) {
  console.log(`\nLive seed. The owner's farm key (${owner.farmId}) is printed this once:\n`);
  console.log(`  ${owner.apiKey}\n`);
  console.log("Keep it somewhere safe. Bot keys are random and are not printed.");
}
