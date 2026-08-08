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
  CALENDAR,
  CARD,
  CARRIAGES,
  CLAIMER,
  COVERS,
  DISTANCE_STATS,
  ECONOMY,
  ENTRY_FEES,
  FARM_COLORS,
  FIGHTS_PER_GROUP_BIRD,
  FIGHT_MODES,
  FIGURE,
  GROUP,
  FORMATS,
  FORMAT_NAMES,
  GACHA_BIRDS,
  GACHA_TOKENS,
  GACHA_WEIGHTS,
  JUVENILE_MAJOR,
  LAND,
  LOBBIES,
  LT_CENTS,
  NW_CAP,
  PINTAKASI,
  STAKER_FLOWS,
  STARS,
  STAT_NAMES,
  WEATHER,
  barnCapacity,
  feeFor,
  fmtLt,
  nextExpansionCost,
  landForFight,
  landPotShare,
  purseShareOf,
  stakePerFight,
} from "@/engine/config";
import { splitBreedFee } from "@/engine/breeding";
import { GRADE_BAND } from "@/engine/grades";
import { fmtGp } from "@/engine/events";

// Claimers run through enter_claimer (they carry a tag + take claims), so the
// class dial on enter_lobby is the rest of the ladder. DERIVED from LOBBIES
// rather than typed out: round 31 merged nw2 into nw3 and a hand-written list
// would have gone on offering a class the engine no longer has.
const ENTRY_CLASSES = LOBBIES.filter((c) => c !== "claimer") as unknown as [string, ...string[]];
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
// ── THE FEE LADDER (round 42) — every rung is priced ────────────────────────
// ⚠ ECONOMY.REAL_ENTRY_FEE and ECONOMY.JUVENILE_ENTRY_FEE ARE DELETED. There
// used to be ONE price per division, so a maiden and the open cost the same and
// the class ladder carried no economic weight at all. Now the price is a
// function of (mode, class, tag) and every figure below goes through feeFor() —
// the same door lobbies.ts bills through — so a reprice moves this prose with
// it and no rung can be quoted at another rung's price.
const juvMaidenFee = feeFor("juvenile", "maiden");
const juvOpenFee = feeFor("juvenile", "open");
const realMaidenFee = feeFor("real", "maiden");
const realNw3Fee = feeFor("real", "nw3");
const realOpenFee = feeFor("real", "open");
/** "48 GP / 96 GP / 144 GP" — every rung carries its unit, because a rung with
 *  no "GP" on it reads as a tag price, and the tags are a DIFFERENT ladder. */
const gpRungs = (fees: readonly number[]) => fees.map((f) => `${f} GP`).join(" / ");
const juvClaimerFees = gpRungs(ENTRY_FEES.juvenile.claimer);
const realClaimerFees = gpRungs(ENTRY_FEES.real.claimer);
// The whole ladder in one breath, per season. Juvenile nw3 is priced in config
// so the lookup is total, but the juvenile card never posts it (see CARD), so
// naming it here would offer an agent a fight that does not exist.
const juvLadder = `maiden ${juvMaidenFee} GP · open ${juvOpenFee} GP · claimer ${juvClaimerFees}`;
const realLadder = `maiden ${realMaidenFee} GP · nw3 ${realNw3Fee} GP · open ${realOpenFee} GP · claimer ${realClaimerFees}`;
// How much dearer the top of the ladder is than the bottom — the headline of
// the round, stated as a multiple so it survives a reprice.
const openVsMaiden = +(realOpenFee / realMaidenFee).toFixed(1);
// ⚠ THE POT IS TWO STAKES, NOT TWO ENTRIES (round 34). One entry buys a GROUP
// of fights and the fee splits across them, so a fight's pot is 2 ×
// stakePerFight — this used to read REAL_ENTRY_FEE * 2 and would now overstate
// every purse in the game by a factor of FIGHTS_PER_GROUP_BIRD.
const potCentsOf = (fee: number) => stakePerFight(fee) * 2 * 100;
const maidenStake = stakePerFight(realMaidenFee);
const openStake = stakePerFight(realOpenFee);
const juvMaidenStake = stakePerFight(juvMaidenFee);
const maidenPotCents = potCentsOf(realMaidenFee);
const openPotCents = potCentsOf(realOpenFee);
const openRakeCents = Math.round(openPotCents * STAKER_FLOWS.FIGHT_RAKE);

// How much bigger the head-to-head element edge is than the day's weather —
// the ORDER of those two terms is the whole ruling (round 24 re-balanced
// weather down to a quarter of it), so it's stated as a ratio rather than as
// two numbers a reader has to divide for themselves.
const elementVsWeather = +(BATTLE.ELEMENT_EDGE / WEATHER.EDGE).toFixed(1);

// Land per daily-card NIGHT, by rung. Hardcore is NOT here any more (round 31
// took it off the card entirely), and since round 42 a championship does not
// mint per fight at all — it splits one fixed pot (see the LAND_POT block
// below), so there is no second curve left to describe.
//
// ⚠ landForFight RETURNS HUNDREDTHS OF A TOKEN since round 36, so these are
// raw award figures and must NEVER reach a string un-formatted — a full real
// maiden night is 1015, and printing that promises an agent 1,015 Land Tokens.
// Every display goes through fmtLt; every RATIO divides by LT_CENTS first, or
// the LT-per-GP comparison below comes out a hundredfold too generous.
//
// ⚠ THE CURVE ITSELF DID NOT MOVE IN ROUND 42 (FEE_PER_TOKEN, FIGHT_EXPONENT
// are untouched) — the FEES feeding it did, so every land figure in this file
// changed anyway. That is exactly why none of them may be typed.
const landOf = (fee: number) => fmtLt(landForFight(fee));
const landPerGpOf = (fee: number) => (landForFight(fee) / LT_CENTS / fee).toFixed(3);
const juvMaidenLand = landOf(juvMaidenFee);
const juvOpenLand = landOf(juvOpenFee);
const realMaidenLand = landOf(realMaidenFee);
const realOpenLand = landOf(realOpenFee);
const realMaidenLandPerGp = landPerGpOf(realMaidenFee);
const realOpenLandPerGp = landPerGpOf(realOpenFee);
const juvMaidenLandPerGp = landPerGpOf(juvMaidenFee);
// The round-number land knobs, back in whole tokens for display.
const gachaLand = LAND.PER_GACHA_ROLL / LT_CENTS;
const dailyLandCap = (LAND.DAILY_BUY_CAP / LT_CENTS).toLocaleString();
const studSeatLand = (COVERS.STUD_LISTING_LT / LT_CENTS).toLocaleString();

// ── What a finish is actually worth (round 40) ──────────────────────────────
// The purse is no longer a table of shares by finishing stage; it is paid on
// FIGHTS WON (see PINTAKASI.PURSE and Tournaments.resolve). So the percentages
// an agent quotes to a player have to be WORKED OUT the way the bracket works
// them out, exactly as src/app/wiki/pintakasi/page.tsx does it — never typed,
// or the day a knob moves this prose starts lying.
//
// ADVANCEMENT splits across every fight won, a round-r win scoring m^(r-1)
// where m is the purse's ROUND_MULTIPLIER; CHAMPION and RUNNER_UP are bonuses
// on top. (A full bracket has no byes, and a bye is not a win, so counting
// forward from the bracket size gives the engine's own answer.)
//
// ⚠ ROUND 41 PUT A PRICE ON THE DOOR, so a share of the purse is no longer the
// number a player asks about — "does this finish get my entry back?" is. The
// honest answer is a THRESHOLD, because the purse changes week to week with
// the juice pool and the size of the field: fee ÷ share is the smallest purse
// at which a finish repays the entry. Computed, never typed, so a reprice or a
// multiplier change moves the agent's advice with it.
//
// ⚠ ROUND 42 CHARGES AT BOTH STAGES. The juvenile crown was the free one for
// exactly one round (41); it costs GP now, so the break-even question is live for a
// chick too and `breakEvenAt` takes the fee rather than closing over the
// Majors'. A `=== 0` branch on either fee would now be dead code that reads
// like a live rule.
// A worked example an agent can repeat to a player: one full bracket, the two
// ends of it. Both divisions cap at the same size today; each reads its own.
const majorBracket = Math.min(32, PINTAKASI.MAX_BRACKET);
const juvenileBracket = Math.min(32, JUVENILE_MAJOR.MAX_BRACKET);
const pct1 = (n: number) => `${(n * 100).toFixed(1)}%`;
const majorChampionPct = pct1(
  purseShareOf(majorBracket, PINTAKASI.PURSE, Math.log2(majorBracket), "champion")
);
const majorOneWinPct = pct1(purseShareOf(majorBracket, PINTAKASI.PURSE, 1, "none"));
const juvenileChampionPct = pct1(
  purseShareOf(juvenileBracket, JUVENILE_MAJOR.PURSE, Math.log2(juvenileBracket), "champion")
);
const juvenileOneWinPct = pct1(purseShareOf(juvenileBracket, JUVENILE_MAJOR.PURSE, 1, "none"));
// The two prices, and the break-even purses that make them concrete.
const majorFee = PINTAKASI.ENTRY_FEE;
const juvenileFee = JUVENILE_MAJOR.ENTRY_FEE;
const majorMult = PINTAKASI.PURSE.ROUND_MULTIPLIER;
const juvenileMult = JUVENILE_MAJOR.PURSE.ROUND_MULTIPLIER;
const breakEvenAt = (fee: number, share: number) =>
  share > 0 && fee > 0 ? Math.ceil(fee / share).toLocaleString() : "0";
