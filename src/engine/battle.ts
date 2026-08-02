import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { battleLog, birds, gameState } from "@/db/schema";
import { BATTLE, ECONOMY, ELEMENT_BEATS, STARS, STATS, type Element } from "./config";
import { Flock, type BirdView } from "./flock";
import { canHardcore, canPractice, canRealFight } from "./lifecycle";
import { freshSeed, mulberry32, randInt, roll2d6, type Rng } from "./rng";

export type FightMode = "practice" | "real" | "hardcore";

export interface FightResult {
  result: "win" | "loss";
  mode: FightMode;
  bird: BirdView; // post-fight (record updated; hardcore loss = retired)
  opponent: HouseBird;
  gpDelta: number;
  forcedRetirement: boolean;
  playByPlay: string;
  seed: number; // replay the fight from this
}

export interface HouseBird {
  name: string;
  stats: { agility: number; heart: number; avoidance: number; stamina: number; ruthless: number; sight: number };
  element: Element;
  halfStars: number;
}

const HOUSE_NAMES = [
  "Haring Itim", "Bulawan", "Salakay", "Tigre ng Talpakan", "Kampilan",
  "Bantay Dagat", "Puting Bagyo", "Sagupaan", "Lintik", "Maharlika",
];

// Turn flavor: which stat drives the roll rotates each turn.
const TURN_STATS = ["agility", "sight", "ruthless", "heart"] as const;

const MODE_ECON: Record<FightMode, { fee: number; prize: number }> = {
  practice: { fee: ECONOMY.PRACTICE_ENTRY_FEE, prize: ECONOMY.PRACTICE_PRIZE },
  real: { fee: ECONOMY.REAL_ENTRY_FEE, prize: ECONOMY.REAL_PRIZE },
  hardcore: { fee: ECONOMY.HARDCORE_ENTRY_FEE, prize: ECONOMY.HARDCORE_PRIZE },
};

interface Fighter {
  name: string;
  stats: HouseBird["stats"];
  element: Element;
  halfStars: number;
  wind: number;
  maxWind: number;
}

export class Battle {
  private flock: Flock;

  constructor(private database: DB) {
    this.flock = new Flock(database);
  }

