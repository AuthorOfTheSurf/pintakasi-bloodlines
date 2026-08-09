import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { events, gameState } from "@/db/schema";

/**
 * The unified ledger (round 11): every meaningful thing that happens —
 * money moving, land moving, birds hatching, fights firing — appends one
 * human-readable row here as it happens. The admin view reads this
 * newest-first; per-bird fight detail still lives in battle_log.
 *
 * Conventions:
 *   - farmId set   → the event belongs to one farm (gpCents/lt are THAT
 *     farm's deltas, signed, exact).
 *   - farmId null  → a WORLD event (a fight, a pool accrual); names go in
 *     the message, money detail in data.
 *   - message      → self-contained one-liner; the log must read without joins.
 */
export type EventType =
  | "farm_registered"
  | "check_in" // the daily airdrop: GP drip + free pulls
  | "gacha" // a roll: token, land, maybe a mystery egg
  | "hatch"
  | "retire" // manual, age cap, or hardcore loss (data.by)
  | "breed" // hen's farm buys a cover (fee out)
  | "stud_income" // rooster's farm banks the stud share
  | "pool_accrual" // staker + juice pool cuts of a breed fee (world)
  | "stud_listed"
  | "stud_unlisted"
  | "entry" // a bird onto tonight's card (fee escrowed)
  | "fight" // one fight going off (world — both sides in the message)
  | "refund" // unmatched at post time — escrow home
  | "card_settled" // round 34: a bird's NIGHT settles — land earned, unfought stake home
  | "claim" // a sealed claim placed (tag escrowed)
  | "claim_won" // the tag wins — the bird changes barns
  | "claim_refund" // a losing claim's escrow home
  | "tag_income" // the claimed bird's owner banks the tag
  | "staking_payout" // the day's pro-rata staker yield
  | "stake"
  | "unstake"
  | "buy_land"
  // Round 43: LAND SPENT ON BARN SLOTS — the game's second LT sink after the
  // stud seat, and the first one a player buys for capacity rather than access.
  // Carries a NEGATIVE `lt` delta, like every burn, so the land conservation
  // proof can see it. See BARN.EXPANSION_BASE_LT for the escalating price.
  | "barn_expanded"
  | "tournament_entry" // a bird registered for the Pintakasi (fee escrowed)
  | "tournament_bump" // the Selection Committee displaced the weakest (refund)
  | "purse_payout" // a share of a championship purse banked
  // ⚠ RETIRED IN ROUND 42 — NOTHING EMITS THIS ANY MORE, and it stays in the
  // union anyway, which is the opposite of how this repo treats a dead config
  // knob (round 31 deleted HARDCORE_ENTRY_FEE rather than keep it "just in
  // case"). The difference is what the two things describe. A config knob
  // describes the rules, so a stale one is a lie. An event type describes what is
  // IN THE DATABASE — and every sim database written before round 42 is full of
  // `crown_land` rows. The doctor and the admin view are built to read old sims,
  // so deleting the name would make yesterday's world unreadable to prove a
  // point about today's.
  //
  // What it meant: one side's land from one championship fight, back when crowns
  // minted per fight (round 37 gave it a signed per-farm row, which is what made
  // land conservation testable at all). Round 42 replaced the per-fight mint and
  // the elimination grants with one fixed pot per crown, paid at settle-up as a
  // `purse_payout` row carrying `lt`. See PINTAKASI.LAND_POT.
  | "crown_land"
  | "champion"; // a Pintakasi crown (world event)

export interface EmitInput {
  type: EventType;
  farmId?: string | null;
  birdId?: string | null;
  gpCents?: number; // signed centi-GP delta for farmId's wallet
  lt?: number; // signed Land Token delta for farmId's holdings
  message: string;
  data?: unknown; // extra structure, JSON-serialized
}

type EventInsert = typeof events.$inferInsert;
type EventBuffer = { dayIndex: number; rows: EventInsert[] };

/**
 * THE TICK'S WRITE-AHEAD LEDGER (round 48).
 *
 * A long simulation emits several rows per fight. At day 182 that meant
 * 407,185 one-row INSERT statements and, before every one, a SELECT of the
 * same one-row game_state table just to rediscover today's date. The event
 * order is meaningful, but individual statement boundaries are not.
 *
 * Game.tick wraps its already-atomic transaction in this buffer. `emit`
 * serializes the row at the original call site, preserving errors and order,
 * then the successful tick writes that sequence in bounded multi-row chunks.
 * Calls outside a tick still insert immediately, which keeps every public
 * engine method's existing transaction semantics.
 *
 * WeakMap keeps parallel test worlds isolated and lets closed DB handles go.
 */
const buffers = new WeakMap<object, EventBuffer>();
const EVENT_INSERT_CHUNK = 250; // 9 columns × 250 stays well below SQLite's parameter ceiling

export function withBufferedEvents<T>(database: DB, dayIndex: number, fn: () => T): T {
  if (buffers.has(database))
    throw new Error("Event buffering cannot be nested for the same world");
  const buffer: EventBuffer = { dayIndex, rows: [] };
  buffers.set(database, buffer);
  try {
    const result = fn();
    for (let i = 0; i < buffer.rows.length; i += EVENT_INSERT_CHUNK)
      database.insert(events).values(buffer.rows.slice(i, i + EVENT_INSERT_CHUNK)).run();
    return result;
  } finally {
    // On a throw no rows have been flushed, and Game.tick's outer transaction
    // rolls back the rest of the day. Never leave a dead buffer attached.
    buffers.delete(database);
  }
}

/**
 * Move buffered event time with the world clock. The clock advances before
 * Hatch Friday callbacks and card resolution, so those rows historically
 * carry the post-tick day while bot/card-entry rows carry the pre-tick day.
 */
export function setBufferedEventDay(database: DB, dayIndex: number): void {
  const buffer = buffers.get(database);
  if (buffer) buffer.dayIndex = dayIndex;
}

export function emit(database: DB, input: EmitInput): void {
  const buffer = buffers.get(database);
  const row: EventInsert = {
    dayIndex:
      buffer?.dayIndex ??
      database.select().from(gameState).where(eq(gameState.id, 1)).get()?.dayIndex ??
      0,
    type: input.type,
    farmId: input.farmId ?? null,
    birdId: input.birdId ?? null,
    gpCents: input.gpCents ?? null,
    lt: input.lt ?? null,
    message: input.message,
    data: input.data === undefined ? null : JSON.stringify(input.data),
  };
  if (buffer) buffer.rows.push(row);
  else database.insert(events).values(row).run();
}

/** Format centi-GP for messages: whole GP stay whole, fractions show cents. */
export function fmtGp(cents: number): string {
  const gp = cents / 100;
  return Number.isInteger(gp) ? String(gp) : gp.toFixed(2);
}
