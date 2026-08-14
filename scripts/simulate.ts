/**
 * The observable smoke run. EVERY run writes its own timestamped database
 * (data/sim-YYYYMMDD-HHMM.db) — iterate freely, nothing clashes, nothing
 * needs wiping. The world starts on day 0, a Friday (Zane's ruling,
 * 2026-08-03): the dev farm plays a simple honest day, the six bot stables
 * play theirs inside the tick. View the newest run with `bun dev:sim` →
 * http://localhost:3435/admin.
 *
 *   bun run simulate [days=91] [--keep] [--db=path] [--force] [--seed=N]
 *                    [--brain=<ollama model> --llm=<farm ids|count>]
 *
 * --keep   continue the NEWEST sim db (or --db target) instead of seeding new.
 * --db     target a specific database file.
 * --force  required to reseed a db holding registered player farms.
 * --seed   pin the world stream — the SAME seed replays the SAME world, which
 *          is what makes an A/B of two code paths honest. Omit for live-style
 *          randomness. See seedWorld in engine/rng.
 * --discovery-policy=current|end-first  simulation-only blade policy A/B.
 */
import { eq } from "drizzle-orm";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { createDb, latestSimDb } from "@/db/client";
import { farms, simTimings } from "@/db/schema";
import { seedGame, DEV_FARM_ID } from "@/db/seed-data";
import { playAllHonestDays } from "@/engine/auto-play";
import { SIMULATION } from "@/engine/config";
import { cardHealth, diagnose, formatReport } from "@/engine/doctor";
import { Bots } from "@/engine/bots";
import { collectProposals } from "@/engine/bot-brain";
import { ollamaDecider } from "@/engine/decider-ollama";
import type { DiscoveryPolicy } from "@/engine/bots";
import { Game } from "@/engine/game";
import { seedWorld } from "@/engine/rng";

const args = process.argv.slice(2);
const dayArg = args.find((a) => /^\d+$/.test(a));
// `simulate 0` is a real request: seed a fresh world and play NO days —
// the manual-play starting point (tick it yourself via the API).
const days = dayArg === undefined ? SIMULATION.DEFAULT_DAYS : Number(dayArg);
const keep = args.includes("--keep");
const force = args.includes("--force");
const dbArg = args.find((a) => a.startsWith("--db="))?.slice(5);
// --seed=N pins the world stream so a run is REPRODUCIBLE (round 35). Without
// it every run builds a different world, which is right for live play and
// wrong for measurement: it makes an A/B of two code paths compare two
// different worlds, and it puts an ±11-point noise band under the BLOODLINES
// ladder that nothing was accounting for. Use the same seed to A/B a change;
// use a spread of seeds to find out how big a delta has to be to mean
// anything at all.
const seedArg = args.find((a) => a.startsWith("--seed="))?.slice("--seed=".length);
if (seedArg !== undefined) {
  if (!/^\d+$/.test(seedArg)) {
    console.error(`--seed must be a whole number (got "${seedArg}")`);
    process.exit(1);
  }
  seedWorld(Number(seedArg));
}

const policyArg = args.find((a) => a.startsWith("--discovery-policy="))?.slice("--discovery-policy=".length);
if (policyArg && policyArg !== "current" && policyArg !== "end-first") {
  console.error(`Unknown discovery policy "${policyArg}" — use current or end-first.`);
  process.exit(1);
}
const discoveryPolicy: DiscoveryPolicy = (policyArg ?? "current") as DiscoveryPolicy;

// ── THE OUTSIDE BRAIN (round 49) ───────────────────────────────────────────
// --brain=qwen3:14b   run the named local Ollama model as a barn's decider
// --llm=bot-1,bot-3   which stables it plays; --llm=2 takes the first N bots
//
// Both are required together and BOTH DEFAULT OFF. A run without them is the
// ordinary reproducible sim, which is the one every balance number and every
// determinism guarantee rests on — the AI barns are an experiment run beside
// that baseline, never a replacement for it.
const brainArg = args.find((a) => a.startsWith("--brain="))?.slice("--brain=".length);
const llmArg = args.find((a) => a.startsWith("--llm="))?.slice("--llm=".length);
if (brainArg && !llmArg) {
  console.error("--brain needs --llm=<farm ids or a count> — which stables should it play?");
  process.exit(1);
}
if (llmArg && !brainArg) {
  console.error("--llm needs --brain=<model> — who is deciding for them?");
  process.exit(1);
}

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
// The clock starts here so `seed + bots` in the TIMING block below measures the
// seeding it names, rather than measuring nothing because it began after.
const t0 = performance.now();
if (!keep) {
  seedGame(db);
  Bots.seed(db);
  console.log(`Fresh world seeded at ${dbPath} — day 0, Friday\n`);
}
const seedMs = performance.now() - t0;

