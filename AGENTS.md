# Working in this repo

Pintakasi: Bloodlines — a digital sabong game. Next.js + TypeScript + Bun, SQLite via Drizzle, a pure-class game engine under `src/engine/`.

---

## ⚠ THE RULE THAT MATTERS MOST: change a rule, change the Handbook

There is a player-facing wiki in this repo at **`src/app/wiki/`** — *The Pintakasi Handbook*, linked from the Stewards' Office header and served at `/wiki`. It exists because the alternative was asking an agent to go read the engine every time somebody wanted to know the gacha odds.

**If you change a game rule, a fee, an odd, a cap, a share, a schedule or a gate, you must update the Handbook in the same unit of work.** Not later, not in a follow-up. A stale handbook is worse than no handbook, because it teaches confident nonsense to somebody who has no way to check.

### Numbers are IMPORTED, never typed

Every figure on every Handbook page reads from `@/engine/config` at render time and is computed inline:

```tsx
// ✅ this is the whole design
<td className="num">{ECONOMY.REAL_ENTRY_FEE} GP</td>
<td className="num">{((GACHA_WEIGHTS.Gold / total) * 100).toFixed(1)}%</td>

// ❌ never this — it will be a lie within two rounds
<td className="num">40 GP</td>
```

If a value you want isn't exported from config, either export it or **describe it in words**. Do not copy a literal out of the engine into a page. The point of the rule is that a knob change propagates to the docs by itself; a hand-copied number silently opts out of that.

### The checklist, when you touch a rule

1. Change the engine.
2. Update the tests (they double as the spec — read them before assuming what a rule was *for*).
3. **Grep `src/app/wiki/` for anything the change makes untrue.** Schedules, gates, "X is the only way to…", worked examples, EV comparisons, and any prose describing a rule you just reversed are the usual suspects — a computed number fixes itself, a *sentence* does not. `src/engine/docs.test.ts` catches the load-bearing cases; it does not catch every sentence.
4. `src/app/api/mcp/route.ts` builds its prose from config, so most rules propagate on their own — but a genuinely NEW mechanic still needs a sentence written. Its tool descriptions are how a Claude playing the game learns the rules.
5. `bunx tsc --noEmit` and `bun test` clean.
6. **`bun run simulate` and read the doctor's report at the end** (below). Its 91-day default is long enough to judge population health beyond the cold-start burst; balance changes are judged on the health block, not on whether the tests pass.

### Handbook page conventions

Server components, no `"use client"`, each page starts with `export const dynamic = "force-dynamic";`. Styling comes entirely from `src/app/wiki/layout.tsx` — never add a `<style>` block to a page. The available classes are `lede`, `callout` (+ `warn` / `tip`), `tablewrap` (wrap **every** table), `cards-2`, `minicard`, `next`, `dim`, and `num` on numeric cells. Escape apostrophes in JSX text as `&apos;`.

The voice is for someone who has never played: short sentences, roughly a 5th-grade reading level, real domain vocabulary defined once, and always the *why* behind a rule that would otherwise look arbitrary.

---

## The rest of the house rules

**Schema changes remake worlds, they don't migrate them.** `src/db/schema.ts` and `src/db/ddl.ts` are hand-synced — edit both. Then delete `data/game.db` (and its `-wal`/`-shm` files) and reseed; old sim databases are disposable by design.

**Config is the single source of balance.** Every tunable lives in `src/engine/config.ts` with a comment saying what it does *in gameplay terms* and, where it was ruled, why. Don't scatter magic numbers into the engine.

**Comments explain WHY.** This codebase comments densely, and the comments carry the design history — which ruling a rule came from, what the alternative was, what broke last time. Match that. Never write a comment that only restates the code.

**GP is never printed or burned.** Wallets + escrow + the juice pool + the staker pool must balance to the cent across every tick. Two faucets only: the starting stake and the daily drip (plus the one-time genesis juice). If you add a place money changes hands, route it somewhere — a silent burn has slipped through twice now (gacha in round 14, `buyLand` in round 22) and both times only the conservation proof would have caught it.

**Bots and auto-play need teaching.** Adding a door doesn't mean anyone walks through it. Twice a feature measured *zero* in simulation because no bot had a reason to use it (claiming in round 19, paid gacha rolls in round 22). If you add a mechanic, give the bots (`src/engine/bot-config.ts`, `src/engine/bots.ts`) and auto-play (`src/engine/auto-play.ts`) an appetite for it — then run a sim and check the number moved.

**Verify by simulating, not by reasoning.** `bun run simulate` writes a fresh timestamped sim database and ends with a doctor's report; its 91-day default covers 13 full weeks. `bun dev:sim` serves the newest one at `localhost:3435/admin`.

**`bun run doctor` is the verification loop.** It asserts the five invariants (GP conservation to the cent, no negative balances, no Pit Figure inversions, purses settling exactly, one card per bird per day) and prints the health block: unmatched rate, the worst lobby keys, population and supply-vs-attrition, staker inflows by source, championship fields, and **mechanic adoption**. It exits non-zero on a broken invariant, so `simulate` fails loudly rather than printing a happy log.

- `bun run doctor` — the newest sim · `--live` — `data/game.db` · `--quiet` — invariants only, for pasting · `--json` — the raw report
- **Read the adoption block after adding anything.** A door at zero means no bot has an appetite for it and the feature is untested in practice. That has happened twice.
- Health warnings are *judgement*, not failures — "19% of entries never drew an opponent" is a design conversation. Invariant failures are bugs.
- Reach for `sqlite3` only for questions the doctor doesn't answer yet — and when you do, consider whether the answer belongs in the doctor instead.

**Fan out.** A round of work usually splits cleanly into engine / tests / docs / UI. Those touch different files, so run them as concurrent subagents in a single message rather than serially — wall clock becomes the slowest one instead of the sum. Keep the engine change yourself (it's the part that needs the whole picture) and tell each agent explicitly which files are off-limits, because the failure mode is two agents editing `package.json`.

**While agents are running, `git checkout <file>` is a loaded gun.** Uncommitted work is the only copy of a subagent's output, and reverting a file to HEAD destroys it silently — `git status` afterwards just looks tidy. If you need to test against the old version of a file, copy it aside and restore from the copy. (Recovery, if it happens anyway: message the agent that wrote it — it still has the context and can re-apply faster than a re-run.)

**Commits** are autonomous in this repo: one per round of work, title says what changed and why.
