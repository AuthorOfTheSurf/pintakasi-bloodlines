import type { BirdRow } from "@/db/schema";
import { AGE, STUD } from "./config";

/**
 * Age gates as pure functions. Age is always DERIVED: currentWeek - birthWeek
 * (one bird-year per game-week). Never stored, never mutated.
 *
 * age 0 = egg · 1 = discovery year (practice/training only) · 2+ = real
 * stakes · 3+ = the fork (hardcore AND manual retirement unlock together) ·
 * 9 = fighting cap (force-retire).
 */

export function ageOf(bird: Pick<BirdRow, "birthWeek">, currentWeek: number): number {
  return currentWeek - bird.birthWeek;
}

export function isEggAge(age: number): boolean {
  return age < AGE.CHICK;
}

export function canPractice(age: number): boolean {
  return age >= AGE.CHICK && age < AGE.FIGHTING_CAP;
}

export function canTrain(age: number): boolean {
  return age === AGE.CHICK; // training belongs to the discovery year
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

/** The record converted to barn worth — what retirement "cashes out." */
export function studValue(bird: Pick<BirdRow, "wins" | "losses">): number {
  return Math.max(STUD.MIN, STUD.BASE + bird.wins * STUD.PER_WIN + bird.losses * STUD.PER_LOSS);
}
