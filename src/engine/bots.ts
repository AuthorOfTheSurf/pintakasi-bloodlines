import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { farms, gameState } from "@/db/schema";
import { seedStarterFlock } from "@/db/seed-data";
import { BOT_FARMS, type BotProfile } from "./bot-config";
import { CLAIMER, ECONOMY, PINTAKASI, type FightFormat, type Lobby } from "./config";
import { Breeding } from "./breeding";
import { drawStarterNames } from "./naming";
import { emit } from "./events";
import { Farms } from "./farms";
import { Flock, type BirdView } from "./flock";
import { Gacha } from "./gacha";
import { canHardcore } from "./lifecycle";
import { Lobbies, type FightMode } from "./lobbies";
import { mulberry32, randInt, type Rng } from "./rng";
import { Tournaments } from "./tournaments";

/** What one bot stable did with its day — surfaced on the tick view. */
export interface BotDayReport {
  farm: string;
  style: BotProfile["style"];
  checkedIn: boolean;
  stakedLand: number; // bots stake every liquid LT, daily
  studsListed: number; // retired roosters put up in the breeding barn
  bred: string | null; // egg name, if a cover was bought (barn included)
  entered: { bird: string; mode: FightMode; classType: Lobby; format: FightFormat; price?: number }[];
  crowns: string[]; // birds registered for this week's championships
  claimsPlaced: number;
}

/** GP a bot keeps in reserve — never gambled into fees, tags, or breeds. */
const RESERVE = 400;
const MAX_CLAIMS_PER_DAY = 2;

/**
 * The bot stables' daily play. Called at the top of every tick — the bots
 * play the CLOSING day (check in, breed, card birds, place claims),
 * then the clock advances and the card they just joined goes off. They are
 * ordinary farms driving the ordinary engine: every rule that binds a
 * player binds them, and every decision uses only information a player
 * could see (own birds' stats, the fogged board, visible claimer fields).
 *
 * Deterministic: the day index seeds the rng, so a replayed day replays.
 * No-ops (empty array) on worlds with no bot farms seeded — tests included.
 */
export class Bots {
  /** Create the bot farms + their starter flocks. Idempotent — a stable
   *  added to BOT_FARMS later joins the world on the next seed call. */
  static seed(db: DB, opts: { flock?: "eggs" | "legacy" } = {}): void {
    const day = db.select().from(gameState).where(eq(gameState.id, 1)).get()!.dayIndex;
    for (const bot of BOT_FARMS) {
      const exists = db.select().from(farms).where(eq(farms.id, bot.id)).get();
      if (exists) continue;
      db.insert(farms)
        .values({
          id: bot.id,
          name: bot.name,
          country: bot.country,
          primaryColor: bot.primaryColor,
          secondaryColor: bot.secondaryColor,
          apiKey: `fk_${bot.id}`,
          gp: ECONOMY.STARTING_GP,
          landTokens: 0,
          createdDay: day,
          isBot: 1,
        })
        .run();
      emit(db, {
        type: "farm_registered",
        farmId: bot.id,
        gpCents: ECONOMY.STARTING_GP * 100,
        message: `${bot.name} registered — starting purse ${ECONOMY.STARTING_GP} GP`,
      });
      seedStarterFlock(db, bot.id, { seed: bot.flockSeed, idPrefix: bot.id, shape: opts.flock });
    }
  }

  static playDay(db: DB): BotDayReport[] {
    const botRows = db.select().from(farms).where(eq(farms.isBot, 1)).all();
    if (botRows.length === 0) return [];
    const today = db.select().from(gameState).where(eq(gameState.id, 1)).get()!.dayIndex;

    const reports: BotDayReport[] = [];
    for (const [i, row] of botRows.entries()) {
      const profile = BOT_FARMS.find((b) => b.id === row.id);
      if (!profile) continue; // a bot removed from config sits out
      const rng = mulberry32((today + 1) * 7919 + (i + 1) * 104729);
      reports.push(Bots.playFarm(db, profile, rng, today));
    }
    return reports;
  }

