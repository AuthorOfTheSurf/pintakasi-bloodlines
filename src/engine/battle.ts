import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { DB } from "@/db/client";
import { battleLog, birds, farms, gameState } from "@/db/schema";
import {
  BARN,
  BATTLE,
  BREEDING,
  CADENCE,
  CLAIMER,
  ECONOMY,
  ELEMENT_BEATS,
  FIGURE,
  FORMATS,
  LAND,
  LOBBY_HOUSE_QUALITY,
  PHASES,
  STARS,
  STATS,
  type Element,
  type FightFormat,
  type Lobby,
} from "./config";
import { Flock, type BirdView } from "./flock";
import { GameClock } from "./game-clock";
import { canHardcore, canPractice, canRealFight } from "./lifecycle";
import { freshSeed, mulberry32, randInt, roll2d6, type Rng } from "./rng";

export type FightMode = "practice" | "real" | "hardcore";

export interface FightResult {
  result: "win" | "loss";
  mode: FightMode;
  format: FightFormat; // the "distance" this fight was run at
  lobby: Lobby;
  bird: BirdView; // post-fight (record updated; hardcore loss = retired; claimer loss = gone)
  opponent: HouseBird;
  gpDelta: number;
  landTokens: number; // flat land award — every fight pays it, win or lose
  pitFigure: number; // banded, format-normalized — the discovery signal
  forcedRetirement: boolean;
  // Claimers: lose and the house claims YOUR bird at the tag (claimedAway;
  // gpDelta includes the claim price). Win and the HOUSE bird is claimable
  // until the end of the game-day (claimOffer → claimHouseBird).
  claimedAway: boolean;
  claimOffer: { battleLogId: number; price: number } | null;
  playByPlay: string;
  seed: number; // replay the fight from this
}

export interface HouseBird {
  name: string;
  sex: "male" | "female";
  age: number;
  stats: BirdStats;
  element: Element;
  halfStars: number;
}

export type BirdStats = {
  agility: number;
  sight: number;
  stamina: number;
  gameness: number;
  station: number;
  condition: number;
};

/** Career + figure summary per format — the past-performance line. */
export type FormatRecord = {
  fights: number;
  wins: number;
  losses: number;
  avgFigure: number;
  bestFigure: number;
};

const HOUSE_NAMES = [
  "Haring Itim", "Bulawan", "Salakay", "Tigre ng Talpakan", "Kampilan",
  "Bantay Dagat", "Puting Bagyo", "Sagupaan", "Lintik", "Maharlika",
];

const MODE_FEES: Record<FightMode, number> = {
  practice: ECONOMY.PRACTICE_ENTRY_FEE,
  real: ECONOMY.REAL_ENTRY_FEE,
  hardcore: ECONOMY.HARDCORE_ENTRY_FEE,
};

interface Fighter {
  name: string;
  stats: BirdStats; // star-boosted base
  element: Element;
  halfStars: number;
  wind: number;
  maxWind: number;
  underdog: boolean; // station's trigger — set once at the scale
  quitChecked: boolean; // the once-per-fight morale check
  ran: boolean;
  dealt: number; // damage bookkeeping for the Pit Figure
}

export class Battle {
  private flock: Flock;

  constructor(
    private database: DB,
    private farmId: string
  ) {
    this.flock = new Flock(database, farmId);
  }

