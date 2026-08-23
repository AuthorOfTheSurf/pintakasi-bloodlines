/**
 * The observable smoke run. EVERY run writes its own timestamped database
 * (data/sim-YYYYMMDD-HHMM.db) — iterate freely, nothing clashes, nothing
 * needs wiping. The world starts on day 0, a Friday (Zane's ruling,
 * 2026-08-03): the dev farm plays a simple honest day, the six bot stables
 * play theirs inside the tick. View the newest run with `bun dev:sim` →
 * http://localhost:3435/admin.
 *
 *   bun run simulate [days=91] [--keep] [--db=path] [--force] [--seed=N]
 *                    [--brain=<ollama model> --llm=<farm ids|count>] [--actors]
 *                    [--panel]
 *                    [--brief=legacy|options]
 *
 * --keep   continue the NEWEST sim db (or --db target) instead of seeding new.
 * --db     target a specific database file.
 * --from   START FROM A SNAPSHOT (Zane's ask, round 50): copy the named world
 *          into a fresh timestamped db and play on from there. The snapshot is
 *          never written to. The first 48 days of a seeded world are
 *          deterministic — simulating them again buys nothing, so bank one
 *          (e.g. cp the db into data/snapshots/) and every experiment starts
 *          at the interesting part. Keep the roster identical across worlds
 *          you mean to compare.
 * --force  required to reseed a db holding registered player farms.
 * --seed   pin the world stream — the SAME seed replays the SAME world, which
 *          is what makes an A/B of two code paths honest. Omit for live-style
 *          randomness. See seedWorld in engine/rng.
 * --discovery-policy=current|end-first  simulation-only blade policy A/B.
 */
import { eq } from "drizzle-orm";
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createDb, latestSimDb } from "@/db/client";
import { brainLog, farms, simTimings } from "@/db/schema";
import type { BrainCallLog } from "@/engine/decider-ollama";
import { seedGame, DEV_FARM_ID } from "@/db/seed-data";
import { playAllHonestDays } from "@/engine/auto-play";
import { SIMULATION } from "@/engine/config";
import { cardHealth, diagnose, formatReport } from "@/engine/doctor";
import { Bots } from "@/engine/bots";
import { collectProposals } from "@/engine/bot-brain";
import { ollamaDecider } from "@/engine/decider-ollama";
import { barnDecider, registry, RIVET_ENDPOINT } from "@/actors/barn";
import { createClient } from "rivetkit/client";
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
// --actors (round 50, phase 2): each llm barn becomes a Rivet Actor. The sim
// stops calling Ollama itself and instead mails each barn its morning view;
// the barn actor thinks (the Ollama call moves inside it) and mails back its
// intentions, accumulating a durable career (days played, actions proposed,
// time spent thinking) that SURVIVES across runs — same world + same farm =
// same actor. rivetkit boots a local Rivet Engine in-process; nothing leaves
// the laptop.
const useActors = args.includes("--actors");
if (useActors && !brainArg) {
  console.error("--actors needs --brain and --llm — actors are the llm barns' home.");
  process.exit(1);
}
// --panel (stagecraft#1): same barns, different substrate — the llm barns run
// on @authorofthesurf/stagecraft (src/actors/barn-stagecraft.ts) instead of
// raw rivetkit, and the stagecraft live panel serves the whole run at
// http://localhost:4949: per-barn activity rows, Sentry-style issue grouping,
// the failure feed. The process STAYS OPEN after the run so the panel can be
// read; Ctrl-C when done. Per-actor production knobs (actionTimeout/noSleep)
// arrived in stagecraft 0.3.0 and the barn now sets them, so this path is
// safe for long fleet runs; the 8MB registry-level message sizes are still
// out of reach (stagecraft#19).
const usePanel = args.includes("--panel");
if (usePanel && !useActors) {
  console.error("--panel needs --actors — the panel watches the barn actors.");
  process.exit(1);
}
// --personas (round 52, phase 4): each llm barn starts the world with the
// standing orders its scripted twin's profile implies — the claim shark
// claims, the whale rolls, the land baron buys the cap. GOALS port over;
// decision logic does not (see src/actors/personas.ts).
//
// --personas=championship (round 53, the 10v10): the palette instead — one
// shared net-worth goal, five ways of chasing it, fixed two-barns-per-creed
// assignment. Bare --personas keeps meaning the style creeds.
const personasArg = args.find((a) => a === "--personas" || a.startsWith("--personas="));
const usePersonas = Boolean(personasArg);
const personaSet = personasArg?.startsWith("--personas=")
  ? personasArg.slice("--personas=".length)
  : "style";