  private static playFarm(db: DB, bot: BotProfile, rng: Rng, today: number): BotDayReport {
    const farmsApi = new Farms(db);
    const flock = new Flock(db, bot.id);
    const lobbies = new Lobbies(db, bot.id);
    const report: BotDayReport = {
      farm: bot.name,
      style: bot.style,
      checkedIn: false,
      stakedLand: 0,
      studsListed: 0,
      bred: null,
      entered: [],
      crowns: [],
      claimsPlaced: 0,
    };
    const gp = () => db.select().from(farms).where(eq(farms.id, bot.id)).get()!.gp;
    const quietly = (fn: () => void) => {
      try {
        fn();
        return true;
      } catch {
        return false; // a house rule said no — bots take no for an answer
      }
    };

    // 1. The daily ritual: check in, spend the free pulls, then STAKE every
    //    liquid Land Token — bots model the intended posture (stack it,
    //    stake it; it may be worth real money someday).
    report.checkedIn = quietly(() => farmsApi.checkIn(bot.id));
    const gacha = new Gacha(db, bot.id, rng);
    while (db.select().from(farms).where(eq(farms.id, bot.id)).get()!.freePulls > 0) {
      if (!quietly(() => gacha.roll())) break;
    }
    const liquid = db.select().from(farms).where(eq(farms.id, bot.id)).get()!.landTokens;
    if (liquid > 0 && quietly(() => farmsApi.stake(bot.id, liquid))) report.stakedLand = liquid;

    // 1b. Stand the retired roosters at stud — selling covers is income.
    const breeding = new Breeding(db, bot.id, rng);
    for (const rooster of flock.all().filter(
      (b) => b.status === "retired" && b.sex === "male" && !b.listedStud
    )) {
      if (quietly(() => void breeding.listStud(rooster.id))) report.studsListed++;
    }

    // (No training step — stats are fixed at birth, ruled round 13. The
    // discovery year is fought, not trained.)

    // 2. The naming law (round 14): no bird fights under an auto-name.
    //    Christen every unnamed active bird from the pool before carding.
    for (const bird of flock.all().filter((b) => b.status === "active" && !b.named)) {
      quietly(() => void flock.rename(bird.id, drawStarterNames(db, 1, rng)[0]));
    }

    // 3. Breed through the BARN, if the drive and a legal cover line up —
    //    bots shop other farms' listed studs like anyone else.
    if (rng() < bot.breedDrive && gp() > ECONOMY.BREED_FEE + RESERVE) {
      const hens = flock.all().filter((b) => b.status === "retired" && b.sex === "female");
      outer: for (const hen of shuffle(hens, rng)) {
        const { studs } = breeding.browseStuds(hen.id);
        for (const stud of shuffle(studs, rng)) {
          let eggName: string | null = null;
          if (quietly(() => (eggName = breeding.breed(hen.id, stud.birdId).egg.name))) {
            report.bred = eggName;
            break outer; // one cover a day is plenty
          }
        }
      }
    }

    // 3b. The Pintakasi (rounds 18–19): a specialist for every crown the
    //     week is running. Nerve still decides how often a barn shows up —
    //     but the floor is high, because dying for a championship is a
    //     better bet than any Tuesday hardcore, and every barn knows it.
    const nerve = Math.min(1, 0.4 + bot.hardcoreNerve * 1.6);
    report.crowns = chaseCrowns(db, bot.id, today, rng, { nerve, reserve: RESERVE });

    // 4. LIQUIDITY FIRST — the job bots exist for. A lobby sitting at an
    //    odd count has a bird waiting with no opponent; join it. Fill
    //    counts are public (the fog hides who, never how many). One bird
    //    per lobby per bot — a bot's own birds can't fight each other.
    const roster = () => shuffle(flock.all().filter((b) => b.status === "active" && b.age >= 1), rng);
    for (const lobby of lobbies.board()) {
      if (lobby.status !== "open") continue; // closed = entries locked
      if (lobby.filled % 2 === 0) continue;
      if (lobby.mode === "hardcore" && rng() >= bot.hardcoreNerve) continue; // nobody's talked into dying
      if (gp() <= lobby.fee + RESERVE) break;
      for (const bird of roster()) {
        const spec = {
          mode: lobby.mode,
          classType: lobby.classType,
          format: lobby.format,
          price: lobby.price ?? undefined,
        };
        if (quietly(() => void lobbies.enter(bird.id, spec))) {
          report.entered.push({ bird: bird.name, ...spec });
          break; // this lobby is even now — on to the next
        }
      }
    }

    // 5. Then card the rest of the flock by style.
    for (const bird of roster()) {
      if (rng() >= bot.entryRate) continue;
      if (gp() <= ECONOMY.HARDCORE_ENTRY_FEE + RESERVE) break;
      const spec = Bots.pickSpec(bot, bird, rng);
      if (quietly(() => void lobbies.enter(bird.id, spec))) {
        report.entered.push({ bird: bird.name, ...spec });
      }
    }

    // 6. Shop the claimer fields — public info only (record vs. the tag).
    if (bot.claimAggression > 0) {
      for (const lobby of lobbies.board()) {
        if (report.claimsPlaced >= MAX_CLAIMS_PER_DAY) break;
        if (lobby.classType !== "claimer") continue;
        for (const entry of lobby.entries) {
          if (report.claimsPlaced >= MAX_CLAIMS_PER_DAY) break;
          if (entry.mine) continue;
          if (rng() >= bot.claimAggression) continue;
          const { wins, losses } = entry.bird.career;
          if (wins < losses) continue; // no lost causes
          if (entry.bird.age > 6) continue; // too little career left
          if (gp() <= (lobby.price ?? 0) + RESERVE) continue;
          if (quietly(() => void lobbies.claim(entry.entryId))) report.claimsPlaced++;
        }
      }
    }

    return report;
  }

