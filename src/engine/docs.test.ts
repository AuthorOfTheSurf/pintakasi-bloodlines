import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MCP_INSTRUCTIONS, TOOL_DESCRIPTIONS } from "@/app/api/mcp/route";
import { splitBreedFee } from "./breeding";
import { fmtGp } from "./events";
import {
  AGE,
  BATTLE,
  CLAIMER,
  COVERS,
  ECONOMY,
  GACHA_BIRDS,
  GACHA_TOKENS,
  JUVENILE_MAJOR,
  LAND,
  PINTAKASI,
  STAKER_FLOWS,
  WEATHER,
} from "./config";

/**
 * THE DRIFT GUARD (see AGENTS.md's "change a rule, change the Handbook").
 *
 * src/app/api/mcp/route.ts is prose an agent-player reads to learn the
 * rules. Prose can't fail to compile the way a stale literal can — so this
 * file is what stands in for that missing compiler error. Every assertion
 * below pins one specific ruling to the live config; if a future round
 * changes a number without touching route.ts, one of these goes red.
 *
 * MCP_INSTRUCTIONS and TOOL_DESCRIPTIONS are exported from route.ts purely
 * for this file — they're pure config-derived strings computed at module
 * load, so importing them here never touches the database.
 *
 * WHAT THIS DOES AND DOES NOT CATCH (verified empirically, 2026-08-04 —
 * a coordinator ran both experiments against a live copy of this file):
 *
 *   - It does NOT catch ordinary config drift. Bump ECONOMY.GACHA_ROLL_PRICE
 *     from 80 to, say, 120 and every test here still passes — because
 *     route.ts's prose is GENERATED from the same constant, so the docs and
 *     the assertions move together automatically. That's the design working
 *     as intended, not a hole: generation is what makes drift impossible in
 *     the first place, for exactly the same reason a wiki page built from
 *     `{ECONOMY.GACHA_ROLL_PRICE}` can't quietly go stale either.
 *   - It DOES catch a RE-TYPED stale claim — prose that asserts a rule the
 *     code has since reversed, pasted back in as a literal string by a
 *     future edit that isn't reading from config. (Confirmed by injecting
 *     the old "the sale doesn't need the fight" line back into route.ts:
 *     the NO FIGHT, NO CLAIM tests failed immediately, correctly.)
 *
 * So: this file guards against regressions in the GENERATION itself (a
 * hand-typed literal creeping back in, a reversed rule getting re-asserted,
 * a tool losing its description), not against the underlying numbers
 * changing — config changes are supposed to flow through untouched.
 */

const instructions = MCP_INSTRUCTIONS.join("\n");
const allTools = Object.values(TOOL_DESCRIPTIONS).join("\n");
const everything = instructions + "\n" + allTools;

const wikiDir = join(import.meta.dir, "..", "app", "wiki");
const readWikiPage = (rel: string) => readFileSync(join(wikiDir, rel), "utf8");