  /**
   * One fight vs a house bird, at a chosen weapon format (the "distance"
   * dial) and lobby (the class dial). POOLED ECONOMY: both sides post the
   * entry, winner takes the pot — win +entry, lose −entry; no GP printed.
   * The subsidy is the flat Land Token. Hardcore = the key rule.
   */
  fight(
    birdId: string,
    mode: FightMode,
    format: FightFormat = "shortKnife",
    seed: number = freshSeed(),
    lobby: Lobby = "open",
    claimPrice?: number
  ): FightResult {
    const bird = this.flock.byId(birdId);
    if (bird.status !== "active") throw new Error(`${bird.name} is not an active fighter`);
    this.checkGate(bird, mode);
    this.checkLobby(bird, mode, lobby, claimPrice);

    const today = this.database.select().from(gameState).where(eq(gameState.id, 1)).get()!.dayIndex;

    // One fight per bird per game-day — a hard count, not a cooldown.
    const foughtToday = this.database
      .select()
      .from(battleLog)
      .where(and(eq(battleLog.birdId, bird.id), eq(battleLog.dayIndex, today)))
      .all().length;
    if (foughtToday >= CADENCE.FIGHTS_PER_BIRD_PER_DAY)
      throw new Error(`${bird.name} already fought today — one fight per bird per game-day (tick a day)`);

    const farm = this.database.select().from(farms).where(eq(farms.id, this.farmId)).get()!;
    const fee = MODE_FEES[mode];
    if (farm.gp < fee) throw new Error(`${mode} entry costs ${fee} GP — you have ${farm.gp}`);

    const rng = mulberry32(seed);
    const opponent = this.generateHouseBird(bird, rng, lobby, claimPrice);
    const { won, playByPlay, pitFigure } = this.simulate(bird, opponent, mode, format, lobby, rng);

    // Settle: pooled pot (win +fee, lose −fee) + the flat land award.
    // A lost claimer adds the claim price — the house buys your bird.
    const claimedAway = lobby === "claimer" && !won;
    const gpDelta = (won ? fee : -fee) + (claimedAway ? claimPrice! : 0);
    this.database
      .update(farms)
      .set({ gp: farm.gp + gpDelta, landTokens: farm.landTokens + LAND.PER_FIGHT })
      .where(eq(farms.id, this.farmId))
      .run();

    // Two ledgers: real + hardcore build the CAREER record (drives stud
    // value); practice builds the separate AMATEUR record.
    this.database
      .update(birds)
      .set(
        mode === "practice"
          ? won
            ? { practiceWins: bird.practiceWins + 1 }
            : { practiceLosses: bird.practiceLosses + 1 }
          : won
            ? { wins: bird.wins + 1 }
            : { losses: bird.losses + 1 }
      )
      .where(eq(birds.id, bird.id))
      .run();

    // The key rule's teeth.
    let forcedRetirement = false;
    if (mode === "hardcore" && !won) {
      this.flock.hardcoreRetire(bird.id);
      forcedRetirement = true;
    }

    // A lost claimer: the bird moves to the house barn. The GP already landed.
    if (claimedAway) {
      this.database.update(birds).set({ farmId: "house" }).where(eq(birds.id, bird.id)).run();
    }

    const inserted = this.database
      .insert(battleLog)
      .values({
        dayIndex: today,
        farmId: this.farmId,
        birdId: bird.id,
        mode,
        format,
        lobby,
        claimPrice: claimPrice ?? null,
        opponentName: opponent.name,
        opponentJson: JSON.stringify(opponent),
        result: won ? "win" : "loss",
        pitFigure,
        gpDelta,
        seed,
        playByPlay,
      })
      .returning({ id: battleLog.id })
      .get();

    const claimOffer =
      lobby === "claimer" && won ? { battleLogId: inserted.id, price: claimPrice! } : null;

    // A claimed-away bird is no longer ours — return the last view we have.
    const postBird = claimedAway
      ? { ...bird, wins: bird.wins + (won ? 1 : 0), losses: bird.losses + (won ? 0 : 1) }
      : this.flock.byId(bird.id);

    return {
      result: won ? "win" : "loss",
      mode,
      format,
      lobby,
      bird: postBird,
      opponent,
      gpDelta,
      landTokens: LAND.PER_FIGHT,
      pitFigure,
      forcedRetirement,
      claimedAway,
      claimOffer,
      playByPlay,
      seed,
    };
  }

