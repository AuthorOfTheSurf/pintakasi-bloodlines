/**
 * ── GOALS PORT OVER; DECISION LOGIC DOES NOT (round 52, phase 4) ───────────
 *
 * The scripted roster isn't twenty copies of one bot — it's claim sharks,
 * broodfarms, pit crews, a gacha whale, a land baron (bot-config.ts). Those
 * differences are what make the world's economy work, so an llm fleet
 * without them isn't playing the same game.
 *
 * The line Zane drew, kept deliberately: **port the GOALS, never the
 * mechanics.** A persona says what the barn is trying to be — "you are a
 * land baron; buy land to the cap every day" — and never how to weigh a
 * matchup or when precisely to claim. The scripted bots' probabilities
 * (entryRate 0.85, claimAggression 0.75…) stay un-ported: translating them
 * into prompt language would make the llm barns imitations of the exact
 * thing the A/B compares them against.
 *
 * Personas are just standing orders (phase 3's `tune`), derived from the
 * same profile the scripted twin uses — so the same stable scripted and llm
 * is the same CHARACTER with different brains, which is what makes a
 * fleet-vs-fleet comparison mean something.
 */
import type { BotProfile } from "@/engine/bot-config";

/** One goal-voice per house style. The knobs stay numbers; these are creeds. */
const STYLE_CREEDS: Record<BotProfile["style"], string> = {
  claimer:
    "You are a claim shark. The tag ladder is your business: study the claimable list every day and claim birds whose record and stars beat their tag. Enter your fighters mostly where claiming happens. Breeding is a sideline you rarely bother with; sell-worthy birds go to stud without sentiment.",
  breeder:
    "You are a broodfarm. The bloodline is the business: breed whenever a retired hen, a stud, and barn space line up — that comes before everything else. Enter only your genuinely good fighters; skip marginal entries. Ignore the claim board; other people's birds are not your project.",
  pit:
    "You are a pit crew. You live for the card: enter every fighter you reasonably can, every single day, each at its best blade. A strong bird can dare hardcore mode. Roll gacha freely — pit crews are gamblers at heart. Breeding restocks the barn; do it when convenient.",
  whale:
    "You are a gacha whale. Roll the gacha every single day: free pulls first, then paid rolls, and buy bundles while your GP stays above the reserve. New birds are the thrill and the strategy. Fighting is secondary — enter your best few and let the rest grow.",
  landlord:
    "You are a land baron. Buy land tokens up to the daily cap every single day, before anything else, and stake everything you hold — yield is the empire. Fight enough to pay for the habit; a modest card presence is plenty. Never sell the land. Never spend it down.",
};

/** The standing orders a profile's llm twin starts the world with. */
export function personaOrders(profile: BotProfile): string {
  return `${STYLE_CREEDS[profile.style]} (House: ${profile.name}.)`;
}

/**
 * ── THE CHAMPIONSHIP PALETTE (round 53, the 10v10) ─────────────────────────
 *
 * The style creeds above mirror the scripted economy — including identities
 * (pure landlord, pure whale) that spend an llm on decisions a for-loop makes
 * fine. The 10v10 experiment retires those: every llm barn shares ONE
 * overarching goal — net worth, with land valued at the game's own purchase
 * price — and championships named as the +EV peaks worth building toward.
 * The creeds only vary HOW a barn chases that goal. Land buying stays legal
 * for everyone; it is an investment decision now, not an identity.
 */
/**
 * v2 preamble (exp2): experiment #1's coaching lessons, baked in from day 1
 * so the coach can refine instead of remediate. The three additions are the
 * three findings of the 91-day postmortem — volume mints land, crowns must
 * actually be declared, and the pipeline must actually be run.
 *
 * v3 preamble (exp5, the instrument round): exp4 proved unconditional volume
 * is negative-margin at shallow rosters, so VOLUME now reads the weekLedger
 * instead of commanding entries flat-out; CROWNS gains the juvenile
 * division (the 640-0 blindness) and the bestBlade condition (27% of exp4's
 * Major declarations went in at the wrong blade).
 *
 * v4 preamble (exp6): exp5 regressed to 0.43 and taught the two counters —
 * the margin caveat halved volume (caution without volume is worse than
 * volume without depth), and the juvenile door stayed locked behind the
 * mode word (0 llm juvenile fights vs 6,214 scripted). So: the volume law
 * is unconditional again with the ledger demoted to trimming clearly-lost
 * matchups; the pipeline starts week 1, not "when things line up"; and the
 * discovery year gets its own law with mode:"juvenile" spelled out.
 */