const majorOneWinBreakEven = breakEvenAt(
  majorFee,
  purseShareOf(majorBracket, PINTAKASI.PURSE, 1, "none")
);
const majorChampionBreakEven = breakEvenAt(
  majorFee,
  purseShareOf(majorBracket, PINTAKASI.PURSE, Math.log2(majorBracket), "champion")
);
const juvenileOneWinBreakEven = breakEvenAt(
  juvenileFee,
  purseShareOf(juvenileBracket, JUVENILE_MAJOR.PURSE, 1, "none")
);

// ── ONE FIXED LAND POT PER CROWN (round 42) ─────────────────────────────────
// ⚠ THIS REPLACES TWO DELETED MECHANICS, and both leave sentences behind that
// no compiler can catch. Gone: `landForTournamentFight()` (the Majors' own,
// steeper land curve, minting per fight) AND the elimination GRANT ladder that
// paid the earliest-eliminated bird the MOST land. Any prose about "land to the
// fallen", or a first-round death being softened by a big land grant, is now
// exactly backwards and had to be deleted rather than reworded.
//
// The live rule: a crown holds a FIXED pot, divided evenly across every fight
// ACTUALLY FOUGHT in the bracket — a bird's share is its fights over every
// fighter slot in the bracket (landPotShare). Three consequences an agent must
// be able to reason about: a deeper run earns more, a BYE earns nothing, and a
// THIN FIELD PAYS EACH BIRD MORE because the same pot divides fewer ways.
//
// A full bracket runs bracket − 1 fights, so it has 2 × (bracket − 1) fighter
// slots; a champion fights log2(bracket) of them. The thin-field figure is the
// actionable one — it is why entering a quiet crown early is rewarded.
const majorLandPot = (PINTAKASI.LAND_POT / LT_CENTS).toLocaleString();
const juvenileLandPot = (JUVENILE_MAJOR.LAND_POT / LT_CENTS).toLocaleString();
const slotsIn = (bracket: number) => 2 * (bracket - 1);
const majorFightLand = fmtLt(landPotShare(PINTAKASI.LAND_POT, slotsIn(majorBracket), 1));
const majorCrownLand = fmtLt(
  landPotShare(PINTAKASI.LAND_POT, slotsIn(majorBracket), Math.log2(majorBracket))
);
const thinBracket = Math.min(8, PINTAKASI.MAX_BRACKET);
const thinFieldFightLand = fmtLt(landPotShare(PINTAKASI.LAND_POT, slotsIn(thinBracket), 1));
const juvenileFightLand = fmtLt(
  landPotShare(JUVENILE_MAJOR.LAND_POT, slotsIn(juvenileBracket), 1)
);
const juvenileCrownLand = fmtLt(
  landPotShare(JUVENILE_MAJOR.LAND_POT, slotsIn(juvenileBracket), Math.log2(juvenileBracket))
);

// How many fights a day the card posts — summed from CARD's own slot counts
// rather than counted off one cardOfDay() call, because the instructions are
// built once at module load and a single day is not the schedule.
const cardKeysPerDay =
  Object.values(CARD.real).reduce((a, b) => a + b, 0) +
  Object.values(CARD.juvenile).reduce((a, b) => a + b, 0);
// Thursday thins the adult open, so the Majors' crown day posts one fewer.
const crownDayKeys = cardKeysPerDay - (CARD.real.open - CARD.CROWN_DAY_OPEN_BLADES);
// How much of the blade dial the discovery year sees each night. Round 32
// widened juvenile open specifically because a juvenile career is exactly one
// game-week long, so it is stated as a fraction of the dial — an agent
// planning a chick's seven days needs to know the wait is short.
const juvenileOpenBlades = `${CARD.juvenile.open} of the ${FORMAT_NAMES.length}`;

/**
 * The instructions block an agent-player reads once, at connect time. Every
 * number is interpolated from config so a knob change can't leave this
 * lying — see the header comment above and src/engine/docs.test.ts.
 */