  /**
   * Claim the house bird from a WON claimer — same game-day only, one claim
   * per fight. The tag price buys the full bird into your barn.
   */
  claimHouseBird(battleLogId: number): { bird: BirdView; pricePaid: number } {
    const row = this.database.select().from(battleLog).where(eq(battleLog.id, battleLogId)).get();
    if (!row || row.farmId !== this.farmId) throw new Error(`No fight #${battleLogId} on your books`);
    if (row.lobby !== "claimer") throw new Error("That fight was not a claimer");
    if (row.result !== "win") throw new Error("You claim off a WIN — the house kept its bird");
    if (row.claimedBirdId) throw new Error("That bird was already claimed");
    const today = this.database.select().from(gameState).where(eq(gameState.id, 1)).get()!.dayIndex;
    if (row.dayIndex !== today) throw new Error("Claim window closed — same game-day only");

    const farm = this.database.select().from(farms).where(eq(farms.id, this.farmId)).get()!;
    const price = row.claimPrice!;
    if (farm.gp < price) throw new Error(`The claim tag is ${price} GP — you have ${farm.gp}`);
    if (this.flock.barnCount() >= BARN.CAPACITY) throw new Error(`The barn is full (${BARN.CAPACITY})`);

    const opponent = JSON.parse(row.opponentJson) as HouseBird;
    const newBird = {
      id: randomUUID(),
      farmId: this.farmId,
      name: opponent.name,
      sex: opponent.sex,
      status: "active" as const,
      ...opponent.stats,
      element: opponent.element,
      halfStars: opponent.halfStars,
      birthWeek: GameClock.weekOf(today) - opponent.age,
      birthDay: today - opponent.age * 7,
      motherId: null,
      fatherId: null,
    };
    this.database.insert(birds).values(newBird).run();
    this.database.update(farms).set({ gp: farm.gp - price }).where(eq(farms.id, this.farmId)).run();
    this.database.update(battleLog).set({ claimedBirdId: newBird.id }).where(eq(battleLog.id, battleLogId)).run();
    return { bird: this.flock.byId(newBird.id), pricePaid: price };
  }

  /**
   * The past-performance lines: record + figures per format, from the battle
   * log. Comparing avgFigure ACROSS formats is how a bird gets typed.
   */
  formatRecords(birdId: string): Partial<Record<FightFormat, FormatRecord>> {
    const rows = this.database.select().from(battleLog).where(eq(battleLog.birdId, birdId)).all();
    const out: Partial<Record<FightFormat, FormatRecord>> = {};
    for (const row of rows) {
      const rec = (out[row.format] ??= { fights: 0, wins: 0, losses: 0, avgFigure: 0, bestFigure: 0 });
      rec.fights += 1;
      if (row.result === "win") rec.wins += 1;
      else rec.losses += 1;
      rec.avgFigure += row.pitFigure; // sum for now, divided below
      rec.bestFigure = Math.max(rec.bestFigure, row.pitFigure);
    }
    for (const rec of Object.values(out)) rec.avgFigure = Math.round(rec.avgFigure / rec.fights);
    return out;
  }

  private checkGate(bird: BirdView, mode: FightMode): void {
    const gates: Record<FightMode, [ok: boolean, rule: string]> = {
      practice: [canPractice(bird.age), "practice opens at age 1"],
      real: [canRealFight(bird.age), "real stakes open at age 2"],
      hardcore: [canHardcore(bird.age), "hardcore opens at age 3 (and ends at the cap)"],
    };
    const [ok, rule] = gates[mode];
    if (!ok) throw new Error(`${bird.name} is ${bird.age} — ${rule}`);
  }

