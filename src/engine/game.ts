import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { gameState } from "@/db/schema";
import { shopAllClaimers } from "./auto-play";
import { Bots, type BotDayReport, type DiscoveryPolicy } from "./bots";
import type { BotAction } from "./bot-brain";
import { Breeding } from "./breeding";
import { Lobbies, type LobbyResolution } from "./lobbies";
import { cardOfDay, weatherOfDay, type CardKey, type Element } from "./config";
import { Farms, type FarmView } from "./farms";
import { Flock, type HatchFridayEvents } from "./flock";
import { GameClock, type ClockState } from "./game-clock";
import { Gacha } from "./gacha";
import { withBufferedEvents } from "./events";
import { baselineBefore, recordSnapshot } from "./snapshots";
import { Tournaments, type TournamentResolution } from "./tournaments";

export interface GameStateView {
  clock: ClockState; // the WORLD clock — shared by every farm
  farm: FarmView; // identity, GP, land, free pulls, check-in status
  barn: { count: number; capacity: number };
  // The day's ascendant element + tomorrow's, so the client can plan (round 24).
  weather: { today: Element; tomorrow: Element };
  // Tonight's posted card + tomorrow's (round 31). Lobbies are no longer
  // conjured on demand: a key is enterable only if the day posted it.
  card: { today: CardKey[]; tomorrow: CardKey[] };
}

/**
 * What a caller may hand a tick. One field so far; it exists as an options
 * object rather than a positional argument because the next thing anyone
 * wants to pass a tick will not be proposals either.
 */
