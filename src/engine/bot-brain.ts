/**
 * ── THE OUTSIDE DECIDER (round 49) ─────────────────────────────────────────
 *
 * `bots.ts` plays a stable by *being* it: `playFarm` reads the wallet,
 * decides, writes, re-reads the wallet, decides again. Decision and effect
 * are the same statement, which is exactly why it is fast and exactly why a
 * model cannot live there — an LLM call is async and takes seconds, and
 * `game.ts` runs the entire tick inside ONE better-sqlite3 transaction on
 * purpose (round 35: "a day either happens or it doesn't"). Nineteen barns
 * thinking for eight seconds each would hold a write transaction open for
 * two minutes with the conservation proof hostage to a network timeout.
 *
 * So an outside decider works in two phases, and the split is the whole
 * design:
 *
 *   1. COLLECT — outside the transaction, async. Every llm barn is handed a
 *      view of what it can see and hands back a list of actions it wants.
 *      Slow, parallel, and allowed to fail.
 *   2. APPLY — inside the transaction, synchronous. The engine replays those
 *      actions through the same public APIs a player uses, in a fixed order,
 *      taking `no` for an answer exactly as `playFarm` does.
 *
 * Atomicity survives, the conservation proof survives, and the barn never
 * touches the database: it reads its mail and answers. A scripted bot is a
 * function the engine calls; an llm barn is a correspondent the engine
 * writes to. Same rules bind both.
 *
 * ⚠ NOTHING HERE RUNS UNLESS A FARM CARRIES `brain = 'llm'`, and nothing
 * seeds one. A default world — every test, every `bun run simulate`, every
 * `doctor` run — never reaches this file, which is what keeps
 * determinism.test.ts, replay.test.ts and playthrough.test.ts honest.
 */
import { and, eq, gt, gte } from "drizzle-orm";
import type { DB } from "@/db/client";
import { battleLog, birds, farms, gameState, tournamentEntries } from "@/db/schema";
import { CROWN_CHASE } from "./bot-config";
import { ECONOMY, JUVENILE_MAJOR, LT_CENTS } from "./config";
import { canHardcore } from "./lifecycle";
import type { BotDayReport } from "./bots";
import { Breeding } from "./breeding";
import { Farms } from "./farms";
import { Flock } from "./flock";
import { Gacha } from "./gacha";
import { Lobbies, type LobbySpec } from "./lobbies";
import { Tournaments, type Division } from "./tournaments";
import { barnCapacity, cardOfDay, weatherOfDay, type CardKey, type Element } from "./config";
import type { FightFormat, FightMode, Lobby } from "./config";
import { drawStarterNames } from "./naming";
import { mulberry32, type Rng } from "./rng";

/**
 * ── THE VERB MENU ──────────────────────────────────────────────────────────
 *
 * One entry per thing a stable can DO in a day, and deliberately nothing
 * more: every action here maps to a single public engine call that a human
 * player reaches through the same door. There is no verb for "read the
 * board" — reading already happened when the view was built. A barn proposes
 * effects, not queries.
 *
 * `do` rather than `type` because the field is going into a model prompt and
 * a JSON schema, where "do" reads as an instruction and "type" reads as
 * metadata. Small thing; it measurably helps a small model.
 */
export type BotAction =
  | { do: "check_in" }
  | { do: "roll_gacha" }
  | { do: "buy_bundle" }
  | { do: "buy_land"; tokens: number }
  | { do: "stake"; tokens: number }
  | { do: "unstake"; tokens: number }
  | { do: "expand_barn" }
  | { do: "retire"; birdId: string }
  | { do: "list_stud"; birdId: string }
  | { do: "breed"; motherId: string; fatherId: string }
  | { do: "enter"; birdId: string; mode: FightMode; classType: Lobby; format: FightFormat; price?: number }
  | { do: "claim"; entryId: number }
  | { do: "crown"; birdId: string; format: FightFormat; division?: Division };

/** Every verb name, for building a schema or a prompt without repeating this list. */
export const BOT_VERBS = [
  "check_in",
  "roll_gacha",
  "buy_bundle",
  "buy_land",
  "stake",
  "unstake",
  "expand_barn",
  "retire",
  "list_stud",
  "breed",
  "enter",
  "claim",
  "crown",
] as const satisfies readonly BotAction["do"][];

