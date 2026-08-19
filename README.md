# Pintakasi: Bloodlines

Breed, fight, retire. A digital sabong auto-battler where **careers end in the breeding barn, not the grave** — and hardcore duels (loser force-retired) carry the stakes.

**Players and agents connect through MCP** at `/api/mcp`; REST exists for scripted tests. Claude Code is the client used during development. There are two web pages, and neither of them plays the game: the **Stewards' Office** at `/admin` (what the operators watch) and **The Pintakasi Handbook** at `/wiki` (the player-facing rules, every number imported live from the engine).

## Source of truth

In this repo, in order: **`src/engine/config.ts`** (every balance knob, with a comment saying what it does in gameplay terms), **`RULINGS.md`** (what changed each round and why — including reversals), **`CLAUDE.md`** / **`AGENTS.md`** (the house rules for working here), and **`PROGRESS.md`** (standing watch items). These are the complete public source of truth.

## Stack

Next.js + TypeScript + Bun · SQLite (Drizzle + better-sqlite3) · `@modelcontextprotocol/server` for MCP. Local-first — a SQLite file doesn't persist on Vercel serverless; deploy = later swap to Turso/libSQL.

## Layout

- `src/engine/` — the game, pure TS, no HTTP: `GameClock`, `Flock`, `Breeding`, `Lobbies` (the daily card), `Tournaments` (the championships), `Gacha`, `Farms`, plus `fight-sim.ts` (the combat engine itself) and `bots.ts` / `auto-play.ts` (the stables that aren't you). **`config.ts` holds every balance seed** — tuning is a one-line edit.
- `src/db/` — Drizzle schema, client, seed script. ⚠ `schema.ts` and `ddl.ts` are **hand-synced**: edit both. `createDb()` runs the DDL on open, so a database bootstraps itself.
- `src/app/api/` — thin REST routes + `/api/mcp`.
- `src/app/wiki/` — the Handbook. **Change a game rule, change the Handbook in the same commit** (see `CLAUDE.md`).
- `scripts/` — `simulate.ts`, `doctor.ts`, `balance.ts`.

## Run

```sh
bun install
bun run db:seed     # 8 named age-0 eggs; they hatch next Friday
bun dev             # http://localhost:3434
```

That's the whole setup — there is no migration step. `createDb()` executes the DDL in `src/db/ddl.ts` when it opens the file, so the schema exists the moment anything touches the database.

The database is **per-machine**: `data/*.db` is gitignored, so a clone never carries a world with it and a `git pull` can never overwrite yours. Running `db:seed` twice is safe and does nothing the second time — "Already seeded … delete the file to reseed" is the expected message, not a failure.

To play manually, open the **Stewards' Office** at `/admin` and use **+1 Day** or **+1 Week**. A fresh world starts on Friday; **+1 Week** reaches the following Hatch Friday, when all eight eggs become age-1 chicks. Local development leaves these controls enabled.

To play through an MCP client, `.mcp.json` in the repo root already does this for Claude Code — start `bun dev` first, since the endpoint *is* the server.

**Every call identifies a farm by key**, because the seeded world holds 20 of them (yours plus 19 bot stables). The seed's own farm is `fk_dev`, which is why `.mcp.json` ends in `?key=fk_dev` and the REST examples here carry `?key=fk_dev` (an `x-farm-key` header works too). Without it you get *"Multiple farms exist — pass your farm key"*, which is the server being careful, not broken. Playing as somebody new instead? `register_farm` over MCP hands you a fresh key; put that in the URL.

Tests: `bun test` · Types: `bun run typecheck` · Health of a world: `bun run doctor` · The combat lab: `bun run balance`

## Run a simulation

The ordinary simulation uses scripted barns and needs no model:

```sh
# 91 game-days = 13 game-weeks. Roughly 2 minutes on the author's M1 Max.
bun run simulate 91 --seed=1
bun dev:sim           # inspect the newest simulation at http://localhost:3435/admin
```

Use `182` game-days (26 game-weeks, about half a calendar year) when you want to watch the longer population and breeding loop. It is a heavier run, roughly 10 minutes on the author's machine as the population grows:

```sh
bun run simulate 182 --seed=1
```

The LLM experiment is optional. Install [Ollama](https://ollama.com/) and pull a local model:

```sh
ollama pull qwen3:30b-a3b

# One model-controlled bot barn, seven game-days: a practical smoke run.
bun run simulate 7 --seed=1 --brain=qwen3:30b-a3b --llm=1 --actors --brief=options
```

`qwen3:30b-a3b` ran locally on the author's MacBook Pro M1 Max with 64 GB unified memory. A machine with less memory may need a smaller model. Ask your AI coding agent which Ollama model fits your hardware before downloading one.

No separate Rivet install or service is needed. `bun install` includes the pinned `rivetkit` package. When you pass `--actors`, it automatically starts the local [Rivet](https://rivet.dev/) Engine daemon, which listens on `127.0.0.1:6420` and keeps Actor state on your machine under `~/.rivetkit/`. Each model-controlled barn runs as a durable Rivet Actor; the Actor calls your local Ollama model to choose that barn's daily actions.

`--llm=1` selects one of the 19 bot barns for model control; the other 18 bots and the seeded dev farm stay scripted. It is the quickest useful experiment. `--llm=10` selects ten bot barns, leaving nine bots plus the seeded dev farm scripted, a 10-versus-10 experiment like the measured runs. Start with fewer days and fewer model barns, then increase either only when the small run is healthy.

## Review a simulation

Each simulation writes a timestamped SQLite world to `data/sim-*.db`. The two fast review paths are:

```sh
bun run doctor  # diagnoses the newest simulation and fails on broken invariants
bun dev:sim     # opens that same newest world in the Stewards' Office
```

An AI coding agent can run the experiment, find the new database, run the doctor, inspect the SQLite tables and `brain_log`, and navigate the local office to explain the result. This is the intended way to handle the otherwise fiddly handoff between terminal output, the database, and the UI. See `BRAINS.md` and `runs/` for measured Actor experiments and their exact commands.

## Public deployment safety

The Stewards' Office is an inspection surface, not an unauthenticated game-control panel. Production deployments hide the clock controls and reject tick requests unless `PINTAKASI_ALLOW_PUBLIC_TICKS=1` is explicitly set.

The fixed `fk_dev` key in the seeded local world and `.mcp.json` is a **local-development convenience**, not real authentication. Do not reuse it to protect a public or player-facing deployment.

## License

This is a source-available portfolio repository, not open-source software. See [LICENSE](LICENSE): the code and documentation are public for viewing and evaluation, but reuse requires written permission.

## The loop (what "playable" means)

Breed an egg ("Egg of \<mother\>", age 0) → it hatches next **Hatch Friday** as an age-1 chick → fight the **discovery year** as a juvenile → real fights from age 2 → **age 3 the fork opens**: hardcore runs (loser force-retired) and safe retirement unlock on the same birthday → ride the career (cap 9) or retire while ahead → breed the retiree (bloodline restriction: no siblings/parents/grandparents/great-grandparents) → a measurably better bird next Friday.

⚠ **There is no training, and stats are hidden.** A bird's six stats are fixed at birth and stay behind a fog until it retires (round 28) — so the skill is *discovery*, not development: card the bird across the five blades, read its Pit Figures, and work out what it already is. Every rule the player needs is in the Handbook at `/wiki`.

## Databases — which world is which

One SQLite file = one world. Three kinds exist; never confuse them:

| World | File | Who writes it |
|---|---|---|
| **Live** (prod) | `data/game.db` on whatever box serves the game (the Zo machine — NOT Vercel; SQLite needs a persistent disk) | The players, via `bun dev` / `next start` |
| **Simulation** | `data/sim-YYYYMMDD-HHMM.db` — every run gets its OWN timestamped file | `bun run simulate [days]` — seeds a fresh world (day 0, a Friday) and plays N days with the bots (defaults to 112 days, 16 full weeks) |
| **Tests** | `:memory:` | `bun test` — never touches disk |

- View a full sim: `bun run simulate`, then `bun dev:sim` → http://localhost:3435/admin — it always resolves to the NEWEST sim db (port 3435, so it can run beside the live server on 3434).
- Continue the newest run instead of starting fresh: `bun run simulate 7 --keep` — handy for pausing mid-week, inspecting the state, then playing on.
- **Manual ticking**: `bun run simulate 0` seeds a fresh world and plays NO days. Then advance it with the **+1 Day / +1 Week buttons** in `/admin` (or `curl -X POST "localhost:3435/api/tick/day?key=fk_dev"`). A tick is a tick everywhere: **all stables play** — the bots inside the tick, and every player-owned farm gets an honest auto-played day first (check-in, free pulls, stake, studs, one cover, enter birds). Same behavior from the buttons and the CLI sim, by design — revisit when real players exist.
- Old sim files are just files — delete them whenever, or keep them all; space is cheap.
- The `-wal` / `-shm` files beside a db are SQLite's write-ahead log and its shared-memory index — bookkeeping for recent writes, auto-managed. If you copy a db while a server has it open, copy all three (or just stop the server first).
- The `/admin` header names the database file it's reading — check it before trusting what you see.
- `PINTAKASI_DB=<path>` points the server at any world (`latest-sim` = newest sim file); `simulate --db=<path>` retargets the sim.
- **Wipe guard**: `simulate` refuses to reseed a database containing registered player farms (anyone beyond the seeded dev farm + bots) unless you pass `--force`. `db:seed` never wipes — it only seeds an empty file.
- All `data/*.db` files are gitignored: a `git pull` can never touch a world. Back up the live world by copying the file (e.g. a nightly `cp data/game.db backups/` cron on the host).