export interface TickOptions {
  /** farmId → the day an outside decider chose for that barn (round 49). */
  proposals?: ReadonlyMap<string, BotAction[]>;
  /**
   * What the tick does for farms that are not bots. "auto-play" is the sim-era
   * rule (Zane, 2026-08-03): they shop the claimer board like a bot would.
   * "hands-off" is the live world's (alpha-1, 2026-10): "ticks play only the
   * bot farms, never a player's farm", so a real player's barn moves only
   * when its owner moves it. Defaults to "auto-play" so sims and the /admin
   * buttons are unchanged.
   */
  players?: "auto-play" | "hands-off";
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
    readonly farmId: string,
    private discoveryPolicy: DiscoveryPolicy = "current"
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
      barn: { count: this.flock.barnCount(), capacity: this.flock.capacity() },
      weather: { today: weatherOfDay(row.dayIndex), tomorrow: weatherOfDay(row.dayIndex + 1) },
      // TONIGHT'S CARD and tomorrow's (round 31), exactly parallel to weather
      // above: both are pure functions of the day index, so one day of
      // foresight is free and deliberately PUBLIC — a stable plans around what
      // is coming, and holding a bird back for tomorrow's blade is a real play.
      card: { today: cardOfDay(row.dayIndex), tomorrow: cardOfDay(row.dayIndex + 1) },
    };
  }

  /**
   * Round 49. `proposals` carries the days that OUTSIDE deciders already
   * chose for their barns — collected by `collectProposals` before this call,
   * because collecting is async and a tick is one synchronous transaction
   * (see engine/bot-brain.ts for the full argument).
   *
   * ⚠ THE TICK STAYS SYNCHRONOUS, deliberately. Making it async to hide the
   * collect step inside would push a promise through `Game`, both tick
   * routes, two MCP tools and the sim loop, to buy nothing — the engine's
   * job is applying rules, and waiting on a network is not that. Whoever
   * drives the tick does the waiting; the engine does the writing.
   */
  tickDay(opts: TickOptions = {}): TickView {
    return this.tick("day", opts);
  }

  tickWeek(opts: TickOptions = {}): TickView {
    return this.tick("week", opts);
  }

  /**
   * ONE TICK IS ONE TRANSACTION (round 35).
   *
   * Two reasons, and the speed one is the smaller. Every `.run()` used to be
   * its own implicit transaction, so a single day — thousands of wallet
   * updates, entry settlements, battle-log inserts and event rows — paid the
   * commit cost thousands of times over.
   *
   * The one that actually matters is ATOMICITY. A tick moves money in a dozen
   * places and its correctness is defined by the conservation proof, which
   * only holds ACROSS the whole day: escrow leaves a wallet at entry and comes
   * back at settle-up, and between those two writes the books do not balance.
   * A crash in the middle used to leave a world permanently short — exactly
   * the "800.00 GP MISSING" shape we saw twice from interrupted sims and both
   * times had to reason our way past. Now a day either happens or it doesn't.
   */
  private tick(kind: "day" | "week", opts: TickOptions): TickView {
    return this.database.transaction((): TickView =>
      withBufferedEvents(this.database, this.clock.currentDay(), () => this.runTick(kind, opts))
    ) as TickView;
  }

  private runTick(kind: "day" | "week", opts: TickOptions): TickView {
    // Baseline snapshot for the pre-tick day, if this world has none yet —
    // the first diff needs something to diff against.
    const preDay = this.clock.currentDay();
    if (baselineBefore(this.database, preDay + 1) === null) recordSnapshot(this.database);
    // The bot stables play the closing day first — filling lobbies, placing
    // claims — so the card that goes off has their money on it. No-op on
    // worlds without bots seeded.
    const bots = Bots.playDay(this.database, this.discoveryPolicy, opts.proposals);
    // Now that tonight's tags are posted, the player-side stables shop the
    // claimer board (round 19) — they run their honest day BEFORE the bots,
    // when the claimer fields are still empty.
    if ((opts.players ?? "auto-play") === "auto-play") shopAllClaimers(this.database);
    const result = kind === "day" ? this.clock.tickDay() : this.clock.tickWeek();
    // The day has turned — the card goes off (fights first, then claims),
    // then the main event: every departed crown day runs its Pintakasi
    // (undercard first, crowns second), then the calendar's own business —
    // Hatch Friday — and then the staking pool pays out.
    const card = Lobbies.resolve(this.database);
    const pintakasi: TournamentResolution[] = [];
    for (let d = preDay; d < result.state.dayIndex; d++) {
      // Wednesday's Juvenile Championship first, then Thursday's Majors — the
      // week builds (round 23). The juvenile stage takes its ruled slice of
      // the juice; the Majors take whatever is left.
      if (Tournaments.isJuvenileCrownDay(d))
        pintakasi.push(...Tournaments.resolveCrownDay(this.database, d, "juvenile"));
      if (Tournaments.isCrownDay(d))
        pintakasi.push(...Tournaments.resolveCrownDay(this.database, d));
    }
    // HATCH FRIDAY RUNS AFTER THE CROWNS (issue #38). It used to fire inside
    // the clock advance, BEFORE the brackets above — and the tick that
    // resolves Thursday's Majors is the tick that turns Thursday into Friday.
    // So a bird in its last fighting year (FIGHTING_CAP − 1) was already
    // retired for age when its bracket went looking for it and went home
    // "no longer stands": zero Major fights at that age across five 182-day
    // worlds, and the Handbook's "age 3+" was really 3 to 7. The card and the
    // crowns resolve the day that just ended; the calendar turns afterwards.
    const fridays = result.hatchFridaysCrossed.map((week) => this.flock.processHatchFriday(week));
    const staking = Farms.distributeStaking(this.database);
    // …and only now do the bot barns bank tonight's land. Their day ran before
    // the card did, so everything the pit paid them arrived after they last
    // walked past the land office — see Bots.sweepStakes for why this sits
    // AFTER the payout rather than before it.
    Bots.sweepStakes(this.database);
    // The office's memory: today's top-line metrics, for tomorrow's diffs.
    recordSnapshot(this.database);
    return {
      clock: result.state,
      daysAdvanced: result.daysAdvanced,
      fridays,
      card,
      pintakasi,
      bots,
      staking,
    };
  }
}
