# Pintakasi: Bloodlines

Breed, fight, retire. A digital sabong auto-battler where **careers end in the breeding barn, not the grave** — and hardcore duels (loser force-retired) carry the stakes.

**Claude is the game client** — the game is played through MCP at `/api/mcp`, and REST exists for scripted tests. There are two web pages, and neither of them plays the game: the **Stewards' Office** at `/admin` (what the operators watch) and **The Pintakasi Handbook** at `/wiki` (the player-facing rules, every number imported live from the engine).

## Source of truth

In this repo, in order: **`src/engine/config.ts`** (every balance knob, with a comment saying what it does in gameplay terms), **`RULINGS.md`** (what changed each round and why — including the reversals), **`CLAUDE.md`** / **`AGENTS.md`** (the house rules for working here), **`PROGRESS.md`** (standing watch items). The original build spec lives in `wiki/projects/pintakasi-mvp.md` in the private `zane-knowledge-system` repo; it is the historical scope ledger, not the current rules.

Future design explorations may live in that sibling knowledge base without becoming rules here. The current idle-gathering brainstorm is **[Pintakasi Idle Expeditions — Callings, Barn Skills, and Cooperative Parties](../zane-knowledge-system/wiki/games/pintakasi-idle-expeditions.md)**. It explores replacing Ground/Air carriage with inherited gathering Callings, async three-bird expeditions, persistent barn skills, missions, and optional friend-composed parties. Until a ruling and implementation land in this repo, it is a design note only.

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
bun run db:seed     # starter flock (includes retired birds so breeding works turn one)
bun dev             # http://localhost:3434
```

That's the whole setup — there is no migration step. `createDb()` executes the DDL in `src/db/ddl.ts` when it opens the file, so the schema exists the moment anything touches the database.

The database is **per-machine**: `data/*.db` is gitignored, so a clone never carries a world with it and a `git pull` can never overwrite yours. Running `db:seed` twice is safe and does nothing the second time — "Already seeded … delete the file to reseed" is the expected message, not a failure.

To play, point an MCP client at the running server. `.mcp.json` in the repo root already does this for Claude Code — start `bun dev` first, since the endpoint *is* the server.

**Every call identifies a farm by key**, because the seeded world holds 20 of them (yours plus 19 bot stables). The seed's own farm is `fk_dev`, which is why `.mcp.json` ends in `?key=fk_dev` and the REST examples here carry `?key=fk_dev` (an `x-farm-key` header works too). Without it you get *"Multiple farms exist — pass your farm key"*, which is the server being careful, not broken. Playing as somebody new instead? `register_farm` over MCP hands you a fresh key; put that in the URL.

Tests: `bun test` · Types: `bun run typecheck` · Health of a world: `bun run doctor` · The combat lab: `bun run balance`

## The loop (what "playable" means)

Breed an egg ("Egg of \<mother\>", age 0) → it hatches next **Hatch Friday** as an age-1 chick → fight the **discovery year** as a juvenile → real fights from age 2 → **age 3 the fork opens**: hardcore runs (loser force-retired) and safe retirement unlock on the same birthday → ride the career (cap 9) or retire while ahead → breed the retiree (bloodline restriction: no siblings/parents/grandparents/great-grandparents) → a measurably better bird next Friday.

⚠ **There is no training, and stats are hidden.** A bird's six stats are fixed at birth and stay behind a fog until it retires (round 28) — so the skill is *discovery*, not development: card the bird across the five blades, read its Pit Figures, and work out what it already is. Every rule the player needs is in the Handbook at `/wiki`.

## Databases — which world is which

One SQLite file = one world. Three kinds exist; never confuse them:

| World | File | Who writes it |
|---|---|---|
| **Live** (prod) | `data/game.db` on whatever box serves the game (the Zo machine — NOT Vercel; SQLite needs a persistent disk) | The players, via `bun dev` / `next start` |
| **Simulation** | `data/sim-YYYYMMDD-HHMM.db` — every run gets its OWN timestamped file | `bun run simulate [days]` — seeds a fresh world (day 0, a Friday) and plays N days with the bots (defaults to 91 days, 13 full weeks) |
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
