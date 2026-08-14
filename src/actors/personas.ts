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
 * same profile the scripted twin uses — so bot-5 scripted and bot-5 llm
 * are the same CHARACTER with different brains, which is what makes a
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
