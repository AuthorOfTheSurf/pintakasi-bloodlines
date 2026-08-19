import { and, eq, gte } from "drizzle-orm";
import type { DB } from "@/db/client";
import { birds, farms, gameState } from "@/db/schema";
import { seedStarterFlock } from "@/db/seed-data";
import { BOT_FARMS, BREEDING_PLAN, CROWN_CHASE, WEATHER_APPETITE, type BotProfile } from "./bot-config";
import { applyProposals, type BotAction } from "./bot-brain";
import {
  BREEDING_SHAPES,
  CLAIMER,
  COVERS,
  DISTANCE_STATS,
  ECONOMY,
  FORMATS,
  FORMAT_NAMES,
  JUVENILE_MAJOR,
  LAND,
  NW_CAP,
  PINTAKASI,
  SCOUT,
  barnCapacity,
  cardOfDay,
  feeFor,
  nextExpansionCost,
  weatherOfDay,
  type CardKey,
  type DistanceStat,
  type FightFormat,
  type Lobby,
  type StatName,
  LT_CENTS,
} from "./config";
import { Breeding, type StudView } from "./breeding";
import { drawStarterNames } from "./naming";
import { emit } from "./events";
import { Farms } from "./farms";
import { Flock, type BirdView } from "./flock";
import { GameClock } from "./game-clock";
import { Gacha } from "./gacha";
import { canHardcore } from "./lifecycle";
import { Lobbies, entryRefusal, type FightMode, type LobbySpec, type ScoutReport } from "./lobbies";
import { mulberry32, randInt, type Rng } from "./rng";
import { DIVISION_RULES, Tournaments } from "./tournaments";

/**
 * "end-first" is simulation-only until it beats the current grid exploration
 * across matched worlds. It spends unread attempts B1 → B5 → B2 → B4 → B3,
 * the racing-style route from extremes inward, without ever reading the sheet.
 */
export type DiscoveryPolicy = "current" | "end-first";
const END_FIRST_ORDER: FightFormat[] = ["b1", "b5", "b2", "b4", "b3"];

/** What one bot stable did with its day — surfaced on the tick view. */
export interface BotDayReport {
  farm: string;
  // "llm" joins the house styles in round 49 — a barn decided from outside
  // has no BotProfile and therefore no house style, and calling it what it
  // is beats borrowing a personality it does not have.
  style: BotProfile["style"] | "llm";
  checkedIn: boolean;
  stakedLandCents: number; // bots stake every liquid LT, daily
  paidPulls: number; //  gacha rolls bought at price (round 22)
  landBought: number; // LT bought with GP — the landlord's daily play (round 23)
  studsListed: number; // retired roosters put up in the breeding barn
  bred: string[]; // egg names — a barn covers every hen it can, not one a day
  entered: { bird: string; mode: FightMode; classType: Lobby; format: FightFormat; price?: number }[];
  crowns: string[]; // birds registered for this week's championships
  claimsPlaced: number;
  // Birds the day's card had NOTHING for (round 31). The only error surface
  // the bot layer has: `quietly` swallows every entry exception, so a card
  // that stranded a class would otherwise be invisible. The doctor reads it.
  noCard: number;
}

/** GP a bot keeps in reserve — never gambled into fees, tags, or breeds. */
const RESERVE = 400;
/** A whale keeps far less back — that's what makes it a whale. */
const WHALE_RESERVE = 100;
const MAX_CLAIMS_PER_DAY = 2;
/**
 * Expand the barn once the flock is within this many slots of the ceiling —
 * roughly one week of covers, so the expansion lands BEFORE `quietly` starts
 * eating refused breeds rather than after (round 43).
 */
const BARN_EXPAND_HEADROOM = 10;