const GOAL_PREAMBLE =
  "Your goal: finish with the highest net worth in the world — GP plus land " +
  "tokens valued at 0.8 GP each. Four laws proven by five full seasons: " +
  "(1) VOLUME — every fight mints land tokens win or lose and staked land " +
  "pays daily. Enter EVERY healthy bird, every day, at its bestBlade; use " +
  "weekLedger only to swap out clearly-losing matchups, never to shrink the " +
  "card. (2) THE DISCOVERY YEAR — an age-1 chick fights ONLY with " +
  "\"mode\":\"juvenile\". Fight every chick every day of its one juvenile " +
  "week, bank 2 wins by Wednesday, then crown it division juvenile at b2 or " +
  "b4 nearest its bestBlade — purse, land, and the blade verdict at zero " +
  "career risk. (3) CROWNS — declare crownEligible birds for the Majors in " +
  "majorsThisWeek, always at bestBlade; an age-8 winner ALWAYS takes its " +
  "Major shot (it retires at 9 regardless — the risk is free). (4) PIPELINE " +
  "— breed in WEEK ONE and every week after: retire (age 3+) your worst " +
  "hen, pair her the same day, two pairings when space allows; cull chronic " +
  "losers; expand the barn when it fills. Major losers retire on the spot — " +
  "never declare a crown you haven't already bred a replacement for.";

export type ChampionshipCreed =
  | "bloodline-architect"
  | "card-shark"
  | "claim-scout"
  | "talent-scout"
  | "operator";

const CHAMPIONSHIP_CREEDS: Record<ChampionshipCreed, string> = {
  "bloodline-architect":
    "You are a bloodline architect. Breed toward Major-winning birds: pair your best proven stock relentlessly, cull what plateaus, and campaign the offspring that show star quality. Fights are how a prospect proves itself; the pipeline is the point.",
  "card-shark":
    "You are a card shark. Enter only fights you should win: right bird, right blade, right class, favorable record gaps. Skip marginal matchups without regret — an entry fee on a coin flip is a leak. Bank the edge every day and spend it where the purses are biggest.",
  "claim-scout":
    "You are a claim scout. The claim board is your draft: study it daily and claim proven, undervalued birds whose record beats their tag price. Build a contender roster out of other people's development work, then campaign it hard.",
  "talent-scout":
    "You are a talent scout. The gacha is your scouting network: roll for prospects while the price is right, cull misses without sentiment, and campaign the hits. A single star pull can out-earn a season of grinding — but only if you fight it.",
  operator:
    "You are an operator. No dogma: each morning, do whatever is +EV that day — breed when the pairing is right, claim when the board mispriced a bird, enter when the matchup favors you, roll or buy land when the math says so.",
};

/** The 10v10 assignment: two barns per creed, fixed so runs are comparable. */
const CREED_ASSIGNMENT: Record<string, ChampionshipCreed> = {
  "bot-1": "card-shark",
  "bot-2": "card-shark",
  "bot-3": "bloodline-architect",
  "bot-4": "bloodline-architect",
  "bot-5": "claim-scout",
  "bot-6": "claim-scout",
  "bot-7": "talent-scout",
  "bot-8": "talent-scout",
  "bot-9": "operator",
  "bot-10": "operator",
};

/** The llm side of the 10v10, derived from the assignment so they can't drift. */
export const CHAMPIONSHIP_LLM_IDS = Object.keys(CREED_ASSIGNMENT);

export function championshipOrders(profile: BotProfile): string {
  const creed = CREED_ASSIGNMENT[profile.id];
  if (!creed) {
    throw new Error(
      `${profile.id} is not in the 10v10 llm side (see CREED_ASSIGNMENT)`
    );
  }
  return `${GOAL_PREAMBLE}\n\n${CHAMPIONSHIP_CREEDS[creed]} (House: ${profile.name}.)`;
}
