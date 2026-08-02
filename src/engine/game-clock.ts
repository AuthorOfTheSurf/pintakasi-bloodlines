import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { gameState } from "@/db/schema";
import { CALENDAR } from "./config";

/**
 * The game calendar. Day 0 = the first Friday of the Year 3000, so every
 * dayIndex divisible by 7 is a Hatch Friday. Birds age one bird-year per
 * game-week: age = currentWeek - birthWeek (derived, never stored).
 */

// First Friday of START_YEAR, as a UTC timestamp (Friday = getUTCDay() 5).
const jan1 = Date.UTC(CALENDAR.START_YEAR, 0, 1);
const jan1Weekday = new Date(jan1).getUTCDay();
const EPOCH_UTC = jan1 + ((5 - jan1Weekday + 7) % 7) * 86_400_000;

export interface ClockState {
  dayIndex: number;
  weekIndex: number;
  date: string; // e.g. "Friday, January 2, 3000"
  isHatchFriday: boolean;
}

export interface TickResult {
  state: ClockState;
  daysAdvanced: number;
  hatchFridaysCrossed: number[]; // weekIndex of each Friday landed on/crossed
}

/** Called once per Hatch Friday crossed (Phase 2 wires Flock aging here). */
export type FridayHandler = (weekIndex: number) => void;

export class GameClock {
  constructor(private database: DB) {}

  static weekOf(dayIndex: number): number {
    return Math.floor(dayIndex / CALENDAR.DAYS_PER_WEEK);
  }

  static isFriday(dayIndex: number): boolean {
    return dayIndex % CALENDAR.DAYS_PER_WEEK === 0;
  }

  static dateOf(dayIndex: number): string {
    const d = new Date(EPOCH_UTC + dayIndex * 86_400_000);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  static stateOf(dayIndex: number): ClockState {
    return {
      dayIndex,
      weekIndex: GameClock.weekOf(dayIndex),
      date: GameClock.dateOf(dayIndex),
      isHatchFriday: GameClock.isFriday(dayIndex),
    };
  }

  currentDay(): number {
    const row = this.database.select().from(gameState).where(eq(gameState.id, 1)).get();
    if (!row) throw new Error("game_state not seeded — run db:seed");
    return row.dayIndex;
  }

  state(): ClockState {
    return GameClock.stateOf(this.currentDay());
  }

  /** Advance one day. Fires onFriday if the new day is a Hatch Friday. */
  tickDay(onFriday?: FridayHandler): TickResult {
    return this.advanceTo(this.currentDay() + 1, onFriday);
  }

  /** Advance to the next Hatch Friday (7 days if already on one). */
  tickWeek(onFriday?: FridayHandler): TickResult {
    const day = this.currentDay();
    const daysToFriday = CALENDAR.DAYS_PER_WEEK - (day % CALENDAR.DAYS_PER_WEEK);
    return this.advanceTo(day + daysToFriday, onFriday);
  }

  private advanceTo(target: number, onFriday?: FridayHandler): TickResult {
    const from = this.currentDay();
    const crossed: number[] = [];
    for (let d = from + 1; d <= target; d++) {
      if (GameClock.isFriday(d)) crossed.push(GameClock.weekOf(d));
    }
    this.database.update(gameState).set({ dayIndex: target }).where(eq(gameState.id, 1)).run();
    for (const week of crossed) onFriday?.(week);
    return {
      state: GameClock.stateOf(target),
      daysAdvanced: target - from,
      hatchFridaysCrossed: crossed,
    };
  }
}