  /** Where does this bird belong tonight? Style + own-stat reading. */
  private static pickSpec(
    bot: BotProfile,
    bird: BirdView,
    rng: Rng
  ): { mode: FightMode; classType: Lobby; format: FightFormat; price?: number } {
    const format = bestFormat(bird, rng);
    if (bird.age === 1) return { mode: "juvenile", classType: "open", format };
    if (bird.age >= 3 && rng() < bot.hardcoreNerve) {
      return { mode: "hardcore", classType: "open", format };
    }
    if (rng() < bot.sellRate) {
      // Tag by the record, stretched by courage: better birds card dearer.
      const edge = Math.max(0, bird.wins - bird.losses);
      const idx = Math.min(CLAIMER.PRICES.length - 1, Math.round(edge * bot.tagCourage));
      return { mode: "real", classType: "claimer", format, price: CLAIMER.PRICES[idx] };
    }
    // The self-sorting ladder: card in the most protective class that takes
    // you. Reads the STAKES record (round 19) — the discovery year doesn't
    // graduate anybody, so a two-year-old starts at the bottom rung.
    const classType: Lobby = ladderClass(bird.stakesWins);
    return { mode: "real", classType, format };
  }
}

/**
 * The class ladder's rung for a given stakes record — the most protective
 * class that still takes you. Shared by the bots and auto-play (round 19:
 * player-side stables carded every bird in the OPEN and never climbed).
 */
export function ladderClass(stakesWins: number): Lobby {
  if (stakesWins === 0) return "maiden";
  if (stakesWins < 2) return "nw2";
  if (stakesWins < 3) return "nw3";
  return "open";
}

/**
 * How well a bird reads at each distance — the owner's private study of its
 * own stats. One table, two uses: pick the blade for a bird (bestFormat),
 * or pick the bird for a blade (the Pintakasi, round 19).
 */
