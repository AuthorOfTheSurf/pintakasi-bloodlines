# Coaching: skill enters the system as language

The fleet has two loops at two speeds. The **player** is in the tick — a local
model, 14+ wakes a day, cheap and fast, reading its morning brief and moving.
The **coach** is out of the tick — big, slow, smart, *rare*. It never plays a
turn: it reads the paper trail, forms a judgement about each barn's week, and
writes new **standing orders** via `tune`. The expensive model's intelligence
gets compiled into cheap sentences the local model executes all week.

This is also how a fixed-price Claude/`droid` subscription joins the project
without entering the daily loop: the coach is a chat session (or `claude -p`),
not an API key in the game. It reads a few query results and emits `bun run
tune` lines. Nothing in the engine knows the coach exists — it is just another
client addressing the barn actors, which works mid-run (phase 3's demo).

## The session, step by step

1. **Pull the paper trail** for the world you're coaching (queries below).
2. **Hand it to the coach** with the prompt at the bottom.
3. **Apply its orders**, one line per barn: `bun run tune bot-5 "..." --world=<name>`.
4. **Play on** (`bun run simulate 7 --keep …`) and compare the week's GP delta,
   rank movement, and `brain_log` behavior against the un-coached week.

Tune mid-run or between runs — mid-run binds instantly (the actor is live);
between runs, expect the retry to absorb the rebind window, and restart the
engine daemon if it never binds (AGENTS.md).

## What the coach reads

All against the world's sim db (`sqlite3 data/<world>.db`):

```sql
-- Standings and brains
SELECT ROW_NUMBER() OVER (ORDER BY gp DESC) rank, id, name, brain, gp,
       (land_tokens_cents + staked_land_cents)/100.0 land
FROM farms WHERE is_bot=1;

-- Each barn's week at a glance: actions/day by verb
SELECT farm_id, json_extract(value,'$.do') verb, COUNT(*) n
FROM brain_log, json_each(proposed_json)
GROUP BY farm_id, verb ORDER BY farm_id, n DESC;

-- Who is thinking long or dropping actions
SELECT farm_id, COUNT(*) days, AVG(brief_tokens) brief, AVG(decide_ms) ms,
       SUM(json_array_length(dropped_json)) dropped
FROM brain_log GROUP BY farm_id;

-- A single barn's full week, decision by decision
SELECT day_index, proposed_json FROM brain_log
WHERE farm_id='bot-5' ORDER BY day_index;
```

Plus each barn's current orders: `bun run tune <farm> --world=<name>` (bare =
read-only).

## The coach prompt

> You are the performance coach for stables in a cockfighting management game.
> Each stable is played day-to-day by a small local model following its
> **standing orders** — you write those orders; you never play a turn.
>
> Below: the standings, each stable's actions-by-verb for the week, and its
> current orders. For each stable I name, reply with ONE line of new standing
> orders (under 60 words), or the word KEEP.
>
> Rules for good orders:
> - State goals and priorities, never mechanics — the player knows the rules.
> - Name what the paper trail shows it under- or over-doing.
> - One personality per barn; keep its existing creed unless it's losing.
> - The player reads orders every morning next to a brief of its wallet,
>   fighters, tonight's card, and the claim board. Write for that reader.

## House creeds (the starting personas)

`--personas` starts each llm barn under the creed its scripted twin's profile
implies (`src/actors/personas.ts`): claim sharks claim, broodfarms breed, pit
crews enter everything, the whale rolls to the bottom of the wallet, the land
baron maxes the daily cap. **Goals port over; decision logic does not** — the
scripted knobs (entryRate 0.85, claimAggression 0.75…) stay un-ported, so the
A/B keeps measuring brains rather than imitations. The coach edits creeds from
there, per barn, based on results.
