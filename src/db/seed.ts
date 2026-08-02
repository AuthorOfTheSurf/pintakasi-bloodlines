import { createDb, defaultDbPath } from "./client";
import { gameState } from "./schema";
import { seedGame } from "./seed-data";

const db = createDb();
const existing = db.select().from(gameState).all();
if (existing.length > 0) {
  console.log(`Already seeded (${defaultDbPath()}) — delete the file to reseed.`);
  process.exit(0);
}
seedGame(db);
console.log(`Seeded starter flock + ${defaultDbPath()}`);