  /** Lobby (class) eligibility — entry restrictions self-sort the fields. */
  private checkLobby(bird: BirdView, mode: FightMode, lobby: Lobby, claimPrice?: number): void {
    if (mode === "hardcore" && lobby !== "open")
      throw new Error("Hardcore runs in the open only — the key rule needs no ladder");
    if (mode === "practice" && lobby !== "open" && lobby !== "maiden")
      throw new Error("Amateur lobbies are open or maiden only");

    if (lobby === "maiden") {
      const winsInClass = mode === "practice" ? bird.practiceWins : bird.wins;
      if (winsInClass > 0)
        throw new Error(`${bird.name} has won before — maidens take never-winners only`);
    }
    if (lobby === "nw2" && bird.wins >= 2)
      throw new Error(`${bird.name} has ${bird.wins} career wins — nw2 takes fewer than 2`);
    if (lobby === "nw3" && bird.wins >= 3)
      throw new Error(`${bird.name} has ${bird.wins} career wins — nw3 takes fewer than 3`);
    if (lobby === "claimer") {
      if (mode !== "real") throw new Error("Claimers are real fights");
      if (!claimPrice || !(CLAIMER.PRICES as readonly number[]).includes(claimPrice))
        throw new Error(`Pick a claiming tag: ${CLAIMER.PRICES.join(" / ")} GP`);
    } else if (claimPrice) {
      throw new Error("A claim price only means something in a claimer");
    }
  }

  /**
   * Opponent generation — the lobby sets the field's quality. Open and the
   * ladder lobbies mirror YOUR bird (scaled soft for maidens); claimers key
   * to the TAG PRICE instead — that's the economic self-balancing.
   */
  private generateHouseBird(bird: BirdView, rng: Rng, lobby: Lobby, claimPrice?: number): HouseBird {
    const mirror = Math.round(
      (bird.agility + bird.sight + bird.stamina + bird.gameness + bird.station + bird.condition) / 6
    );
    const center =
      lobby === "claimer"
        ? CLAIMER.QUALITY_FLAT + claimPrice!
        : Math.round(mirror * LOBBY_HOUSE_QUALITY[lobby]);
    const stat = () =>
      Math.min(STATS.MAX, Math.max(STATS.MIN, center + randInt(rng, -BATTLE.HOUSE_SPREAD, BATTLE.HOUSE_SPREAD)));
    const elements: Element[] = ["Fire", "Metal", "Wood", "Earth", "Water"];
    return {
      name: HOUSE_NAMES[randInt(rng, 0, HOUSE_NAMES.length - 1)],
      sex: rng() < BREEDING.FEMALE_CHANCE ? "female" : "male",
      age: randInt(rng, 2, 6),
      stats: { agility: stat(), sight: stat(), stamina: stat(), gameness: stat(), station: stat(), condition: stat() },
      element: elements[randInt(rng, 0, elements.length - 1)],
      halfStars: Math.min(STARS.MAX_HALF_STARS, Math.max(0, bird.halfStars + randInt(rng, -2, 2))),
    };
  }

  private toFighter(name: string, stats: BirdStats, element: Element, halfStars: number): Fighter {
    // Star baseline boost: +BOOST_PER_FULL_STAR effective points on every
    // stat — format-agnostic, which is the whole point of stars.
    const boost = Math.floor(halfStars / 2) * STARS.BOOST_PER_FULL_STAR;
    const boosted = Object.fromEntries(
      Object.entries(stats).map(([k, v]) => [k, Math.min(STATS.MAX, v + boost)])
    ) as BirdStats;
    const maxWind = Math.round(BATTLE.BASE_WIND + boosted.stamina * BATTLE.WIND_PER_STAMINA);
    return {
      name,
      stats: boosted,
      element,
      halfStars,
      wind: maxWind,
      maxWind,
      underdog: false,
      quitChecked: false,
      ran: false,
      dealt: 0,
    };
  }

