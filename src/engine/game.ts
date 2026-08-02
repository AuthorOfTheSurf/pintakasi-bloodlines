import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { gameState } from "@/db/schema";
import { Battle } from "./battle";
import { Breeding } from "./breeding";
import { BARN } from "./config";
import { Flock, type HatchFridayEvents } from "./flock";
import { GameClock, type ClockState } from "./game-clock";
import { Gacha } from "./gacha";

export interface GameStateView {
  clock: ClockState;
  gp: number;
  landTokens: number;
  barn: { count: number; capacity: number };
}

export interface TickView {
  clock: ClockState;
  daysAdvanced: number;
  fridays: HatchFridayEvents[]; // hatches + force-retirements, per Friday crossed
}

/**
 * The facade routes and MCP talk to. Composes the five ruled modules and
 * wires the Hatch Friday hook (clock tick → flock processing) in one place.
 */
export class Game {
  readonly clock: GameClock;
  readonly flock: Flock;
  readonly breeding: Breeding;
  readonly battle: Battle;
  readonly gacha: Gacha;

  constructor(private database: DB) {
    this.clock = new GameClock(database);
    this.flock = new Flock(database);
    this.breeding = new Breeding(database);
    this.battle = new Battle(database);
    this.gacha = new Gacha(database);
  }

  state(): GameStateView {
    const row = this.database.select().from(gameState).where(eq(gameState.id, 1)).get();
    if (!row) throw new Error("game_state not seeded — run db:seed");
    return {
      clock: GameClock.stateOf(row.dayIndex),
      gp: row.gp,
      landTokens: row.landTokens,
      barn: { count: this.flock.barnCount(), capacity: BARN.CAPACITY },
    };
  }

  tickDay(): TickView {
    return this.tick("day");
  }

  tickWeek(): TickView {
    return this.tick("week");
  }

  private tick(kind: "day" | "week"): TickView {
    const fridays: HatchFridayEvents[] = [];
    const onFriday = (week: number) => fridays.push(this.flock.processHatchFriday(week));
    const result = kind === "day" ? this.clock.tickDay(onFriday) : this.clock.tickWeek(onFriday);
    return { clock: result.state, daysAdvanced: result.daysAdvanced, fridays };
  }
}