/**
 * ── THE MAIL ───────────────────────────────────────────────────────────────
 *
 * What a barn is told when its turn opens. Everything here is information a
 * human player has on the same morning and NOTHING else — the fog rules of
 * round 28 are not re-implemented here, they are inherited: `Flock.view`
 * already nulls a live bird's six stats for everyone including its owner,
 * and `Lobbies.board` already hides who is entered outside the claimer
 * classes. Building the view out of the same public methods the web UI calls
 * is what makes that guarantee free instead of a thing to remember.
 */
export interface BotView {
  day: number;
  weather: { today: Element; tomorrow: Element };
  card: { today: CardKey[]; tomorrow: CardKey[] };
  farm: {
    id: string;
    name: string;
    gp: number;
    landTokensCents: number;
    stakedLandCents: number;
    freePulls: number;
    checkedInToday: boolean;
    barn: { count: number; capacity: number };
  };
  /** The barn's own flock, fogged exactly as the owner sees it in the UI. */
  flock: ReturnType<Flock["view"]>[];
  /**
   * The board at exactly the two detail levels a SCRIPTED bot gets — `fills`
   * for the general read (how full each posted key is, without who is in it)
   * and the claimer `field` (visible entrants, because a claim is placed on a
   * named bird before the fight). Matching the scripted bots here is not
   * tidiness: give an llm barn a richer board and the comparison between the
   * two brains stops measuring the brains.
   */
  board: ReturnType<Lobbies["board"]>;
  claimerBoard: ReturnType<Lobbies["board"]>;
  /** The scout's read per active bird: where the evidence says it belongs. */
  scout: Record<string, ReturnType<Lobbies["scoutReport"]>>;
  /**
   * This week's Majors, and which of MY birds clear the bar to declare
   * (round 53, the day-56 instrument fix). The 10v10 found the blind spot
   * the hard way: the coach ordered "declare for a Major crown whenever a
   * bird qualifies," and 280 calls later the crown verb had been used zero
   * times — because nothing in the view mentioned the tournament. Scripted
   * bots reach into the db for this (`chaseCrowns`); an outside brain only
   * knows what its mail says. Facts in the brief, skill in the standing
   * orders — this is the facts half. Eligibility mirrors chaseCrowns
   * exactly: active, named, hardcore age, ≥ CROWN_MIN_REAL_WINS real wins.
   *
   * The juvenile pair is exp5's instrument fix, and it is the SAME bug a
   * second time: exp4 closed with scripted barns holding 640 juvenile-crown
   * entries against the llm side's zero — not because the llms declined the
   * discovery stage but because their mail never mentioned it existed. The
   * verb had supported `division: "juvenile"` all along. Eligibility mirrors
   * chaseJuvenileCrowns exactly: active, named, age 1, ≥ QUALIFYING_WINS
   * juvenile wins.
   */
  crowns: {
    weekFormats: FightFormat[];
    eligibleBirdIds: string[];
    juvenileFormats: FightFormat[];
    juvenileEligibleBirdIds: string[];
  };
  /**
   * The stud MARKET (exp8 — instrument gap #7, the pipeline killer). The
   * brief's `studs` list has only ever shown the barn's OWN retired
   * roosters, while every scripted bot breeds by shopping OTHER farms'
   * listed studs ("bots shop other farms' listed studs like anyone else").
   * Result across seven experiments: llm breed proposals failed for want
   * of a legal father the mail never showed — exp8 day 28: 18 proposals,
   * 0 eggs. The engine has always accepted a cross-farm listed stud; only
   * the visibility was missing.
   */
  studMarket: { id: string; name: string; stars: number; farm: string }[];
  /**
   * The last seven days' fight economics (exp5). Exp4 proved the model will
   * follow a volume law straight through zero: fees appear at entry time and
   * purses at settle time, never side by side, so profitability was
   * invisible and 2,460 fights ran at a negative margin without one barn
   * noticing. Three numbers make margin a fact instead of a vibe: net GP
   * from the daily card (stakes won minus stakes lost — battle_log already
   * nets each fight), crown fees paid, crown purses won.
   */
  ledger: { cardNetGp: number; crownFeesGp: number; crownWinningsGp: number };
}

/** An outside brain: given what the barn can see, say what it wants to do. */
export type BotDecider = (view: BotView) => Promise<BotAction[]>;

/**
 * Build the day's mail for one farm.
 *
 * Read-only and cheap enough to call per barn per tick. Deliberately built
 * from the same public engine methods the routes use — see the fog note on
 * `BotView`.
 */
