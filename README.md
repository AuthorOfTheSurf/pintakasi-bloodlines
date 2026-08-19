# Pintakasi: Bloodlines

Breed, fight, retire. The strongest Birds in the game do not exist yet, we get to breed for them.

Currently the game is mainly played and developed as a simulation to get the game balance and design right.

**Players and agents connect through MCP** at `/api/mcp`; REST exists for scripted tests. Claude Code (or your favorite coding agent) is recommended as the client used during development and simulation testing.

Running the app locally serves a UI that shows all of the birds, breeds, fights and so on that occurred. This UI accepts a database parameter, so previous simulations can be viewed too.
- **Stewards' Office** at `/admin` (all of the game stats, and the nicest game UI available so far)
- **The Pintakasi Handbook** at `/wiki` (the player-facing rules, numbers get imported from config).

## Useful files

- **`src/engine/config.ts`** (every balance knob, with a comment saying what it does in gameplay terms)
- **`RULINGS.md`** (what changed each round and why — including reversals)
- **`CLAUDE.md`** / **`AGENTS.md`** (the house rules for working here)
- **`PROGRESS.md`** (standing watch items)

## Stack

Next.js + TypeScript + Bun · SQLite (Drizzle + better-sqlite3) · `@modelcontextprotocol/server` for MCP

Note that SQLite will work fine locally, but on Vercel because that's serverless. Can modify and swap to Turso/libSQL if hosting their becomes desired.

## Quick summary of the game
- A season is 7 game-days and starts on Friday
- Friday is "Hatch Day". Pregnant hens produce a 0yo egg. Existing eggs grow into 1yo juvenile chicks. All other birds age +1 year.
- The goal of the game is to win Golden Pesos (GP) and amass Land Tokens (LT) via battling your birds
- The most lucrative (+EV) fights in the game are the Pintakasi Finals. This is where most of the prize money is concentrated. Both serious players and casual players should target these seasonal tournaments
- Birds can fight daily. There is a fight card with 5-10 fight types available per day
- Birds have six fighting stats: Agility, Sight, Stamina, Gameness, Station, and Condition. These stats are hidden during their careers and only revealed after retirement
- Birds also have an Element: Earth, Fire, Water, Metal, or Wood and a Star rating from 0-5. Their element can provide a small edge in certain conditions
- **The best birds in the game do not exist yet, they must be bred for**. Take a strong hen and breed it with a strong rooster to ideally produce a chick that is superior to both
- There are several fight types: Maiden, Claimer, Open, Hardcore
- There are also several blade types: B1 to B5. B1 are long-blades, which are the quickest fights and most dependent on Agility and Sight. B5 are short-gaff fights, which are long endurance type fights most dependent on Gameness and Stamina
- A typical season will involve finding ideal fights for each bird, and breeding your best hens
- There is also a Gatcha machine that can be pulled 1x per game day for prizes
- The lucrative Pintakasi Finals are "hardcore"; losing birds get force-retired. Competitive barns are always pushing the ceiling to create newer, better birds
- Read the `/wiki` page for detailed game rules

## Layout

- `src/engine/` — the game, pure TS, no HTTP: `GameClock`, `Flock`, `Breeding`, `Lobbies` (the daily card), `Tournaments` (the championships), `Gacha`, `Farms`, plus `fight-sim.ts` (the combat engine itself)
- `bots.ts` / `auto-play.ts` (scripted bot logic, used for simulations)
- **`config.ts` holds every balance seed** — tuning often becomes a couple of edits + run a new simulation and compare
- `src/db/` — Drizzle schema, client, seed script. ⚠ `schema.ts` and `ddl.ts` are **hand-synced**: edit both. `createDb()` runs the DDL on open, so a database bootstraps itself.
- `src/app/api/` — thin REST routes
- `/api/mcp` - MCP server and routes
- `src/app/wiki/` — the Handbook. **Change a game rule, change the Handbook in the same commit** (see `CLAUDE.md`).
- `scripts/`
    - `simulate.ts` (simulation code, the main thing we "play the game with" right now)
    - `doctor.ts` (checks the game world database and prints out detailed findings, checks invariants (e.g. money printed out of thin air))
    - `balance.ts` (a suite for tuning the balance of the game. This checks things like stronger birds winning more vs. weaker birds. Used to balance out the fighting stats)

## Run

```sh
bun install
bun run db:seed     # 8 named age-0 eggs; they hatch next Friday
bun dev             # http://localhost:3434
```

That's the whole setup, there is no migration step. `createDb()` executes the DDL in `src/db/ddl.ts` when it opens the file, so the schema exists the moment anything touches the database.

The database is **per-machine**: `data/*.db` is gitignored, so a clone never carries a world with it and a `git pull` can never overwrite yours. Running `db:seed` twice is safe and does nothing the second time — "Already seeded … delete the file to reseed" is the expected message, not a failure. We utilize SQLite, which makes 1x database per simulation easy to achieve and work with. The database simply being a file is great for experimentation purposes

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

## Databases — which world is which

One SQLite file = one world. Three kinds exist:

| World | File | Who writes it |
|---|---|---|
| **Live** (prod) | `data/game.db` on whatever box serves the game (a personal server, NOT Vercel; SQLite needs a persistent disk) | The players, via `bun dev` / `next start` |
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

## License

This is a source-available portfolio repository, not open-source software. See [LICENSE](LICENSE): the code and documentation are public for viewing and evaluation, but reuse requires written permission.
