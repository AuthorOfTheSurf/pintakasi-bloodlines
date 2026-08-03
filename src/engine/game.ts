import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { gameState } from "@/db/schema";
import { Bots, type BotDayReport } from "./bots";
import { Breeding } from "./breeding";
import { Lobbies, type LobbyResolution } from "./lobbies";
import { BARN } from "./config";
import { Farms, type FarmView } from "./farms";
import { Flock, type HatchFridayEvents } from "./flock";
import { GameClock, type ClockState } from "./game-clock";
import { Gacha } from "./gacha";

export interface GameStateView {
  clock: ClockState; // the WORLD clock — shared by every farm
  farm: FarmView; // identity, GP, land, free pulls, check-in status
  barn: { count: number; capacity: number };
}

export interface TickView {
  clock: ClockState;
  daysAdvanced: number;
  fridays: HatchFridayEvents[]; // hatches + force-retirements, per Friday crossed
  card: LobbyResolution[]; // the day's lobbies going off — public events
  bots: BotDayReport[]; // what the bot stables did before post time
}

/**
 * The facade routes and MCP talk to — scoped to ONE FARM. Composes the
 * ruled modules and wires the Hatch Friday hook (clock tick → flock
 * processing) in one place. The clock is the world's; the rest is yours.
 */
export class Game {
  readonly clock: GameClock;
  readonly flock: Flock;
  readonly breeding: Breeding;
  readonly lobbies: Lobbies;
  readonly gacha: Gacha;
  readonly farms: Farms;

  constructor(
    private database: DB,
    readonly farmId: string
  ) {
    this.clock = new GameClock(database);
    this.flock = new Flock(database, farmId);
    this.breeding = new Breeding(database, farmId);
    this.lobbies = new Lobbies(database, farmId);
    this.gacha = new Gacha(database, farmId);
    this.farms = new Farms(database);
  }

  state(): GameStateView {
    const row = this.database.select().from(gameState).where(eq(gameState.id, 1)).get();
    if (!row) throw new Error("game_state not seeded — run db:seed");
    return {
      clock: GameClock.stateOf(row.dayIndex),
      farm: this.farms.view(this.farms.rowById(this.farmId)),
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
    // The bot stables play the closing day first — filling lobbies, placing
    // claims — so the card that goes off has their money on it. No-op on
    // worlds without bots seeded.
    const bots = Bots.playDay(this.database);
    const fridays: HatchFridayEvents[] = [];
    const onFriday = (week: number) => fridays.push(this.flock.processHatchFriday(week));
    const result = kind === "day" ? this.clock.tickDay(onFriday) : this.clock.tickWeek(onFriday);
    // The day has turned — the card goes off (fights first, then claims).
    const card = Lobbies.resolve(this.database);
    return { clock: result.state, daysAdvanced: result.daysAdvanced, fridays, card, bots };
  }
}