export function formatScores(bird: BirdView): Record<FightFormat, number> {
  return {
    longKnife: bird.agility + bird.sight, // the sprint
    shortKnife: (bird.agility + bird.sight + bird.stamina + bird.gameness) / 2, // the hybrid
    longGaff: bird.stamina * 2, // the route
    shortGaff: bird.gameness * 2, // the marathon
  };
}

/**
 * An owner can read their OWN birds' stats — pick the format that fits them.
 * Shared with auto-play (round 17): every stable cards by style, which also
 * spreads the field across formats instead of piling into one lobby key.
 */
export function bestFormat(bird: BirdView, rng: Rng): FightFormat {
  const scores = formatScores(bird);
  const jitter = () => rng() * 100; // imperfect judges — bots misread the margin calls
  return (Object.entries(scores) as [FightFormat, number][]).reduce((best, cur) =>
    cur[1] + jitter() > best[1] + jitter() ? cur : best
  )[0];
}

/**
 * THE CROWN CHASE (round 19) — every stable's weekly Pintakasi decision,
 * shared by the bots and by auto-play.
 *
 * The old behavior stopped at ONE entry per stable per week, which capped
 * a three-crown week at one field of seven across ten farms — most
 * championships cancelled for want of a second bird. The rule was never
 * one bird per STABLE, it's one bird per CROWN: so walk the week's three
 * blades and send the barn's best specialist to each, cheapest signal
 * first (a long-gaff crown wants the deepest wind, not the highest total).
 *
 * `nerve` gates each blade for the bots (a breeder shows up less often than
 * a pit crew). Auto-play passes none — the Majors are the most +EV card on
 * the board, and a stable with the bodies to spare enters all three.
 */
export function chaseCrowns(
  db: DB,
  farmId: string,
  today: number,
  rng: Rng,
  opts: { nerve?: number; reserve?: number } = {}
): string[] {
  const tournaments = new Tournaments(db, farmId);
  const flock = new Flock(db, farmId);
  const reserve = opts.reserve ?? 0;
  const entered: string[] = [];

  const blades = Tournaments.bladesOfWeek(Tournaments.targetWeek(today));
  const eligible = flock.all().filter((b) => b.status === "active" && b.named && canHardcore(b.age));
  if (eligible.length === 0) return entered;

  // Each bird declares for the running blade it reads BEST at — that's the
  // specialist rule, and it stops a shallow barn from piling its whole
  // roster into whichever crown happens to be checked first.
  const declared = new Map<FightFormat, BirdView[]>(blades.map((b) => [b, []]));
  for (const bird of eligible) {
    const home = blades.reduce((best, b) =>
      formatScores(bird)[b] > formatScores(bird)[best] ? b : best
    );
    declared.get(home)!.push(bird);
  }

  const send = (blade: FightFormat, candidates: BirdView[]): boolean => {
    let sent = tournaments.myEntriesThisWeek(blade);
    for (const bird of candidates.sort((a, b) => formatScores(b)[blade] - formatScores(a)[blade])) {
      if (sent >= PINTAKASI.MAX_PER_BARN) break;
      if (db.select().from(farms).where(eq(farms.id, farmId)).get()!.gp < PINTAKASI.ENTRY_FEE + reserve)
        return false; // out of money, out of crowns
      try {
        tournaments.enter(bird.id, blade);
        entered.push(bird.name);
        sent++;
      } catch {
        /* already committed elsewhere, barn full, or the committee said no */
      }
    }
    return true;
  };

  const chosen = blades.filter((b) => opts.nerve === undefined || rng() < opts.nerve);
  // Pass 1: specialists into their own blade.
  for (const blade of chosen) if (!send(blade, [...declared.get(blade)!])) return entered;
  // Pass 2: anyone still idle fills a crown that's short — up to MAX_PER_BARN
  // per blade. A body in a bracket beats a body in the barn.
  for (const blade of chosen) if (!send(blade, [...eligible])) return entered;
  return entered;
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