  private simulate(
    bird: BirdView,
    opponent: HouseBird,
    mode: FightMode,
    format: FightFormat,
    lobby: Lobby,
    rng: Rng
  ): { won: boolean; playByPlay: string; pitFigure: number } {
    const fmt = FORMATS[format];
    const you = this.toFighter(bird.name, bird, bird.element as Element, bird.halfStars);
    const foe = this.toFighter(opponent.name, opponent.stats, opponent.element, opponent.halfStars);

    // Station's trigger, judged once at the scale: total base stats.
    const total = (f: Fighter) => Object.values(f.stats).reduce((a, b) => a + b, 0);
    you.underdog = total(foe) >= total(you) * BATTLE.UNDERDOG_RATIO;
    foe.underdog = total(you) >= total(foe) * BATTLE.UNDERDOG_RATIO;

    const lobbyTag = lobby === "open" ? "" : ` [${lobby.toUpperCase()}]`;
    const lines: string[] = [
      `⚔ ${mode.toUpperCase()}${lobbyTag} · ${fmt.label} — ${you.name} (${bird.stars}) vs ${foe.name} (${foe.halfStars / 2}★ ${foe.element})`,
      `Wind: ${you.name} ${you.wind} · ${foe.name} ${foe.wind}`,
    ];
    if (ELEMENT_BEATS[you.element] === foe.element)
      lines.push(`${you.element} overcomes ${foe.element} — ${you.name} has the element edge.`);
    else if (ELEMENT_BEATS[foe.element] === you.element)
      lines.push(`${foe.element} overcomes ${you.element} — ${foe.name} has the element edge.`);
    if (you.underdog) lines.push(`${you.name} is outmatched on paper — station will tell.`);
    if (foe.underdog) lines.push(`${foe.name} is outmatched on paper — station will tell.`);

    let turnsFought = 0;
    for (let turn = 1; turn <= fmt.maxTurns; turn++) {
      if (you.wind <= 0 || foe.wind <= 0 || you.ran || foe.ran) break;
      turnsFought = turn;

      // The distance curve: whose stat drives depends on how deep we are.
      const stat =
        turn <= PHASES.BREAK_THROUGH_TURN ? "agility" : turn <= PHASES.OPEN_THROUGH_TURN ? "sight" : "gameness";

      const a = this.turnRoll(you, foe, stat, turn, rng);
      const b = this.turnRoll(foe, you, stat, turn, rng);

      if (a.total === b.total) {
        lines.push(`T${turn} [${stat}] Both circle — ${a.detail} vs ${b.detail}. No blood.`);
        continue;
      }
      const [winner, loser, w, l] = a.total > b.total ? [you, foe, a, b] : [foe, you, b, a];
      // Damage = roll margin × the blade. Knives hit like trucks; gaffs chip.
      let damage = Math.max(1, Math.round((w.total - l.total) * fmt.damageMult));
      if (w.doubles) damage = Math.round(damage * fmt.critMult);
      loser.wind -= damage;
      winner.dealt += damage;
      const move = w.doubles
        ? `TARI STRIKE (double ${w.dice[0]}s!)`
        : w.dice[0] + w.dice[1] >= 10
          ? "high slash"
          : w.dice[0] + w.dice[1] <= 4
            ? "quick feint"
            : "clean hit";
      lines.push(
        `T${turn} [${stat}] ${winner.name} lands a ${move} — ${damage} wind. (${w.detail} vs ${l.detail}) ${loser.name}: ${Math.max(0, loser.wind)}`
      );

      // The morale check — gameness's teeth. Once per fight, when a bird is
      // first badly hurt, it decides whether to keep fighting or RUN.
      if (
        loser.wind > 0 &&
        loser.wind < loser.maxWind * BATTLE.QUIT_WIND_FRACTION &&
        !loser.quitChecked
      ) {
        loser.quitChecked = true;
        const quitChance = BATTLE.QUIT_BASE_CHANCE * (1 - loser.stats.gameness / STATS.MAX);
        if (rng() < quitChance) {
          loser.ran = true;
          lines.push(`${loser.name} breaks and RUNS — no gameness left in it.`);
        } else {
          lines.push(`${loser.name} is badly hurt but stands its ground.`);
        }
      }
    }

    const won = !you.ran && (foe.ran || (you.wind > 0 && (foe.wind <= 0 || you.wind >= foe.wind)));
    if (you.ran || foe.ran) {
      // Line already narrated at the moment of the break.
    } else if (foe.wind <= 0 || you.wind <= 0) {
      const down = foe.wind <= 0 ? foe : you;
      lines.push(`${down.name} is out of wind — the sentensyador calls it.`);
    } else {
      lines.push(`Time is called — ${won ? you.name : foe.name} kept more wind.`);
    }

    // ── The Pit Figure ──────────────────────────────────────────────────────
    // Damage margin per turn, normalized by the blade's damage scale so
    // figures compare across formats, adjusted for opponent quality, then
    // fogged: noise + banding. A narrow loss to a monster can out-figure an
    // ugly win over a dud — that's the discovery signal working.
    const yourAvg =
      (bird.agility + bird.sight + bird.stamina + bird.gameness + bird.station + bird.condition) / 6;
    const foeAvg = Object.values(opponent.stats).reduce((s, v) => s + v, 0) / 6;
    const marginPerTurn = (you.dealt - foe.dealt) / Math.max(1, turnsFought) / fmt.damageMult;
    const raw =
      FIGURE.BASE +
      marginPerTurn * FIGURE.MARGIN_SCALE +
      (foeAvg - yourAvg) / FIGURE.OPP_ADJ_DIVISOR +
      randInt(rng, -FIGURE.NOISE, FIGURE.NOISE);
    const pitFigure = Math.max(0, Math.min(FIGURE.MAX, Math.round(raw / FIGURE.BAND) * FIGURE.BAND));

    lines.push(won ? `🏆 ${you.name} WINS.` : `💀 ${you.name} LOSES.`);
    lines.push(`Pit Figure: ${pitFigure} (${fmt.label})`);
    return { won, playByPlay: lines.join("\n"), pitFigure };
  }