export const MCP_INSTRUCTIONS: string[] = [
  "Pintakasi: Bloodlines — a digital sabong game. YOU are the game client: narrate fights and hatch days with color, present choices clearly, and let the player decide.",
  "YOUR FARM: every player (human or agent) runs a named farm with a country flag and two colors. No farm on this connection? register_farm, save the key, and reconnect with ?key=… on the MCP URL. (When only one farm exists, the key is optional.)",
  `THE DAILY RITUAL: check_in once per game-day — it pays the GP drip ($${usd(ECONOMY.DAILY_DRIP)} = ${ECONOMY.DAILY_DRIP} GP) and ${ECONOMY.FREE_PULLS_PER_CHECK_IN} free gacha pull. Do it first thing.`,
  "THE LOOP: breed retired birds → the hen is pregnant NOW, the egg is LAID next Friday (freeing her for another cover) and HATCHES the Friday after as an age-1 chick → juvenile through the discovery year → real fights from age 2 → at age 3 the fork opens: the Pintakasi Majors (hardcore, and the only hardcore left in the game) AND safe retirement → retire (or lose in the Majors) → the retiree becomes breeding stock → a better bird.",
  `AGE GATES: ${AGE.EGG} = egg · ${AGE.CHICK} = juvenile only · ${AGE.REAL_STAKES}+ = real fights · ${AGE.FORK}+ = the Majors + manual retirement · ${AGE.FIGHTING_CAP} = force-retired. Ages advance every Hatch Friday (tick_week); one game-week = one bird-year.`,
  "STATS ARE FIXED AT BIRTH, AND HIDDEN UNTIL RETIREMENT (round 28 — the fog). There is NO training, and there is no sheet to read on a live bird: the six fighting stats show as null until the career ends (retirement, a hardcore loss, or the age cap — any of them reveals the sheet). The skill is DISCOVERY, for real now: fight the juvenile year across blades, read the scout report on get_bird (figures per blade, shrunk toward a neutral prior), and learn what the bird already is. Stars, element, carriage, the record AND the bird's overallGrade stay visible — they are the card, not the sheet. The overall grade is the deliberate exception: it says HOW STRONG the bird is (six-stat average as a letter) and never WHAT SHAPE it is, so a B+ sprinter and a B+ stayer read identically — quote it freely, it gives a fresh hatch something to be proud of and a claim something honest to bid on. Never guess a live bird's stats to a player; present the scout report instead.",
  `CARRIAGE IS THE SECOND AXIS (round 23) — every bird also carries a rating of ${CARRIAGES.join(" or ")} (pang-baba/pang-itaas — the low-working shuffler vs. the flyer that comes over the top), rolled at birth or gacha and inherited at breeding the same way stars are. It shows on get_bird and list_flock. IT IS DATA ONLY FOR NOW: it is NOT wired into the fight engine yet, so it never changes tonight's outcome — mention it as part of a bird's profile, but don't imply it swings a fight.`,
  `EVERY FIGHT IS PvP — PURE, BETWEEN BARNS. The house supplies nobody. The rhythm: during the game-day you ENTER birds into lobbies (enter_lobby / enter_claimer); at the day tick every lobby GOES OFF. Entries are BINDING (fee escrowed, the bird's one entry for the day spent). LOBBIES ARE UNBOUNDED (round 31): there is exactly ONE lobby per posted fight per day and it grows without limit, so there is no room to be shut out of and nothing to gain by camping — entering early and entering late land you in the same field. What a big lobby costs you is certainty: the deal is random, so a deep field is a deeper lottery over who you draw.`,
  `THE GROUP STAGE (round 34 — it changes what an entry IS). A closing lobby no longer draws PAIRS. It deals its field into GROUPS of at most ${GROUP.SIZE}, and inside a group EVERYBODY FIGHTS EVERYBODY: one entry buys up to ${FIGHTS_PER_GROUP_BIRD} FIGHTS IN ONE NIGHT, not one. Group sizes are LEVELLED, not packed (nine birds = 3+3+3, never ${GROUP.SIZE}+${GROUP.SIZE}+1), so no bird is ever left out unless it was the ONLY bird in the room — the old "odd lobby strands one bird" problem is gone. Matchmaking still NEVER pairs two birds of the same barn, and the deal actively SPREADS your birds across different groups: enter several birds in one lobby freely. If two of yours do land together, that one fight is skipped and both simply fight fewer times. THE FEE SPLITS ACROSS THE FIGHTS: it escrows whole at the door, each fight risks ONE SHARE (a ${realMaidenFee} GP real maiden night = ${maidenStake} GP a fight · a ${realOpenFee} GP real open night = ${openStake} GP a fight · a ${juvMaidenFee} GP juvenile maiden night = ${juvMaidenStake} GP a fight), and whatever the bird never got to risk is REFUNDED at post. So a bird that fought ${FIGHTS_PER_GROUP_BIRD - 1} of ${FIGHTS_PER_GROUP_BIRD} gets one share back. Tell the player this plainly when they see a price: THE NUMBER ON THE DOOR IS THE NIGHT, NOT THE FIGHT — every fee divides by ${FIGHTS_PER_GROUP_BIRD} exactly, so divide it yourself before you tell them what a fight costs. Three figures at one blade in one night is also the cheapest read on a bird you will ever get — card birds MORE, not less.`,
  `THE CLASS LADDER IS PRICED (round 42 — THE NEWEST RULE IN THE GAME, and it reverses how every fee in it worked). There is no flat entry fee any more. Until now one price covered a whole division, so a maiden and the open cost the same and climbing the ladder was a pure sporting decision with no money in it. Now EVERY RUNG HAS ITS OWN PRICE. GROWN: ${realLadder}. DISCOVERY YEAR: ${juvLadder} — exactly half the grown price at every rung, and the juvenile card posts no nw3 at all. Standing in the open costs ${openVsMaiden}× what a maiden costs, so quote the price of the SPECIFIC fight you are proposing and never a division's "usual" fee. WHY IT IS WORTH CLIMBING: land is minted on a curve steeper than linear, so a dearer night pays disproportionately more Land Token — a full real open night mints ${realOpenLand} LT (${realOpenLandPerGp} LT per GP risked) against a real maiden's ${realMaidenLand} LT (${realMaidenLandPerGp} LT/GP) and the discovery year's ${juvMaidenLand} LT (${juvMaidenLandPerGp} LT/GP). Fighting up pays extra PER GP, not merely more of it. WHY IT IS A REAL DECISION: everything is priced against the ${ECONOMY.BREED_FEE} GP breed fee — A BODY IS CHEAP AND A NIGHT IS DEAR. One open night is nearly two covers, so a bird that can win there earns back its own creation cost in an evening, and a bird that cannot is burning breeding money three fights at a time. THE ADVICE TO GIVE A PLAYER: campaign an unknown bird DOWN the ladder (a maiden, an nw3, the cheap claimer rung) where a wrong read costs little, and spend up to the open only once the scout report says the bird belongs there. Do the arithmetic out loud before you enter — an agent that cards a chick into the ${juvOpenFee} GP juvenile open every night will empty a wallet faster than the drip fills it.`,
  `THE CARD IS PUBLISHED, AND IT IS THE DOOR (round 31 — the rule that changed how you play). Lobbies are no longer conjured by asking for them. Each game-day POSTS a card of about ${cardKeysPerDay} fights (${crownDayKeys} on ${DAY_NAMES[PINTAKASI.DAY_OF_WEEK]}, when the Majors take the veterans off the daily card), and a bird may only be entered into a fight that is ON it — an off-card key is refused at the door, no matter how sensible it sounds. WHAT ROTATES IS THE BLADE, NOT THE CLASS: every class runs every day in both divisions (adult ${LOBBIES.join(" · ")}, and juvenile open · maiden · claimer), so no bird is ever left with nowhere to go; which BLADES each class runs is what changes from day to day, and the claimer tags rotate with them. So the perfect fight is often NOT available tonight, and that is the whole point: waiting for your bird's exact blade can cost it three or four days of fighting, so the usual right call is to SETTLE for close-enough and take the fuller field. get_state returns the card for TODAY and TOMORROW (it is a pure function of the date, like the weather), and lobby_board lists tonight's in full — read one of them BEFORE you promise a player a fight, and holding a bird back a day for tomorrow's blade is a real, plannable play. THE DISCOVERY YEAR IS THE EXCEPTION TO THE WAITING (round 32): juvenile open is dealt ${juvenileOpenBlades} blades every night, as wide a rotation as any class on the card gets, because a juvenile career is only ${CALENDAR.DAYS_PER_WEEK} game-days long — at a narrower rotation a chick could age out having never been offered two of the five blades, and the discovery year would have failed at the one job it has. So a one-year-old almost never waits more than a day or two for a given blade: card it at a NEW distance whenever one is posted rather than repeating the one you already have a read on.`,
  `THE ECONOMY IS POOLED ($1 = ${ECONOMY.GP_PER_DOLLAR} GP): each fight's pot is TWO STAKES — one share from each bird, NOT two entry fees, and the share depends on the RUNG (${maidenStake} GP a side in a real maiden, ${openStake} GP a side in the open). ` +
    (STAKER_FLOWS.FIGHT_RAKE === 0
      ? `The winner takes the whole pot — the daily card rakes nothing (round 23 zeroed it back to a pure pot; the plumbing stays wired at 0% so a future season could turn it back on). So a real maiden fight pays the winner ${fmtGp(maidenPotCents)} GP and an open fight ${fmtGp(openPotCents)} GP, and a bird that sweeps a full group of ${FIGHTS_PER_GROUP_BIRD} in the open banks ${fmtGp(openPotCents * FIGHTS_PER_GROUP_BIRD)} GP off its ${realOpenFee} GP entry.`
      : `The winner takes the pot LESS a ${fightRakePct}% rake to the Land Token stakers — an open fight's ${openStake * 2} GP pot pays ${fmtGp(openPotCents - openRakeCents)}.`) +
    ` No fight ever prints GP. WHAT A WIN BANKS, BESIDES THE POT: the GP goes onto the bird's CAREER EARNINGS, and career earnings are the Selection Committee's seating order for the Majors (round 37 deleted the old qualification-points counter outright — there is no second scoreboard to bank any more). Each fight in the group counts on its own, so a bird that sweeps a full group of ${FIGHTS_PER_GROUP_BIRD} moves a long way up that list in one night. Losses subtract nothing; they just add nothing. The subsidy is LAND: it pays ONCE PER ENTRY at settle-up, on the TOTAL the bird actually risked, on a curve steeper than linear (a full card of ${FIGHTS_PER_GROUP_BIRD}: juvenile maiden ${juvMaidenLand} LT · real maiden ${realMaidenLand} LT · real open ${realOpenLand} LT; a short card pays less, honestly — it risked less). A CHAMPIONSHIP DOES NOT USE THIS CURVE AT ALL (round 42): its land is one fixed pot split across the bracket — see the Pintakasi paragraph. LAND COMES IN FRACTIONS (round 36): awards are minted in HUNDREDTHS of a token, so a real maiden night pays ${realMaidenLand} LT and not a round number — quote the decimals, they are real. The rule of thumb for a player: you EARN fractional land, you BUY and STAKE whole tokens. Fighting UP into dearer company pays extra land PER GP RISKED, not merely more of it — a full real open night pays ${realOpenLandPerGp} LT/GP against a real maiden's ${realMaidenLandPerGp} and the discovery year's ${juvMaidenLandPerGp}. That ordering is now guaranteed by construction and you may state it flatly: hundredths made the rounding too small to outweigh the curve, and a test pins the direction across every entry fee from 1 to 300 GP. (It was briefly INVERTED in round 34, when land minted in whole tokens and rounding at the cheap end was worth more than the exponent; round 36 removed the cause, and handed back the across-the-board haircut round 34 had used to paper over it, so every land award is slightly larger than last round's.) A bird that drew NOBODY earns none: land is for FIGHTING, not queueing. Land is also buyable (buy_land, $${usd(LAND.GP_PER_100_TOKENS)}/LT, capped at ${dailyLandCap} LT/game-day) and NEVER sellable.`,
  `ONE ENTRY PER BIRD PER GAME-DAY — a hard count, not a cooldown (it is one CARD, which is now up to ${FIGHTS_PER_GROUP_BIRD} fights). A full barn is how you card more than one bird a day.`,
  "WEAPON FORMATS ARE THE DISTANCE DIAL, enumerated B1–B5 from sprint to deep-water classic (round 27 gave the dial its true middle): every fight blends ALL FOUR distance stats, weighted per blade — B1 the sprint (agility keys it), B2 the hybrid (sight), B3 the exact middle (all four stats weigh THE SAME, so the flat, balanced bird is best there — the one blade with no key stat), B4 the marathon (stamina — the fuel tank), B5 the deep-water classic (gameness rules the end). Every stat counts a LITTLE everywhere; the weights decide how much. Any bird can enter any format; it's just disadvantaged outside its type.",
  "WIND AND FUEL (round 27): every bird starts every fight with the same 100 wind — no stat buys hit points. Stamina is the FUEL TANK instead: it sets how many turns the bird fights at full power, and when the tank empties the bird HITS THE WALL — its agility and sight halve for the rest of the fight. Gameness never fades (heart is mental) and also decides, once per fight, whether a badly hurt bird stands or RUNS. Sprints end before any tank empties; the long blades are decided by who is still at full book in the deep water.",
  `CLASSES ARE THE LADDER: open · maiden (never-winners only) · nw3 (fewer than ${NW_CAP} STAKES wins — round 31 merged the old nw2 into it, so there is now ONE conditioned rung between maiden and open) · claimer (priced). The classes NEST — maiden ⊂ nw3 ⊂ open — so a young bird always has a softer class it may drop into, and a veteran always has open. EVERY RUNG HAS ITS OWN PRICE since round 42 (grown ${realLadder}; discovery year about half that) — the ladder is an economic decision now, not just a sporting one. The discovery year runs its OWN, smaller ladder (round 23) — open, maiden, and claimer only; nw3 stays out, since a one-year-old hasn't fought long enough to have the stakes record it sorts by. ⚠ BUT IT NO LONGER HAS ITS OWN CLAIMING TAGS (round 42 deleted the cheap juvenile rungs): there is ONE tag ladder for both seasons, ${CLAIMER.PRICES.join("/")} GP, because a juvenile that has campaigned a real card is worth something like a grown bird. What still differs by season is the ENTRY — the tag says what the BIRD costs, the entry says what the NIGHT costs, and a juvenile pays half (${juvClaimerFees} against the grown ${realClaimerFees}). The field is WHOEVER ENTERS — but the board is FOGGED while a lobby is OPEN: lobby_board shows every lobby and its fill count, NEVER whose birds are inside (no dodging — predicting a lobby's strength from its mode, class, and tag is the skill). The one exception: CLAIMER fields are fully visible (stars, records, figures — never stats), because claims are placed on specific birds. Fighting for a tag is choosing to be seen.`,
  "CARDS RUN THREE STATES (PFL-style): OPEN (taking entries, fogged) → CLOSED (entries locked, GROUPS DEALT AND REVEALED — the fog lifts and each entry's `drew` lists the birds it fights tonight) → COMPLETED (every fight in every group run, unrisked stakes refunded, land paid, claims settled). On manual ticks close and post happen together; on the real-time clock claimers close at 6 PM PH for an evening claiming window, everything else minutes before the 11:55 PM post. Claims flow until the lobby completes — a last-second claim either makes it or it's too late.",
  `CLAIMERS ARE THE MARKETPLACE — farm-to-farm, escrowed, PRE-FIGHT: enter_claimer cards a bird at a tag price from ONE ladder shared by both seasons (${CLAIMER.PRICES.join(" / ")} GP — round 42 deleted the separate juvenile rungs, so a chick and a veteran are tagged on the same prices; the ladder brackets the ${ECONOMY.BREED_FEE} GP breed floor, one rung under it and two over). What the bird's age DOES decide is the entry fee, which the tool reads off the bird itself rather than asking: ${juvClaimerFees} juvenile against ${realClaimerFees} grown, rung for rung. Other farms place_claim with the tag escrowed; claims are SEALED. At post time the bird fights its whole GROUP for its ORIGINAL owner (who keeps every prize), then one claim wins (RNG if several — losers refund in full), and the owner banks the tag as the bird transfers. NO FIGHT, NO CLAIM (round 23, softened round 34): if the bird drew NOBODY AT ALL, its entry fee refunds AND every claim standing on it refunds too — a sale needs a fight to actually happen. But ONE fight is enough: a short group (the bird fought once or twice instead of ${FIGHTS_PER_GROUP_BIRD}) still sells, because a short card is the lobby's fault, not the bird's. You cannot claim your own bird. The house never claims. Winning AND getting claimed is an income spike — a legitimate play. Claiming undervalued birds and racing them UP is a full playstyle.`,
  `DISCOVERY — THE PIT FIGURE, REBUILT ROUND 30: every fight returns a figure on a FIXED scale, so numbers mean the same thing forever and across every blade. A perfectly even bird with ${FIGURE.PEG_STAT} in every stat posts ${FIGURE.PEG_FIGURE} when it wins; one letter grade is worth exactly ${(GRADE_BAND / FIGURE.PEG_STAT) * FIGURE.PEG_FIGURE} figure points at every rung of the ladder, and there is NO ceiling — a bred monster posting 140 really is that good. Today's starters read in the 20s and 30s. READ IT TWO WAYS. (1) ACROSS BLADES: the figure is built from what each blade TESTS, so a bird posts its biggest number at the blade that suits it. Compare a bird’s own figures blade to blade (get_bird’s scoutReport does this for you) — the gap IS the bird’s shape, and it gets LOUDER as a bird gets better, not quieter. (2) AGAINST ITS GRADE: the figure weighs only the four distance stats, while overallGrade averages all six. A bird figuring below what its grade suggests is carrying its weight in station and condition — heart and form, not blade. That gap is a real read, not an error. THE NIGHT MOVES IT up to ${FIGURE.NIGHT_RANGE * 100}% either way: condition, the element wheel, the day’s weather, station’s clawback when outmatched, and emptying the fuel tank in a long fight. A LOSS is marked down by how far the bird finished behind. So one figure is an opinion and three are evidence — figures are deliberately imprecise, and you must never present one as exact truth.`,
  `STARS ARE THE ELEMENT'S VOLUME KNOB (reworked round 26) — a bird's star rating (0 to ${STARS.MAX_HALF_STARS / 2}★ in half-steps) scales every edge its element grants: the head-to-head wheel edge AND the daily weather edge are each multiplied by stars/${STARS.MAX_HALF_STARS / 2}. A ${STARS.MAX_HALF_STARS / 2}★ bird at a favorable matchup gets the full +${BATTLE.ELEMENT_EDGE}; a 2.5★ bird gets half; a 0★ bird's element is a color on the card and NOTHING more — never sell a 0★ bird's matchup or its weather day as an edge. Stars do NOT add stat points anymore: a high-star bird with weak stats is a weak bird that punches hard on the right matchup. Stars are bred and pulled, not trained — that is what makes them worth chasing.`,
  `THE DAILY ELEMENT WEATHER (round 24) — one Element is ASCENDANT every game-day, the same for every fight on that day's card, rotating irregularly so a bird's day comes around without being predictable. A bird OF the ascendant element carries the weather edge — +${WEATHER.EDGE} at ${STARS.MAX_HALF_STARS / 2}★, scaled down by its stars, zero at 0★ — on every turn roll it takes that day; everyone else fights unchanged (there is no penalty for the wrong element). get_state names today's and tomorrow's — plan which STARRED birds you run around it. It STACKS with the head-to-head element edge (Fire beats Metal, Water beats Fire, and so on) but is DELIBERATELY the weaker of the two: that one is worth ${elementVsWeather}× the weather at the same stars. So weather COLORS a fight and the matchup DECIDES it — never talk a player out of a good blade or a soft field for a good sky. And it nudges the PIT FIGURE: a starred bird posts a slightly bigger figure on its own day than the same bird on an off day, so read every form line with that day's element in mind (get_bird's formBook stamps each past fight with the day's Element and flags the ones the bird ran with the edge).`,
  "HARDCORE — THE LOSER IS FORCE-RETIRED ON THE SPOT — NOW LIVES ONLY IN THE MAJORS (round 31). There is no hardcore mode on the daily card any more; a bird cannot be entered into one, and nothing you enter on an ordinary night can end its career. The one place a career is on the line is the Pintakasi Majors, which are hardcore throughout — so THAT is the charged decision, and enter_pintakasi is the tool that carries it. Always confirm with the player before registering a bird; never do it on your own judgment. (Old fights in a bird's form book may still be marked hardcore — that is history, from before the card, plus every Majors bout.)",
  `THE PINTAKASI — THE WEEKLY MAJORS: every ${DAY_NAMES[PINTAKASI.DAY_OF_WEEK]} (the week's last day), three blade championships crown specialists, the SAME three every week (round 27): ${FORMATS[PINTAKASI.BLADES[0]].label} the Sprint, ${FORMATS[PINTAKASI.BLADES[1]].label} the Middle, ${FORMATS[PINTAKASI.BLADES[2]].label} the Classic — the ends of the blade dial and its exact middle (${FORMATS.b2.label}/${FORMATS.b4.label} belong to the Juvenile Championship instead). Single elimination in ONE day, winners healing to full between rounds; HARDCORE THROUGHOUT — every loser force-retires (the Juvenile Championship the day before is the one exception in the whole game — see below). THURSDAY IS OPEN (round 37): ${majorFee} GP TO ENTER (a price since round 41 and DOUBLED in round 42 with the rest of the fee ladder — it was free from round 22 to round 40, so do not tell a player it costs nothing; against the daily card it sits between the dearest claimer night and a ${realOpenFee} GP open one), and AGE ${AGE.FORK}+ is the ONLY hard gate left at the door — the qualification-points threshold that stood here from round 22 is DELETED, and any active, named, age-${AGE.FORK}+ bird may register even with an empty record. What replaced it is not a threshold but a SEAT YOU MUST BE GOOD ENOUGH TO HOLD: ${PINTAKASI.MAX_BRACKET} seats per crown, and the SELECTION COMMITTEE seats them on CAREER EARNINGS (every GP the bird has ever won — daily-card pots plus banked purse). Registering is therefore NOT a guarantee of standing, and you must say so when you register a bird: at a full field a newcomer either OUTRANKS the current weakest (who is bumped, refunded, in public) or is REFUSED on the spot, and a bird that got in on Monday can be bumped out later in the week by a richer newcomer. Nothing is settled until ${DAY_NAMES[PINTAKASI.DAY_OF_WEEK]}. The practical advice: check pintakasi_board for where the bird sits, and if it is near the bump line, go and win real fights on the daily card — that is the only thing that moves it up. (Why the change: a fixed threshold was binary and invisible, while a ranking is continuous and READABLE off the bird's own card.) One crown per bird and up to ${PINTAKASI.MAX_PER_BARN} birds from one barn in the same championship (enter_pintakasi any day up to ${DAY_NAMES[PINTAKASI.DAY_OF_WEEK]} itself). WHAT THE ${majorFee} GP BUYS (round 41): it is NOT a gate — it does not decide who stands and buys no advantage in the bracket — it is PURSE. Every entry fee paid at a crown is added WHOLE to that same crown's purse, with no rake, so the purse = entry fees + the week's juice-pool share (after the Juvenile Championship's slice comes off the top). Why it stopped being free: the purse used to be pure juice, meaning gacha buyers and breeders bankrolled a stage they might never enter, while an entrant paid 0% of what it was drawing from. Now the crowns follow the same principle as the daily card — the money in the pot is the money the fighters put there. The fee ESCROWS at registration and REFUNDS in full if the committee bumps the bird or the championship is cancelled, so a barn only ever pays for a crown its bird actually stands in. THE PURSE PAYS EVERY WIN (RE-RULED ROUND 40 — SAY THIS OUT LOUD, IT REVERSES THE OLD RULE): it is NO LONGER a table of shares by finishing place. It splits three ways — ADVANCEMENT ${(PINTAKASI.PURSE.ADVANCEMENT * 100).toFixed(0)}% across EVERY FIGHT WON in the bracket, a CHAMPION bonus of ${(PINTAKASI.PURSE.CHAMPION * 100).toFixed(0)}% and a RUNNER_UP bonus of ${(PINTAKASI.PURSE.RUNNER_UP * 100).toFixed(0)}% on top — and a win in each round is worth ${majorMult}× a win in the round before (round 41 softened this from double: at double, a first-round win in a full ${majorBracket}-bird bracket paid LESS than the entry, and "every win pays" has to mean every winner clears the door; round 42 doubled the door and moved the SHARES rather than the multiplier to keep that true, which is why advancement now takes ${(PINTAKASI.PURSE.ADVANCEMENT * 100).toFixed(0)}% and the trophy less than it used to). So winning ONE Major fight and going out now pays real GP (in a full ${majorBracket}-bird bracket: ~${majorOneWinPct} of the purse for one win, ~${majorChampionPct} for the crown). ⚠ A SHARE IS NOT GP — the purse changes every week, so quote the BREAK-EVEN instead: at ${majorBracket} birds one win repays the ${majorFee} GP once the purse tops ~${majorOneWinBreakEven} GP and the crown repays it at ~${majorChampionBreakEven} GP, and pintakasi_board prints the projected purse so you can check before you advise entering. In a ${PINTAKASI.MAX_BRACKET}-bird field the same pot splits across twice as many winners, so one win can still come out slightly behind the fee — say so on a busy week. ⚠ A BYE IS NOT A WIN and pays nothing — byes only exist because the field was short. A bird that never wins a fight is still paid zero GP, but that is now a CONSEQUENCE (nothing to pay it for), not a special rule, and the earned shares stretch to fill the purse. Tell a player entering a live one that the fight itself is worth money, not just the trophy. ⚠ THE LAND RULE REVERSED IN ROUND 42 — SAY THE NEW ONE AND FORGET THE OLD. Land at a crown used to be weighted to the FALLEN: elimination grants grew the earlier you went out, so a first-round death paid the most land. THAT IS GONE, along with the tournament land curve that minted per fight. A crown now holds ONE FIXED LAND POT — ${majorLandPot} LT for a Major, ${juvenileLandPot} LT for a juvenile crown — and it divides EVENLY ACROSS EVERY FIGHT ACTUALLY FOUGHT in the bracket: your share is your fights ÷ all the fights. So land now goes to the DEEP RUN, not the early exit (in a full ${majorBracket}-bird Major: ${majorFightLand} LT for winning one and going out, ${majorCrownLand} LT for the champion's ${Math.log2(majorBracket)} fights), and A BYE EARNS NO LAND because a bye is not a fight. ⚠ AND THE STRATEGIC FACT WORTH ACTING ON: A THIN FIELD PAYS EVERY BIRD MORE, because the same pot divides fewer ways — one fight in a field of just ${thinBracket} is worth ${thinFieldFightLand} LT against ${majorFightLand} LT in a full ${majorBracket}-bird bracket. Entering a quiet crown is rewarded, so read pintakasi_board's field size before you decide the week is too crowded to bother. The bracket is committee-seeded by career earnings → career wins → average figure, byes to the top seeds, and the field is PUBLIC all week (pintakasi_board) precisely so a farm can see who it would bump and who might bump it. This is where champions — and breeding legends — are made: pitch it to the player when a bird hits age ${AGE.FORK} strong.`,
  `THE JUVENILE CHAMPIONSHIP RUNS THE DAY BEFORE (round 23): every ${DAY_NAMES[JUVENILE_MAJOR.DAY_OF_WEEK]}, two crowns for age-${AGE.CHICK} birds only, on the two blades the Majors don't run — ${FORMATS[JUVENILE_MAJOR.BLADES[0]].label} and ${FORMATS[JUVENILE_MAJOR.BLADES[1]].label}, fixed, every week (round 27 killed the rotation; between the two stages all five blades crown somebody weekly). Qualify with ${JUVENILE_MAJOR.QUALIFYING_WINS} juvenile wins on the discovery-year ladder, up to ${JUVENILE_MAJOR.MAX_PER_BARN} birds per barn per blade, bracket capped at ${JUVENILE_MAJOR.MAX_BRACKET}. IT IS NOT HARDCORE — the ONE championship in the game that does not force-retire its losers, because the discovery year exists to find out what a bird is, and ending careers at age one would gut the population the Majors are meant to inherit. ⚠ IT IS NOT FREE ANY MORE (round 42, reversing round 41 — this crown was the one free stage in the game for exactly one round, so if you learned that rule, unlearn it): entry costs ${juvenileFee} GP, against a Major's ${majorFee}. Quote the JUVENILE number at a chick — the two stages carry separate fees on purpose — and remember why the price came back: a juvenile open night on the daily card now costs ${juvOpenFee} GP, so a free championship had become the cheapest serious fight available to a one-year-old, which is backwards. Its purse is a fixed ${(JUVENILE_MAJOR.JUICE_SHARE * 100).toFixed(0)}% slice of the week's juice pool, taken before Thursday's Majors get the rest, PLUS every entry fee paid at that crown, exactly as a Major's works. It pays the SAME WAY a Major's purse does (every fight won takes a share, a win in each round worth ${juvenileMult}× the round before, byes worth nothing) but the split is set FLATTER on purpose: ADVANCEMENT ${(JUVENILE_MAJOR.PURSE.ADVANCEMENT * 100).toFixed(0)}% / CHAMPION ${(JUVENILE_MAJOR.PURSE.CHAMPION * 100).toFixed(0)}% / RUNNER_UP ${(JUVENILE_MAJOR.PURSE.RUNNER_UP * 100).toFixed(0)}%, against a Major's ${(PINTAKASI.PURSE.ADVANCEMENT * 100).toFixed(0)}/${(PINTAKASI.PURSE.CHAMPION * 100).toFixed(0)}/${(PINTAKASI.PURSE.RUNNER_UP * 100).toFixed(0)}. In a full ${juvenileBracket}-bird juvenile bracket that is ~${juvenileChampionPct} of the purse for the crown and ~${juvenileOneWinPct} for a single win, where a Major pays ~${majorChampionPct} and ~${majorOneWinPct} — the discovery year is buying one behaviour, showing up with a live one and WINNING A FIGHT, so that is what it pays for. WHICH OF THE TWO CROWNS: a bird may hold ONE championship entry a week, so entering one crown spends the other — the chick has to declare. Declare for the blade its SCOUT REPORT reads better at (get_bird's per-blade figures): ${FORMATS[JUVENILE_MAJOR.BLADES[0]].label} is the short end of the dial and ${FORMATS[JUVENILE_MAJOR.BLADES[1]].label} the long one, and finding out which end a bird belongs to is the whole purpose of the discovery year. Nothing STOPS you entering either — a chick that reads the two dead even is a true middle-distance bird, and there is no crown for that yet, so pick the one with the softer field or the better read and treat the result as data. Register it with enter_pintakasi, division "juvenile".`,
  `WHEN AN EGG HATCHES, reveal its sex (hidden 50-50 while an egg) and prompt the player to name the chick (name_bird). Mystery Eggs from the gacha hatch the same way. THE NAMING LAW: a bird CANNOT fight while still wearing its auto-name ('Egg of …', 'Mystery Egg (…)') — entering is refused until name_bird is called. Make naming part of the hatch-day ritual, BEFORE the first card.`,
  "ONE LIFETIME RECORD (ruled round 15): juvenile, real, and hardcore fights ALL count toward the same wins-losses line, for birds and farms alike. NOTE: the record does NOT set stud prices — stud pricing is player speculation and supply/demand (flat " + ECONOMY.BREED_FEE + " GP for now).",
  `BREEDING IS PvP TOO — THE BARN: both parents retired, hen × rooster, not close kin. list_stud stands your retired roosters (${COVERS.PER_WEEK} covers/week public + ${COVERS.OWNER_RESERVED} owner-reserved, and costs ${studSeatLand} LT the FIRST time you open the seat — spent outright, not staked, not refundable); browse_studs shows a hen every stud she can take, with kin exclusions NAMED. A cover costs ${ECONOMY.BREED_FEE} GP flat (min AND max for now — player pricing later) and SPLITS ${breedStakerPct}% to land stakers / ${breedJuicePct}% fight juice / ${breedOwnerPct}% to the stud's owner. Hens pay, hens keep the egg. Selling covers is income; top studs capping out is by design.`,
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

  get_state: `The world calendar (in-game date, whether today is Hatch Friday) plus YOUR farm: GP wallet ($1 = ${ECONOMY.GP_PER_DOLLAR} GP), Land Tokens, free pulls, check-in status, barn occupancy. Also reports today's ascendant Element (the daily "weather" — birds of that element get a small edge on the card today) and tomorrow's, so you can plan which birds to run. AND \`card\`: the posted schedule for TODAY and TOMORROW — the ~${cardKeysPerDay} fights on offer each day as {mode, classType, format, price?} keys. A key that is not on today's card cannot be entered, so check this before choosing a bird's fight; tomorrow's is published for the same reason, so holding a bird back one day is a plannable move. Start here.`,

  list_flock:
    "Every bird in YOUR barn with derived age, element stars (e.g. '2.5★ Fire'), carriage, `generation` (0 = starter or gacha pull, otherwise the dam's generation + 1 — how many nests deep the line runs), record, and status (egg/active/retired). THE FOG (round 28): the six fighting stats read null while a bird can still fight — they REVEAL at retirement. `overallGrade` is ALWAYS present (power, not shape). A live bird is judged by its grade and its figures, not a sheet. Retired roosters show whether they're standing at stud (listedStud).",

  get_bird:
    "One bird in full: carriage, `generation` (bloodline depth — 0 for a starter or a gacha pull, dam + 1 for a bred chick; never fogged, it is pedigree rather than shape), lineage tree, and the DISCOVERY READOUT — `scoutReport` (all five blades: record, average and best Pit Figure, and a shrunk `score` per blade with `bestBlade` flagged; unraced blades score the neutral prior, so one loud figure never types a bird), the raw per-format lines (`formatRecords`), and `formBook`: every past fight stamped with that day's ascendant Element, `edge: true` marking fights run in its OWN weather (read those figures down a touch), plus `onEdge`/`offEdge` averages. THE FOG (round 28): the six stats are null while the bird can fight and REVEAL at retirement — on a retired bird this is the full sheet. `overallGrade` is public at every age.",

  name_bird:
    "Give a bird a player-chosen name — the ritual for a freshly hatched chick, and REQUIRED before its first fight (the naming law: auto-named birds are refused at the lobby door). Names are world-unique.",

  tick_day:
    `Move the WORLD calendar one day (all farms share the clock — coordinate in beta; the scheduler owns this later). Landing on a Friday triggers Hatch Friday. TONIGHT'S CARD GOES OFF: every open lobby deals its birds into groups of at most ${GROUP.SIZE} and runs every fight inside every group, then settles up (unrisked stake refunded, land paid, claims settled) — so ONE entry comes back as up to ${FIGHTS_PER_GROUP_BIRD} results. Narrate them as a night, not a single bout: a bird that went 2-1 in its group had a real evening, and the three figures together are the read. Resets daily limits (entries, check-in, land cap).`,

  tick_week:
    "Jump the WORLD clock to the next Hatch Friday (the aging tick). Eggs hatch into age-1 chicks — prompt the player to name them. Tonight's card goes off too.",

  breed:
    `Buy a cover: YOUR retired hen × a retired rooster — your own, or ANY farm's listed stud (browse_studs first). Costs ${ECONOMY.BREED_FEE} GP ($${usd(ECONOMY.BREED_FEE)}, min AND max for now), which SPLITS: ${fmtGp(breedSplit.stakerPoolCents)} GP to the land-staking pool, ${fmtGp(breedSplit.juicePoolCents)} to the fight-juice pool, ${fmtGp(breedSplit.studOwnerCents)} to the stud's owner. The hen's farm keeps the egg ('Egg of <mother>'). She is pregnant until the next Friday, then the egg lays and she is free for another cover; that egg hatches the Friday after. Covers are capped per rooster per week (${COVERS.PER_WEEK} public + ${COVERS.OWNER_RESERVED} owner-reserved).`,

  browse_studs:
    `The barn from one hen's point of view: every stud she CAN breed with (name, farm, stars, age, record, covers left, AND his full revealed six-stat sheet + overall grade — he is retired, so nothing about him is fogged; ${ECONOMY.BREED_FEE} GP each) plus the excluded ones WITH the reason (kin overlap named explicitly, or covered out this week). Candidates = every farm's listed studs + your own retired roosters.`,

  list_stud:
    `List a retired rooster of yours in the breeding barn — any farm's hens can then buy covers at ${ECONOMY.BREED_FEE} GP, of which ${fmtGp(breedSplit.studOwnerCents)} GP lands in YOUR wallet per cover. ${COVERS.PER_WEEK} public covers/week plus ${COVERS.OWNER_RESERVED} reserved for your own hens. THE FIRST TIME you open a rooster's public slots it costs ${studSeatLand} LT, spent outright — not staked, not refundable; pulling him and re-listing him later is free, the land buys the seat once, not a subscription. Selling covers is real income — list your good retirees.`,

  unlist_stud: "Remove your rooster from the breeding barn. Covers already bought this week stand.",

  stake_land:
    `Stake Land Tokens into THE pool (single pool for now). Staked land earns a pro-rata share of every inflow — claim rakes, gacha share, breed cut, land purchases` +
    (STAKER_FLOWS.FIGHT_RAKE > 0 ? ", fight-pot rakes" : "") +
    ` — paid every day at the tick, which is where GP goes decimal. STAKE IN WHOLE TOKENS: awards mint in hundredths, so a balance normally carries a fraction on the end that simply stays liquid until the next award pushes it over the next whole token. Stake as soon as you earn; unstake any time. STACK LAND: it may be worth real money one day ($1/LT is the dream), and it is never sellable either way.`,

  unstake_land: "Pull Land Tokens out of the staking pool — back to liquid (still never sellable).",

  expand_barn:
    `Buy the next barn expansion: +${BARN.EXPANSION_SLOTS} slots for an ESCALATING Land Token burn — the first costs ${nextExpansionCost(0) / LT_CENTS} LT, the second ${nextExpansionCost(1) / LT_CENTS}, the third ${nextExpansionCost(2) / LT_CENTS}, and so on. Every barn starts at ${BARN.CAPACITY} slots (birds + eggs combined), and capacity is a rule with teeth: a FULL barn refuses new covers, forfeits gacha mystery eggs (the token still pays), and blocks claims. Retired brood stock keeps its slot forever, so an active breeding operation WILL hit the ceiling — this is the way through it. The land is SPENT outright (like a stud seat): not staked, not refundable, gone. Since nearly all of a stable's land is normally staked, expanding usually means unstake_land first — the real price is giving up that land's daily yield forever.`,

  enter_lobby:
    `Put a bird on tonight's card — PURE PvP, and ONE ENTRY IS A GROUP OF FIGHTS (round 34): at the day tick the lobby deals its field into groups of at most ${GROUP.SIZE} and everybody fights everybody inside their group, so this entry buys up to ${FIGHTS_PER_GROUP_BIRD} fights in one night (never two of your own — enter several birds freely, the deal spreads barn-mates across different groups and any pair of yours that still shares one simply doesn't fight). ⚠ THE FIGHT MUST BE ON TONIGHT'S CARD: only ~${cardKeysPerDay} (mode, class, blade) combinations are posted each day, and this tool's dials list every LEGAL value, not today's available ones — so read get_state's \`card\` or lobby_board FIRST and enter one of the keys you find there. Anything else is refused with "that fight isn't on tonight's card", and nothing is charged. BINDING once accepted: the fee escrows whole and the bird's ONE ENTRY for the day is spent. Lobbies have no size limit — join a busy one freely; the fuller the room, the fuller everybody's group. THE FEE IS THE PRICE OF THE NIGHT AND IT SPLITS ACROSS THE FIGHTS: each fight risks one share and every unrisked share is refunded at post, so a bird that only got ${FIGHTS_PER_GROUP_BIRD - 1} fights pays for ${FIGHTS_PER_GROUP_BIRD - 1}, and a bird that drew nobody (it was alone in the room — the only way that happens now) pays nothing at all. Pick the WEAPON FORMAT (distance dial) and CLASS (ladder dial) deliberately from what is posted — lobby_board shows fill counts, not fields (fogged), so judge where your bird belongs. ⚠ THE CLASS IS ALSO THE PRICE (round 42 — there is no flat entry fee any more, and the old one-price-per-division rule is deleted). What a night costs, per rung. JUVENILE (age ${AGE.CHICK} only): ${juvLadder}. REAL (age ${AGE.REAL_STAKES}+): ${realLadder}. Each fight risks a third of it (a ${realOpenFee} GP open night = ${openStake} GP a fight; a ${juvMaidenFee} GP juvenile maiden = ${juvMaidenStake} GP a fight), so the open costs ${openVsMaiden}× a maiden and you must tell the player the price of the rung you are actually entering — never a division's "usual" fee. Both modes feed the ONE lifetime record, and every fight in the group goes on it separately. There is NO hardcore mode any more (round 31): nothing entered here can end a career; hardcore lives only in the Majors, via enter_pintakasi. Land pays win or lose, once per entry at settle-up, on the total the bird actually risked, on a superlinear curve — so a dearer rung pays more land AND more land per GP (a full card of ${FIGHTS_PER_GROUP_BIRD}: ${realOpenLand} LT for a real open night, ${realMaidenLand} LT for a real maiden, ${juvOpenLand} LT for a juvenile open, ${juvMaidenLand} LT for a juvenile maiden — land mints in hundredths of a token, so those decimals are exact, not rounded off). That is the reward for climbing; the risk is that a lost open night costs nearly two ${ECONOMY.BREED_FEE} GP covers. Claimers run through enter_claimer.`,

  lobby_board:
    `Tonight's card in full — both the lobbies that exist AND the posted fights nobody has entered yet. A row with \`filled: 0\` and a null \`lobbyId\` (flagged \`offered: true\`) is a PHANTOM: a fight the day posted that is still empty. It is a real, enterable option, not a leftover — being the first bird in is a legitimate play, and often the best one, since every other barn is reading the same board and the fight only fills if somebody starts it. Rows WITH a lobby id already have birds in them. OPEN lobbies are FOGGED: you see each lobby's mode/class/format/tag and its fill count, plus YOUR OWN entries, never other barns' birds (no dodging) — except CLAIMER lobbies, whose fields are fully visible so claims can be placed. CLOSED lobbies are the REVEAL: entries locked, groups dealt, full field shown, and each entry's \`drew\` is an ARRAY (round 34 — it used to be a single opponent or null) listing the birds it fights tonight: its whole group minus itself and minus its own barn-mates, so up to ${FIGHTS_PER_GROUP_BIRD} names. AN EMPTY ARRAY means it drew nobody and refunds in full at post — the only way that happens now is a lobby with just the one bird in it. Fewer than ${FIGHTS_PER_GROUP_BIRD} names means a short night: the bird fights that many times, risks that many shares of its fee, and gets the rest back. The six stats are ALWAYS hidden (reading figures is the skill) and claims already placed are SEALED. Scout fill counts before entering; scout closed claimer draws before claiming.`,

  enter_claimer:
    `Card a bird in a claimer lobby at a tag price. TWO LADDERS, AND ROUND 42 MERGED ONE OF THEM: the TAG — what the bird itself is priced at — is now ONE ladder shared by both seasons, ${CLAIMER.PRICES.join(" / ")} GP, so a juvenile and a veteran wear the same price tags (the old cheap juvenile rungs are DELETED; a chick that has campaigned a real card is worth a real bird's tag). What still differs by season is the ENTRY — what the NIGHT costs — and the tool reads that off the bird's own age rather than asking: an age-${AGE.CHICK} juvenile pays ${juvClaimerFees} for the three rungs in order, a grown bird (age ${AGE.REAL_STAKES}+) pays ${realClaimerFees}. Same animal price, half the cost to campaign it as a juvenile. ⚠ ONLY SOME TAGS ARE POSTED ON A GIVEN DAY, at particular blades — the grown card runs ${CARD.real.claimer} claimer fights a day (one cheap tag, one dearer one, the dear rung rotating) and the juvenile card ${CARD.juvenile.claimer}. The list above is every LEGAL tag, not today's; read get_state's \`card\` or lobby_board for the (blade, tag) pairs actually running, or the entry is refused as off-card. Like every entry it buys a GROUP: the bird fights up to ${FIGHTS_PER_GROUP_BIRD} birds at the tick, risking one share of the fee per fight and refunding the rest. Same PvP card rules as enter_lobby otherwise (binding, the deal is random) — PLUS the bird's card is publicly visible (claimers are the one un-fogged class) and other farms may claim it (sealed) until post time. You keep every prize it wins either way; IF the bird fights AND is claimed, you also bank the tag as it transfers. NO FIGHT, NO CLAIM (round 23, softened round 34): only a bird that drew NOBODY AT ALL calls the whole thing off — entry fee AND every claim on it refund in full, nothing transfers. ONE fight is enough to make the sale, so a short group still sells. Cheap tag = claimable but quick money; dear tag = safer, dearer company — and a dearer tag now also means a dearer NIGHT, since the entry rungs climb with the tag rungs. Read the tag against the ${ECONOMY.BREED_FEE} GP breed fee: the bottom rung sells a bird for less than it costs to make one, the top two for more.`,

  place_claim:
    "Sealed claim on a claimer entry from lobby_board — the tag escrows NOW and settles at post time (the day tick). If several farms claim, the RNG picks one; losers refund in full. The bird transfers AFTER it fights its group (the original owner keeps every prize) — and only if it fought at all; a bird that drew nobody refunds every claim standing on it instead. One fight is enough, so a short group still sells. One claim per farm per entry; not your own bird.",

  enter_pintakasi:
    `Register an age-${AGE.FORK}+ bird for one of THIS WEEK's three blade championships (the weekly Majors — crowns every ${DAY_NAMES[PINTAKASI.DAY_OF_WEEK]}). HARDCORE THROUGHOUT: every loser in the bracket is FORCE-RETIRED, so always confirm with the player first. ${majorFee} GP TO ENTER (escrowed at registration; refunded in full if the bird is bumped or the crown is cancelled) and OPEN — since round 37 there is NO qualification gate beyond age ${AGE.FORK}+, so a bird with an empty record may register, and the fee buys purse rather than a seat: every peso of it goes into this crown's own pot. ⚠ BUT REGISTERING IS NOT STANDING, and you must tell the player that rather than promising them a bracket seat: there are only ${PINTAKASI.MAX_BRACKET} seats, the SELECTION COMMITTEE seats them on CAREER EARNINGS (all the GP the bird has ever won — daily-card pots plus banked purse), and at a full field this call either BUMPS the current weakest bird (refunded, in public) or is REFUSED because your bird is the weakest. A seat won today can also be taken away later in the week by a richer newcomer — nothing is final until ${DAY_NAMES[PINTAKASI.DAY_OF_WEEK]}. Check pintakasi_board for where the bird sits, and if it is near the bump line the fix is to win real fights on the daily card before crown day; the purse = every entry fee paid at this crown plus the week's juice-pool share (less the Juvenile Championship's slice), and since round 40 it is paid on FIGHTS WON, not on finishing place: ${(PINTAKASI.PURSE.ADVANCEMENT * 100).toFixed(0)}% of it splits across every win in the bracket (a win in each round worth ${majorMult}× the round before), plus a ${(PINTAKASI.PURSE.CHAMPION * 100).toFixed(0)}% champion and ${(PINTAKASI.PURSE.RUNNER_UP * 100).toFixed(0)}% runner-up bonus. Winning even one Major fight pays (~${majorOneWinPct} of the purse in a full ${majorBracket}-bird bracket; ~${majorChampionPct} for the crown) — which clears the ${majorFee} GP entry once the purse is over ~${majorOneWinBreakEven} GP for that one win, so check the projected purse on pintakasi_board before telling a player the fee is worth it. A BYE pays nothing, and a bird that wins nothing takes nothing. LAND IS ONE FIXED POT SINCE ROUND 42 — ${majorLandPot} LT a Major (${juvenileLandPot} LT a juvenile crown), split evenly across every fight ACTUALLY FOUGHT in the bracket, so a bird's cut is its fights ÷ all the fights: ${majorFightLand} LT for one win in a full ${majorBracket}-bird field, ${majorCrownLand} LT for the champion. This REVERSES the old rule that paid the earliest-eliminated bird the most land — a first-round exit is now the SMALLEST land award, not the biggest, and a bye earns none at all. A THIN FIELD PAYS MORE PER BIRD though (${thinFieldFightLand} LT for one win in a field of just ${thinBracket}), so a quiet crown is worth entering on the land alone. Committee-seeded bracket by career earnings → career wins → average figure. One bird per crown and up to ${PINTAKASI.MAX_PER_BARN} birds from your barn per championship; the field is PUBLIC — check pintakasi_board. Registrants fight normal cards all week except ${DAY_NAMES[PINTAKASI.DAY_OF_WEEK]} itself. SAME TOOL ENTERS THE JUVENILE CHAMPIONSHIP: pass division "juvenile" with an age-${AGE.CHICK} bird holding ${JUVENILE_MAJOR.QUALIFYING_WINS} juvenile wins, at ${FORMATS[JUVENILE_MAJOR.BLADES[0]].label} or ${FORMATS[JUVENILE_MAJOR.BLADES[1]].label} (${DAY_NAMES[JUVENILE_MAJOR.DAY_OF_WEEK]}, ${juvenileFee} GP — its own fee, so never quote a Major's ${majorFee} at a chick, and NOT free any more: round 42 ended the one-round experiment with a free crown. NOT hardcore either — no career is at risk, so you don't need the same solemn confirmation, but you do need to say what it costs. One win in a full ${juvenileBracket}-bird juvenile bracket repays the ${juvenileFee} GP once that crown's purse tops ~${juvenileOneWinBreakEven} GP; its land pot is ${juvenileLandPot} LT, paying ${juvenileFightLand} LT for one win and ${juvenileCrownLand} LT for the crown). A bird gets ONE championship a week, so a chick declares for ONE of the two juvenile crowns: send it to the blade its scout report reads better at, since sorting birds onto their end of the dial is what the discovery year is for.`,

  pintakasi_board:
    `This week's three blade championships: each field ranked as the Selection Committee sees it TODAY (rank 1 = top seed; the bottom of a full field is the bump line), the entry fee, and the projected purse (entries so far + the juice-pool share). Fields are PUBLIC — the Pintakasi is the one un-fogged stage in the game. THE FIELD SIZE IS ALSO A LAND READ (round 42): each crown's land pot is fixed (${majorLandPot} LT a Major, ${juvenileLandPot} LT a juvenile crown) and splits across every fight the bracket actually runs, so a THIN field pays each bird more — a quiet crown is the one to enter if land is what you want. Pass division "juvenile" for ${DAY_NAMES[JUVENILE_MAJOR.DAY_OF_WEEK]}'s two discovery-year crowns instead (${FORMATS[JUVENILE_MAJOR.BLADES[0]].label} and ${FORMATS[JUVENILE_MAJOR.BLADES[1]].label}) — read both fields before you declare a chick for one, since it may only stand in one a week.`,

  retire_bird:
    `The safe arm of the age-${AGE.FORK} fork: end the career and convert the bird to breeding stock (roosters can then stand at stud via list_stud). Irreversible — confirm with the player.`,

  buy_land:
    `Buy Land Tokens with GP: ${LAND.GP_PER_100_TOKENS} GP per 100 LT ($${usd(LAND.GP_PER_100_TOKENS)}/LT), capped at ${dailyLandCap} LT per game-day. Buying is a WHOLE-token action — fractions are something you earn by fighting, not something you can purchase. One-way — land never sells back.`,

  roll_gacha:
    `One roll = ${ECONOMY.GACHA_ROLL_PRICE} GP ($${usd(ECONOMY.GACHA_ROLL_PRICE)}) — the free pull from check_in spends first, and past that there is NO DAILY CAP (round 23 removed it; the price alone is the limiter now, up from round 22's brief 16 GP experiment). Always pays a rarity token (${GACHA_TOKENS.join("/")} — prizes TBD) plus ${gachaLand} Land Token. Only ${eggTokenNames} ALSO drop a MYSTERY EGG (random element, hidden sex, no parents, hatches next Hatch Friday) — announce it with fanfare; the other tokens never do. ${gachaStakerPct}% of a paid roll's spend goes to the land stakers, ${gachaJuicePct}% to the juice pool that pays the championships — free pulls split nothing, there's no GP to share. See roll_gacha_bundle for the multi-roll option.`,

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
    "expand_barn",
    {
      title: "Expand the Barn",
      description: TOOL_DESCRIPTIONS.expand_barn,
      inputSchema: z.object({}),
    },
    async () => ruled(() => { const g = game(); return g.farms.expandBarn(g.farmId); })
  );

  server.registerTool(
    "enter_lobby",
    {
      title: "Enter a Lobby (Tonight's Card)",
      description: TOOL_DESCRIPTIONS.enter_lobby,
      inputSchema: z.object({
        birdId: z.string(),
        // The LEGAL sets, not tonight's. These enums are built once at module
        // load and the card turns over daily, so they cannot narrow to what is
        // posted — the descriptions send the caller to get_state/lobby_board
        // and Lobbies.enter refuses anything off-card.
        mode: z.enum(FIGHT_MODES).default("real"),
        format: z
          .enum(FORMAT_NAMES as [string, ...string[]])
          .default("b2")
          .describe("b1 = sprint · b2 = hybrid · b3 = route · b4 = marathon · b5 = classic — only the blades on today's card are enterable"),
        classType: z
          .enum(ENTRY_CLASSES)
          .default("open")
          .describe(`open · maiden (never-winners) · nw3 (fewer than ${NW_CAP} stakes wins)`),
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
          .describe("The weapon format the lobby runs at — must be one today's card posted for a claimer"),
        price: z
          .number()
          .int()
          .describe(
            "The claiming tag, and it must be the tag posted at that blade today (see get_state's card) — " +
              CLAIMER.PRICES.join(" / ") +
              " GP, ONE ladder for both seasons since round 42 (a juvenile wears the same tags as a grown bird; only the entry fee differs by age, and the tool works that out itself)"
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
          .describe(
            `This week's blades only — pintakasi_board lists them. Majors: ${PINTAKASI.BLADES.join("/")}, the same three every week since round 27. Juvenile Championship: ${JUVENILE_MAJOR.BLADES.join("/")}`
          ),
        // The engine has always taken a division here (Tournaments.enter), but
        // the tool didn't expose it, so an agent-player could read about the
        // Juvenile Championship in the instructions and have no door to it —
        // only the bots could enter one. Defaulted to "major" so every existing
        // call keeps its meaning.
        division: z
          .enum(["major", "juvenile"])
          .optional()
          .describe(
            `Which stage. "major" (default) = the hardcore Majors, age ${AGE.FORK}+ and nothing else required at the door — the committee then seats ${PINTAKASI.MAX_BRACKET} on career earnings, so entry can be refused or later bumped. "juvenile" = the Juvenile Championship the day before, age ${AGE.CHICK} only, ${JUVENILE_MAJOR.QUALIFYING_WINS} juvenile wins (the one hard qualification gate left in the game), NOT hardcore`
          ),
      }),
    },
    async ({ birdId, format, division }) =>
      ruled(() => game().tournaments.enter(birdId, format as never, division ?? "major"))
  );

  server.registerTool(
    "pintakasi_board",
    {
      title: "The Pintakasi Board",
      description: TOOL_DESCRIPTIONS.pintakasi_board,
      inputSchema: z.object({
        // Exposed alongside enter_pintakasi's division: an agent told to send a
        // chick to the crown with the softer field needs to be able to SEE both
        // juvenile fields first.
        division: z
          .enum(["major", "juvenile"])
          .optional()
          .describe(
            `"major" (default) = ${DAY_NAMES[PINTAKASI.DAY_OF_WEEK]}'s three blade championships · "juvenile" = ${DAY_NAMES[JUVENILE_MAJOR.DAY_OF_WEEK]}'s two discovery-year crowns`
          ),
      }),
    },
    async ({ division }) => ruled(() => game().tournaments.board(division ?? "major"))
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