/**
 * The bot stables' daily play. Called at the top of every tick — the bots
 * play the CLOSING day (check in, breed, card birds, place claims),
 * then the clock advances and the card they just joined goes off. They are
 * ordinary farms driving the ordinary engine: every rule that binds a
 * player binds them, and every decision uses only information a player
 * could see (the scout report, the fogged board, visible claimer fields —
 * NEVER a live bird's stats, which round 28 hid from everyone alike).
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
   * pay for the full roster's worth of DB traffic to prove it (19 stables as of round 43).
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
          landTokensCents: 0,
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

  /**
   * `proposals` is the round-49 seam: a map of farmId → the actions an
   * OUTSIDE decider already chose for that barn, collected before the tick
   * opened its transaction (see engine/bot-brain.ts for why it cannot be
   * collected in here). A farm carrying `brain = 'llm'` plays its proposed
   * day; every other farm plays its scripted one exactly as before.
   *
   * ⚠ Omit it and this method is byte-for-byte the function it has always
   * been. Nothing seeds an llm barn, so tests, `simulate` and `doctor` take
   * the scripted path and stay replayable.
   */
  static playDay(
    db: DB,
    discoveryPolicy: DiscoveryPolicy = "current",
    proposals?: ReadonlyMap<string, BotAction[]>
  ): BotDayReport[] {
    const botRows = db.select().from(farms).where(eq(farms.isBot, 1)).all();
    if (botRows.length === 0) return [];
    const today = db.select().from(gameState).where(eq(gameState.id, 1)).get()!.dayIndex;

    const reports: BotDayReport[] = [];
    for (const [i, row] of botRows.entries()) {
      const rng = mulberry32((today + 1) * 7919 + (i + 1) * 104729);
      if (row.brain === "llm") {
        // An llm barn with no proposals sits the day out rather than falling
        // back to the scripted brain. Silently substituting one decider for
        // the other would make a broken model look like a working one, which
        // is the single most expensive thing this file could get wrong — the
        // whole point of the pair is that the two are TELLING APART.
        const actions = proposals?.get(row.id);
        if (actions) reports.push(applyProposals(db, row.id, actions, rng));
        continue;
      }
      const profile = BOT_FARMS.find((b) => b.id === row.id);
      if (!profile) continue; // a bot removed from config sits out
      reports.push(Bots.playFarm(db, profile, rng, today, discoveryPolicy));
    }
    return reports;
  }

  /**
   * ── THE OVERNIGHT SWEEP (round 40) ─────────────────────────────────────────
   *
   * Every bot already stakes every whole token it holds, first thing, as step
   * 1c of its day. So why did a 91-day world end with 16,224 LT — 6.7% of all
   * land — sitting IDLE, earning nobody anything?
   *
   * Because a bot's day happens BEFORE the card goes off. Land is minted when
   * fights settle and when the crowns pay their grants, which is hours after
   * the last bot walked past the land office. Every barn's idle balance was
   * exactly one night's winnings waiting for tomorrow morning — measured on
   * the round-39 sim, farm by farm, to the token: Pulang Bagwis idle 1,804.04
   * against 1,803.21 earned that day, and so on down the table. Not a missing
   * appetite; a missing hour.
   *
   * Zane: "They should be immediately staking everything they get." So the
   * tick sweeps them after settlement — the barn walks out to the land office
   * the moment the card ends, rather than waiting for the morning.
   *
   * ⚠ IT RUNS AFTER `distributeStaking`, ON PURPOSE. Sweeping first would let
   * tonight's winnings draw tonight's payout, which is a different and better
   * deal than any player gets — the land was minted after the pool was earned.
   * Staked overnight, it starts paying tomorrow, which is what "immediately"
   * honestly means here.
   *
   * ⚠ BOTS ONLY. A real barn's land is its own business, and auto-play already
   * stakes a player farm at the start of its honest day.
   */
  static sweepStakes(db: DB): number {
    const farmsApi = new Farms(db);
    let staked = 0;
    for (const bot of db.select().from(farms).where(eq(farms.isBot, 1)).all()) {
      // Whole tokens only — `stake` refuses a fraction, and the remainder
      // simply waits for tomorrow's earnings to round it up past a token.
      //
      // ⚠ NOT WRAPPED IN `quietly`, unlike everything else the bots do. The
      // floor guarantees `stake` cannot refuse this (it holds at least what we
      // ask for), so a throw here is a bug in the arithmetic, not a house rule
      // saying no — and swallowing it would repeat round 36 exactly, where a
      // hundredths/whole-tokens mixup stopped every bot in the world staking
      // and nothing anywhere said a word.
      const whole = Math.floor(bot.landTokensCents / LT_CENTS);
      if (whole > 0) {
        farmsApi.stake(bot.id, whole);
        staked += whole;
      }
    }
    return staked;
  }

  private static playFarm(
    db: DB,
    bot: BotProfile,
    rng: Rng,
    today: number,
    discoveryPolicy: DiscoveryPolicy
  ): BotDayReport {
    const farmsApi = new Farms(db);
    const flock = new Flock(db, bot.id);
    const lobbies = new Lobbies(db, bot.id);
    const report: BotDayReport = {
      farm: bot.name,
      style: bot.style,
      checkedIn: false,
      stakedLandCents: 0,
      paidPulls: 0,
      landBought: 0,
      studsListed: 0,
      bred: [],
      entered: [],
      crowns: [],
      claimsPlaced: 0,
      noCard: 0,
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
    // 1a. GROW THE BARN before it chokes (round 43) — and BEFORE any gacha
    // spending, which is an ordering that had to be measured to be believed:
    // this block originally ran after the whale appetite, and Ginto — who
    // drinks its wallet down to WHALE_RESERVE on bundles every single day —
    // reached the buy-the-shortfall fallback with ~160 GP left, every day,
    // for seventy days, while its barn sat jammed at 100. Capacity is
    // infrastructure: the barn pays its rent before it gambles. The block
    // draws NO rng, so moving it does not shift the day's stream.
    // Deliberately COMPETENCE,
    // not personality — no profile knob, every barn does it — because a stable
    // that cannot breed has stopped playing, and the flat 100-cap was an
    // absorbing state: retired brood stock never leaves, `breed` throws when
    // full, `quietly` eats the throw, and the barn goes silent FOREVER with
    // every adoption bar still green (7 of 20 barns were there by day 91).
    // Same shape as the stud-seat rule above: expanding is the second thing
    // worth pulling staked land back out for. Draws NO rng, so a world where
    // nobody hits the headroom plays out identically to one before this existed.
    {
      const row = db.select().from(farms).where(eq(farms.id, bot.id)).get()!;
      // Headroom of one week's worth of covers: expanding the morning the barn
      // is already full would still lose every cover `quietly` swallowed while
      // the wallet was short — start paying while there is still room to breed.
      if (flock.barnCount() >= barnCapacity(row.barnExpansions) - BARN_EXPAND_HEADROOM) {
        const short = nextExpansionCost(row.barnExpansions) - row.landTokensCents;
        if (short > 0) quietly(() => void farmsApi.unstake(bot.id, Math.ceil(short / LT_CENTS)));
        // A barn with no land BANK buys the shortfall with GP (round 43,
        // measured on the first 182-day run): Ginto the whale never fights
        // enough to earn land — 17 LT lifetime against a 1,000 LT expansion —
        // so it sat at capacity for weeks, rich, while the doctor warned. Land
        // is the fighters' currency, but buyLand converts at 80 GP/100 LT and
        // the daily cap covers the first expansion in a single morning. The
        // re-read is deliberate: the unstake above may have already fixed it.
        const liquid = db.select().from(farms).where(eq(farms.id, bot.id)).get()!.landTokensCents;
        const stillShort = nextExpansionCost(row.barnExpansions) - liquid;
        if (stillShort > 0)
          quietly(() => void farmsApi.buyLand(bot.id, Math.ceil(stillShort / LT_CENTS)));
        quietly(() => void farmsApi.expandBarn(bot.id));
      }
    }

    // …then THE HABIT (round 43): one paid roll on a habit day, for every barn.
    // Before this, 18 of 20 stables took their free pull and paid for nothing,
    // so two whales funded 71% of all championship juice — see gachaHabit in
    // bot-config for the ruling and the egg-supply guard. The rng draw is
    // UNCONDITIONAL (the same pattern as wantsToClimb in pickOffering): a barn
    // too broke to roll must still consume the draw, or solvency would bend
    // every later decision the barn makes that day.
    const habitDay = rng() < bot.gachaHabit;
    if (habitDay && gp() >= ECONOMY.GACHA_ROLL_PRICE + RESERVE) {
      if (quietly(() => gacha.roll())) report.paidPulls++;
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
      // ⚠ BOTH SIDES IN WHOLE TOKENS (round 36). `DAILY_BUY_CAP` is stored in
      // hundredths but `buyLand` takes whole tokens, so the cap has to come
      // down to tokens before it meets `affordable` — otherwise this asks for
      // up to 100× the cap, `buyLand` refuses it, `quietly` eats the refusal,
      // and the landlord silently stops buying. That would have been an
      // expensive silence: land purchases were 72,800 GP of the 87,510 GP the
      // staker pool paid out over 91 days, so the whole staking economy would
      // have gone quiet with nothing on fire.
      const affordable = Math.floor(((gp() - RESERVE) * 100) / LAND.GP_PER_100_TOKENS);
      const want = Math.min(LAND.DAILY_BUY_CAP / LT_CENTS, affordable);
      if (want > 0 && quietly(() => void farmsApi.buyLand(bot.id, want)))
        report.landBought = want;
    }
    // 1b. Stand the retired roosters at stud — selling covers is income.
    //     BEFORE staking, since round 23 a stud seat costs 100 LT and a barn
    //     that has already staked every token has nothing liquid to pay with.
    //
    // ⚠ AND SINCE ROUND 40, BEFORE STAKING IS NO LONGER ENOUGH — IT HAS TO
    // UNSTAKE. The overnight sweep (see Bots.sweepStakes) banks every whole
    // token the moment the card settles, so a barn now wakes up with nothing
    // liquid and the ordering above protects nothing. The sim said so
    // immediately and in exactly the shape AGENTS.md warns about: the doctor's
    // adoption block read **studs listed 4 of 20**, down from 19, with no
    // error anywhere — `quietly` ate twenty refusals a day. A door that was
    // wide open the round before had quietly closed.
    //
    // Zane's ordering, stated plainly: stake everything, and the ONE thing
    // worth pulling land back out for is a stud seat. So that is what this
    // does — it unstakes exactly the shortfall, and only when there is a
    // rooster standing there waiting for it.
    const breeding = new Breeding(db, bot.id, rng);
    const unlisted = flock
      .all()
      .filter((b) => b.status === "retired" && b.sex === "male" && !b.listedStud);
    if (unlisted.length > 0) {
      const row = db.select().from(farms).where(eq(farms.id, bot.id)).get()!;
      // One seat at a time: a barn with three roosters lists one today and the
      // rest tomorrow, rather than emptying the pool in one morning.
      const short = COVERS.STUD_LISTING_LT - row.landTokensCents;
      if (short > 0) quietly(() => void farmsApi.unstake(bot.id, Math.ceil(short / LT_CENTS)));
    }
    for (const rooster of unlisted) {
      if (quietly(() => void breeding.listStud(rooster.id))) report.studsListed++;
    }

    // 1c. …and only THEN stake what's left over.
    //
    // ⚠ WHOLE TOKENS GO IN, HUNDREDTHS COME OUT (round 36). The balance is
    // stored in hundredths but `stake` takes whole tokens, so this must floor
    // — and getting it wrong would have been INVISIBLE. Passing the raw
    // hundredths asks to stake 100× the balance, `stake` throws, `quietly`
    // eats it, and every bot in the world silently stops staking while the
    // staker pool quietly stops paying anyone. That is the round-19 claiming
    // and round-22 gacha failure exactly: a door nobody walks through, with no
    // error anywhere. The fractional remainder simply stays liquid until the
    // next day's earnings round it up past a whole token.
    const liquid = db.select().from(farms).where(eq(farms.id, bot.id)).get()!.landTokensCents;
    const whole = Math.floor(liquid / LT_CENTS);
    if (whole > 0 && quietly(() => farmsApi.stake(bot.id, whole)))
      report.stakedLandCents = whole * LT_CENTS;

    // (No training step — stats are fixed at birth, ruled round 13. The
    // discovery year is fought, not trained.)

    // 2. The naming law (round 14): no bird fights under an auto-name.
    //    Christen every unnamed active bird from the pool before carding.
    for (const bird of flock.all().filter((b) => b.status === "active" && !b.named)) {
      quietly(() => void flock.rename(bird.id, drawStarterNames(db, 1, rng)[0]));
    }

    // 3. Breed through the BARN — bots shop other farms' listed studs like
    //    anyone else, and they shop with a PLAN (round 29: this loop used to
    //    take the first legal cover off a shuffled list, which optimised for
    //    nothing and bred the whole world flat — see BREEDING_PLAN).
    //
    //    ROUND 32 LIFTED THE ONE-COVER-A-DAY CAP, and it was never a budget
    //    rule. A cover is BREED_FEE, a hen can hold only one pregnancy until
    //    her egg lays the following Friday, so ~10 retired hens want ~10
    //    covers A WEEK — under a third of a day's DAILY_DRIP. The cap was
    //    throwing away two thirds of the world's breeding capacity for
    //    nothing, and the round-31 sim showed it plainly: 73 of 154 retired
    //    hens never bred once, while eight hens carried nine foals each.
    //
    //    So `breedDrive` stops being a daily dice roll and becomes DEPTH —
    //    the share of her hens a barn intends to work. Zane, 2026-08-06:
    //    "I'd expect barns to either breed all of their hens, or their X best
    //    hens each season." The stop is now money and biology, not a counter.
    //
    // ⚠ CARRYING HENS ARE FILTERED OUT BEFORE THE COUNT, and that is what makes
    // `breedDrive` mean anything. A hen holds one pregnancy until her egg lays
    // the following Friday, so on any given day most of a worked band is
    // already carrying. Counting the whole band would set every barn's target
    // at the daily cap and then spend the pricing budget on hens whose cover
    // can only throw — swallowed by `quietly`, invisible. Depth is a share of
    // the hens who can actually take a cover TODAY.
    // Read off the db rather than `flock.all()`: BirdView exposes `eggStage`
    // but not `motherId`, and the rule is specifically GESTATING — an egg
    // already LAID leaves its dam free, which is the round-14 rule that lets a
    // hen carry again while last week's egg waits to hatch.
    const thisWeek = GameClock.weekOf(today);
    const carrying = new Set(
      db
        .select()
        .from(birds)
        .where(and(eq(birds.farmId, bot.id), eq(birds.status, "egg")))
        .all()
        .filter((egg) => egg.motherId && egg.birthWeek > thisWeek)
        .map((egg) => egg.motherId!)
    );
    const hens = flock
      .all()
      .filter((b) => b.status === "retired" && b.sex === "female" && !carrying.has(b.id));
    const coverTarget = breedTarget(bot, hens.length);
    if (coverTarget > 0 && gp() > ECONOMY.BREED_FEE + RESERVE) {
      // Round 30: the shape is chosen PER HEN, not per barn. Round 29 priced
      // every cover in the barn against one house axis, which meant half the
      // flock was being bred ACROSS its own grain — a deep-water hen dragged
      // toward sprint spends the foal's whole midpoint undoing her. The house
      // pair survives as the fallback below.
      const house = BREEDING_SHAPES[bot.housePair % BREEDING_SHAPES.length];
      // Priced up front rather than inside the try/buy loop: a legal cover can
      // still fail on kinship or a used-up slot, and the barn should fall to
      // its SECOND choice, not back to random.
      //
      // ⚠ THE HEN CAP IS THE ONE THAT MATTERS, and round 32 had to add it.
      // The only cap here used to be MAX_PAIRS_PRICED against MAX_STUDS_PER_HEN
      // studs each — 150 ÷ 40, so barely FOUR hens were ever priced in a day.
      // Lifting the one-cover-a-day rule on its own would have changed nothing
      // past the fourth hen, because there was nothing priced to buy. Count
      // HENS, and let the pair cap go back to being a pure runaway guard.
      const priced: { henId: string; studId: string; score: number }[] = [];
      let hensPriced = 0;
      for (const hen of shuffle(hens, rng)) {
        if (hensPriced >= coverTarget + BREEDING_PLAN.HENS_PRICED_SLACK) break;
        if (priced.length >= BREEDING_PLAN.MAX_PAIRS_PRICED) break;
        hensPriced++;
        // A retired hen's sheet is revealed (round 28), so this is public
        // information for a bot exactly as it is for a player reading her card.
        const dam = flock.byId(hen.id);
        // HER shape if she has one, the barn's if she doesn't. A hen sitting a
        // few points off flat has no grain to follow, and following the noise
        // in her sheet is following nothing — worse, it would scatter the
        // barn's covers across all three axes and give up the concentration
        // that makes a bloodline a bloodline.
        const own = bestShape(dam);
        const shape = own.separation >= BREEDING_PLAN.OWN_SHAPE_MIN ? own.shape : house;
        // SHUFFLED, and this is load-bearing: browseStuds returns rows in
        // insertion order, so a cap applied to the raw list always sliced to
        // the OLDEST studs in the barn — the unselected founders. The first
        // cut of this plan picked beautifully from exactly the wrong 60 studs
        // and moved the flock's median shape by nothing at all across 91 days.
        let forThisHen = 0;
        for (const stud of shuffle(breeding.browseStuds(hen.id).studs, rng)) {
          if (priced.length >= BREEDING_PLAN.MAX_PAIRS_PRICED) break;
          // Per-hen cap so the budget reaches several hens: without it the
          // first hen out of the shuffle ate it all, and every cover in the
          // game had a chosen father and a random mother.
          if (forThisHen >= BREEDING_PLAN.MAX_STUDS_PER_HEN) break;
          forThisHen++;
          priced.push({ henId: hen.id, studId: stud.birdId, score: foalScore(dam, stud, shape) });
        }
      }
      // Best pair first, then walk down. Sorting the PAIRS rather than the hens
      // is what makes this "the barn's top X hens": a hen's rank is the rank of
      // her best available cover, so a good hen with no good stud left standing
      // quietly drops below a lesser hen who has one — which is the right call,
      // since it is the FOAL the barn is buying, not the dam.
      priced.sort((a, b) => b.score - a.score);
      const covered = new Set<string>();
      for (const pick of priced) {
        if (covered.size >= coverTarget) break;
        // One pregnancy per hen until her egg lays, so a second pair for a hen
        // already covered today can only fail. Skip it rather than spend the
        // attempt — `quietly` would swallow the throw and we would never know.
        if (covered.has(pick.henId)) continue;
        // MONEY IS THE REAL STOP, and it is checked per cover rather than once
        // up front: a barn that can afford three covers must buy three and then
        // halt, not commit to its target and overdraw toward the reserve.
        if (gp() < ECONOMY.BREED_FEE + RESERVE) break;
        let eggName: string | null = null;
        if (quietly(() => (eggName = breeding.breed(pick.henId, pick.studId).egg.name))) {
          covered.add(pick.henId);
          report.bred.push(eggName!);
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
    // ⚠ THE FLOCK IS FETCHED ONCE, THE SHUFFLE STILL HAPPENS PER LOBBY (round
    // 43). `roster()` used to call `flock.all()` on every iteration — a query
    // plus a view built for every bird in the barn, per lobby, per bot, per day.
    // Entering a lobby does not modify a bird row, so the rows are stable for the
    // whole loop and re-reading them bought nothing.
    //
    // The SHUFFLE deliberately stays inside the closure. `shuffle` draws from
    // `rng` once per element, so hoisting it would change how much of the stream
    // this loop consumes and every later decision in the barn's day would land
    // differently — a "pure" speed change that silently rewrites the world. Same
    // number of draws in, same world out.
    const rosterRows = flock.all().filter((b) => b.status === "active" && b.age >= 1);
    const roster = () => weatherOrder(shuffle(rosterRows, rng), today);
    for (const lobby of lobbies.board({ detail: "fills" })) {
      if (lobby.lobbyId === null) continue; // a phantom — posted, nobody in it yet
      if (lobby.status !== "open") continue; // closed = entries locked
      if (lobby.filled % 2 === 0) continue;
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
    // ⚠ THE AFFORDABILITY GATE IS PER-CARD SINCE ROUND 42, and it had to be.
    // This read `gp() <= ECONOMY.REAL_ENTRY_FEE + RESERVE` — one hardcoded fee,
    // which was honest only while every grown fight cost the same 42 GP. With a
    // priced ladder (24 GP up to 300) a fixed gate is wrong in both directions:
    // it would stop a barn entering a 24 GP juvenile claimer it could easily
    // afford, and wave it through into a 300 GP open it could not. So the BREAK
    // tests the CHEAPEST rung posted today — below that the barn genuinely
    // cannot card at all — and the budget is handed to pickOffering, which will
    // not choose a rung the barn can't cover.
    const cheapest = Math.min(
      ...cardOfDay(today).map((k) => feeFor(k.mode, k.classType, k.price))
    );
    // The roster's scout reports, one query (round 44). Nothing writes
    // battle_log during a barn's day — fights resolve at the tick — so the
    // reports are stable for the whole loop and each bird's is just handed
    // down instead of re-fetched inside pickOffering.
    const reports = lobbies.scoutReports(rosterRows.map((b) => b.id));
    for (const bird of roster()) {
      if (!weatherCardsToday(bird, today, rng, bot.entryRate)) continue;
      const budget = gp() - RESERVE;
      if (budget < cheapest) break;
      const spec = pickOffering(db, bot, bird, rng, today, discoveryPolicy, budget, reports.get(bird.id));
      // null = today's card had nothing this bird is eligible for. Counted
      // rather than swallowed: `quietly` hides every other entry failure, so
      // without this number a card that starved a class would look like bots
      // simply choosing not to run.
      if (spec === null) {
        report.noCard++;
        continue;
      }
      if (quietly(() => void lobbies.enter(bird.id, spec))) {
        report.entered.push({ bird: bird.name, ...spec });
      }
    }

    // 6. Shop the claimer fields — public info only (record vs. the tag).
    if (bot.claimAggression > 0) {
      // Cards ARE needed here — a claim is placed on a specific bird, read off
      // the public claimer field — but only for claimers, which is what the
      // filter buys (round 43: this used to build cards for every open lobby on
      // the board and then skip all but the claimers).
      for (const lobby of lobbies.board({ classType: "claimer", detail: "field" })) {
        if (report.claimsPlaced >= MAX_CLAIMS_PER_DAY) break;
        if (lobby.lobbyId === null) continue; // a phantom has no field to shop
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

  /** Where does this bird belong tonight? Style + the scout report (round 28). */
}

/**
 * WHAT SHALL THIS BIRD RUN IN TONIGHT? — or null, if today's card has nothing
 * for it.
 *
 * ⚠ INVERTED IN ROUND 31: blade first, CLASS AS THE SLACK. The old chooser
 * picked a class from the bird's record and then a blade, which worked only
 * because every key existed every day. Now a small card is posted, and the
 * naive port — pick the class, then hope its blade is up — starves the classes
 * that run one blade a day: measured worst gap for a k=1 class is 8 days, and a
 * juvenile's whole discovery year is 7. A winless chick could have finished its
 * career without ever seeing a blade in a maiden.
 *
 * Inverting fixes it using the property the card is built on — the classes NEST
 * (maiden ⊂ nw3 ⊂ open). Find the blade this bird wants among everything it is
 * legally allowed to enter today, then take the most PROTECTIVE class posted at
 * that blade. A winless juvenile whose blade isn't in today's maiden simply
 * runs juvenile open at that blade instead. Maiden becomes protection you get
 * when the card offers it, and the whole-card blade gap — 3 days in both
 * divisions — is what actually governs coverage.
 *
 * Eligibility comes from `entryRefusal`, the same predicate `Lobbies.enter`
 * throws on, so the chooser can never propose a spec the door refuses. That
 * matters more than it looks: both entry paths wrap `enter` in `quietly()`, so
 * a disagreement between the two would surface as nothing at all except a fill
 * rate that silently collapsed.
 *
 * Exported (it was private) because auto-play used to carry its own copy of
 * this decision and the two had already drifted apart.
 */
export function pickOffering(
  db: DB,
  bot: { sellRate: number; tagCourage: number; ladderCourage: number },
  bird: BirdView,
  rng: Rng,
  today: number,
  discoveryPolicy: DiscoveryPolicy = "current",
  budget = Infinity,
  // Prefetched scout report — threaded through to bestFormat. See there.
  report?: ScoutReport
): LobbySpec | null {
  // ELIGIBILITY FIRST, THEN AFFORDABILITY — the order matters for the caller's
  // bookkeeping. A null return means "today's card had nothing this bird may
  // enter", which the caller counts as `noCard`; narrowing by price before that
  // test would file a broke barn as a starved class and hide a real card bug.
  // The caller has already established that the cheapest rung is affordable.
  const eligible = cardOfDay(today).filter((k) => entryRefusal(bird, k) === null);
  if (eligible.length === 0) return null;
  const feeOf = (k: CardKey) => feeFor(k.mode, k.classType, k.price);
  const options = eligible.filter((k) => feeOf(k) <= budget);
  if (options.length === 0) return null;

  const format = bestFormat(db, bird, rng, discoveryPolicy, new Set(options.map((k) => k.format)), report);
  const atBlade = options.filter((k) => k.format === format);

  // Spend the sell draw UNCONDITIONALLY, before knowing whether a claimer is
  // posted at this blade — otherwise the number of draws depends on the card
  // and a bot's whole day shifts with the schedule.
  const wantsToSell = rng() < bot.sellRate;
  const claimers = atBlade
    .filter((k) => k.classType === "claimer")
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  if (wantsToSell && claimers.length > 0) {
    // Tag by the record, stretched by courage: better birds card dearer. Picks
    // from the rungs OFFERED today rather than the whole ladder, so a barn is
    // never priced out of the marketplace by the day's draw.
    const edge = Math.max(0, bird.wins - bird.losses);
    return claimers[Math.min(claimers.length - 1, Math.round(edge * bot.tagCourage))];
  }

  // Spent UNCONDITIONALLY, exactly like the sell draw above and for the same
  // reason: if the number of rng() calls depended on what the card happened to
  // post, a bot's whole day — its breeding picks, its claim rolls — would shift
  // with the schedule and no sim would be reproducible against another.
  const wantsToClimb = rng() < bot.ladderCourage;

  // The self-sorting ladder, most protective rung first. Reads the STAKES
  // record for grown birds (round 19) — the discovery year graduates nobody.
  let base: CardKey | null = null;
  for (const classType of PROTECTION_ORDER) {
    const found = atBlade.find((k) => k.classType === classType);
    if (found) {
      base = found;
      break;
    }
  }
  if (base === null) return atBlade[0] ?? null;

  // ── FIGHTING UP (round 42) ────────────────────────────────────────────────
  // The protection this bird is entitled to, declined on purpose. Round 42
  // priced the class ladder and made the land curve superlinear across it, so
  // climbing buys harder company for more GP and disproportionately more land —
  // but only a bot that sometimes CHOOSES the dearer rung can demonstrate that.
  // See BotProfile.ladderCourage for why this knob exists at all.
  //
  // ⚠ STRICTLY DEARER, not "the next class along". Maiden and nw3 cost the same
  // 60 GP since round 42 (they became the same rung in practice — a group stage
  // graduates a maiden almost immediately), so stepping by CLASS would let a
  // maiden "climb" into nw3 for no extra stake and no extra land, and the
  // measurement would show a ladder being used while nothing had moved. Sorting
  // by fee and taking the next strictly dearer rung sends a maiden to the open,
  // which is the choice that actually costs something.
  //
  // Claimers are excluded from the climb: entering one is a decision to SELL,
  // taken above by sellRate, and a bird that just declined to sell should not be
  // put up for sale as a side effect of being brave.
  if (wantsToClimb) {
    const baseFee = feeOf(base);
    const dearer = atBlade
      .filter((k) => k.classType !== "claimer" && feeOf(k) > baseFee)
      .sort((a, b) => feeOf(a) - feeOf(b));
    if (dearer.length > 0) return dearer[0]; // one rung up, not straight to the top
  }
  return base;
}

/** Most protective class first — the order `pickOffering` settles down. */
const PROTECTION_ORDER: Lobby[] = ["maiden", "nw3", "open", "claimer"];

/**
 * The class ladder's rung for a given stakes record — the most protective
 * class that still takes you. Shared by the bots and auto-play (round 19:
 * player-side stables carded every bird in the OPEN and never climbed).
 */
export function ladderClass(stakesWins: number): Lobby {
  if (stakesWins === 0) return "maiden";
  if (stakesWins < NW_CAP) return "nw3"; // nw2 merged into nw3 in round 31
  return "open";
}

/**
 * WHICH SHAPE IS THIS BIRD ALREADY? (Zane, 2026-08-06: "Each hen is different,
 * and ought to be bred strategically. If a hen has b1/b2 oriented stats, it
 * should breed with a b1/b2 oriented rooster if possible.")
 *
 * Returns the BREEDING_SHAPES entry the bird's own sheet already leans toward,
 * plus how far it leans — the same `mean(pair) - mean(off)` arithmetic
 * `foalScore` prices a foal on, so the two speak one unit and a caller can
 * compare a hen's separation against a threshold in BREEDING_PLAN.
 *
 * It lives HERE and not in config because it is not a rule of the game: it
 * decides nothing about a fight, a fee or a gate. It is how a *plan* reads a
 * bird, which is bot territory — the same place `bestFormat` and `foalScore`
 * live. Config owns the three shapes; this owns the opinion about them.
 *
 * NULLS ARE THE POINT OF THE `?? 0`. Round 28 put a fog on the sheet: the six
 * fighting stats are `null` on a BirdView unless the bird is retired. Breeding
 * hens are retired, so in practice the numbers are there — but an arithmetic
 * `undefined` here would produce NaN, NaN sorts to the bottom of every
 * comparison in silence, and the whole plan quietly degrades to random. That
 * exact class of bug has bitten this file twice. A fully fogged bird instead
 * reads as separation 0 on every shape, which is honest (we know nothing about
 * her shape) and lands below any sane threshold, so the caller falls back.
 *
 * Ties go to the earliest shape on the dial. Deterministic on purpose: a
 * random tie-break would make the same barn price the same hen differently on
 * two consecutive days for no reason a player could ever see.
 */
export function bestShape(sheet: Partial<Record<DistanceStat, number | null>>): {
  shape: (typeof BREEDING_SHAPES)[number];
  separation: number;
} {
  const mean = (stats: readonly DistanceStat[]) =>
    stats.reduce((sum, s) => sum + (sheet[s] ?? 0), 0) / stats.length;
  let best = BREEDING_SHAPES[0];
  let separation = -Infinity;
  for (const shape of BREEDING_SHAPES) {
    const sep = mean(shape.pair) - mean(shape.off);
    if (sep > separation) {
      best = shape;
      separation = sep;
    }
  }
  return { shape: best, separation };
}

/**
 * Price one cover: what would the FOAL be worth to a barn breeding `shape`?
 *
 * How many hens this barn intends to cover TODAY (round 32).
 *
 * `breedDrive` used to be a daily coin flip in front of a hard one-cover cap,
 * which meant even a 0.9-drive broodfarm bought about one foal every other day
 * and most of its band never carried at all. It is now DEPTH: the share of the
 * barn's retired hens it works. 0.9 breeds nearly all of them, 0.3 breeds the
 * best third — and since the pairs are ranked by expected foal, "the best
 * third" means the best third, not a random third.
 *
 * THE FLOOR is the part Zane ruled directly (2026-08-06): "All barns should
 * basically want to breed, except for the ones with specific non breeding
 * strategies." A hen standing idle is a retired asset earning nothing, and at
 * BREED_FEE a cover the money is never the reason — so every barn works at
 * least MIN_HENS_COVERED of them regardless of style, and a barn with fewer
 * hens than that simply works all of them.
 *
 * THE ONE EXEMPTION is a barn with a `landAppetite`, which pours its whole
 * wallet into land every single day and genuinely cannot afford a floor. That
 * is the "specific non-breeding strategy" the ruling carves out, and keying it
 * off the appetite rather than a magic bot id means a future landlord inherits
 * the exemption for the right reason.
 */
function breedTarget(bot: BotProfile, hens: number): number {
  if (hens === 0) return 0;
  const share = Math.ceil(hens * bot.breedDrive);
  const floor = bot.landAppetite ? 0 : BREEDING_PLAN.MIN_HENS_COVERED;
  return Math.min(hens, BREEDING_PLAN.MAX_COVERS_PER_DAY, Math.max(share, floor));
}

/**
 * Expected foal sheet is the parents' midpoint — BREEDING.STAT_VARIANCE is
 * symmetric noise around it and mutations are a 5% tail, so the midpoint is
 * the honest expectation and the whole plan stays arithmetic a player could
 * do on paper. That matters: bots must not out-know their owners. Every input
 * here is public (both parents are retired, so both sheets are revealed, and
 * stars are on the card).
 *
 * Four terms, in Zane's order — shape first, then the anchors and the stars:
 *
 *   shape  how far the foal's TARGET PAIR clears its off-pair, as two-stat
 *          averages. This is the term nothing else in the game supplies.
 *   level  the four-stat average, so the plan can't breed a shapely weakling.
 *   anchor station and condition — they key no blade, so they never fight the
 *          shape term.
 *   stars  the element wheel's volume knob, worth 77-87% at 5★.
 *
 * Weights live in BREEDING_PLAN with the reasoning for each.
 */
export function foalScore(
  dam: BirdView,
  sire: StudView,
  shape: (typeof BREEDING_SHAPES)[number]
): number {
  // A retired parent's stats are revealed, but BirdView types them nullable
  // for the fogged case. A hen that reaches here is retired by the caller's
  // filter; 0 is the safe read if that ever stops being true, and it simply
  // makes her look like a bad mate rather than crashing the day.
  const mid = (stat: StatName) => ((dam[stat] ?? 0) + sire.sheet[stat]) / 2;
  const mean = (stats: readonly StatName[]) =>
    stats.reduce((sum, s) => sum + mid(s), 0) / stats.length;

  const separation = mean(shape.pair) - mean(shape.off);
  const level = mean(DISTANCE_STATS);
  const anchors = mean(["station", "condition"] as const);
  const halfStars = (dam.halfStars + sire.halfStars) / 2;

  return (
    separation * BREEDING_PLAN.SHAPE_WEIGHT +
    level * BREEDING_PLAN.LEVEL_WEIGHT +
    anchors * BREEDING_PLAN.ANCHOR_WEIGHT +
    halfStars * BREEDING_PLAN.STAR_WEIGHT
  );
}

/**
 * How well a bird reads at each distance — THE SCOUT REPORT'S scores
 * (round 28). The old table read the bird's true stats through the engine's
 * own weight matrix, which was legal while owners could see the sheet;
 * with the fog down (stats hidden until retirement) that would be cheating,
 * and the bots proved the discovery loop dead by never needing it. Now a
 * stable — bot or auto-played — reads exactly what a player reads: the
 * shrunk figure history per blade, nothing else.
 */
export function scoutScores(db: DB, birdId: string): Record<FightFormat, number> {
  const report = new Lobbies(db, "scout").scoutReport(birdId);
  return Object.fromEntries(
    FORMAT_NAMES.map((f) => [f, report.blades[f].score])
  ) as Record<FightFormat, number>;
}

/**
 * scoutScores for a whole roster in one query (round 44) — the crown chase
 * scores every eligible bird every day, and a juvenile field can be thirty
 * birds wide per barn. Same numbers, batched read.
 */
export function scoutScoresMany(
  db: DB,
  birdIds: string[]
): Map<string, Record<FightFormat, number>> {
  const reports = new Lobbies(db, "scout").scoutReports(birdIds);
  return new Map(
    birdIds.map((id) => [
      id,
      Object.fromEntries(
        FORMAT_NAMES.map((f) => [f, reports.get(id)!.blades[f].score])
      ) as Record<FightFormat, number>,
    ])
  );
}

/**
 * Pick tonight's blade for a bird — discovery-first (round 28).
 *
 * Two moves, in order:
 *  1. EXPLORE: while any blade is still UNREAD (fewer than SCOUT.MIN_READS
 *     figures), sometimes card the least-read one. Without this a bird's
 *     first blade is self-fulfilling — the only blade with figures is the
 *     only one that ever scores above the prior, so it would be the only
 *     blade ever carded, and a B5 monster could live and die as a mediocre
 *     B1 bird.
 *  2. EXPLOIT: otherwise take the best score, with SCOUT.JITTER of judge
 *     error — imperfect reads keep the field spread across lobby keys, same
 *     job the old stat-scale jitter did.
 *
 * Shared with auto-play (round 17): every stable cards by style, which also
 * spreads the field across formats instead of piling into one lobby key.
 */
export function bestFormat(
  db: DB,
  bird: BirdView,
  rng: Rng,
  discoveryPolicy: DiscoveryPolicy = "current",
  allowed?: ReadonlySet<FightFormat>,
  // A prefetched report from Lobbies.scoutReports — pure query-saving (round
  // 44): the carding loops score a whole roster, so the caller batches the
  // read and hands each bird's report down. Identical numbers either way.
  report?: ScoutReport
): FightFormat {
  report ??= new Lobbies(db, "scout").scoutReport(bird.id);
  // ⚠ THE DRAW COUNT MUST NOT DEPEND ON `allowed` (round 31). Today's card
  // offers only some blades, so this now picks from a subset — but the jitter
  // below draws twice per blade inside a reduce, and shrinking the CANDIDATE
  // set would spend four draws instead of eight and shift every later decision
  // in that bot's day (breeding picks, claim rolls, weather holds). So the loop
  // still walks all five blades and an off-card one is scored to -Infinity
  // instead. Same discipline as the end-first branch below, which spends its
  // draw even when it discards the result.
  const offCard = (f: FightFormat) => allowed !== undefined && !allowed.has(f);
  const unread = FORMAT_NAMES.filter(
    (f) => report.blades[f].fights < SCOUT.MIN_READS && !offCard(f)
  );
  if (unread.length > 0 && rng() < SCOUT.EXPLORE) {
    const least = Math.min(...unread.map((f) => report.blades[f].fights));
    const targets = unread.filter((f) => report.blades[f].fights === least);
    // Always spend the draw, even when end-first discards it: matched policy
    // sims keep their later bot decisions on the same random stream.
    const randomTarget = targets[randInt(rng, 0, targets.length - 1)];
    if (discoveryPolicy === "current") return randomTarget;
    return END_FIRST_ORDER.find((f) => targets.includes(f))!;
  }
  const jitter = () => rng() * SCOUT.JITTER; // imperfect judges — bots misread the margin calls
  const score = (f: FightFormat) => (offCard(f) ? -Infinity : report.blades[f].score + jitter());
  return FORMAT_NAMES.reduce((best, cur) => (score(cur) > score(best) ? cur : best));
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
 * first (the Classic wants the stayer, not the highest total).
 *
 * `nerve` gates each blade for the bots (a breeder shows up less often than
 * a pit crew). Auto-play passes none — the Majors are the most +EV card on
 * the board, and a stable with the bodies to spare enters all three.
 */
/**
 * The DISCOVERY-YEAR chase (round 23): send qualified juveniles to Wednesday's
 * championship. No nerve check — the juvenile stage isn't hardcore, so there is
 * no reason on earth not to enter a bird that has earned its way in.
 *
 * ⚠ AND IT IS FREE, WHICH IS NOW A FACT RATHER THAN AN ASSUMPTION (round 41).
 * This said "costs nothing" and checked no wallet, which was true — but the
 * fee came off `PINTAKASI.ENTRY_FEE`, shared with the Majors, so the day the
 * Majors started charging this loop would have thrown on every entry and the
 * bare `catch` below would have eaten it. Twenty barns would have stopped
 * entering the division with nothing reported anywhere. The fee is per
 * division now (DIVISION_RULES) and the check below reads the juvenile one, so
 * it stays honest whichever way either knob moves.
 */
export function chaseJuvenileCrowns(db: DB, farmId: string, today: number): string[] {
  const tournaments = new Tournaments(db, farmId);
  const flock = new Flock(db, farmId);
  const entered: string[] = [];
  const blades = Tournaments.juvenileBladesOfWeek(Tournaments.targetWeek(today));
  // Zero today, so this is a no-op and costs one query a day — kept anyway,
  // because the alternative is the silent outage described above.
  const fee = DIVISION_RULES.juvenile.entryFee;
  if (fee > 0 && db.select().from(farms).where(eq(farms.id, farmId)).get()!.gp < fee) return entered;
  const qualified = flock
    .all()
    .filter((b) => b.status === "active" && b.named && b.age === 1)
    .filter((b) => b.wins >= JUVENILE_MAJOR.QUALIFYING_WINS);
  // One scout read for the whole field (round 44) — a juvenile field can be
  // thirty birds wide per barn, and this runs every day.
  const scores = scoutScoresMany(db, qualified.map((b) => b.id));

  // ⚠ EACH BIRD DECLARES FOR ONE CROWN FIRST — round 32 fixed a real bug here.
  //
  // This loop used to run BLADES on the outside, sending up to MAX_PER_BARN
  // birds to b2 and only then looking at b4. But a bird may hold one
  // championship entry per week (Tournaments.enter enforces it), so b2 — just
  // by being checked first — took every barn's two best juveniles and b4 got
  // whatever was left over. Measured across the round-31 sim: b2 fields of
  // 16-27 against b4 fields of 1-8. Nothing about the birds caused that; it
  // was the iteration order.
  //
  // The adult `chaseCrowns` below has always declared first for exactly this
  // reason. Same structure here, and it is also what the juvenile stage is
  // FOR — Zane, 2026-08-06: "The whole point of juvi season would be to at
  // least determine which extreme they are good at (B1/B2 vs. B4/B5)." The
  // crown a chick declares for IS that verdict.
  // `seated` keeps its original meaning — the birds THIS CALL got a seat for —
  // because the second pass deliberately skips them even if one is bumped
  // later in the same call. `pending` is the round-44 saving: a chick seated
  // on Monday used to be re-attempted every day after, and enter() threw
  // "already registered" at every one of them. Skipping a pending bird is the
  // same outcome without the throw; refreshed on success because our own
  // entry can bump our own weakest (see chaseCrowns below).
  const seated = new Set<string>();
  let pending = tournaments.myPendingBirdsThisWeek();
  const declared = new Map<FightFormat, BirdView[]>(blades.map((b) => [b, []]));
  for (const [i, bird] of qualified.entries()) {
    const s = scores.get(bird.id)!;
    const top = Math.max(...blades.map((b) => s[b]));
    // A TRUE B3 BIRD READS THE TWO CROWNS DEAD EVEN, and there is no crown at
    // b3 to send it to — Zane: "if it's a true B3 bird, that's a wont-solve
    // scenario and they'll simply opt into B2 or B4 based on the data
    // available." So ties spread round-robin rather than falling to the first
    // blade, which would rebuild the very imbalance this fix removes.
    const tied = blades.filter((b) => s[b] === top);
    declared.get(tied[i % tied.length])!.push(bird);
  }

  for (const blade of blades) {
    let sent = 0;
    for (const bird of declared
      .get(blade)!
      .filter((b) => !seated.has(b.id) && !pending.has(b.id)) // both only ever threw — see above
      .sort((a, b) => scores.get(b.id)![blade] - scores.get(a.id)![blade])) {
      if (sent >= JUVENILE_MAJOR.MAX_PER_BARN) break;
      try {
        tournaments.enter(bird.id, blade, "juvenile");
        entered.push(bird.name);
        seated.add(bird.id);
        pending = tournaments.myPendingBirdsThisWeek();
        sent++;
      } catch {
        /* already in this week, barn cap, or not qualified */
      }
    }
  }

  // Then a SECOND pass over anyone who didn't get a seat at the crown they
  // declared for — their barn was already full there. A qualified juvenile
  // with a free crown standing empty should stand in it: the stage costs
  // nothing and isn't hardcore, so a second-choice blade beats no blade.
  for (const blade of blades) {
    let sent = tournaments.myEntriesThisWeek(blade);
    for (const bird of qualified.filter((b) => !seated.has(b.id) && !pending.has(b.id))) {
      if (sent >= JUVENILE_MAJOR.MAX_PER_BARN) break;
      try {
        tournaments.enter(bird.id, blade, "juvenile");
        entered.push(bird.name);
        seated.add(bird.id);
        pending = tournaments.myPendingBirdsThisWeek();
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
  // ROUND 37 — APPETITE, NOT A GATE. Until now this mirrored an engine rule:
  // the crowns demanded 3 qualification points, so the bot filtered on them
  // and every rejected bird was a call enter() would have thrown on anyway.
  // Thursday is open now, and the engine will happily take an unraced age-3
  // bird into a HARDCORE bracket, so the restraint has to live here instead.
  //
  // The bot's rule is one proven real win. It is deliberately far looser than
  // the 3 points it replaces — that is the point of opening Thursday up — but
  // it is not nothing: a bird with no record has no earnings, so the Selection
  // Committee seats it last anyway, and feeding a total unknown into a bracket
  // that force-retires losers is how a bot culls its own barn. Everything
  // above this line is the barn deciding; the committee decides the rest.
  //
  // ⚠ THIS WAS A FULL `birds` SCAN UNTIL ROUND 43, and it was the most expensive
  // line in the simulation. `db.select().from(birds).all()` then filtered in JS —
  // every bot, EVERY DAY (chaseCrowns is not gated on crown day), over a table
  // that grows all run. On a 91-day world that is 1,820 whole-table
  // materializations of ~1,300 thirty-column rows to find the handful belonging
  // to one barn. The measured symptom was a day taking 1s at the start of a run
  // and 14s at the end; the predicate belongs in SQL, where `ix_birds_farm_status`
  // already covers the farm side.
  const proven = new Set(
    db
      .select({ id: birds.id })
      .from(birds)
      .where(
        and(
          eq(birds.farmId, farmId),
          gte(birds.stakesWins, CROWN_CHASE.CROWN_MIN_REAL_WINS)
        )
      )
      .all()
      .map((b) => b.id)
  );
  const eligible = flock
    .all()
    .filter((b) => b.status === "active" && b.named && canHardcore(b.age) && proven.has(b.id));
  if (eligible.length === 0) return entered;

  // Each bird declares for the running blade it reads BEST at — that's the
  // specialist rule, and it stops a shallow barn from piling its whole
  // roster into whichever crown happens to be checked first. Declared on
  // the SCOUT scores (round 28): a Major is hardcore, so the read is the
  // demonstrated form, deterministic — nobody experiments in the ring that
  // retires losers.
  const scores = scoutScoresMany(db, eligible.map((b) => b.id));
  const declared = new Map<FightFormat, BirdView[]>(blades.map((b) => [b, []]));
  for (const [i, bird] of eligible.entries()) {
    // Exact ties spread ROUND-ROBIN across the tied crowns. With the fog
    // down (round 28) a barn of unraced veterans reads every blade at the
    // prior — under a first-blade tie-break the whole roster would declare
    // for the same crown and leave the other two brackets short.
    const s = scores.get(bird.id)!;
    const top = Math.max(...blades.map((b) => s[b]));
    const tied = blades.filter((b) => s[b] === top);
    declared.get(tied[i % tied.length])!.push(bird);
  }

  // ⚠ THIS CHECK HAD NEVER RUN UNTIL ROUND 41. Entry was free from round 22,
  // so `PINTAKASI.ENTRY_FEE > 0` short-circuited before the wallet was ever
  // read — the guard was written for a paid season that hadn't arrived. It has
  // arrived, and it takes 80 GP a bird now, up to MAX_PER_BARN × three crowns
  // a week off the top of a barn's money.
  //
  // ⚠ READ THE FEE FROM THE DIVISION, NOT FROM `PINTAKASI` — the same coupling
  // round 41 just took out of `findOrOpen`. Correct today only by coincidence
  // (majors only, and the knob matches every open row); wrong in exactly the
  // case the per-entry escrow exists for, since a mid-season reprice leaves
  // last week's rows stamped at the old price while the bot budgets against
  // the new one.
  const fee = DIVISION_RULES.major.entryFee;
  const canAfford = () =>
    db.select().from(farms).where(eq(farms.id, farmId)).get()!.gp >= fee + reserve;

  // Birds already holding a seat this week — attempting one only ever throws
  // "already registered", and both passes below used to pay that throw for
  // every seated bird, every blade, every day (round 44). Skipping one is the
  // identical outcome — but the set must be REFRESHED after every success,
  // not merely appended to: our own entry can bump our own weakest bird
  // (enter() re-reads the wallet for exactly this case), and a bumped bird is
  // pending no more — the old code would re-enter it in pass 2, so a stale
  // snapshot here would silently un-declare it. Successes are capped at
  // MAX_PER_BARN × blades a day, so the refresh costs nothing that matters.
  let seated = tournaments.myPendingBirdsThisWeek();
  const send = (blade: FightFormat, candidates: BirdView[]): void => {
    let sent = tournaments.myEntriesThisWeek(blade);
    for (const bird of candidates.sort(
      (a, b) => scores.get(b.id)![blade] - scores.get(a.id)![blade]
    )) {
      if (sent >= PINTAKASI.MAX_PER_BARN) break;
      if (seated.has(bird.id)) continue;
      if (!canAfford()) return; // this crown is out of reach — try the next one
      try {
        tournaments.enter(bird.id, blade);
        entered.push(bird.name);
        seated = tournaments.myPendingBirdsThisWeek();
        sent++;
      } catch {
        /* already committed elsewhere, barn full, or the committee said no */
      }
    }
  };

  const chosen = blades.filter((b) => opts.nerve === undefined || rng() < opts.nerve);
  // ⚠ A BARN THAT RUNS SHORT SKIPS A CROWN, IT DOES NOT GO HOME. `send` used
  // to return false on an empty wallet and both loops below `return entered`
  // on it — which was harmless at a free entry and would be a real bug at 80
  // GP: a barn that couldn't afford its THIRD blade would abandon the two it
  // could. The passes run to the end now, and each entry is priced on its own.
  // Pass 1: specialists into their own blade.
  for (const blade of chosen) send(blade, [...declared.get(blade)!]);
  // Pass 2: anyone still idle fills a crown that's short — up to MAX_PER_BARN
  // per blade. A body in a bracket beats a body in the barn.
  for (const blade of chosen) send(blade, [...eligible]);
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