  private turnRoll(
    self: Fighter,
    other: Fighter,
    stat: "agility" | "sight" | "gameness",
    turn: number,
    rng: Rng
  ): { total: number; dice: [number, number]; doubles: boolean; detail: string } {
    const dice = roll2d6(rng);
    const parts = [`${dice[0]}+${dice[1]}`];

    // Condition — day-of-fight form, rolled fresh every turn. High condition
    // pins form near 100%; low condition means some turns arrive badly.
    const formFloor = BATTLE.WORST_FORM + BATTLE.FORM_RANGE * (self.stats.condition / STATS.MAX);
    const form = formFloor + rng() * (1 - formFloor);

    // Stamina's second job — physical stats (agility/sight) decay each turn;
    // big wind slows the fade. Gameness doesn't decay: grit is mental.
    const physical = stat !== "gameness";
    const decay = physical
      ? Math.max(BATTLE.DECAY_FLOOR, 1 - (turn - 1) * BATTLE.DECAY_PER_TURN * (1 - self.stats.stamina / STATS.MAX))
      : 1;

    let total = dice[0] + dice[1] + (self.stats[stat] * form * decay) / BATTLE.ROLL_DIVISOR;

    if (ELEMENT_BEATS[self.element] === other.element) {
      total += BATTLE.ELEMENT_EDGE;
      parts.push(`+${BATTLE.ELEMENT_EDGE}elem`);
    }
    // Station — the rivalry modifier: the underdog fights above its book.
    if (self.underdog) {
      total += (self.stats.station * form) / BATTLE.STATION_DIVISOR;
      parts.push("+station");
    }
    // Gameness holds a hurt bird's performance together late.
    if (self.wind < self.maxWind * BATTLE.QUIT_WIND_FRACTION) {
      total += (self.stats.gameness * form) / BATTLE.GAMENESS_DIVISOR;
      parts.push("+gameness");
    }
    return { total, dice, doubles: dice[0] === dice[1], detail: parts.join("") };
  }
}
