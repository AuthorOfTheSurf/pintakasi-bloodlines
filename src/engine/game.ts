import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { gameState } from "@/db/schema";
import { shopAllClaimers } from "./auto-play";
import { Bots, type BotDayReport } from "./bots";
import { Breeding } from "./breeding";
import { Lobbies, type LobbyResolution } from "./lobbies";
import { BARN, weatherOfDay, type Element } from "./config";
import { Farms, type FarmView } from "./farms";
import { Flock, type HatchFridayEvents } from "./flock";
import { GameClock, type ClockState } from "./game-clock";
import { Gacha } from "./gacha";
import { baselineBefore, recordSnapshot } from "./snapshots";
import { Tournaments, type TournamentResolution } from "./tournaments";

export interface GameStateView {
  clock: ClockState; // the WORLD clock — shared by every farm
  farm: FarmView; // identity, GP, land, free pulls, check-in status
  barn: { count: number; capacity: number };
  // The day's ascendant element + tomorrow's, so the client can plan (round 24).
  weather: { today: Element; tomorrow: Element };
}

export interface TickView {
  clock: ClockState;
  daysAdvanced: number;
  fridays: HatchFridayEvents[]; // hatches + force-retirements, per Friday crossed
  card: LobbyResolution[]; // the day's lobbies going off — public events
  pintakasi: TournamentResolution[]; // crown day's blade championships (round 18)
  bots: BotDayReport[]; // what the bot stables did before post time
  staking: { paidGp: number; stakers: number }; // the day's pro-rata payout
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
  readonly tournaments: Tournaments;
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
    this.tournaments = new Tournaments(database, farmId);
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
      weather: { today: weatherOfDay(row.dayIndex), tomorrow: weatherOfDay(row.dayIndex + 1) },
    };
  }

  tickDay(): TickView {
    return this.tick("day");
  }

  tickWeek(): TickView {
    return this.tick("week");
  }

  private tick(kind: "day" | "week"): TickView {
    // Baseline snapshot for the pre-tick day, if this world has none yet —
    // the first diff needs something to diff against.
    const preDay = this.clock.currentDay();
    if (baselineBefore(this.database, preDay + 1) === null) recordSnapshot(this.database);
    // The bot stables play the closing day first — filling lobbies, placing
    // claims — so the card that goes off has their money on it. No-op on
    // worlds without bots seeded.
    const bots = Bots.playDay(this.database);
    // Now that tonight's tags are posted, the player-side stables shop the
    // claimer board (round 19) — they run their honest day BEFORE the bots,
    // when the claimer fields are still empty.
    shopAllClaimers(this.database);
    const fridays: HatchFridayEvents[] = [];
    const onFriday = (week: number) => fridays.push(this.flock.processHatchFriday(week));
    const result = kind === "day" ? this.clock.tickDay(onFriday) : this.clock.tickWeek(onFriday);
    // The day has turned — the card goes off (fights first, then claims),
    // then the main event: every departed crown day runs its Pintakasi
    // (undercard first, crowns second), then the staking pool pays out.
    const card = Lobbies.resolve(this.database);
    const pintakasi: TournamentResolution[] = [];
    for (let d = preDay; d < result.state.dayIndex; d++) {
      // Wednesday's Juvenile Championship first, then Thursday's Majors — the
      // week builds (round 23). The juvenile stage takes its ruled slice of
      // the juice; the Majors take whatever is left.
      if (Tournaments.isJuvenileCrownDay(d))
        pintakasi.push(...Tournaments.resolveCrownDay(this.database, d, "juvenile"));
      if (Tournaments.isCrownDay(d)) pintakasi.push(...Tournaments.resolveCrownDay(this.database, d));
    }
    const staking = Farms.distributeStaking(this.database);
    // The office's memory: today's top-line metrics, for tomorrow's diffs.
    recordSnapshot(this.database);
    return { clock: result.state, daysAdvanced: result.daysAdvanced, fridays, card, pintakasi, bots, staking };
  }
}