export function buildView(db: DB, farmId: string): BotView {
  const day = db.select().from(gameState).where(eq(gameState.id, 1)).get()!.dayIndex;
  const farmsApi = new Farms(db);
  const flock = new Flock(db, farmId);
  const lobbies = new Lobbies(db, farmId);
  const row = farmsApi.rowById(farmId);
  const mine = flock.all();
  const scout: BotView["scout"] = {};
  for (const bird of mine) {
    if (bird.status !== "active") continue;
    scout[bird.id] = lobbies.scoutReport(bird.id);
  }
  return {
    day,
    weather: { today: weatherOfDay(day), tomorrow: weatherOfDay(day + 1) },
    card: { today: cardOfDay(day), tomorrow: cardOfDay(day + 1) },
    farm: {
      id: row.id,
      name: row.name,
      gp: farmsApi.view(row).gp,
      landTokensCents: row.landTokensCents,
      stakedLandCents: row.stakedLandCents,
      freePulls: row.freePulls,
      checkedInToday: farmsApi.view(row).checkedInToday,
      barn: { count: flock.barnCount(), capacity: barnCapacity(row.barnExpansions) },
    },
    flock: mine,
    board: lobbies.board({ detail: "fills" }),
    claimerBoard: lobbies.board({ classType: "claimer", detail: "field" }),
    scout,
    crowns: (() => {
      // Same facts chaseCrowns reads, through the same indexed query.
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
      return {
        weekFormats: Tournaments.bladesOfWeek(Tournaments.targetWeek(day)),
        eligibleBirdIds: mine
          .filter(
            (b) =>
              b.status === "active" && b.named && canHardcore(b.age) && proven.has(b.id)
          )
          .map((b) => b.id),
        juvenileFormats: Tournaments.juvenileBladesOfWeek(Tournaments.targetWeek(day)),
        juvenileEligibleBirdIds: mine
          .filter(
            (b) =>
              b.status === "active" &&
              b.named &&
              b.age === 1 &&
              b.wins >= JUVENILE_MAJOR.QUALIFYING_WINS
          )
          .map((b) => b.id),
      };
    })(),
    studMarket: db
      .select()
      .from(birds)
      .where(and(eq(birds.sex, "male"), eq(birds.status, "retired"), eq(birds.listedStud, 1)))
      .all()
      .filter((b) => b.farmId !== farmId)
      .sort((a, b) => b.halfStars - a.halfStars)
      .slice(0, 12)
      .map((b) => ({
        id: b.id,
        name: b.name,
        stars: b.halfStars / 2,
        farm: b.farmId,
      })),
    ledger: (() => {
      const since = day - 7;
      // battle_log nets each daily-card fight (win = stake minus rake, loss =
      // -stake); tournament fights write 0 there and settle through
      // tournament_entries instead, so the two sources never double-count.
      const cardNetCents = db
        .select({ v: battleLog.gpDeltaCents })
        .from(battleLog)
        .where(and(eq(battleLog.farmId, farmId), gt(battleLog.dayIndex, since)))
        .all()
        .reduce((sum, r) => sum + r.v, 0);
      const crownRows = db
        .select({
          fee: tournamentEntries.fee,
          won: tournamentEntries.gpWonCents,
          status: tournamentEntries.status,
        })
        .from(tournamentEntries)
        .where(and(eq(tournamentEntries.farmId, farmId), gt(tournamentEntries.dayEntered, since)))
        .all()
        // A refunded or bumped entry got its fee back — money that came home
        // is not a cost, and counting it would overstate the crown bill.
        .filter((r) => r.status !== "refunded" && r.status !== "bumped");
      return {
        cardNetGp: Math.round(cardNetCents / 100),
        crownFeesGp: crownRows.reduce((sum, r) => sum + r.fee, 0),
        crownWinningsGp: Math.round(crownRows.reduce((sum, r) => sum + r.won, 0) / 100),
      };
    })(),
  };
}

/**
 * ── COLLECT ────────────────────────────────────────────────────────────────
 *
 * Runs OUTSIDE the tick's transaction — that is the entire point of this
 * function existing separately from `applyProposals`. Call it, await it,
 * then hand what it returns to `tickDay`.
 *
 * Fans out across every llm barn at once. That is not only faster: a local
 * model has to be loaded into memory before it can answer, and the load
 * costs far more than the answer does, so waking every barn in the same
 * moment means one load serves the whole roster. The tick was already
 * shaped this way for its own reasons; the clustering comes free.
 *
 * A barn whose decider throws or hangs simply proposes nothing and sits the
 * day out — the same shape as a scripted bot whose every action is refused.
 * One broken brain must never take the world down with it.
 */
