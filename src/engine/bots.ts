import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { birds, farms, gameState } from "@/db/schema";
import { seedStarterFlock } from "@/db/seed-data";
import { BOT_FARMS, WEATHER_APPETITE, type BotProfile } from "./bot-config";
import {
  CLAIMER,
  ECONOMY,
  JUVENILE_MAJOR,
  LAND,
  PINTAKASI,
  weatherOfDay,
  type FightFormat,
  type Lobby,
} from "./config";
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
  paidPulls: number; //  gacha rolls bought at price (round 22)
  landBought: number; // LT bought with GP — the landlord's daily play (round 23)
  studsListed: number; // retired roosters put up in the breeding barn
  bred: string | null; // egg name, if a cover was bought (barn included)
  entered: { bird: string; mode: FightMode; classType: Lobby; format: FightFormat; price?: number }[];
  crowns: string[]; // birds registered for this week's championships
  claimsPlaced: number;
}

/** GP a bot keeps in reserve — never gambled into fees, tags, or breeds. */
const RESERVE = 400;
/** A whale keeps far less back — that's what makes it a whale. */
const WHALE_RESERVE = 100;
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
  /**
   * Create the bot farms + their starter flocks. Idempotent — a stable
   * added to BOT_FARMS later joins the world on the next seed call.
   *
   * `only` (test-only knob): seed a named subset of BOT_FARMS instead of the
   * full roster. `Bots.playDay` already scopes itself to whatever farms carry
   * `isBot = 1`, so a partial seed plays a partial day for free — nothing
   * downstream needs to know. Production and `bun run simulate` never pass
   * it, so the real world always gets every configured stable; it exists so
   * tests that only need the GENERIC behavior a bot day proves (determinism,
   * GP conservation, no dangling entries across several days) don't have to
   * pay for all fifteen stables' worth of DB traffic to prove it.
   */
  static seed(db: DB, opts: { flock?: "eggs" | "legacy"; only?: string[] } = {}): void {
    const day = db.select().from(gameState).where(eq(gameState.id, 1)).get()!.dayIndex;
    const roster = opts.only ? BOT_FARMS.filter((b) => opts.only!.includes(b.id)) : BOT_FARMS;
    for (const bot of roster) {
      const exists = db.select().from(farms).where(eq(farms.id, bot.id)).get();
      if (exists) continue;
      db.insert(farms)
        .values({
          id: bot.id,
          name: bot.name,
          country: bot.country,
          primaryColor: bot.primaryColor,
          secondaryColor: bot.secondaryColor,
          handler: bot.handler ?? null,
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
      paidPulls: 0,
      landBought: 0,
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
    // …and then the SPECULATORS (round 23). Ordinary stables take the free
    // pull and put their GP into covers — Zane's ruling that breeding, not
    // the gacha, should make the birds. Two barns exist to be the other kind
    // of player: the high roller who buys bundles, and the landlord who
    // stockpiles Land Tokens on conviction alone.
    if (bot.gachaAppetite && rng() < bot.gachaAppetite) {
      // Bundles until the wallet won't take another — the whole point of a
      // whale is that it does not budget.
      while (gp() >= ECONOMY.BUNDLE_PRICE + WHALE_RESERVE) {
        if (!quietly(() => void gacha.bundle())) break;
        report.paidPulls += ECONOMY.BUNDLE_ROLLS;
      }
      // …then singles with whatever's left over.
      while (gp() >= ECONOMY.GACHA_ROLL_PRICE + WHALE_RESERVE) {
        if (!quietly(() => gacha.roll())) break;
        report.paidPulls++;
      }
    }
    if (bot.landAppetite && rng() < bot.landAppetite) {
      // Max the daily cap, or as much of it as the wallet allows. Land never
      // sells, so this barn is making a one-way bet on the staking yield.
      const affordable = Math.floor(((gp() - RESERVE) * 100) / LAND.GP_PER_100_TOKENS);
      const want = Math.min(LAND.DAILY_BUY_CAP, affordable);
      if (want > 0 && quietly(() => void farmsApi.buyLand(bot.id, want)))
        report.landBought = want;
    }
    // 1b. Stand the retired roosters at stud — selling covers is income.
    //     BEFORE staking, since round 23 a stud seat costs 100 LT and a barn
    //     that has already staked every token has nothing liquid to pay with.
    const breeding = new Breeding(db, bot.id, rng);
    for (const rooster of flock.all().filter(
      (b) => b.status === "retired" && b.sex === "male" && !b.listedStud
    )) {
      if (quietly(() => void breeding.listStud(rooster.id))) report.studsListed++;
    }

    // 1c. …and only THEN stake what's left over.
    const liquid = db.select().from(farms).where(eq(farms.id, bot.id)).get()!.landTokens;
    if (liquid > 0 && quietly(() => farmsApi.stake(bot.id, liquid))) report.stakedLand = liquid;

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
    report.crowns.push(...chaseJuvenileCrowns(db, bot.id, today));

    // 4. LIQUIDITY FIRST — the job bots exist for. A lobby sitting at an
    //    odd count has a bird waiting with no opponent; join it. Fill
    //    counts are public (the fog hides who, never how many). One bird
    //    per lobby per bot — a bot's own birds can't fight each other.
    //    Shuffled for spread, then re-ordered by the going (round 25): when
    //    two of the barn's birds would both fill an odd lobby, the one whose
    //    element is ascendant today goes. Costs the card nothing — it's the
    //    same number of entries, just a better-chosen bird.
    const roster = () =>
      weatherOrder(
        shuffle(flock.all().filter((b) => b.status === "active" && b.age >= 1), rng),
        today
      );
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

    // 5. Then card the rest of the flock by style — and by the going. A bird
    //    runs a little more often on its own element's day, and sometimes
    //    waits a night when tomorrow is its day (see WEATHER_APPETITE).
    for (const bird of roster()) {
      if (!weatherCardsToday(bird, today, rng, bot.entryRate)) continue;
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
    // THE DISCOVERY-YEAR LADDER (round 23): a juvenile climbs the same way a
    // grown bird does — maiden while it hasn't won, stakes once it has, and
    // sometimes out with a tag on it. The old code carded every chick in one
    // flat open division, which is exactly the lack of laddering Zane wanted
    // fixed ("allow deeper discovery by promoting laddering in the Juvi
    // season").
    if (bird.age === 1) {
      if (bird.wins === 0) return { mode: "juvenile", classType: "maiden", format };
      if (rng() < bot.sellRate) {
        const idx = Math.min(
          CLAIMER.JUVENILE_PRICES.length - 1,
          Math.round(Math.max(0, bird.wins - bird.losses) * bot.tagCourage)
        );
        return {
          mode: "juvenile",
          classType: "claimer",
          format,
          price: CLAIMER.JUVENILE_PRICES[idx],
        };
      }
      return { mode: "juvenile", classType: "open", format };
    }
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
    b1: bird.agility + bird.sight, // the sprint
    b2: (bird.agility + bird.sight + bird.stamina + bird.gameness) / 2, // the hybrid
    b3: bird.stamina * 2, // the route
    b4: bird.gameness * 2, // the marathon
    b5: bird.gameness + bird.stamina, // the deep-water classic — the stayer's pair
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
 * READING THE GOING (round 25) — the weather half of "which bird, which day".
 *
 * Weather is blade-INDEPENDENT: the ascendant element is the same in every
 * lobby on the card, so unlike bestFormat it says nothing about WHERE to card
 * a bird. It only ever answers WHETHER to card it tonight. That's why these
 * are separate functions and why pickSpec is untouched — a weather-matched
 * bird still belongs at the distance its stats say, not somewhere else.
 *
 * Shared with auto-play so a player-side stable times its entries the same
 * way a bot does; the knobs and the reasoning for their size live in
 * bot-config's WEATHER_APPETITE.
 */

/** Is this bird's element the day's ascendant one — and can it CASH that in? */
export function weatherMatched(bird: BirdView, dayIndex: number): boolean {
  // Stars are the element's volume knob (2026-08-04): the weather edge is
  // WEATHER.EDGE × halfStars/10, so a 0★ bird gets literally nothing from
  // its own day. A stable that held a 0★ bird back for tomorrow's sky would
  // be reading a going that doesn't exist for it.
  return bird.halfStars > 0 && bird.element === weatherOfDay(dayIndex);
}

/**
 * The roster in the order a conditioner would reach for it: today's birds
 * first, tomorrow's birds LAST, everything else in between.
 *
 * The FREE lever, and — measured — the one that does most of the work. It
 * changes WHICH bird goes, never how many, so it cannot cost the card a
 * single entry. It matters most in the liquidity pass, which fills odd
 * lobbies with whichever of the barn's birds the rules will take: instrumented
 * over a 35-day sim, that pass ran 36% of its entries on the bird's own day
 * purely from this ordering, against 20% by chance.
 *
 * That measurement is also why the third tier exists. The liquidity pass is
 * deliberately NOT gated by weatherCardsToday — an odd lobby has a bird of
 * somebody's waiting with no opponent, and no amount of clever timing is
 * worth stranding it — so without this, the pass happily spent the very birds
 * the entry gate had just decided to hold for tomorrow, and the hold measured
 * as nothing. Sinking them to the bottom means they only get used when the
 * card genuinely has nothing else, which is exactly the right exception.
 *
 * Stable within each tier, so a shuffled roster stays shuffled inside it —
 * otherwise every barn would card its birds in the same seeded order and the
 * matchmaker would see the flock in id order all week.
 */
export function weatherOrder(roster: BirdView[], dayIndex: number): BirdView[] {
  const tier = (b: BirdView) =>
    weatherMatched(b, dayIndex) ? 0 : weatherMatched(b, dayIndex + 1) ? 2 : 1;
  return [0, 1, 2].flatMap((t) => roster.filter((b) => tier(b) === t));
}

/**
 * Does this bird go on tonight's card at all?
 *
 * `baseRate` is the barn's ordinary appetite for carding a bird (auto-play
 * passes 1 — it cards everything it can), and the weather bends it two ways:
 * up on the bird's own day, and — once — down on the eve of it.
 *
 * The hold is checked BEFORE the boost and only when today is not already the
 * bird's day, so the two can never fight over the same bird.
 */
export function weatherCardsToday(
  bird: BirdView,
  dayIndex: number,
  rng: Rng,
  baseRate: number
): boolean {
  if (weatherMatched(bird, dayIndex))
    return rng() < baseRate + (1 - baseRate) * WEATHER_APPETITE.MATCH_BOOST;
  // Tomorrow is its day — worth waiting a night for, sometimes.
  if (weatherMatched(bird, dayIndex + 1) && rng() < WEATHER_APPETITE.HOLD_FOR_TOMORROW) return false;
  return rng() < baseRate;
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
/**
 * The DISCOVERY-YEAR chase (round 23): send qualified juveniles to Wednesday's
 * championship. No nerve check and no reserve — the juvenile stage isn't
 * hardcore and costs nothing, so there is no reason on earth not to enter a
 * bird that has earned its way in.
 */
export function chaseJuvenileCrowns(db: DB, farmId: string, today: number): string[] {
  const tournaments = new Tournaments(db, farmId);
  const flock = new Flock(db, farmId);
  const entered: string[] = [];
  const blades = Tournaments.juvenileBladesOfWeek(Tournaments.targetWeek(today));
  const qualified = flock
    .all()
    .filter((b) => b.status === "active" && b.named && b.age === 1)
    .filter((b) => b.wins >= JUVENILE_MAJOR.QUALIFYING_WINS);
  for (const blade of blades) {
    let sent = 0;
    for (const bird of qualified.sort((a, b) => formatScores(b)[blade] - formatScores(a)[blade])) {
      if (sent >= JUVENILE_MAJOR.MAX_PER_BARN) break;
      try {
        tournaments.enter(bird.id, blade, "juvenile");
        entered.push(bird.name);
        sent++;
      } catch {
        /* already in this week, barn cap, or not qualified */
      }
    }
  }
  return entered;
}

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
  // Age AND qualification points (round 22): the crowns cost nothing now, so
  // the gate is what the bird did on the daily card, not what the barn can
  // afford. Filtering here keeps the pointless enter() attempts out.
  const qualified = new Set(
    db
      .select()
      .from(birds)
      .all()
      .filter((b) => b.farmId === farmId && b.crownPoints >= PINTAKASI.QUALIFYING_POINTS)
      .map((b) => b.id)
  );
  const eligible = flock
    .all()
    .filter((b) => b.status === "active" && b.named && canHardcore(b.age) && qualified.has(b.id));
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
      // Free entry still respects the reserve if a future season re-prices it.
      if (
        PINTAKASI.ENTRY_FEE > 0 &&
        db.select().from(farms).where(eq(farms.id, farmId)).get()!.gp < PINTAKASI.ENTRY_FEE + reserve
      )
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
