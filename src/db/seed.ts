import { BOT_FARMS } from "@/engine/bot-config";
import { Bots } from "@/engine/bots";
import { createDb, defaultDbPath } from "./client";
import { gameState } from "./schema";
import { seedGame } from "./seed-data";

const db = createDb();
const existing = db.select().from(gameState).all();
if (existing.length > 0) {
  Bots.seed(db); // idempotent — adds any bot stables missing from an older db
  console.log(`Already seeded (${defaultDbPath()}) — bot stables ensured. Delete the file to reseed.`);
  process.exit(0);
}
seedGame(db);
Bots.seed(db);
console.log(`Seeded starter flock + ${BOT_FARMS.length} bot stables + ${defaultDbPath()}`);