export async function collectProposals(
  db: DB,
  decide: BotDecider | null
): Promise<Map<string, BotAction[]>> {
  const out = new Map<string, BotAction[]>();
  if (!decide) return out;
  const llmFarms = db.select().from(farms).where(eq(farms.brain, "llm")).all();
  if (llmFarms.length === 0) return out;

  const views = llmFarms.map((row) => ({ id: row.id, view: buildView(db, row.id) }));
  const settled = await Promise.allSettled(views.map(({ view }) => decide(view)));
  for (const [i, result] of settled.entries()) {
    if (result.status === "fulfilled") out.set(views[i].id, result.value);
    else console.warn(`[bot-brain] ${views[i].id} proposed nothing: ${result.reason}`);
  }
  return out;
}

/**
 * ── APPLY ──────────────────────────────────────────────────────────────────
 *
 * Replays a barn's proposed day through the public engine APIs, inside the
 * tick's transaction.
 *
 * Three rules that make this safe to hand a language model:
 *
 * 1. `quietly` — every action is attempted and every refusal is swallowed,
 *    exactly as `bots.ts` and `auto-play.ts` do. A barn that proposes a
 *    breed it cannot afford gets told no and moves on. This is the reason an
 *    unreliable decider cannot corrupt a world: the house rules are enforced
 *    at the same door for everybody, and the only cost of a bad idea is a
 *    wasted line.
 * 2. FIXED ORDER, not proposal order. Actions are grouped and run in the
 *    same sequence a scripted day uses (settle the ritual, then the barn,
 *    then the breeding shed, then the card). A model that lists `enter`
 *    before `check_in` should not get a worse day than one that happens to
 *    list them the other way round, and a model that discovers it can
 *    reorder its way into an advantage has found a bug, not a strategy.
 * 3. CAPPED. `MAX_ACTIONS` bounds a runaway reply — a model stuck in a loop
 *    proposing the same claim four hundred times costs one tick, not a world.
 *
 * The dice stay seeded. `rng` here is derived from the day index exactly as
 * `Bots.playDay` derives it, so gacha outcomes remain reproducible GIVEN the
 * same action list. The model's choices are not replayable; the world's dice
 * still are, which keeps a surprising result attributable to the decision
 * rather than the draw.
 */
const MAX_ACTIONS = 200;

/** Actions run in this order regardless of the order proposed — see rule 2. */
const ORDER: BotAction["do"][] = [
  "check_in",
  "roll_gacha",
  "buy_bundle",
  "buy_land",
  "unstake",
  "expand_barn",
  // Retire BEFORE breed — the exp5 day-28 finding: a barn that culls a loser
  // into the shed this morning should be able to pair her the same day.
  "retire",
  "list_stud",
  "breed",
  "enter",
  "crown",
  "claim",
  "stake",
];