  /**
   * One fight vs a server-generated house bird. Auto-resolved turn by turn on
   * 2d6; returns a text play-by-play. Hardcore = the key rule: bigger prize,
   * loser force-retired.
   */
  fight(birdId: string, mode: FightMode, seed: number = freshSeed()): FightResult {
    const bird = this.flock.byId(birdId);
    if (bird.status !== "active") throw new Error(`${bird.name} is not an active fighter`);
    this.checkGate(bird, mode);

    const state = this.database.select().from(gameState).where(eq(gameState.id, 1)).get()!;
    const { fee, prize } = MODE_ECON[mode];
    if (state.gp < fee) throw new Error(`${mode} entry costs ${fee} GP — you have ${state.gp}`);

    const rng = mulberry32(seed);
    const opponent = this.generateHouseBird(bird, rng);
    const { won, playByPlay } = this.simulate(bird, opponent, mode, rng);

    // Settle GP.
    const gpDelta = won ? prize - fee : -fee;
    this.database.update(gameState).set({ gp: state.gp + gpDelta }).where(eq(gameState.id, 1)).run();

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

    this.database
      .insert(battleLog)
      .values({
        dayIndex: state.dayIndex,
        birdId: bird.id,
        mode,
        opponentName: opponent.name,
        result: won ? "win" : "loss",
        gpDelta,
        seed,
        playByPlay,
      })
      .run();

    return {
      result: won ? "win" : "loss",
      mode,
      bird: this.flock.byId(bird.id),
      opponent,
      gpDelta,
      forcedRetirement,
      playByPlay,
      seed,
    };
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

  /** Opponent scaled to the bird: each stat near the bird's average. */
  private generateHouseBird(bird: BirdView, rng: Rng): HouseBird {
    const avg = Math.round(
      (bird.agility + bird.heart + bird.avoidance + bird.stamina + bird.ruthless + bird.sight) / 6
    );
    const stat = () =>
      Math.min(STATS.MAX, Math.max(STATS.MIN, avg + randInt(rng, -BATTLE.HOUSE_SPREAD, BATTLE.HOUSE_SPREAD)));
    const elements: Element[] = ["Fire", "Metal", "Wood", "Earth", "Water"];
    return {
      name: HOUSE_NAMES[randInt(rng, 0, HOUSE_NAMES.length - 1)],
      stats: { agility: stat(), heart: stat(), avoidance: stat(), stamina: stat(), ruthless: stat(), sight: stat() },
      element: elements[randInt(rng, 0, elements.length - 1)],
      halfStars: Math.min(STARS.MAX_HALF_STARS, Math.max(0, bird.halfStars + randInt(rng, -2, 2))),
    };
  }

  private toFighter(name: string, stats: HouseBird["stats"], element: Element, halfStars: number): Fighter {
    // Star baseline boost: +BOOST_PER_FULL_STAR effective points on every stat.
    const boost = Math.floor(halfStars / 2) * STARS.BOOST_PER_FULL_STAR;
    const boosted = Object.fromEntries(
      Object.entries(stats).map(([k, v]) => [k, Math.min(STATS.MAX, v + boost)])
    ) as HouseBird["stats"];
    const maxWind = Math.round(BATTLE.BASE_WIND + boosted.stamina * BATTLE.WIND_PER_STAMINA);
    return { name, stats: boosted, element, halfStars, wind: maxWind, maxWind };
  }

  private simulate(
    bird: BirdView,
    opponent: HouseBird,
    mode: FightMode,
    rng: Rng
  ): { won: boolean; playByPlay: string } {
    const you = this.toFighter(bird.name, bird, bird.element as Element, bird.halfStars);
    const foe = this.toFighter(opponent.name, opponent.stats, opponent.element, opponent.halfStars);

    const lines: string[] = [
      `⚔ ${mode.toUpperCase()} — ${you.name} (${bird.stars}) vs ${foe.name} (${foe.halfStars / 2}★ ${foe.element})`,
      `Wind: ${you.name} ${you.wind} · ${foe.name} ${foe.wind}`,
    ];
    if (ELEMENT_BEATS[you.element] === foe.element)
      lines.push(`${you.element} overcomes ${foe.element} — ${you.name} has the element edge.`);
    else if (ELEMENT_BEATS[foe.element] === you.element)
      lines.push(`${foe.element} overcomes ${you.element} — ${foe.name} has the element edge.`);

    for (let turn = 1; turn <= BATTLE.MAX_TURNS; turn++) {
      if (you.wind <= 0 || foe.wind <= 0) break;
      const stat = TURN_STATS[(turn - 1) % TURN_STATS.length];
      const a = this.turnRoll(you, foe, stat, rng);
      const b = this.turnRoll(foe, you, stat, rng);

      if (a.total === b.total) {
        lines.push(`T${turn} [${stat}] Both circle — ${a.detail} vs ${b.detail}. No blood.`);
        continue;
      }
      const [winner, loser, w, l] = a.total > b.total ? [you, foe, a, b] : [foe, you, b, a];
      let damage = Math.max(1, w.total - l.total + Math.round(winner.stats.ruthless / 25));
      damage = Math.max(1, damage - Math.round(loser.stats.avoidance / 30));
      if (w.doubles) damage *= 2;
      loser.wind -= damage;
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
    }

    const won = you.wind > 0 && (foe.wind <= 0 || you.wind >= foe.wind);
    if (foe.wind <= 0 || you.wind <= 0) {
      const down = foe.wind <= 0 ? foe : you;
      lines.push(`${down.name} is out of wind — the sentensyador calls it.`);
    } else {
      lines.push(`Time is called — ${won ? you.name : foe.name} kept more wind.`);
    }
    lines.push(won ? `🏆 ${you.name} WINS.` : `💀 ${you.name} LOSES.`);
    return { won, playByPlay: lines.join("\n") };
  }

  private turnRoll(
    self: Fighter,
    other: Fighter,
    stat: (typeof TURN_STATS)[number],
    rng: Rng
  ): { total: number; dice: [number, number]; doubles: boolean; detail: string } {
    const dice = roll2d6(rng);
    let total = dice[0] + dice[1] + self.stats[stat] / 20;
    const parts = [`${dice[0]}+${dice[1]}`];
    if (ELEMENT_BEATS[self.element] === other.element) {
      total += BATTLE.ELEMENT_EDGE;
      parts.push(`+${BATTLE.ELEMENT_EDGE}elem`);
    }
    if (self.wind < self.maxWind * 0.3) {
      total += self.stats.heart / 25; // heart: the comeback stat
      parts.push("+heart");
    }
    return { total, dice, doubles: dice[0] === dice[1], detail: parts.join("") };
  }
}
