import type { BirdRow } from "@/db/schema";
import { AGE } from "./config";

/**
 * Age gates as pure functions. Age is always DERIVED: currentWeek - birthWeek
 * (one bird-year per game-week). Never stored, never mutated.
 *
 * age 0 = egg · 1 = discovery year (juvenile only — stats are FIXED at
 * birth; discovery means fighting the formats, not training) · 2+ = real
 * stakes · 3+ = the fork (hardcore AND manual retirement unlock together) ·
 * 9 = fighting cap (force-retire).
 */

/**
 * A retired bird's age FREEZES at its retirement week (ruled round 15 —
 * "week 6, age 17" starters were retirees still accruing bird-years). The
 * frozen number is the age the career ended at; active birds keep aging.
 */
export function ageOf(
  bird: Pick<BirdRow, "birthWeek"> & Partial<Pick<BirdRow, "retiredWeek">>,
  currentWeek: number
): number {
  const asOf =
    bird.retiredWeek != null && bird.retiredWeek < currentWeek ? bird.retiredWeek : currentWeek;
  return asOf - bird.birthWeek;
}

export function isEggAge(age: number): boolean {
  return age < AGE.CHICK;
}

/**
 * The discovery year ONLY (ruled round 20: "juveniles should only be
 * competing against juveniles"). The gate used to stay open at every age,
 * so a five-year-old could drop into a juvenile card and beat up chicks.
 * Now age 1 is a closed division, 2+ is one group, and hardcore is 3+.
 */
export function canJuvenile(age: number): boolean {
  return age === AGE.CHICK;
}

export function canRealFight(age: number): boolean {
  return age >= AGE.REAL_STAKES && age < AGE.FIGHTING_CAP;
}

export function canHardcore(age: number): boolean {
  return age >= AGE.FORK && age < AGE.FIGHTING_CAP;
}

export function canManualRetire(age: number): boolean {
  return age >= AGE.FORK;
}

export function mustRetire(age: number): boolean {
  return age >= AGE.FIGHTING_CAP;
}

// NOTE: there is deliberately NO studValue formula. A stud's price is
// player price-setting + supply/demand (ruled 2026-08-03) — winning does
// not mechanically raise it. For now every cover costs ECONOMY.BREED_FEE.
