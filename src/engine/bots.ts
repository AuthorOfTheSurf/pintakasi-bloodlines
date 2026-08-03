import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { farms, gameState } from "@/db/schema";
import { seedStarterFlock } from "@/db/seed-data";
import { BOT_FARMS, type BotProfile } from "./bot-config";
import { CLAIMER, ECONOMY, type FightFormat, type Lobby } from "./config";
import { Breeding } from "./breeding";
import { drawStarterNames } from "./naming";
import { emit } from "./events";
import { Farms } from "./farms";
import { Flock, type BirdView } from "./flock";
import { Gacha } from "./gacha";
import { Lobbies, type FightMode } from "./lobbies";
import { mulberry32, randInt, type Rng } from "./rng";

/** What one bot stable did with its day — surfaced on the tick view. */
export interface BotDayReport {
  farm: string;
  style: BotProfile["style"];
  checkedIn: boolean;
  stakedLand: number; // bots stake every liquid LT, daily
  studsListed: number; // retired roosters put up in the breeding barn
  bred: string | null; // egg name, if a cover was bought (barn included)
  entered: { bird: string; mode: FightMode; classType: Lobby; format: FightFormat; price?: number }[];
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
  /** Create the six bot farms + their starter flocks. Idempotent. */
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
    // The self-sorting ladder: card in the most protective class that takes you.
    const classType: Lobby =
      bird.wins === 0 ? "maiden" : bird.wins < 2 ? "nw2" : bird.wins < 3 ? "nw3" : "open";
    return { mode: "real", classType, format };
  }
}

/**
 * An owner can read their OWN birds' stats — pick the format that fits them.
 * Shared with auto-play (round 17): every stable cards by style, which also
 * spreads the field across formats instead of piling into one lobby key.
 */
export function bestFormat(bird: BirdView, rng: Rng): FightFormat {
  const scores: Record<FightFormat, number> = {
    longKnife: bird.agility + bird.sight, // the sprint
    shortKnife: (bird.agility + bird.sight + bird.stamina + bird.gameness) / 2, // the hybrid
    longGaff: bird.stamina * 2, // the route
    shortGaff: bird.gameness * 2, // the marathon
  };
  const jitter = () => rng() * 100; // imperfect judges — bots misread the margin calls
  return (Object.entries(scores) as [FightFormat, number][]).reduce((best, cur) =>
    cur[1] + jitter() > best[1] + jitter() ? cur : best
  )[0];
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