// Flip the chosen stables over to the outside brain. Done AFTER seeding so a
// --keep run can add or move brains between sessions without reseeding.
const decider = brainArg ? ollamaDecider({ model: brainArg, verbose: true }) : null;
if (llmArg) {
  const botIds = db
    .select()
    .from(farms)
    .where(eq(farms.isBot, 1))
    .all()
    .map((f) => f.id);
  const chosen = /^\d+$/.test(llmArg) ? botIds.slice(0, Number(llmArg)) : llmArg.split(",");
  const unknown = chosen.filter((id) => !botIds.includes(id));
  if (unknown.length > 0) {
    console.error(`--llm names farms that are not bot stables: ${unknown.join(", ")}`);
    process.exit(1);
  }
  // Reset first: on a --keep run, yesterday's llm barns should not linger just
  // because today's --llm named someone else.
  db.update(farms).set({ brain: "scripted" }).where(eq(farms.isBot, 1)).run();
  for (const id of chosen) db.update(farms).set({ brain: "llm" }).where(eq(farms.id, id)).run();
  console.log(`Brain: ${brainArg} plays ${chosen.length} stable(s) — ${chosen.join(", ")}\n`);
}

const game = new Game(db, DEV_FARM_ID, discoveryPolicy);

// ── TIMING (round 43) ───────────────────────────────────────────────────────
// There was NO instrumentation here until this round, and the cost of that was
// concrete: the only way anyone could say how long a 91-day run took was to read
// the mtimes of the files in data/ and subtract. Round 43 doubles the default run
// length and reworks half a dozen hot paths, so "is it faster" had to become a
// question with an answer.
//
// ⚠ IT LIVES IN THE SCRIPT, NOT THE ENGINE, and that is deliberate. Putting
// performance.now() inside Game.runTick would make timing the first non-game
// concern in the engine, and the three phases that actually matter (seeding, the
// honest-play pass, the tick) are all owned right here.
//
// ⚠ AND THE PER-UNIT LINE IS THE POINT. Wall clock alone cannot compare a
// 91-day run to a 182-day one, and round 35 already learned this the hard way —
// see the note in engine/rng.ts: that round compared 2:37 / 2:22 / 2:58 across
// runs that fought 10,556 / 10,000 / 10,277 fights, so most of what it measured
// was different amounts of work, not different speed. ms/fight and ms/entry are
// the numbers an A/B can actually be run on.
let honestMs = 0;
let tickMs = 0;
const dayMs: { day: number; ms: number }[] = [];
// Durations under a minute stay decimal seconds; past a minute they print as
// m:ss (Zane's ask, round 47 — a 182-day run says "12:42", not "762.7s",
// because nobody should be dividing by sixty in their head mid-run).
const fmtSec = (ms: number) => {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const whole = Math.round(ms / 1000);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

let weekStart = performance.now();
let weekDays = 0;

for (let day = 1; day <= days; day++) {
  const dayStart = performance.now();

  // ── Every player-owned stable plays its honest day ───────────────────
  playAllHonestDays(db, discoveryPolicy);
  const afterHonest = performance.now();
  honestMs += afterHonest - dayStart;

  // ── Outside deciders think, BEFORE the transaction opens ─────────────
  // Round 49's two-phase bot day (engine/bot-brain.ts). On an ordinary world
  // this returns an empty map without building a single view — no farm
  // carries brain='llm' unless somebody set it by hand — so the await costs
  // nothing and the sim plays exactly the day it always has.
  //
  // The decider is null until a model is wired in. When one arrives, THIS is
  // the line that gets slow, and deliberately so: it is the only point in a
  // day where waiting is allowed. Its cost lands OUTSIDE `tickMs`, which
  // keeps PERFORMANCE.md's ms/fight comparable to every number ever measured
  // against it.
  const proposals = await collectProposals(db, decider);
  const afterBrains = performance.now();

  // ── The day turns: bots play, the card goes off, staking pays ────────
  const tick = game.tickDay({ proposals });
  tickMs += performance.now() - afterBrains;
  const elapsed = performance.now() - dayStart;
  dayMs.push({ day: tick.clock.dayIndex, ms: elapsed });
  // …and into the database, so the run's cost curve outlives the terminal
  // (round 43, Zane's ask). One query graphs any run after the fact:
  //   SELECT day_index, ms FROM sim_timings ORDER BY day_index
  db.insert(simTimings)
    .values({ dayIndex: tick.clock.dayIndex, ms: Math.round(elapsed) })
    .onConflictDoUpdate({ target: simTimings.dayIndex, set: { ms: Math.round(elapsed) } })
    .run();

  const fights = tick.card.reduce((s, l) => s + l.fights.length, 0);
  const unmatched = tick.card.reduce((s, l) => s + l.unmatched.length, 0);
  const claims = tick.card.reduce((s, l) => s + l.claims.length, 0);
  console.log(
    `Day ${tick.clock.dayIndex} (${tick.clock.date.split(",")[0]}): ${fights} fights, ${unmatched} unmatched, ` +
      `${claims} claims settled, staking paid ${tick.staking.paidGp.toFixed(2)} GP to ${tick.staking.stakers} stakers` +
      (tick.fridays.length ? ` — HATCH FRIDAY (${tick.fridays[0].hatched.length} hatched)` : "") +
      ` — ${fmtSec(elapsed)}`
  );

  // A weekly roll-up on Hatch Friday, which the day line already detects. One
  // line a week is readable in a 182-day scrollback; one line a day is not, and
  // the shape of the curve (is it getting slower as the world grows?) is the
  // thing worth seeing while a long run is still going.
  weekDays++;
  if (tick.fridays.length > 0) {
    const weekTotal = performance.now() - weekStart;
    console.log(
      `        wk ${Math.ceil(tick.clock.dayIndex / 7)} · ${weekDays} days in ${fmtSec(weekTotal)} · ` +
        `avg ${(weekTotal / weekDays / 1000).toFixed(2)}s/day`
    );
    weekStart = performance.now();
    weekDays = 0;
  }
}
const simMs = performance.now() - t0 - seedMs;

// Every run ends with a check-up (round 24). Before this, a sim printed four
// numbers a day and asserted nothing — which is how two GP burns shipped.
const doctorStart = performance.now();
const report = diagnose(db, path.relative(process.cwd(), dbPath));
const doctorMs = performance.now() - doctorStart;

// Printed BEFORE the health report rather than after, so the report stays the
// last thing on screen — it is what a human is here to read.
const totalFights = report.topline.fights;
const totalEntries = cardHealth(db).entries;
const slowest = [...dayMs].sort((a, b) => b.ms - a.ms).slice(0, 3);
console.log(
  "\nTIMING\n" +
    `  seed + bots  ${fmtSec(seedMs).padStart(8)}\n` +
    `  simulation   ${fmtSec(simMs).padStart(8)}   (${days} day(s), avg ` +
    `${(simMs / Math.max(1, days) / 1000).toFixed(2)}s/day · honest ` +
    `${Math.round((honestMs / Math.max(1, honestMs + tickMs)) * 100)}% / tick ` +
    `${Math.round((tickMs / Math.max(1, honestMs + tickMs)) * 100)}%)\n` +
    `  doctor       ${fmtSec(doctorMs).padStart(8)}\n` +
    `  total        ${fmtSec(performance.now() - t0).padStart(8)}\n` +
    (slowest.length
      ? `  slowest days ${slowest.map((d) => `d${d.day} ${fmtSec(d.ms)}`).join(" · ")}\n`
      : "") +
    // ⚠ THE COMPARABLE NUMBERS. Everything above scales with how much work the
    // world happened to generate; these two do not. Compare THESE across runs.
    `  per unit     ${totalFights > 0 ? (simMs / totalFights).toFixed(2) : "—"} ms/fight · ` +
    `${totalEntries > 0 ? (simMs / totalEntries).toFixed(2) : "—"} ms/entry`
);

console.log("\n" + formatReport(report));

console.log(`\nDone → ${dbPath}`);
console.log(`Run \`bun dev:sim\` and open http://localhost:3435/admin — it always shows the newest sim.`);
// LAST, so the path is still on screen when it fails — a broken world is
// exactly the one you want to open.
if (!report.ok) process.exit(1);