describe("MCP docs carry the CURRENT config values", () => {
  // Drift #1a: round 22 briefly cut the roll to 16 GP; round 23 put it back
  // to 80 and killed the daily purchase cap entirely (see gacha.ts's roll()
  // — "There is NO daily cap any more"). The docs must quote 80, not 16.
  test("the gacha roll price is ECONOMY.GACHA_ROLL_PRICE, not a stale round-22 figure", () => {
    expect(TOOL_DESCRIPTIONS.roll_gacha).toContain(`${ECONOMY.GACHA_ROLL_PRICE} GP`);
  });

  // Drift #1b: there is no "N rolls per game-day" limit any more (round 23
  // removed it) — the docs must say so, not invent a cap the engine doesn't
  // enforce.
  test("the gacha has no daily purchase cap", () => {
    expect(TOOL_DESCRIPTIONS.roll_gacha).toMatch(/no daily cap/i);
    expect(TOOL_DESCRIPTIONS.roll_gacha).not.toMatch(/a farm may (buy|roll) \d+/i);
  });

  // Drift #2: GACHA_BIRDS dropped Blue in round 23 (its egg was a
  // sub-starter body nobody wanted) — only Purple and Gold drop eggs now.
  // The tier list must be DERIVED (GACHA_TOKENS.filter), not typed out, so
  // deleting a tier here can never leave a phantom "Blue" in the prose.
  test("only the tiers actually in GACHA_BIRDS are named as egg-droppers", () => {
    const eggTokens = GACHA_TOKENS.filter((t) => GACHA_BIRDS[t]);
    expect(eggTokens).toEqual(["Purple", "Gold"]); // pins today's ruling
    expect(TOOL_DESCRIPTIONS.roll_gacha).toContain(eggTokens.join(" and "));
    expect(TOOL_DESCRIPTIONS.roll_gacha).not.toMatch(/blue.{0,20}also drop/i);
  });

  // Drift #3: Gacha.bundle() (the 11-for-800 multi) existed in the engine
  // with no MCP tool exposing it at all. It needs an actual registerTool,
  // not just a mention in prose — a doc can't call a method the client has
  // no way to invoke.
  test("the gacha bundle has its own registered tool description", () => {
    expect(TOOL_DESCRIPTIONS.roll_gacha_bundle).toBeDefined();
    expect(TOOL_DESCRIPTIONS.roll_gacha_bundle).toContain(`${ECONOMY.BUNDLE_ROLLS}`);
    expect(TOOL_DESCRIPTIONS.roll_gacha_bundle).toContain(`${ECONOMY.BUNDLE_PRICE} GP`);
  });

  // Drift #4: STAKER_FLOWS.FIGHT_RAKE is 0 (round 23 zeroed the daily-card
  // rake back out) — the docs must say the winner keeps the WHOLE pot, not
  // quote round 22's 2%/78.40 worked example. Written to flip correctly the
  // day the rake gets turned back on, per the wiki/card page's own pattern.
  test("the daily-card fight pot reflects STAKER_FLOWS.FIGHT_RAKE, not a stale 2%", () => {
    if (STAKER_FLOWS.FIGHT_RAKE === 0) {
      expect(instructions).toMatch(/winner takes the whole pot/i);
      expect(instructions).not.toMatch(/less a 2% rake/i);
      expect(instructions).not.toMatch(/78\.40/);
    } else {
      expect(instructions).toContain(`${(STAKER_FLOWS.FIGHT_RAKE * 100).toFixed(0)}%`);
    }
  });

  // Drift #5: round 23 re-ruled claiming to NO FIGHT, NO CLAIM (Lobbies.
  // refundClaims) — an unmatched bird's claims refund instead of the sale
  // going through anyway. The old "the sale doesn't need the fight" framing
  // must be gone from both the tool description and the general prose.
  test("claiming reflects NO FIGHT, NO CLAIM (round 23), not the old unmatched-sale rule", () => {
    expect(everything).toMatch(/no fight,? no claim/i);
    expect(everything).not.toMatch(/sale (doesn't|does not) need the fight/i);
    expect(TOOL_DESCRIPTIONS.enter_claimer).not.toMatch(/even if it went unmatched/i);
  });

  // Drift #6: BREED_SPLIT.STAKER_SHARE is 0.05, so a stud owner banks 76.00
  // GP of a 160 GP cover, not 78.00 (that was round 21's 2.5%-staker rate).
  // Computed through splitBreedFee — the same function breeding.ts pays
  // out with — so this can't drift from the engine's own centi-GP math.
  test("the stud owner's share is computed from splitBreedFee, not a stale 78.00", () => {
    const split = splitBreedFee(ECONOMY.BREED_FEE);
    const ownerGp = fmtGp(split.studOwnerCents); // same formatter route.ts uses
    expect(TOOL_DESCRIPTIONS.list_stud).toContain(`${ownerGp} GP`);
    expect(TOOL_DESCRIPTIONS.breed).toContain(ownerGp);
    expect(everything).not.toMatch(/78\.00 GP/);
    expect(everything).not.toMatch(/\b78 GP\b.{0,40}(stud|owner)/i);
  });

  // Drift #7: standing a stud has cost Land Tokens since round 23
  // (COVERS.STUD_LISTING_LT) — list_stud's own description used to say
  // nothing about it, which meant an agent would try to list a stud with a
  // full LT balance and get an unexplained ⛔.
  test("list_stud mentions the LT cost of opening a rooster's public slots", () => {
    expect(TOOL_DESCRIPTIONS.list_stud).toContain(`${COVERS.STUD_LISTING_LT} LT`);
  });

  // Missing entirely #1: the Juvenile Championship (JUVENILE_MAJOR) — the
  // non-hardcore crown that runs the day before the Majors.
  test("the Juvenile Championship is documented, including that it isn't hardcore", () => {
    expect(instructions).toMatch(/juvenile championship/i);
    expect(instructions).toContain(`${JUVENILE_MAJOR.QUALIFYING_WINS} juvenile wins`);
    expect(instructions).toMatch(/not force-retire/i);
  });

  // Missing entirely #2: the discovery-year class ladder — juvenile
  // maidens/stakes/claimers price on CLAIMER.JUVENILE_PRICES, a separate,
  // cheaper ladder from the grown CLAIMER.PRICES rungs.
  test("the juvenile claimer ladder (CLAIMER.JUVENILE_PRICES) is documented", () => {
    expect(instructions).toContain(CLAIMER.JUVENILE_PRICES.join("/"));
  });

  // Missing entirely #3: carriage (round 23's Ground/Air axis) — data-only,
  // not wired into the fight engine, but visible on every bird and worth an
  // agent knowing about so it doesn't over- or under-sell it.
  test("carriage is documented as data-only (not yet wired into fights)", () => {
    expect(instructions).toMatch(/carriage/i);
    expect(instructions).toMatch(/not (be )?wired into the fight engine|data only/i);
  });

  // Every other numeric rule an agent needs to play correctly — pinned so a
  // future balance change trips a test instead of teaching a lie silently.
  test("age gates, entry fees, and qualification points are all live-read", () => {
    expect(instructions).toContain(`${AGE.CHICK} = juvenile only`);
    // Entry fees live on enter_lobby / enter_claimer's own tool descriptions.
    expect(everything).toContain(`${ECONOMY.JUVENILE_ENTRY_FEE} GP`);
    expect(everything).toContain(`${ECONOMY.REAL_ENTRY_FEE} GP`);
    expect(everything).toContain(`${ECONOMY.HARDCORE_ENTRY_FEE} GP`);
    expect(instructions).toContain(`${PINTAKASI.QUALIFYING_POINTS} qualification points`);
    expect(instructions).toContain(`${LAND.DAILY_BUY_CAP.toLocaleString()} LT`);
  });
});

describe("The Handbook (src/app/wiki) doesn't assert what config now contradicts", () => {
  // Cheap text greps, per AGENTS.md's checklist item 3 ("grep src/app/wiki/
  // for anything the change makes untrue") — these are regression guards on
  // the specific reversals this round made, not a full re-audit.

  test("claiming page states NO FIGHT, NO CLAIM, not the old unmatched-sale rule", () => {
    const src = readWikiPage("claiming/page.tsx");
    expect(src).toMatch(/no fight,? no claim/i);
    expect(src.toLowerCase()).not.toContain("doesn't need the fight");
  });

  test("gacha page derives its egg tiers from GACHA_BIRDS, doesn't type them out", () => {
    const src = readWikiPage("gacha/page.tsx");
    expect(src).toContain("GACHA_BIRDS");
    expect(src).not.toMatch(/blue,?\s*purple,?\s*and\s*gold/i);
  });

  test("card page's pot section branches on STAKER_FLOWS.FIGHT_RAKE, not a typed 2%", () => {
    const src = readWikiPage("card/page.tsx");
    expect(src).toContain("STAKER_FLOWS.FIGHT_RAKE");
    expect(src).not.toMatch(/less a 2% rake/i);
  });

  test("breeding page mentions the stud-listing Land Token sink", () => {
    const src = readWikiPage("breeding/page.tsx");
    expect(src).toContain("COVERS.STUD_LISTING_LT");
  });

  // Drift, weather (round 24's re-rule). The daily-element section shipped
  // describing WEATHER.EDGE as "the same as the element edge … the weather
  // only nudges" — true of neither value it has ever held. At the original
  // +1 it was the most decisive term in a fight (76% for the matched bird
  // between two equal 350-stat starters); at 0.25 it is deliberately a
  // FRACTION of the head-to-head element edge. Either way the sentence was a
  // lie, and a computed {WEATHER.EDGE} in the middle of it didn't help,
  // because the FRAMING is what was wrong. These tests pin the framing.
  test("fighting page never claims the weather edge matches or beats the element edge", () => {
    const src = readWikiPage("fighting/page.tsx");
    // The ruling itself: weather is the weaker of the two element bonuses.
    // If a future round reverses that, this fails first and the prose below
    // ("chase the matchup, not the forecast") gets re-read rather than left.
    expect(WEATHER.EDGE).toBeLessThan(BATTLE.ELEMENT_EDGE);
    expect(src).not.toMatch(/same .{0,30}as the element edge/i);
    expect(src).not.toMatch(/weather only nudges/i);
    // Positively state the relationship, so the page can't go silent on it.
    expect(src).toMatch(/weaker/i);
  });

  test("fighting page reads WEATHER.EDGE live instead of typing the number", () => {
    const src = readWikiPage("fighting/page.tsx");
    expect(src).toContain("WEATHER.EDGE");
    // A hand-typed "+0.25" / "+1 on every roll" would opt the page out of
    // config entirely — the exact failure the import rule exists to stop.
    expect(src).not.toMatch(/\+\s*\d+(\.\d+)?\s*on every roll/i);
    // Win rates have no config export to read, so per AGENTS.md they must be
    // described in words. A typed percentage here would rot the day any of
    // EDGE / ELEMENT_EDGE / ROLL_DIVISOR moves.
    expect(src).not.toMatch(/\b(5[0-9]|[6-9][0-9])%/);
  });

  // Drift, the Pit Figure (round 30's rebuild). The figure stopped being
  // "damage per turn against a hand-tuned per-blade ghost, minus a flat
  // beaten-lengths subtraction, clamped to 0–150" and became spine × night.
  // Every constant behind the old prose was DELETED, so a stale sentence here
  // can't even be caught by a compile error on the page: the page just stops
  // mentioning them and keeps describing a machine that no longer exists.
  test("fighting page describes the spine × night figure, not the deleted ghost", () => {
    const src = readWikiPage("fighting/page.tsx");
    expect(src).toMatch(/spine/i);
    // The ghost was never a bird — it was a divisor named after one, and the
    // per-blade GHOST_PACE table it implied is gone.
    expect(src).not.toMatch(/ghost/i);
    expect(src).not.toMatch(/GHOST_PACE|CLASS_BASE|CLASS_DIVISOR|BEATEN_SCALE|FIGURE\.MAX/);
    // The peg has to be read live: it is the whole reason the scale can't
    // drift the way it drifted in round 27.
    expect(src).toContain("FIGURE.PEG_STAT");
    expect(src).toContain("FIGURE.PEG_FIGURE");
  });

  test("fighting page promises no upper cap on a Pit Figure", () => {
    const src = readWikiPage("fighting/page.tsx");
    // Ruled 2026-08-06: "let's forget about the 0–150 range." A bred monster
    // posting 140 should read 140, so the page must not describe a ceiling.
    expect(src).not.toMatch(/clamped between/i);
    expect(src).toMatch(/no ceiling|no upper cap/i);
  });

  test("fighting page states the fixed points-per-grade the peg buys", () => {
    const src = readWikiPage("fighting/page.tsx");
    // The headline fact of the rebuild: a letter grade is worth a fixed
    // number of figure points everywhere on the ladder. It must be COMPUTED
    // from the peg and the grade band, never typed, or the day either moves
    // the page teaches a wrong conversion.
    expect(src).toContain("figurePerGrade");
    expect(src).not.toMatch(/\b10 figure points/);
    // And blade fit is multiplicative now — a better bird shows its shape
    // LOUDER. If that framing is ever reversed, this fails before a player
    // reads the old promise.
    expect(src).toMatch(/louder/i);
  });

  test("MCP get_state tells an agent about the daily ascendant element", () => {
    // Deliberately loose: route.ts's exact sentence is free to be reworded,
    // but an agent that can't learn the day's element from get_state can't
    // plan around it at all.
    expect(TOOL_DESCRIPTIONS.get_state).toMatch(/ascendant|weather/i);
    expect(TOOL_DESCRIPTIONS.get_state).toContain("Element");
  });

  test("pintakasi page documents the Juvenile Championship as non-hardcore", () => {
    const src = readWikiPage("pintakasi/page.tsx");
    expect(src).toMatch(/juvenile championship/i);
    // JSX escapes the apostrophe as &apos; — match either spelling.
    expect(src).toMatch(/isn(?:'|&apos;)t hardcore|not hardcore/i);
  });
});

describe("The two WHY comments this round's audit flagged stay fixed", () => {
  // config.ts:383 used to say "4.00 staker / 78.00 juice / 78.00 stud
  // owner" three lines above BREED_SPLIT itself, which quotes 8.00/76.00/
  // 76.00 — a comment contradicting the constant directly beneath it.
  test("config.ts's breed-split comment doesn't contradict BREED_SPLIT", () => {
    const src = readFileSync(join(import.meta.dir, "config.ts"), "utf8");
    expect(src).not.toMatch(/4\.00 staker \/ 78\.00 juice \/ 78\.00 stud owner/);
  });

  // lobbies.ts:163's class doc comment used to describe the pre-round-23
  // behaviour ("the sale doesn't need the fight").
  test("lobbies.ts's class doc comment describes NO FIGHT, NO CLAIM", () => {
    const src = readFileSync(join(import.meta.dir, "lobbies.ts"), "utf8");
    expect(src).not.toMatch(/sale (doesn't|does not) need the fight/i);
    expect(src).toMatch(/no fight,? no claim/i);
  });
});
