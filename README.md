# Pintakasi: Bloodlines

Breed, fight, retire. A digital sabong auto-battler where **careers end in the breeding barn, not the grave** — and hardcore duels (loser force-retired) carry the stakes.

**There is no UI.** Claude is the game client (MCP at `/api/mcp`); REST exists for scripted tests.

## Source of truth

The build spec is `wiki/projects/pintakasi-mvp.md` in the `zane-knowledge-system` repo — the scope ledger (items 1–25), age gates, and all design rulings live there. This repo implements the IN spine (1–15).

## Stack

Next.js + TypeScript + Bun · SQLite (Drizzle + better-sqlite3) · `@modelcontextprotocol/server` for MCP. Local-first — a SQLite file doesn't persist on Vercel serverless; deploy = later swap to Turso/libSQL.

## Layout

- `src/engine/` — the game, pure TS, no HTTP: `GameClock`, `Flock`, `Breeding`, `Battle`, `Gacha`; **`config.ts` holds every balance seed** (tuning = one-line edits).
- `src/db/` — Drizzle schema, client, seed script.
- `src/app/api/` — thin REST routes + `/api/mcp`.

## Run

```sh
bun install
bun run db:push     # create the SQLite schema (data/game.db)
bun run db:seed     # starter flock (includes retired birds so breeding works turn one)
bun dev             # http://localhost:3434
```

Tests: `bun test` · Types: `bun run typecheck`

## The loop (what "playable" means)

Breed an egg ("Egg of \<mother\>", age 0) → it hatches next **Hatch Friday** as an age-1 chick → practice and train through the discovery year → real fights from age 2 → **age 3 the fork opens**: hardcore runs (loser force-retired) and safe retirement unlock on the same birthday → ride the career (cap 9) or convert at peak stud value → breed the retiree (bloodline restriction: no siblings/parents/grandparents/great-grandparents) → a measurably better bird next Friday.

## Databases — which world is which

One SQLite file = one world. Three kinds exist; never confuse them:

| World | File | Who writes it |
|---|---|---|
| **Live** (prod) | `data/game.db` on whatever box serves the game (the Zo machine — NOT Vercel; SQLite needs a persistent disk) | The players, via `bun dev` / `next start` |
| **Simulation** | `data/sim-YYYYMMDD-HHMM.db` — every run gets its OWN timestamped file | `bun run simulate [days]` — seeds a fresh world (day 0, a Friday) and plays N days with the bots |
| **Tests** | `:memory:` | `bun test` — never touches disk |

- View a sim: `bun run simulate 5`, then `bun dev:sim` → http://localhost:3435/admin — it always resolves to the NEWEST sim db (port 3435, so it can run beside the live server on 3434).
- Continue the newest run instead of starting fresh: `bun run simulate 7 --keep` — handy for pausing mid-week, inspecting the state, then playing on.
- **Manual play**: `bun run simulate 0` seeds a fresh world and plays NO days. Then advance it yourself with the **+1 Day / +1 Week buttons** in `/admin`, or `curl -X POST "localhost:3435/api/tick/day?key=fk_dev"`. Buttons and curl are pure ticks — the bots play their day, the card resolves, staking pays — but the dev farm only acts when YOU act (check-in, gacha, breed, enter lobbies via the API or MCP). The CLI sim additionally plays an honest dev-farm day each tick.
- Old sim files are just files — delete them whenever, or keep them all; space is cheap.
- The `-wal` / `-shm` files beside a db are SQLite's write-ahead log and its shared-memory index — bookkeeping for recent writes, auto-managed. If you copy a db while a server has it open, copy all three (or just stop the server first).
- The `/admin` header names the database file it's reading — check it before trusting what you see.
- `PINTAKASI_DB=<path>` points the server at any world (`latest-sim` = newest sim file); `simulate --db=<path>` retargets the sim.
- **Wipe guard**: `simulate` refuses to reseed a database containing registered player farms (anyone beyond the seeded dev farm + bots) unless you pass `--force`. `db:seed` never wipes — it only seeds an empty file.
- All `data/*.db` files are gitignored: a `git pull` can never touch a world. Back up the live world by copying the file (e.g. a nightly `cp data/game.db backups/` cron on the host).
