/**
 * What does a barn's mail actually cost, in tokens and in seconds?
 *
 * Two questions this answers and nothing else does:
 *
 * 1. HOW BIG IS THE VIEW, and how much of it survives the digest? The whole
 *    reason decider-ollama.ts has a `digest()` at all is that a `BotView` is
 *    too big to hand a model — but "too big" was an assumption until this
 *    script measured it. Run it against a mature world and the compression
 *    ratio is a number instead of an instinct.
 *
 * 2. WHERE DO THE SECONDS GO? Ollama reports its own timings on every reply
 *    (load, prompt eval, generation). A barn-day that takes 13 seconds is
 *    three very different stories depending on which of those dominates, and
 *    only one of them gets better by clustering the wakes.
 *
 *   bun run brain-bench [--model=qwen3:14b] [--farm=bot-1] [--db=path]
 *
 * Reads the newest sim database by default and writes NOTHING — it is a
 * measurement, not a tick.
 */
import { createDb, latestSimDb } from "@/db/client";
import { buildView } from "@/engine/bot-brain";
import { digest } from "@/engine/decider-ollama";

const args = process.argv.slice(2);
const model = args.find((a) => a.startsWith("--model="))?.slice("--model=".length) ?? "qwen3:14b";
const farmId = args.find((a) => a.startsWith("--farm="))?.slice("--farm=".length) ?? "bot-1";
const dbArg = args.find((a) => a.startsWith("--db="))?.slice("--db=".length);

const db = createDb(dbArg ?? latestSimDb());
const view = buildView(db, farmId);
const { brief } = digest(view);

// ~3.5 chars/token is the usual rule of thumb for dense JSON. Rough on
// purpose: the interesting number is the RATIO between the two, and that
// survives any reasonable estimate.
const tokens = (s: string) => Math.round(s.length / 3.5);
const rawJson = JSON.stringify(view);
const briefJson = JSON.stringify(brief);

console.log(`\n  world: ${dbArg ?? latestSimDb()}`);
console.log(`  farm:  ${farmId} · day ${view.day}\n`);
console.log(`  RAW VIEW    ${rawJson.length.toLocaleString().padStart(9)} chars  ≈ ${tokens(rawJson).toLocaleString().padStart(7)} tokens`);
console.log(`  DIGEST      ${briefJson.length.toLocaleString().padStart(9)} chars  ≈ ${tokens(briefJson).toLocaleString().padStart(7)} tokens`);
console.log(`  ratio       ${(rawJson.length / briefJson.length).toFixed(1)}× smaller\n`);
console.log(`  view parts: flock ${view.flock.length} birds · board ${view.board.length} lobbies · claimer ${view.claimerBoard.length} · scout ${Object.keys(view.scout).length}`);

// ── Where the seconds go ───────────────────────────────────────────────────
console.log(`\n  calling ${model} …`);
const res = await fetch("http://localhost:11434/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model,
    stream: false,
    think: false,
    options: { temperature: 0.7, num_predict: 700 },
    messages: [
      { role: "system", content: "Reply with JSON only: {\"actions\":[]}" },
      { role: "user", content: briefJson },
    ],
  }),
});
const body = (await res.json()) as Record<string, number>;
const ms = (ns?: number) => (ns ? (ns / 1e6).toFixed(0) : "—");
const rate = (count?: number, ns?: number) =>
  count && ns ? `${((count / ns) * 1e9).toFixed(1)} tok/s` : "—";

console.log(`
  TIMING (ollama's own, milliseconds)
    load           ${ms(body.load_duration).padStart(7)}   model into memory — 0 when already resident
    prompt eval    ${ms(body.prompt_eval_duration).padStart(7)}   ${body.prompt_eval_count ?? "—"} tokens in   ${rate(body.prompt_eval_count, body.prompt_eval_duration)}
    generation     ${ms(body.eval_duration).padStart(7)}   ${body.eval_count ?? "—"} tokens out  ${rate(body.eval_count, body.eval_duration)}
    total          ${ms(body.total_duration).padStart(7)}
`);