export function applyProposals(
  db: DB,
  farmId: string,
  actions: readonly BotAction[],
  rng: Rng
): BotDayReport {
  const farmsApi = new Farms(db);
  const flock = new Flock(db, farmId);
  const breeding = new Breeding(db, farmId, rng);
  const lobbies = new Lobbies(db, farmId);
  const tournaments = new Tournaments(db, farmId);
  const gacha = new Gacha(db, farmId, rng);
  const row = farmsApi.rowById(farmId);

  const report: BotDayReport = {
    farm: row.name,
    style: "llm",
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

  const quietly = (fn: () => void): boolean => {
    try {
      fn();
      return true;
    } catch {
      return false; // a house rule said no — an llm barn takes no for an answer too
    }
  };

  // THE NAMING LAW, applied as bookkeeping (exp7 day-56 — instrument gap
  // #6): no bird fights under an auto-name (Lobbies.enter throws), and both
  // the scripted bots and auto-play christen hatchlings as a pre-card CHORE
  // — but this path had no naming affordance at all, so exp7's month-two
  // chicks were silently unenterable: 76 juvenile proposals, 0 landed, and
  // the only tell was `named: 0` in the db. Christening is a chore, not a
  // strategy — it lives here with the plumbing rather than spending model
  // tokens on inventing cockfighting names.
  for (const bird of flock.all().filter((b) => b.status === "active" && !b.named)) {
    quietly(() => void flock.rename(bird.id, drawStarterNames(db, 1, rng)[0]));
  }

  // CHECK-IN, same doctrine (round 63, spec decision #1): the daily-login
  // reflex measures nothing as a model decision — eight experiments never
  // saw a barn meaningfully forget it. Scripted bots and auto-play treat it
  // as a reflex; now this path does too. The verb stays in the grammar
  // (legacy replies and offMenu still carry it) and lands harmlessly on the
  // sticky report below.
  report.checkedIn = quietly(() => void farmsApi.checkIn(farmId));

  const sorted = [...actions]
    .slice(0, MAX_ACTIONS)
    .sort((a, b) => ORDER.indexOf(a.do) - ORDER.indexOf(b.do));

  for (const action of sorted) {
    switch (action.do) {
      case "check_in":
        // STICKY, not assigned. A decider that proposes check_in twice would
        // otherwise have its successful first attempt overwritten by the
        // second one's refusal, and report a day it did not have — found by
        // the runaway-reply test, which is exactly the shape of input a
        // looping model produces.
        report.checkedIn ||= quietly(() => void farmsApi.checkIn(farmId));
        break;
      case "roll_gacha":
        if (quietly(() => void gacha.roll())) report.paidPulls++;
        break;
      case "buy_bundle":
        // A bundle is BUNDLE_ROLLS pulls, and the adoption read compares
        // this count against the scripted bots' — which count every roll.
        if (quietly(() => void gacha.bundle())) report.paidPulls += ECONOMY.BUNDLE_ROLLS;
        break;
      case "buy_land":
        if (quietly(() => void farmsApi.buyLand(farmId, action.tokens)))
          report.landBought += action.tokens;
        break;
      case "stake":
        // stake() takes whole tokens; the report field is cent-based, as
        // the name says — bots.ts converts the same way.
        if (quietly(() => void farmsApi.stake(farmId, action.tokens)))
          report.stakedLandCents += action.tokens * LT_CENTS;
        break;
      case "unstake":
        quietly(() => void farmsApi.unstake(farmId, action.tokens));
        break;
      case "expand_barn":
        quietly(() => void farmsApi.expandBarn(farmId));
        break;
      case "retire":
        // The exp5 day-28 instrument fix, third of its kind: the cull law
        // ordered "retire chronic losers to the breeding shed" while the verb
        // menu had no retire — a prompt commanding an action the barn could
        // not express. Same public API the web route and MCP call; the engine
        // still says no to a bird under age 3 (manual retirement unlocks with
        // hardcore, lifecycle.ts).
        quietly(() => void flock.retire(action.birdId));
        break;
      case "list_stud":
        if (quietly(() => void breeding.listStud(action.birdId))) report.studsListed++;
        break;
      case "breed":
        quietly(() => {
          const { egg } = breeding.breed(action.motherId, action.fatherId);
          report.bred.push(egg.name);
        });
        break;
      case "enter": {
        const spec: LobbySpec = {
          mode: action.mode,
          classType: action.classType,
          format: action.format,
          ...(action.price === undefined ? {} : { price: action.price }),
        };
        const ok = quietly(() => void lobbies.enter(action.birdId, spec));
        if (ok)
          report.entered.push({
            bird: flock.byId(action.birdId).name,
            mode: action.mode,
            classType: action.classType,
            format: action.format,
            ...(action.price === undefined ? {} : { price: action.price }),
          });
        // The day's card had nothing for this bird — the same signal the
        // scripted bots report, so the doctor's read of a stranded class
        // covers llm barns without knowing they exist.
        else report.noCard++;
        break;
      }
      case "crown":
        quietly(() => {
          tournaments.enter(action.birdId, action.format, action.division ?? "major");
          report.crowns.push(flock.byId(action.birdId).name);
        });
        break;
      case "claim":
        if (quietly(() => void lobbies.claim(action.entryId))) report.claimsPlaced++;
        break;
    }
  }
  return report;
}

/**
 * The rng a barn's applied day draws from — the same derivation
 * `Bots.playDay` uses, so an llm barn sits in the world's dice stream the
 * way a scripted one does rather than off to the side of it.
 */
export function brainRng(today: number, index: number): Rng {
  return mulberry32((today + 1) * 7919 + (index + 1) * 104729);
}