if (usePersonas && !["style", "championship"].includes(personaSet)) {
  console.error(`Unknown persona set "${personaSet}" — use bare --personas or --personas=championship.`);
  process.exit(1);
}
if (usePersonas && !useActors) {
  console.error("--personas needs --actors — orders live in the barn actors' state.");
  process.exit(1);
}
// --brief=options (round 63 — runs/options-brief-spec.md): the llm barns
// read the OPTIONS brief — every legal move pre-computed into valued rows,
// the reply collapsed to picks. Default stays the legacy digest that played
// experiments 1–8, so the A/B is this one flag.
const briefArg = args.find((a) => a.startsWith("--brief="))?.slice("--brief=".length) ?? "legacy";
if (!["legacy", "options"].includes(briefArg)) {
  console.error(`Unknown brief "${briefArg}" — use --brief=legacy (default) or --brief=options.`);
  process.exit(1);
}
const brief = briefArg as "legacy" | "options";
if (brief === "options" && !brainArg) {
  console.error("--brief=options only means something with --brain/--llm.");
  process.exit(1);
}

function stamp(): string {
  const t = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}`;
}

// --from=<snapshot.db>: fork a saved world instead of seeding or continuing.
const fromArg = args.find((a) => a.startsWith("--from="))?.slice("--from=".length);
if (fromArg && (keep || dbArg)) {
  console.error("--from forks a snapshot into a NEW db — it can't combine with --keep or --db.");
  process.exit(1);
}
// The snapshot is checked HERE, before a path is reserved below. Validating
// after reservation left an empty .db behind on every typo'd --from, and an
// empty file is worse than no file: it is the newest sim db, so `scoreboard`
// and `bun dev:sim` pick it and fail on the missing schema.
const snapshot = fromArg ? path.resolve(fromArg) : undefined;
if (snapshot && !existsSync(snapshot)) {
  console.error(`--from: no snapshot at ${snapshot}`);
  process.exit(1);
}

// The stamp is minute-precision, so two auto-named runs in the same minute
// (easy when forking snapshots back-to-back) would share a path — and the
// second would delete the first world's files. Uniquify with a counter
// suffix; an explicit --db keeps its exact name. The name is RESERVED by
// creating the file exclusively ("wx"), not by peeking with existsSync —
// two concurrent launches that both saw the name absent would otherwise
// both claim it, and the wipe below would delete the other run's world.
// One process wins the create; the loser gets EEXIST and takes the next
// suffix. SQLite treats the empty reserved file exactly like a new db.
let reservedFresh = false;
function freshSimPath(): string {
  const dir = path.join(process.cwd(), "data");
  // data/ is gitignored, so a clean checkout doesn't have one — createDb makes
  // it, but the reservation below happens first and would die on ENOENT.
  mkdirSync(dir, { recursive: true });
  const base = path.join(dir, `sim-${stamp()}`);
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? `${base}.db` : `${base}-${n}.db`;
    try {
      writeFileSync(candidate, "", { flag: "wx" });
      reservedFresh = true;
      return candidate;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }
  }
}

const dbPath = path.resolve(dbArg ?? (keep ? latestSimDb() : freshSimPath()));

// …and if the run dies before it ever writes a world — a crash in seeding, a
// refused wipe, a Ctrl-C — sweep the reservation away again. It is only ever
// removed while still ZERO BYTES: the moment createDb writes a schema the
// file is a real world and this becomes a no-op, so there is no path where
// this deletes anybody's data.
process.on("exit", () => {
  if (!reservedFresh) return;
  try {
    if (statSync(dbPath).size === 0) rmSync(dbPath);
  } catch {
    // already gone, or never created — either way nothing to sweep
  }
});
// A bare SIGINT kills the process WITHOUT running exit handlers, so Ctrl-C
// during the first second of a run would leave the reservation behind.
// Re-raising it as an ordinary exit gives the sweep above its chance; 130 is
// the conventional code for "died on SIGINT" and keeps `!report.ok`-style
// scripting honest.
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => process.exit(130));

if (snapshot) {
  // Clear the target's sidecars FIRST. A stale -wal beside the target path
  // is not debris — SQLite will replay it over the fresh copy on open and
  // silently resurrect whatever world it belonged to. (Found the hard way:
  // a fork "started at day 48" and played somebody else's day 2.) The base
  // file stays: it is this run's atomic name reservation, and copyFileSync
  // overwrites it in place — deleting it first would hand the name back to
  // any concurrent launch for the length of the gap.
  for (const suffix of ["-wal", "-shm"]) {
    if (existsSync(dbPath + suffix)) rmSync(dbPath + suffix);
  }
  // The snapshot's own -wal carries any un-checkpointed pages; copying it
  // alongside keeps the fork byte-honest even if saved mid-checkpoint.
  copyFileSync(snapshot, dbPath);
  for (const suffix of ["-wal", "-shm"]) {
    if (existsSync(snapshot + suffix)) copyFileSync(snapshot + suffix, dbPath + suffix);
  }
  console.log(`Forked ${path.relative(process.cwd(), snapshot)} → ${path.relative(process.cwd(), dbPath)}\n`);
}

// reservedFresh skips the guard: the path exists only because THIS process
// just created it as an empty reservation — it holds no world, and opening
// it to count farms would fail on the missing schema.
if (!keep && !fromArg && !reservedFresh && existsSync(dbPath)) {
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
if (!keep && !fromArg) {
  seedGame(db);
  Bots.seed(db);
  console.log(`Fresh world seeded at ${dbPath} — day 0, Friday\n`);
}
const seedMs = performance.now() - t0;

// Flip the chosen stables over to the outside brain. Done AFTER seeding so a
// --keep run can add or move brains between sessions without reseeding.
// The world name scopes each barn actor's key — bot-1 of one world and bot-1
// of another are different careers (see src/actors/barn.ts).
const worldName = path.basename(dbPath, ".db");
let rivetClient: ReturnType<typeof createClient<typeof registry>> | null = null;
let scBarn: { getOrCreate: (key: string) => any } | null = null;
let scDispose: (() => Promise<void>) | null = null;
if (useActors && usePanel) {
  const { issueTracker, testEngine } = await import("@authorofthesurf/stagecraft");
  const { startPanel } = await import("@authorofthesurf/stagecraft/panel");
  const { reapOrphanEngines } = await import("@authorofthesurf/stagecraft/testing");
  const { Barn } = await import("@/actors/barn-stagecraft");
  // A stranded engine from a previous run (or another repo's test suite)
  // still owns the port and will keep waking ITS actors — foreign
  // "not_registered" noise at best, stolen registrations at worst.
  reapOrphanEngines();
  // rivetkit's own default is "warn", but test mode raises it and the info
  // stream (every actor created / ready) buries the lines worth reading.
  process.env.RIVET_LOG_LEVEL ??= "warn";
  const tracker = issueTracker();
  const engine = testEngine(Barn);
  scBarn = engine.client(Barn);
  scDispose = () => engine.dispose();
  const panel = startPanel({ tracker, quietAfterMs: 5 * 60_000 });
  console.log(`Stagecraft panel live: ${panel.url}\n`);
} else if (useActors) {
  // startAndWait, not start(): start() returns before the envoy has
  // registered with the engine, and a barn mailed in that gap fails with
  // "no_envoys" — it cost a barn two whole game-days to teach us that. The
  // wait is ~2s once per run.
  await registry.startAndWait();
  rivetClient = createClient<typeof registry>(RIVET_ENDPOINT);
}
// The paper trail (round 50): every barn-day's brief size, proposals, and
// drops land in the brain_log table so a long run can be STUDIED — which
// decisions followed which context — instead of scraped from scrollback.
// Same sink for both brains; the rows can't tell --actors from direct.
const dayBrainLogs: BrainCallLog[] = [];
const sink = (log: BrainCallLog) => dayBrainLogs.push(log);
// The timeout scales with the fleet. Ollama runs a few requests truly in
// parallel and QUEUES the rest, so the 19th barn's wait is mostly other
// barns' turns — the first full-fleet day timed out 6 of 19 at the flat
// 120s. A queue wait is not a hung model; give the tail room.
const llmCount = llmArg ? (/^\d+$/.test(llmArg) ? Number(llmArg) : llmArg.split(",").length) : 0;
const brainTimeoutMs = 120_000 + 15_000 * llmCount;
const decider = brainArg
  ? scBarn
    ? (await import("@/actors/barn-stagecraft")).stagecraftBarnDecider(scBarn, worldName, { model: brainArg, brief, verbose: true, sink, timeoutMs: brainTimeoutMs })
    : rivetClient
      ? barnDecider(rivetClient, worldName, { model: brainArg, brief, verbose: true, sink, timeoutMs: brainTimeoutMs })
      : ollamaDecider({ model: brainArg, brief, verbose: true, sink, timeoutMs: brainTimeoutMs })
  : null;
if (llmArg) {
  const botIds = db
    .select()
    .from(farms)
    .where(eq(farms.isBot, 1))
    .all()
    .map((f) => f.id);
  // A bare count means bot-1..bot-N — after the 2026-08-23 rename the llm
  // roster IS bot-1..bot-10 and the scripted stables are scripted-*, so the
  // intuitive reading and the correct one are finally the same thing.
  const chosen = /^\d+$/.test(llmArg)
    ? Array.from({ length: Number(llmArg) }, (_, i) => `bot-${i + 1}`)
    : llmArg.split(",");
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

  if (usePersonas && (rivetClient || scBarn)) {
    const { BOT_FARMS } = await import("@/engine/bot-config");
    const { personaOrders, championshipOrders } = await import("@/actors/personas");
    const orders = personaSet === "championship" ? championshipOrders : personaOrders;
    for (const id of chosen) {
      const profile = BOT_FARMS.find((p) => p.id === id);
      if (!profile) continue;
      if (scBarn) await scBarn.getOrCreate(`${worldName}/${id}`).tune({ strategy: orders(profile) });
      else await rivetClient!.barn.getOrCreate([worldName, id]).tune(orders(profile));
    }
    console.log(`Personas set: ${chosen.length} barn(s) start under the ${personaSet} creeds\n`);
  }
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
// Time spent WAITING ON BRAINS — zero on an ordinary run, and the dominant
// cost the moment one barn goes llm. Tracked separately from tickMs on
// purpose: mixing inference latency into the engine's ms/fight would make
// every PERFORMANCE.md number incomparable the day a model arrives.
let brainMs = 0;
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
  brainMs += afterBrains - afterHonest;
  for (const log of dayBrainLogs.splice(0)) {
    db.insert(brainLog)
      .values({
        dayIndex: log.day,
        farmId: log.farmId,
        model: log.model,
        briefTokens: log.briefTokens,
        proposedJson: JSON.stringify(log.proposed),
        droppedJson: JSON.stringify(log.dropped),
        decideMs: Math.round(log.ms),
        // Only present on options-brief calls — and only in the INSERT when
        // present, so a --keep resume of a pre-round-63 world (whose
        // brain_log has no offered_json column) keeps working on the
        // legacy brief.
        ...(log.offered ? { offeredJson: JSON.stringify(log.offered) } : {}),
        // Round 64: same contract — a --keep resume of a pre-round-64 world
        // (no menu_json column) keeps working as long as the column is
        // absent from the INSERT.
        ...(log.menu ? { menuJson: JSON.stringify(log.menu) } : {}),
      })
      .run();
  }

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
        `avg ${(weekTotal / weekDays / 1000).toFixed(2)}s/day · total ${fmtSec(performance.now() - t0)}`
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
    // The brain line only appears when there was a brain — an ordinary run's
    // timing block should look exactly as it always has.
    (brainMs > 1
      ? `  brains       ${fmtSec(brainMs).padStart(8)}   (${((brainMs / Math.max(1, days)) / 1000).toFixed(2)}s/day · ` +
        `${Math.round((brainMs / Math.max(1, simMs)) * 100)}% of the run` +
        (decider ? `, ${decider.stats.calls} call(s), ${decider.stats.failures} failed` : "") +
        `)\n`
      : "") +
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

// ── The careers (round 50): what each barn actor remembers about itself ────
// Read back AFTER the run so the number printed is the durable copy, not a
// local counter. Run again with --keep and daysPlayed keeps climbing — that
// continuity across process restarts is the thing phase 2 exists to show.
if (rivetClient || scBarn) {
  const llmFarms = db.select().from(farms).where(eq(farms.brain, "llm")).all();
  console.log("\nBARN CAREERS (durable actor state — persists across runs)");
  for (const f of llmFarms) {
    const c = scBarn
      ? await scBarn.getOrCreate(`${worldName}/${f.id}`).career(undefined)
      : await rivetClient!.barn.getOrCreate([worldName, f.id]).career();
    console.log(
      `  ${f.id.padEnd(8)} ${String(c.daysPlayed).padStart(3)} day(s) played · last day ${c.lastDay} · ` +
        `${c.proposedActions} proposed, ${c.droppedActions} dropped, ${c.failures} failure(s) · ` +
        `${(c.thinkingMs / 1000).toFixed(1)}s thinking`
    );
  }
}

console.log("\n" + formatReport(report));

console.log(`\nDone → ${dbPath}`);
console.log(`Run \`bun dev:sim\` and open http://localhost:3435/admin — it always shows the newest sim.`);
// The registry holds the process open (the embedded engine is still
// listening); drain it so the sim exits like a sim.
if (useActors && !usePanel) await registry.shutdown();

// LAST, so the path is still on screen when it fails — a broken world is
// exactly the one you want to open.
if (!report.ok) process.exit(1);
// --panel holds the process open ON PURPOSE: the run is done (the line above
// said so) but the panel keeps serving what happened. Ctrl-C to leave.
if (usePanel) {
  console.log("Panel still live at http://localhost:4949 — Ctrl-C to close.");
  await new Promise(() => {});
}
// Exit explicitly on success too. Without this, a plain (no --actors) run
// finishes its work and then just stands there — something keeps the event
// loop alive — which forces anyone driving the sim (a human, an agent, CI)
// to poll the output and guess at doneness. An exit code IS the doneness
// signal (Zane's ask, 2026-08-22).
process.exit(0);
