import { NextRequest } from "next/server";
import {
  McpServer,
  WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import { db } from "@/db/client";
import { seedStarterFlock } from "@/db/seed-data";
import {
  AGE,
  BARN,
  BATTLE,
  BREEDING_SHAPES,
  CARRIAGES,
  CLAIMER,
  COVERS,
  DISTANCE_STATS,
  ECONOMY,
  FARM_COLORS,
  FIGURE,
  FORMATS,
  FORMAT_NAMES,
  GACHA_BIRDS,
  GACHA_TOKENS,
  GACHA_WEIGHTS,
  JUVENILE_MAJOR,
  LAND,
  PINTAKASI,
  STAKER_FLOWS,
  STARS,
  STAT_NAMES,
  WEATHER,
  landForFight,
} from "@/engine/config";
import { splitBreedFee } from "@/engine/breeding";
import { GRADE_BAND } from "@/engine/grades";
import { fmtGp } from "@/engine/events";

// Claimers run through enter_claimer (they carry a tag + take claims).
const ENTRY_CLASSES = ["open", "maiden", "nw2", "nw3"] as const;
import { Farms } from "@/engine/farms";
import { Game } from "@/engine/game";
import { freshSeed } from "@/engine/rng";

function text(value: string) {
  return { content: [{ type: "text" as const, text: value }] };
}

function json(value: unknown) {
  return text(JSON.stringify(value, null, 2));
}

/** Engine errors are rule violations — return them as readable text, not protocol errors. */
function ruled<T>(fn: () => T) {
  try {
    return json(fn());
  } catch (err) {
    return text(`⛔ ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// EVERY NUMBER BELOW IS COMPUTED FROM @/engine/config AT MODULE LOAD.
// This mirrors the Handbook's rule (src/app/wiki/*, see AGENTS.md): a typed
// literal silently opts out of the next balance change. If a value isn't
// exported from config, either export it or describe it in words — never
// copy a number out of the engine by hand. src/engine/docs.test.ts asserts
// the strings below still match the live config; that's what catches drift.
// ─────────────────────────────────────────────────────────────────────────

const usd = (gp: number) => (gp / ECONOMY.GP_PER_DOLLAR).toFixed(2);

/** dayIndex % 7 → day name (round 20's calendar) — same table wiki/pintakasi uses. */
const DAY_NAMES = ["Friday", "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

// The breed-fee split, decomposed the same way splitBreedFee() actually pays
// it out — so "who banks what" can never drift from the engine's own math.
const breedSplit = splitBreedFee(ECONOMY.BREED_FEE);
const breedStakerPct = ((breedSplit.stakerPoolCents / (ECONOMY.BREED_FEE * 100)) * 100).toFixed(1);
const breedJuicePct = ((breedSplit.juicePoolCents / (ECONOMY.BREED_FEE * 100)) * 100).toFixed(1);
const breedOwnerPct = ((breedSplit.studOwnerCents / (ECONOMY.BREED_FEE * 100)) * 100).toFixed(1);
const coversPerWeek = COVERS.PER_WEEK + COVERS.OWNER_RESERVED;

// The gacha odds and egg tiers — GACHA_BIRDS is the source of truth for
// which tokens drop a mystery egg; nothing here is typed out by hand.
const gachaTotalWeight = Object.values(GACHA_WEIGHTS).reduce((a, b) => a + b, 0);
const eggTokens = GACHA_TOKENS.filter((t) => GACHA_BIRDS[t]);
const eggTokenNames = eggTokens.join(" and ");
const eggWeight = eggTokens.reduce((sum, t) => sum + GACHA_WEIGHTS[t], 0);
const eggChancePct = (eggWeight / gachaTotalWeight) * 100;
const gachaStakerPct = (STAKER_FLOWS.GACHA_SHARE * 100).toFixed(0);
const gachaJuicePct = (100 - STAKER_FLOWS.GACHA_SHARE * 100).toFixed(0);

// The daily-card pot: toggled entirely off STAKER_FLOWS.FIGHT_RAKE, exactly
// like src/app/wiki/card/page.tsx's live branch — never a hand-typed "2%".
const fightRakePct = (STAKER_FLOWS.FIGHT_RAKE * 100).toFixed(0);
const claimRakePct = (STAKER_FLOWS.CLAIM_RAKE * 100).toFixed(0);
const examplePotCents = ECONOMY.REAL_ENTRY_FEE * 2 * 100;
const exampleRakeCents = Math.round(examplePotCents * STAKER_FLOWS.FIGHT_RAKE);

// How much bigger the head-to-head element edge is than the day's weather —
// the ORDER of those two terms is the whole ruling (round 24 re-balanced
// weather down to a quarter of it), so it's stated as a ratio rather than as
// two numbers a reader has to divide for themselves.
const elementVsWeather = +(BATTLE.ELEMENT_EDGE / WEATHER.EDGE).toFixed(1);

const juvenileLand = landForFight(ECONOMY.JUVENILE_ENTRY_FEE);
const realLand = landForFight(ECONOMY.REAL_ENTRY_FEE);
const hardcoreLand = landForFight(ECONOMY.HARDCORE_ENTRY_FEE);

// The Juvenile Championship's purse shares are stored un-normalized (they
// don't sum to 1) — same renormalization src/app/wiki/pintakasi/page.tsx
// does before turning them into percentages.
const juvenilePurseTotal = Object.values(JUVENILE_MAJOR.PURSE_SHARES).reduce((a, b) => a + b, 0);
const juvenileChampionPct = ((JUVENILE_MAJOR.PURSE_SHARES.champion / juvenilePurseTotal) * 100).toFixed(0);

/**
 * The instructions block an agent-player reads once, at connect time. Every
 * number is interpolated from config so a knob change can't leave this
 * lying — see the header comment above and src/engine/docs.test.ts.
 */
export const MCP_INSTRUCTIONS: string[] = [
  "Pintakasi: Bloodlines — a digital sabong game. YOU are the game client: narrate fights and hatch days with color, present choices clearly, and let the player decide.",
  "YOUR FARM: every player (human or agent) runs a named farm with a country flag and two colors. No farm on this connection? register_farm, save the key, and reconnect with ?key=… on the MCP URL. (When only one farm exists, the key is optional.)",
  `THE DAILY RITUAL: check_in once per game-day — it pays the GP drip ($${usd(ECONOMY.DAILY_DRIP)} = ${ECONOMY.DAILY_DRIP} GP) and ${ECONOMY.FREE_PULLS_PER_CHECK_IN} free gacha pull. Do it first thing.`,
  "THE LOOP: breed retired birds → the hen is pregnant NOW, the egg is LAID next Friday (freeing her for another cover) and HATCHES the Friday after as an age-1 chick → juvenile through the discovery year → real fights from age 2 → at age 3 the fork opens: hardcore duels AND safe retirement → retire (or lose a hardcore) → the retiree becomes breeding stock → a better bird.",
  `AGE GATES: ${AGE.EGG} = egg · ${AGE.CHICK} = juvenile only · ${AGE.REAL_STAKES}+ = real fights · ${AGE.FORK}+ = hardcore + manual retirement · ${AGE.FIGHTING_CAP} = force-retired. Ages advance every Hatch Friday (tick_week); one game-week = one bird-year.`,
  "STATS ARE FIXED AT BIRTH, AND HIDDEN UNTIL RETIREMENT (round 28 — the fog). There is NO training, and there is no sheet to read on a live bird: the six fighting stats show as null until the career ends (retirement, a hardcore loss, or the age cap — any of them reveals the sheet). The skill is DISCOVERY, for real now: fight the juvenile year across blades, read the scout report on get_bird (figures per blade, shrunk toward a neutral prior), and learn what the bird already is. Stars, element, carriage, the record AND the bird's overallGrade stay visible — they are the card, not the sheet. The overall grade is the deliberate exception: it says HOW STRONG the bird is (six-stat average as a letter) and never WHAT SHAPE it is, so a B+ sprinter and a B+ stayer read identically — quote it freely, it gives a fresh hatch something to be proud of and a claim something honest to bid on. Never guess a live bird's stats to a player; present the scout report instead.",
  `CARRIAGE IS THE SECOND AXIS (round 23) — every bird also carries a rating of ${CARRIAGES.join(" or ")} (pang-baba/pang-itaas — the low-working shuffler vs. the flyer that comes over the top), rolled at birth or gacha and inherited at breeding the same way stars are. It shows on get_bird and list_flock. IT IS DATA ONLY FOR NOW: it is NOT wired into the fight engine yet, so it never changes tonight's outcome — mention it as part of a bird's profile, but don't imply it swings a fight.`,
  "EVERY FIGHT IS PvP — PURE, BETWEEN BARNS. The house supplies nobody. The rhythm: during the game-day you ENTER birds into lobbies (enter_lobby / enter_claimer); at the day tick every lobby GOES OFF — its birds are randomly paired and fight each other. Matchmaking NEVER pairs two birds from the same barn: enter several birds in one lobby freely, they will only ever draw other farms (birds left with only barn-mates go unmatched and refund). Entries are BINDING (fee escrowed, the bird's daily fight spent). Lobbies lock at 8 (even — a full lobby guarantees everyone a fight); a lobby that goes off odd strands one bird, whose fee refunds. There is a real risk a lobby doesn't fill — that's the game: judge your birds' strength and pick where they should be fighting.",
  `THE ECONOMY IS POOLED ($1 = ${ECONOMY.GP_PER_DOLLAR} GP): both sides post the entry. ` +
    (STAKER_FLOWS.FIGHT_RAKE === 0
      ? "The winner takes the WHOLE pot — the daily card rakes nothing (round 23 zeroed it back to a pure pot; the plumbing stays wired at 0% so a future season could turn it back on)."
      : `The winner takes the pot LESS a ${fightRakePct}% rake to the Land Token stakers — a ${ECONOMY.REAL_ENTRY_FEE * 2} GP pot pays ${fmtGp(examplePotCents - exampleRakeCents)}.`) +
    ` No fight ever prints GP. Every win also banks PINTAKASI QUALIFICATION POINTS (real +${PINTAKASI.POINTS_FOR.real}, hardcore +${PINTAKASI.POINTS_FOR.hardcore}, juvenile ${PINTAKASI.POINTS_FOR.juvenile}) — that is how a bird earns its way into a championship. The subsidy is LAND: both fighters earn Land Tokens scaled to the entry fee and slightly MORE than linearly (juvenile ${juvenileLand} LT · real ${realLand} LT · hardcore ${hardcoreLand} LT) — fighting UP into dearer company pays extra land. Unmatched birds earn none. Land is also buyable (buy_land, $${usd(LAND.GP_PER_100_TOKENS)}/LT, capped at ${LAND.DAILY_BUY_CAP.toLocaleString()} LT/game-day) and NEVER sellable.`,
  "ONE FIGHT PER BIRD PER GAME-DAY — a hard count, not a cooldown. A full barn is how you fight more than once a day.",
  "WEAPON FORMATS ARE THE DISTANCE DIAL, enumerated B1–B5 from sprint to deep-water classic (round 27 gave the dial its true middle): every fight blends ALL FOUR distance stats, weighted per blade — B1 the sprint (agility keys it), B2 the hybrid (sight), B3 the exact middle (all four stats weigh THE SAME, so the flat, balanced bird is best there — the one blade with no key stat), B4 the marathon (stamina — the fuel tank), B5 the deep-water classic (gameness rules the end). Every stat counts a LITTLE everywhere; the weights decide how much. Any bird can enter any format; it's just disadvantaged outside its type.",
  "WIND AND FUEL (round 27): every bird starts every fight with the same 100 wind — no stat buys hit points. Stamina is the FUEL TANK instead: it sets how many turns the bird fights at full power, and when the tank empties the bird HITS THE WALL — its agility and sight halve for the rest of the fight. Gameness never fades (heart is mental) and also decides, once per fight, whether a badly hurt bird stands or RUNS. Sprints end before any tank empties; the long blades are decided by who is still at full book in the deep water.",
  `CLASSES ARE THE LADDER: open · maiden (never-winners only) · nw2/nw3 (fewer than 2/3 career wins) · claimer (priced). The discovery year runs its OWN, smaller ladder (round 23) — open, maiden, and claimer only; nw2/nw3 stay out, since a one-year-old hasn't fought long enough to have the record they sort by — and its claimer tags are their own cheaper rungs: ${CLAIMER.JUVENILE_PRICES.join("/")} GP, against the grown ladder's ${CLAIMER.PRICES.join("/")} GP. The field is WHOEVER ENTERS — but the board is FOGGED while a lobby is OPEN: lobby_board shows every lobby and its fill count, NEVER whose birds are inside (no dodging — predicting a lobby's strength from its mode, class, and tag is the skill). The one exception: CLAIMER fields are fully visible (stars, records, figures — never stats), because claims are placed on specific birds. Fighting for a tag is choosing to be seen.`,
  "CARDS RUN THREE STATES (PFL-style): OPEN (taking entries, fogged) → CLOSED (entries locked, matchups DRAWN AND REVEALED — the fog lifts and you see who your bird fights) → COMPLETED (fights concluded, refunds paid, claims settled). On manual ticks close and post happen together; on the real-time clock claimers close at 6 PM PH for an evening claiming window, everything else minutes before the 11:55 PM post. Claims flow until the lobby completes — a last-second claim either makes it or it's too late.",
  `CLAIMERS ARE THE MARKETPLACE — farm-to-farm, escrowed, PRE-FIGHT: enter_claimer cards a bird at a tag price from its OWN season's ladder (${CLAIMER.PRICES.join("/")} GP grown, ${CLAIMER.JUVENILE_PRICES.join("/")} GP juvenile — the grown ladder brackets the ${ECONOMY.BREED_FEE} GP breed floor; the tool reads the bird's age itself, you don't pick a mode). Other farms place_claim with the tag escrowed; claims are SEALED. At post time the bird fights for its ORIGINAL owner (who keeps the pooled prize), then one claim wins (RNG if several — losers refund in full), and the owner banks the tag as the bird transfers. NO FIGHT, NO CLAIM (re-ruled round 23): if the bird draws no opponent, its entry fee refunds AND every claim standing on it refunds too — a sale needs the fight to actually happen, it doesn't skip it. You cannot claim your own bird. The house never claims. Winning AND getting claimed is an income spike — a legitimate play. Claiming undervalued birds and racing them UP is a full playstyle.`,
  `DISCOVERY — THE PIT FIGURE, REBUILT ROUND 30: every fight returns a figure on a FIXED scale, so numbers mean the same thing forever and across every blade. A perfectly even bird with ${FIGURE.PEG_STAT} in every stat posts ${FIGURE.PEG_FIGURE} when it wins; one letter grade is worth exactly ${(GRADE_BAND / FIGURE.PEG_STAT) * FIGURE.PEG_FIGURE} figure points at every rung of the ladder, and there is NO ceiling — a bred monster posting 140 really is that good. Today's starters read in the 20s and 30s. READ IT TWO WAYS. (1) ACROSS BLADES: the figure is built from what each blade TESTS, so a bird posts its biggest number at the blade that suits it. Compare a bird’s own figures blade to blade (get_bird’s scoutReport does this for you) — the gap IS the bird’s shape, and it gets LOUDER as a bird gets better, not quieter. (2) AGAINST ITS GRADE: the figure weighs only the four distance stats, while overallGrade averages all six. A bird figuring below what its grade suggests is carrying its weight in station and condition — heart and form, not blade. That gap is a real read, not an error. THE NIGHT MOVES IT up to ${FIGURE.NIGHT_RANGE * 100}% either way: condition, the element wheel, the day’s weather, station’s clawback when outmatched, and emptying the fuel tank in a long fight. A LOSS is marked down by how far the bird finished behind. So one figure is an opinion and three are evidence — figures are deliberately imprecise, and you must never present one as exact truth.`,
  `STARS ARE THE ELEMENT'S VOLUME KNOB (reworked round 26) — a bird's star rating (0 to ${STARS.MAX_HALF_STARS / 2}★ in half-steps) scales every edge its element grants: the head-to-head wheel edge AND the daily weather edge are each multiplied by stars/${STARS.MAX_HALF_STARS / 2}. A ${STARS.MAX_HALF_STARS / 2}★ bird at a favorable matchup gets the full +${BATTLE.ELEMENT_EDGE}; a 2.5★ bird gets half; a 0★ bird's element is a color on the card and NOTHING more — never sell a 0★ bird's matchup or its weather day as an edge. Stars do NOT add stat points anymore: a high-star bird with weak stats is a weak bird that punches hard on the right matchup. Stars are bred and pulled, not trained — that is what makes them worth chasing.`,
  `THE DAILY ELEMENT WEATHER (round 24) — one Element is ASCENDANT every game-day, the same for every fight on that day's card, rotating irregularly so a bird's day comes around without being predictable. A bird OF the ascendant element carries the weather edge — +${WEATHER.EDGE} at ${STARS.MAX_HALF_STARS / 2}★, scaled down by its stars, zero at 0★ — on every turn roll it takes that day; everyone else fights unchanged (there is no penalty for the wrong element). get_state names today's and tomorrow's — plan which STARRED birds you run around it. It STACKS with the head-to-head element edge (Fire beats Metal, Water beats Fire, and so on) but is DELIBERATELY the weaker of the two: that one is worth ${elementVsWeather}× the weather at the same stars. So weather COLORS a fight and the matchup DECIDES it — never talk a player out of a good blade or a soft field for a good sky. And it nudges the PIT FIGURE: a starred bird posts a slightly bigger figure on its own day than the same bird on an off day, so read every form line with that day's element in mind (get_bird's formBook stamps each past fight with the day's Element and flags the ones the bird ran with the edge).`,
  "HARDCORE IS THE CHARGED DECISION: bigger pot, but the LOSER of the pair is FORCE-RETIRED on the spot — both owners signed up for that by entering. Open class only. Always confirm with the player first — never enter one on your own judgment.",
  `THE PINTAKASI — THE WEEKLY MAJORS: every ${DAY_NAMES[PINTAKASI.DAY_OF_WEEK]} (the week's last day), three blade championships crown specialists, the SAME three every week (round 27): ${FORMATS[PINTAKASI.BLADES[0]].label} the Sprint, ${FORMATS[PINTAKASI.BLADES[1]].label} the Middle, ${FORMATS[PINTAKASI.BLADES[2]].label} the Classic — the ends of the blade dial and its exact middle (${FORMATS.b2.label}/${FORMATS.b4.label} belong to the Juvenile Championship instead). Single elimination in ONE day, winners healing to full between rounds; HARDCORE THROUGHOUT — every loser force-retires (the Juvenile Championship the day before is the one exception in the whole game — see below). Age ${AGE.FORK}+ and ${PINTAKASI.ENTRY_FEE === 0 ? "FREE TO ENTER" : `${PINTAKASI.ENTRY_FEE} GP to enter`} — but you must QUALIFY: a bird needs ${PINTAKASI.QUALIFYING_POINTS} qualification points, earned by winning on the daily card (real win +${PINTAKASI.POINTS_FOR.real}, hardcore win +${PINTAKASI.POINTS_FOR.hardcore}, the discovery year pays ${PINTAKASI.POINTS_FOR.juvenile}). One crown per bird and up to ${PINTAKASI.MAX_PER_BARN} birds from one barn in the same championship (enter_pintakasi any day up to ${DAY_NAMES[PINTAKASI.DAY_OF_WEEK]} itself). The purse = the week's juice pool (after the Juvenile Championship's slice comes off the top), paid to the top (champion ~${(PINTAKASI.PURSE_SHARES.champion * 100).toFixed(0)}%; first-round losers zero GP) — but LAND pays the fallen hardest (elimination grants grow the earlier you fall, plus every tournament fight mints land on a steeper curve). The bracket is committee-seeded by qualification points → career earnings → wins → average figure, byes to the top seeds, and the field is PUBLIC all week (pintakasi_board). At ${PINTAKASI.MAX_BRACKET} the committee bumps the weakest for a stronger newcomer. This is where champions — and breeding legends — are made: pitch it to the player when a bird hits age ${AGE.FORK} strong.`,
  `THE JUVENILE CHAMPIONSHIP RUNS THE DAY BEFORE (round 23): every ${DAY_NAMES[JUVENILE_MAJOR.DAY_OF_WEEK]}, two crowns for age-${AGE.CHICK} birds only, on the two blades the Majors don't run — ${FORMATS[JUVENILE_MAJOR.BLADES[0]].label} and ${FORMATS[JUVENILE_MAJOR.BLADES[1]].label}, fixed, every week (round 27 killed the rotation; between the two stages all five blades crown somebody weekly). Qualify with ${JUVENILE_MAJOR.QUALIFYING_WINS} juvenile wins on the discovery-year ladder (no GP entry), up to ${JUVENILE_MAJOR.MAX_PER_BARN} birds per barn per blade, bracket capped at ${JUVENILE_MAJOR.MAX_BRACKET}. IT IS NOT HARDCORE — the ONE championship in the game that does not force-retire its losers, because the discovery year exists to find out what a bird is, and ending careers at age one would gut the population the Majors are meant to inherit. Its purse is a fixed ${(JUVENILE_MAJOR.JUICE_SHARE * 100).toFixed(0)}% slice of the week's juice pool, taken before Thursday's Majors get the rest, and paid out flatter (champion ~${juvenileChampionPct}% of it) than a Major's purse — a discovery-year stage rewards showing up with a live one, not just winning it all.`,
  `WHEN AN EGG HATCHES, reveal its sex (hidden 50-50 while an egg) and prompt the player to name the chick (name_bird). Mystery Eggs from the gacha hatch the same way. THE NAMING LAW: a bird CANNOT fight while still wearing its auto-name ('Egg of …', 'Mystery Egg (…)') — entering is refused until name_bird is called. Make naming part of the hatch-day ritual, BEFORE the first card.`,
  "ONE LIFETIME RECORD (ruled round 15): juvenile, real, and hardcore fights ALL count toward the same wins-losses line, for birds and farms alike. NOTE: the record does NOT set stud prices — stud pricing is player speculation and supply/demand (flat " + ECONOMY.BREED_FEE + " GP for now).",
  `BREEDING IS PvP TOO — THE BARN: both parents retired, hen × rooster, not close kin. list_stud stands your retired roosters (${COVERS.PER_WEEK} covers/week public + ${COVERS.OWNER_RESERVED} owner-reserved, and costs ${COVERS.STUD_LISTING_LT} LT the FIRST time you open the seat — spent outright, not staked, not refundable); browse_studs shows a hen every stud she can take, with kin exclusions NAMED. A cover costs ${ECONOMY.BREED_FEE} GP flat (min AND max for now — player pricing later) and SPLITS ${breedStakerPct}% to land stakers / ${breedJuicePct}% fight juice / ${breedOwnerPct}% to the stud's owner. Hens pay, hens keep the egg. Selling covers is income; top studs capping out is by design.`,
  `WHAT TO BREED FOR (round 29) — the four fighting stats sit on a dial, ${DISTANCE_STATS.join(" → ")}, and the plan is to aim a line at TWO NEIGHBOURING stats on it: ${BREEDING_SHAPES.map(({ pair }) => pair.join(" & ")).join(", ")}. A pair buys a FLOOR — strong at the two blades its stats key, still ahead of a plain bird in the middle, never truly bad anywhere — and under the fog, where nobody knows a chick's sheet for months, the floor is the part the breeder actually owns. A single towering stat is a legitimate line too, just a narrower one. THEN break ties on station, condition and stars: none of them keys a blade, so none of them fights the shape. Both parents are retired, so BOTH SHEETS ARE PUBLIC on the stud card (browse_studs) — a chick's expected stats are simply the parents' midpoint, so the player can do this arithmetic before buying the cover. Coach it: a flock bred for big numbers alone drifts into birds that are mediocre everywhere and excellent nowhere, which wins no crowns and leaves the scout report nothing to find.`,
  "GENERATION IS THE BLOODLINE'S DEPTH (round 30) — every bird carries a `generation` number, shown on get_bird and list_flock. Starters and gacha pulls are generation 0: they came from outside the line. A chick takes its MOTHER's generation + 1, so gen 3 means three nests of the player's own breeding since the founder hen. It gates NOTHING and changes no fight — it is the scoreboard on the breeding project, and the reason to mention it. When a gen-4 chick out-grades its gen-0 great-grandmother, say so; that is the whole loop paying off.",
  `STAKE YOUR LAND — ALWAYS. stake_land every LT as soon as you earn it (one pool for now): staked land collects a slice of EVERY GP that changes hands, daily and pro-rata: ${claimRakePct}% of every claiming tag, ${gachaStakerPct}% of gacha spend, ${breedStakerPct}% of every breed fee, and the entire price of any Land Token someone buys.` +
    (STAKER_FLOWS.FIGHT_RAKE > 0
      ? ` Also ${fightRakePct}% of every daily-card fight pot.`
      : " The daily-card fight pot itself is NOT raked any more — round 23 zeroed that back to a pure pot; the plumbing stays wired at 0% in case a future season turns it back on.") +
    " Land never sells, so idle liquid LT earns nothing — staked LT compounds your GP. Tell the player to DESIRE land and stack it: it may be worth real money someday ($1/LT is the dream).",
  "SIX BOT STABLES play every game-day (they card birds, breed, and shop the claimer fields just before post time). They are RIVALS, not the house — same rules, own wallets. Their day shows up in the tick result; narrate notable bot moves (a claim on the player's bird!) with color.",
  "Rule violations come back as ⛔ text — read them to the player as house rules, not errors.",
];

/**
 * Every `registerTool` description, keyed by tool name — exported so
 * src/engine/docs.test.ts can assert them against the live config without
 * spinning up the MCP server itself.
 */
export const TOOL_DESCRIPTIONS = {
  register_farm:
    `Create your farm: name (required), country flag (encouraged — pick one!), and two colors from the palette: ` +
    FARM_COLORS.join(", ") +
    `. Returns your farm key (fk_…) — SAVE IT and reconnect with ?key=… on the MCP URL. Seeds ${BARN.STARTER_EGGS} starter eggs, hatching together on the first Friday, and a $${usd(ECONOMY.STARTING_GP)} (${ECONOMY.STARTING_GP.toLocaleString()} GP) stake.`,

  list_farms: "Every farm's public identity — name, flag, colors, GP, land. No keys.",

  check_in: `The daily ritual, once per game-day: pays the GP drip (${ECONOMY.DAILY_DRIP} GP = $${usd(ECONOMY.DAILY_DRIP)}) and grants ${ECONOMY.FREE_PULLS_PER_CHECK_IN} free gacha pull. Do this first thing each day.`,

  get_state: `The world calendar (in-game date, whether today is Hatch Friday) plus YOUR farm: GP wallet ($1 = ${ECONOMY.GP_PER_DOLLAR} GP), Land Tokens, free pulls, check-in status, barn occupancy. Also reports today's ascendant Element (the daily "weather" — birds of that element get a small edge on the card today) and tomorrow's, so you can plan which birds to run. Start here.`,

  list_flock:
    "Every bird in YOUR barn with derived age, element stars (e.g. '2.5★ Fire'), carriage, `generation` (0 = starter or gacha pull, otherwise the dam's generation + 1 — how many nests deep the line runs), record, and status (egg/active/retired). THE FOG (round 28): the six fighting stats read null while a bird can still fight — they REVEAL at retirement. `overallGrade` is ALWAYS present (power, not shape). A live bird is judged by its grade and its figures, not a sheet. Retired roosters show whether they're standing at stud (listedStud).",

  get_bird:
    "One bird in full: carriage, `generation` (bloodline depth — 0 for a starter or a gacha pull, dam + 1 for a bred chick; never fogged, it is pedigree rather than shape), lineage tree, and the DISCOVERY READOUT — `scoutReport` (all five blades: record, average and best Pit Figure, and a shrunk `score` per blade with `bestBlade` flagged; unraced blades score the neutral prior, so one loud figure never types a bird), the raw per-format lines (`formatRecords`), and `formBook`: every past fight stamped with that day's ascendant Element, `edge: true` marking fights run in its OWN weather (read those figures down a touch), plus `onEdge`/`offEdge` averages. THE FOG (round 28): the six stats are null while the bird can fight and REVEAL at retirement — on a retired bird this is the full sheet. `overallGrade` is public at every age.",

  name_bird:
    "Give a bird a player-chosen name — the ritual for a freshly hatched chick, and REQUIRED before its first fight (the naming law: auto-named birds are refused at the lobby door). Names are world-unique.",

  tick_day:
    "Move the WORLD calendar one day (all farms share the clock — coordinate in beta; the scheduler owns this later). Landing on a Friday triggers Hatch Friday. TONIGHT'S CARD GOES OFF: every open lobby pairs its birds and fights, claims settle — narrate the results with color. Resets daily limits (fights, check-in, land cap).",

  tick_week:
    "Jump the WORLD clock to the next Hatch Friday (the aging tick). Eggs hatch into age-1 chicks — prompt the player to name them. Tonight's card goes off too.",

  breed:
    `Buy a cover: YOUR retired hen × a retired rooster — your own, or ANY farm's listed stud (browse_studs first). Costs ${ECONOMY.BREED_FEE} GP ($${usd(ECONOMY.BREED_FEE)}, min AND max for now), which SPLITS: ${fmtGp(breedSplit.stakerPoolCents)} GP to the land-staking pool, ${fmtGp(breedSplit.juicePoolCents)} to the fight-juice pool, ${fmtGp(breedSplit.studOwnerCents)} to the stud's owner. The hen's farm keeps the egg ('Egg of <mother>'). She is pregnant until the next Friday, then the egg lays and she is free for another cover; that egg hatches the Friday after. Covers are capped per rooster per week (${COVERS.PER_WEEK} public + ${COVERS.OWNER_RESERVED} owner-reserved).`,

  browse_studs:
    `The barn from one hen's point of view: every stud she CAN breed with (name, farm, stars, age, record, covers left, AND his full revealed six-stat sheet + overall grade — he is retired, so nothing about him is fogged; ${ECONOMY.BREED_FEE} GP each) plus the excluded ones WITH the reason (kin overlap named explicitly, or covered out this week). Candidates = every farm's listed studs + your own retired roosters.`,

  list_stud:
    `List a retired rooster of yours in the breeding barn — any farm's hens can then buy covers at ${ECONOMY.BREED_FEE} GP, of which ${fmtGp(breedSplit.studOwnerCents)} GP lands in YOUR wallet per cover. ${COVERS.PER_WEEK} public covers/week plus ${COVERS.OWNER_RESERVED} reserved for your own hens. THE FIRST TIME you open a rooster's public slots it costs ${COVERS.STUD_LISTING_LT} LT, spent outright — not staked, not refundable; pulling him and re-listing him later is free, the land buys the seat once, not a subscription. Selling covers is real income — list your good retirees.`,

  unlist_stud: "Remove your rooster from the breeding barn. Covers already bought this week stand.",

  stake_land:
    `Stake Land Tokens into THE pool (single pool for now). Staked land earns a pro-rata share of every inflow — claim rakes, gacha share, breed cut, land purchases` +
    (STAKER_FLOWS.FIGHT_RAKE > 0 ? ", fight-pot rakes" : "") +
    ` — paid every day at the tick, which is where GP goes decimal. Stake as soon as you earn; unstake any time. STACK LAND: it may be worth real money one day ($1/LT is the dream), and it is never sellable either way.`,

  unstake_land: "Pull Land Tokens out of the staking pool — back to liquid (still never sellable).",

  enter_lobby:
    `Put a bird on tonight's card — PURE PvP: at the day tick the lobby's birds are randomly paired and fight EACH OTHER (never two of your own — enter several birds freely, matchmaking keeps barn-mates apart). BINDING: the fee escrows and the bird's daily fight is spent. Lobbies lock at 8; birds without an opponent refund. Pick the WEAPON FORMAT (distance dial) and CLASS (ladder dial) deliberately — lobby_board shows fill counts, not fields (fogged), so judge where your bird belongs. Modes: juvenile (age ${AGE.CHICK}+, ${ECONOMY.JUVENILE_ENTRY_FEE} GP) · real (${AGE.REAL_STAKES}+, ${ECONOMY.REAL_ENTRY_FEE} GP) — all modes feed the ONE lifetime record · hardcore (${AGE.FORK}+, ${ECONOMY.HARDCORE_ENTRY_FEE} GP, LOSER FORCE-RETIRED — confirm first, open class only). Land pays both fighters, scaled up with the fee. Claimers run through enter_claimer.`,

  lobby_board:
    "Tonight's card, in both live states. OPEN lobbies are FOGGED: you see each lobby's mode/class/format/tag and its fill count, plus YOUR OWN entries, never other barns' birds (no dodging) — except CLAIMER lobbies, whose fields are fully visible so claims can be placed. CLOSED lobbies are the REVEAL: entries locked, full field shown, and each entry's `drew` says who it fights tonight (drew: null = no opponent, refunds at post). The six stats are ALWAYS hidden (reading figures is the skill) and claims already placed are SEALED. Scout fill counts before entering; scout closed claimer draws before claiming.",

  enter_claimer:
    `Card a bird in a claimer lobby at a tag price — the ladder depends on the BIRD's own age, not something you choose: an age-${AGE.CHICK} juvenile prices on ${CLAIMER.JUVENILE_PRICES.join(" / ")} GP, a grown bird (age ${AGE.REAL_STAKES}+) on ${CLAIMER.PRICES.join(" / ")} GP. The entry fee follows the same split (${ECONOMY.JUVENILE_ENTRY_FEE} GP juvenile, ${ECONOMY.REAL_ENTRY_FEE} GP grown). Same PvP card rules as enter_lobby otherwise (binding, random pairing at the tick) — PLUS the bird's card is publicly visible (claimers are the one un-fogged class) and other farms may claim it (sealed) until post time. You keep the pooled prize either way; IF the bird fights AND is claimed, you also bank the tag as it transfers. NO FIGHT, NO CLAIM (round 23): draw no opponent and the whole thing calls off — entry fee AND every claim on the bird refund in full, nothing transfers. Cheap tag = claimable but quick money; dear tag = safer, dearer company.`,

  place_claim:
    "Sealed claim on a claimer entry from lobby_board — the tag escrows NOW and settles at post time (the day tick). If several farms claim, the RNG picks one; losers refund in full. The bird transfers AFTER it fights (the original owner keeps the prize) — and only if it fights at all; an unmatched bird refunds every claim standing on it instead. One claim per farm per entry; not your own bird.",

  enter_pintakasi:
    `Register an age-${AGE.FORK}+ bird for one of THIS WEEK's three blade championships (the weekly Majors — crowns every ${DAY_NAMES[PINTAKASI.DAY_OF_WEEK]}). HARDCORE THROUGHOUT: every loser in the bracket is FORCE-RETIRED, so always confirm with the player first. ${PINTAKASI.ENTRY_FEE === 0 ? "FREE to enter" : `${PINTAKASI.ENTRY_FEE} GP to enter`}, but the bird must hold ${PINTAKASI.QUALIFYING_POINTS} QUALIFICATION POINTS won on the daily card (real win +${PINTAKASI.POINTS_FOR.real}, hardcore win +${PINTAKASI.POINTS_FOR.hardcore}, juvenile ${PINTAKASI.POINTS_FOR.juvenile}); the purse = the week's juice pool (less the Juvenile Championship's slice), weighted to the TOP (first-round losers take zero GP) while LAND is weighted to the FALLEN (the earlier a bird goes out, the bigger its land grant — a first-round hardcore death is never a pure loss). Committee-seeded bracket by qualification points → career earnings → wins → average figure; at ${PINTAKASI.MAX_BRACKET} entrants a stronger newcomer BUMPS the weakest. One bird per crown and up to ${PINTAKASI.MAX_PER_BARN} birds from your barn per championship; the field is PUBLIC — check pintakasi_board. Registrants fight normal cards all week except ${DAY_NAMES[PINTAKASI.DAY_OF_WEEK]} itself.`,

  pintakasi_board:
    "This week's three blade championships: each field ranked as the Selection Committee sees it TODAY (rank 1 = top seed; the bottom of a full field is the bump line), the entry fee, and the projected purse (entries so far + the juice-pool share). Fields are PUBLIC — the Pintakasi is the one un-fogged stage in the game.",

  retire_bird:
    `The safe arm of the age-${AGE.FORK} fork: end the career and convert the bird to breeding stock (roosters can then stand at stud via list_stud). Irreversible — confirm with the player.`,

  buy_land:
    `Buy Land Tokens with GP: ${LAND.GP_PER_100_TOKENS} GP per 100 LT ($${usd(LAND.GP_PER_100_TOKENS)}/LT), capped at ${LAND.DAILY_BUY_CAP.toLocaleString()} LT per game-day. One-way — land never sells back.`,

  roll_gacha:
    `One roll = ${ECONOMY.GACHA_ROLL_PRICE} GP ($${usd(ECONOMY.GACHA_ROLL_PRICE)}) — the free pull from check_in spends first, and past that there is NO DAILY CAP (round 23 removed it; the price alone is the limiter now, up from round 22's brief 16 GP experiment). Always pays a rarity token (${GACHA_TOKENS.join("/")} — prizes TBD) plus ${LAND.PER_GACHA_ROLL} Land Token. Only ${eggTokenNames} ALSO drop a MYSTERY EGG (random element, hidden sex, no parents, hatches next Hatch Friday) — announce it with fanfare; the other tokens never do. ${gachaStakerPct}% of a paid roll's spend goes to the land stakers, ${gachaJuicePct}% to the juice pool that pays the championships — free pulls split nothing, there's no GP to share. See roll_gacha_bundle for the multi-roll option.`,

  roll_gacha_bundle:
    `${ECONOMY.BUNDLE_ROLLS} rolls for ${ECONOMY.BUNDLE_PRICE} GP ($${usd(ECONOMY.BUNDLE_PRICE)}) in one motion — ${ECONOMY.BUNDLE_ROLLS - 1} rolls' worth of money, one on the house. It costs exactly one day's check-in drip (${ECONOMY.DAILY_DRIP} GP) and does NOT touch your free pulls — a bundle is a purchase, not a spend of the daily allowance. Same odds and the same mystery-egg tiers (${eggTokenNames}) as roll_gacha, ${ECONOMY.BUNDLE_ROLLS} times over.`,
} as const;

function createServer(farmId: string | null): McpServer {
  const database = db();
  const farmsApi = new Farms(database);

  /** Scoped game — every farm-tool goes through this. */
  const game = (): Game => {
    if (!farmId)
      throw new Error(
        "No farm on this connection — register_farm first, then add ?key=fk_… to the MCP URL"
      );
    return new Game(database, farmId);
  };

  const server = new McpServer(
    { name: "pintakasi-bloodlines", version: "0.3.0" },
    { instructions: MCP_INSTRUCTIONS.join("\n") }
  );

  server.registerTool(
    "register_farm",
    {
      title: "Register a Farm",
      description: TOOL_DESCRIPTIONS.register_farm,
      inputSchema: z.object({
        name: z.string().describe("The farm's name"),
        country: z.string().optional().describe("Flag emoji or country name, e.g. 🇵🇭"),
        primaryColor: z.enum(FARM_COLORS),
        secondaryColor: z.enum(FARM_COLORS),
      }),
    },
    async (input) =>
      ruled(() => {
        const { farm, apiKey } = farmsApi.register(input);
        seedStarterFlock(database, farm.id, { seed: freshSeed() });
        return { farm, apiKey, note: "Save the apiKey — it is your login (?key=… on the MCP URL)." };
      })
  );

  server.registerTool(
    "list_farms",
    {
      title: "The Scoreboard",
      description: TOOL_DESCRIPTIONS.list_farms,
      annotations: { readOnlyHint: true },
    },
    async () => ruled(() => farmsApi.all())
  );

  server.registerTool(
    "check_in",
    {
      title: "Daily Check-In",
      description: TOOL_DESCRIPTIONS.check_in,
    },
    async () => ruled(() => game().farms.checkIn(game().farmId))
  );

  server.registerTool(
    "get_state",
    {
      title: "Game State",
      description: TOOL_DESCRIPTIONS.get_state,
      annotations: { readOnlyHint: true },
    },
    async () => ruled(() => game().state())
  );

  server.registerTool(
    "list_flock",
    {
      title: "List the Flock",
      description: TOOL_DESCRIPTIONS.list_flock,
      annotations: { readOnlyHint: true },
    },
    async () => ruled(() => game().flock.all())
  );

  server.registerTool(
    "get_bird",
    {
      title: "Bird Detail",
      description: TOOL_DESCRIPTIONS.get_bird,
      inputSchema: z.object({ id: z.string().describe("Bird id from list_flock") }),
      annotations: { readOnlyHint: true },
    },
    async ({ id }) =>
      ruled(() => {
        const g = game();
        return {
          bird: g.flock.byId(id),
          lineage: g.breeding.lineage(id),
          // The sheet's stand-in while the fog is down (round 28): every
          // blade's record with a shrunk score — the same read the bots use.
          scoutReport: g.lobbies.scoutReport(id),
          formatRecords: g.lobbies.formatRecords(id),
          // The weather half of the readout (see FormBook in engine/flock.ts):
          // the same figures again, each stamped with the day's ascendant
          // element, so a good day can be told from a good bird.
          formBook: g.flock.formBook(id),
        };
      })
  );

  server.registerTool(
    "name_bird",
    {
      title: "Name a Bird",
      description: TOOL_DESCRIPTIONS.name_bird,
      inputSchema: z.object({
        id: z.string(),
        name: z.string().describe("The new name"),
      }),
    },
    async ({ id, name }) => ruled(() => game().flock.rename(id, name))
  );

  server.registerTool(
    "tick_day",
    {
      title: "Advance One Day",
      description: TOOL_DESCRIPTIONS.tick_day,
    },
    async () => ruled(() => game().tickDay())
  );

  server.registerTool(
    "tick_week",
    {
      title: "Advance to Next Hatch Friday",
      description: TOOL_DESCRIPTIONS.tick_week,
    },
    async () => ruled(() => game().tickWeek())
  );

  server.registerTool(
    "breed",
    {
      title: "Breed (Buy a Cover)",
      description: TOOL_DESCRIPTIONS.breed,
      inputSchema: z.object({
        motherId: z.string().describe("A retired hen of YOURS — hens keep the egg"),
        fatherId: z.string().describe("A retired rooster: yours, or a stud id from browse_studs"),
      }),
    },
    async ({ motherId, fatherId }) => ruled(() => game().breeding.breed(motherId, fatherId))
  );

  server.registerTool(
    "browse_studs",
    {
      title: "Browse the Breeding Barn",
      description: TOOL_DESCRIPTIONS.browse_studs,
      inputSchema: z.object({ henId: z.string().describe("A retired hen of yours") }),
      annotations: { readOnlyHint: true },
    },
    async ({ henId }) => ruled(() => game().breeding.browseStuds(henId))
  );

  server.registerTool(
    "list_stud",
    {
      title: "Stand a Stud",
      description: TOOL_DESCRIPTIONS.list_stud,
      inputSchema: z.object({ birdId: z.string().describe("A retired rooster of yours") }),
    },
    async ({ birdId }) => ruled(() => game().breeding.listStud(birdId))
  );

  server.registerTool(
    "unlist_stud",
    {
      title: "Pull a Stud",
      description: TOOL_DESCRIPTIONS.unlist_stud,
      inputSchema: z.object({ birdId: z.string() }),
    },
    async ({ birdId }) => ruled(() => game().breeding.unlistStud(birdId))
  );

  server.registerTool(
    "stake_land",
    {
      title: "Stake Land",
      description: TOOL_DESCRIPTIONS.stake_land,
      inputSchema: z.object({ amount: z.number().int().positive().describe("Liquid LT to stake") }),
    },
    async ({ amount }) => ruled(() => { const g = game(); return g.farms.stake(g.farmId, amount); })
  );

  server.registerTool(
    "unstake_land",
    {
      title: "Unstake Land",
      description: TOOL_DESCRIPTIONS.unstake_land,
      inputSchema: z.object({ amount: z.number().int().positive() }),
    },
    async ({ amount }) => ruled(() => { const g = game(); return g.farms.unstake(g.farmId, amount); })
  );

  server.registerTool(
    "enter_lobby",
    {
      title: "Enter a Lobby (Tonight's Card)",
      description: TOOL_DESCRIPTIONS.enter_lobby,
      inputSchema: z.object({
        birdId: z.string(),
        mode: z.enum(["juvenile", "real", "hardcore"]).default("real"),
        format: z
          .enum(FORMAT_NAMES as [string, ...string[]])
          .default("b2")
          .describe("b1 = sprint · b2 = hybrid · b3 = route · b4 = marathon"),
        classType: z
          .enum(ENTRY_CLASSES)
          .default("open")
          .describe("open · maiden (never-winners) · nw2/nw3 (win caps)"),
      }),
    },
    async ({ birdId, mode, format, classType }) =>
      ruled(() =>
        game().lobbies.enter(birdId, { mode, classType: classType as never, format: format as never })
      )
  );

  server.registerTool(
    "lobby_board",
    {
      title: "The Board (Tonight's Card)",
      description: TOOL_DESCRIPTIONS.lobby_board,
      annotations: { readOnlyHint: true },
    },
    async () => ruled(() => game().lobbies.board())
  );

  server.registerTool(
    "enter_claimer",
    {
      title: "Enter a Claimer",
      description: TOOL_DESCRIPTIONS.enter_claimer,
      inputSchema: z.object({
        birdId: z.string(),
        format: z
          .enum(FORMAT_NAMES as [string, ...string[]])
          .default("b2")
          .describe("The weapon format the lobby runs at"),
        price: z
          .number()
          .int()
          .describe(
            "The claiming tag — " +
              CLAIMER.PRICES.join(" / ") +
              " GP for a grown bird, " +
              CLAIMER.JUVENILE_PRICES.join(" / ") +
              " GP for a juvenile"
          ),
      }),
    },
    async ({ birdId, format, price }) =>
      ruled(() => {
        const g = game();
        // The mode is the BIRD's, not the caller's: a one-year-old can only
        // card in the discovery year, a grown bird only at real stakes —
        // asking would just be a way to get it wrong. Bots/auto-play already
        // exercise both paths (see bots.ts) — this was only unreachable
        // through the MCP tool itself.
        const mode = g.flock.byId(birdId).age <= AGE.CHICK ? "juvenile" : "real";
        return g.lobbies.enter(birdId, { mode, classType: "claimer", format: format as never, price });
      })
  );

  server.registerTool(
    "place_claim",
    {
      title: "Place a Claim",
      description: TOOL_DESCRIPTIONS.place_claim,
      inputSchema: z.object({ entryId: z.number().int().describe("From lobby_board") }),
    },
    async ({ entryId }) => ruled(() => game().lobbies.claim(entryId))
  );

  server.registerTool(
    "enter_pintakasi",
    {
      title: "Register for the Pintakasi",
      description: TOOL_DESCRIPTIONS.enter_pintakasi,
      inputSchema: z.object({
        birdId: z.string(),
        format: z
          .enum(FORMAT_NAMES as [string, ...string[]])
          .describe("This week's blades only — pintakasi_board lists them (B1/B3/B5, the same three every week since round 27)"),
      }),
    },
    async ({ birdId, format }) => ruled(() => game().tournaments.enter(birdId, format as never))
  );

  server.registerTool(
    "pintakasi_board",
    {
      title: "The Pintakasi Board",
      description: TOOL_DESCRIPTIONS.pintakasi_board,
    },
    async () => ruled(() => game().tournaments.board())
  );

  // (No train tool — stats are fixed at birth, ruled 2026-08-03 round 13.)

  server.registerTool(
    "retire_bird",
    {
      title: "Retire a Bird",
      description: TOOL_DESCRIPTIONS.retire_bird,
      inputSchema: z.object({ birdId: z.string() }),
    },
    async ({ birdId }) => ruled(() => game().flock.retire(birdId))
  );

  server.registerTool(
    "buy_land",
    {
      title: "Buy Land Tokens",
      description: TOOL_DESCRIPTIONS.buy_land,
      inputSchema: z.object({ amount: z.number().int().describe("Whole LT to buy") }),
    },
    async ({ amount }) => ruled(() => game().farms.buyLand(game().farmId, amount))
  );

  server.registerTool(
    "roll_gacha",
    {
      title: "Roll the Gacha",
      description: TOOL_DESCRIPTIONS.roll_gacha,
    },
    async () => ruled(() => game().gacha.roll())
  );

  server.registerTool(
    "roll_gacha_bundle",
    {
      title: `The ${ECONOMY.BUNDLE_ROLLS}-Roll Bundle`,
      description: TOOL_DESCRIPTIONS.roll_gacha_bundle,
    },
    async () => ruled(() => game().gacha.bundle())
  );

  return server;
}

async function handleMcp(request: NextRequest): Promise<Response> {
  // Low-security beta auth by design: farm key via ?key= or x-farm-key.
  // Single-farm fallback keeps local dev zero-friction.
  const database = db();
  const farmsApi = new Farms(database);
  const key =
    request.headers.get("x-farm-key") || new URL(request.url).searchParams.get("key") || null;
  let farmId: string | null = null;
  if (key) {
    try {
      farmId = farmsApi.byKey(key).id;
    } catch {
      farmId = null; // bad key → tools will say so via ruled()
    }
  } else {
    farmId = farmsApi.soleFarm()?.id ?? null;
  }

  const server = createServer(farmId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export const GET = handleMcp;
export const POST = handleMcp;
export const DELETE = handleMcp;
