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
  | "tournament_entry" // a bird registered for the Pintakasi (fee escrowed)
  | "tournament_bump" // the Selection Committee displaced the weakest (refund)
  | "purse_payout" // a share of a championship purse banked
  | "crown_land" // round 37: one side's land from one championship fight
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

export function emit(database: DB, input: EmitInput): void {
  const state = database.select().from(gameState).where(eq(gameState.id, 1)).get();
  database
    .insert(events)
    .values({
      dayIndex: state?.dayIndex ?? 0,
      type: input.type,
      farmId: input.farmId ?? null,
      birdId: input.birdId ?? null,
      gpCents: input.gpCents ?? null,
      lt: input.lt ?? null,
      message: input.message,
      data: input.data === undefined ? null : JSON.stringify(input.data),
    })
    .run();
}

/** Format centi-GP for messages: whole GP stay whole, fractions show cents. */
export function fmtGp(cents: number): string {
  const gp = cents / 100;
  return Number.isInteger(gp) ? String(gp) : gp.toFixed(2);
}
