import path from "node:path";
import { db, defaultDbPath } from "@/db/client";
import { TickControls } from "./tick-controls";
import { publicTicksEnabled } from "@/app/ticks";
import { battleLog, birds, claims, events, farms, gachaTokens, gameState, lobbies, lobbyEntries, simTimings, tournamentEntries, tournaments } from "@/db/schema";
import {
  ECONOMY,
  FIGHTS_PER_GROUP_BIRD,
  FORMATS,
  LT_CENTS,
  // NO CROWN-LAND CONFIG IS IMPORTED HERE, and the history is worth keeping:
  // this page once did the arithmetic itself (landForTournamentFight × fights,
  // off a hard-coded basis), then in round 41 read the `crown_land` ledger
  // instead. Round 42 deleted both — the curve, the bases, the per-fight mint
  // and the elimination-grant ladder. A crown now pays ONE FIXED POT
  // (DIVISION_RULES[division].landPot) divided at settle-up by fights fought,
  // and it lands on `tournamentEntries.landGranted`, so the page reads the
  // settled figure off the entry row and needs no land config at all.
  // `landForFight` below is the DAILY card's award, which is untouched.
  landForFight,
  cardOfDay,
  stakePerFight,
  weatherOfDay,
  type CardKey,
  type FightFormat,
} from "@/engine/config";
import { splitBreedFee } from "@/engine/breeding";
import { GameClock } from "@/engine/game-clock";
import { gradeColor, overallGradeOf, type Grade } from "@/engine/grades";
import { ageOf } from "@/engine/lifecycle";
import { baselineBefore, computeTopline, stakingBook, type Topline } from "@/engine/snapshots";
import { cardHealth } from "@/engine/doctor";
import { DIVISION_RULES, roundName, seedPlacement, type Division } from "@/engine/tournaments";
import { ElementSprite, GpIcon, LtIcon } from "./sprites";
import { CHART_CSS, ChartStrip, SERIES_COLORS, type DayChartProps, type StackedDayChartProps } from "./charts";
import {
  AdminTabs,
  type BirdFightRowUI,
  type BirdRowUI,
  type BreedingRowUI,
  type FarmRowUI,
  type FightRowUI,
  type GachaRowUI,
  type GpRowUI,
  type LedgerRowUI,
  type StakingRowUI,
} from "./grids";

export const dynamic = "force-dynamic";

/**
 * The Stewards' Office — the admin view. Top-line figures up top; below,
 * one tab bar switching the AG Grid tables (Farms / Fights / Birds /
 * Breeding / Gacha / GP / The Ledger). Read-only; everything derives from
 * the same SQLite the game runs on — the header names WHICH database file,
 * so a sim run and the live world are never mistaken for each other.
 */

const LEDGER_LIMIT = 3000;
const FIGHT_LIMIT = 1000;
/**
 * The per-bird fight histories behind the Birds grid's detail panel — ONE ROW
 * PER BIRD PER FIGHT (so a fight contributes two), across every bird, because
 * the grid filters to the clicked bird on the client.
 *
 * The most recent rows win: a long world holds tens of thousands of them, and
 * the whole array is serialized into the page. WHAT FALLS OFF: the OLDEST
 * fights, so a long-retired bird can show a short history — or none — while
 * everything the current card produced is always present. Raise it if the
 * panel starts lying about veterans; the cost is page weight, nothing else.
 */
const BIRD_FIGHT_LIMIT = 6000;

function gpFmt(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/**
 * ⚠ LAND IS MINTED IN HUNDREDTHS since round 36 — every land figure reaching
 * this page (farm piles, topline totals, entry awards, crown grants, the
 * ledger's Δ column) is 100× what a player calls it, and printing one raw is a
 * correctness bug rather than a formatting one.
 *
 * Grouped rather than config's `fmtLt`, which is plain `toFixed(2)`: the
 * office's topline runs to six figures of land and a comma-less 1234567.89 is
 * unreadable. Same value, thousands separators.
 */
function ltFmt(cents: number): string {
  return (cents / LT_CENTS).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * The card's name for a lobby: mode·class, with "REAL" left unsaid (round
 * 20 — real stakes are the default, so only juvenile and hardcore announce
 * themselves). A plain real/open card just reads OPEN.
 */
function cardLabel(mode: string, classType: string): string {
  const parts = [
    ...(mode === "real" ? [] : [mode.toUpperCase()]),
    ...(classType === "open" ? [] : [classType.toUpperCase()]),
  ];
  return parts.length ? parts.join("·") : "OPEN";
}

/**
 * One key on the posted card (round 31), in the same shorthand the lobby
 * boxes below use — so the header's schedule and the card that went off read
 * as the same language, and a missing lobby is easy to spot by eye.
 */
function cardKeyLabel(k: CardKey): string {
  return `${cardLabel(k.mode, k.classType)}${k.price ? `@${k.price}` : ""} ${FORMATS[k.format].label}`;
}

type EntryRow = typeof tournamentEntries.$inferSelect;
type LogRow = typeof battleLog.$inferSelect;

/** One side of a bracket card — a fought fighter, or null on a bye. */
interface BracketFighter {
  bird: string;
  farm: string;
  grade: Grade;
  element: string;
  stars: number;
  figure: number | null; // null on a bye — nobody threw a blade
  gpWonCents: number;
  // ⚠ THIS IS A SETTLEMENT FIGURE, NOT A RUNNING TOTAL (round 42) — and the
  // change is the interesting one on this page.
  //
  // Two earlier models both wanted land shown on EVERY card in the tree,
  // because both paid per fight: rounds 18–40 showed the inverted elimination
  // grant ("land to the fallen"), and round 41 showed the `crown_land` ledger
  // accumulated through round r plus that grant. Round 42 deleted both. A
  // crown now pays ONE FIXED POT, divided once at the end of the bracket in
  // proportion to the fights each bird actually fought.
  //
  // So THERE IS NO PER-ROUND LAND NUMBER TO SHOW, and inventing one — pot ×
  // (fights so far / fighter slots) — would print a figure the engine never
  // paid and no ledger row backs. The land therefore appears exactly once per
  // bird, on its LAST card (its exit, or the Final for the champion), on the
  // same line and by the same `showAwards` rule the purse GP already used:
  // both are settle-up money, so they now settle in the same place on the
  // tree. Earlier cards show a purse-less, land-less award line, which is
  // honest — nothing had been paid yet.
  landCents: number; // hundredths of a token (round 36) — render via ltFmt
  // The NUMERATOR of that share, shown beside it (`×3`), because the pot is
  // divided by fights fought and the figure is otherwise unexplainable: two
  // birds in the same bracket bank different land for reaching the same round
  // if one of them got there on a bye. Counted off battle_log, which is the
  // only record of which fights happened — a bye writes no row.
  landFights: number;
  won: boolean;
  // CAREER TO DATE (round 40), read live off the bird row and the ledgers —
  // so it is the number AFTER this fight, not a pre-fight snapshot: by the
  // time a championship has resolved, birds.wins/losses and every gp row it
  // produced are already written. A bracket is read after the fact, so
  // "current" and "post-fight" are the same figure and nothing has to be
  // reconstructed backwards.
  wins: number;
  losses: number;
  netCents: number; // NET lifetime GP — negative for a bird that lost more stake than it won
}
interface BracketMatch {
  isBye: boolean;
  a: BracketFighter;
  b: BracketFighter | null; // null on a bye — the "opponent" seat is empty
  onPath: boolean; // the eventual champion won this one
}
interface BracketRound {
  name: string;
  matches: BracketMatch[];
}

/**
 * Rebuild the EXACT tree runChampionship fought, from nothing the resolution
 * kept for later: each entry's stored `seedRank` and `eliminatedRound`, plus
 * the battle log. No new state — round 18/23 didn't persist the bracket
 * shape, only its outcome, so the admin view re-derives the shape the same
 * way the sim built it (seedPlacement) and reads winners off elimination
 * rounds rather than log order, which single elimination makes exact: a
 * bird's `eliminatedRound` IS the round of the fight that beat it, and the
 * champion never gets one at all.
 */
function buildBracket(
  bracketSize: number,
  totalRounds: number,
  field: EntryRow[],
  log: LogRow[],
  tournamentId: number,
  birdCard: (id: string) => { name: string; grade: Grade; element: string; stars: number },
  career: (id: string) => { wins: number; losses: number; netCents: number },
  // How many fights this bird actually FOUGHT in this tournament — the
  // numerator of its land-pot share (round 42). Byes are absent from
  // battle_log and so contribute nothing, which is exactly the engine's rule.
  fightsFought: (birdId: string) => number,
  fname: (id: string | null) => string,
  championBirdId: string | null
): BracketRound[] {
  // seeded[i] = the entry holding seed rank i+1 (1 = top seed).
  const seeded = [...field].sort((a, b) => (a.seedRank ?? 0) - (b.seedRank ?? 0));
  const placement = seedPlacement(bracketSize);
  // Ghost seats — seeds past the real field — render as byes, same as the
  // sim itself: a ghost only ever lands opposite a real seed (see
  // seedPlacement's doc), so this array never needs a "two ghosts" case.
  let alive: (EntryRow | null)[] = placement.map((seat) => seeded[seat - 1] ?? null);

  // Single elimination means any two birds meet at most once — so a
  // (birdId, opponentBirdId) pair is enough to find the log row unambiguously,
  // no round bookkeeping in battle_log required.
  const figureOf = (birdId: string, oppId: string): number | null =>
    log.find((r) => r.tournamentId === tournamentId && r.birdId === birdId && r.opponentBirdId === oppId)
      ?.pitFigure ?? null;
  // No `round` argument any more (round 42): the only thing that ever needed
  // one was the cumulative crown-land total, and land no longer accrues round
  // by round. `showAwards` alone says whether this is the bird's settle-up card.
  const fighter = (
    e: EntryRow,
    won: boolean,
    figure: number | null,
    showAwards = false
  ): BracketFighter => {
    const card = birdCard(e.birdId);
    const c = career(e.birdId);
    return {
      bird: card.name,
      farm: fname(e.farmId),
      grade: card.grade,
      element: card.element,
      stars: card.stars,
      figure,
      gpWonCents: showAwards ? e.gpWonCents : 0,
      // Both awards ride the same `showAwards` gate now (round 42): the purse
      // share and the land-pot share are one settlement at the end of the
      // bracket, so they appear together on the bird's last card and nowhere
      // else. See BracketFighter.landCents for why there is no per-round land.
      landCents: showAwards ? e.landGranted : 0,
      landFights: fightsFought(e.birdId),
      won,
      wins: c.wins,
      losses: c.losses,
      netCents: c.netCents,
    };
  };

  const rounds: BracketRound[] = [];
  for (let round = 1; round <= totalRounds; round++) {
    const matches: BracketMatch[] = [];
    const next: (EntryRow | null)[] = [];
    for (let i = 0; i < alive.length; i += 2) {
      const a = alive[i];
      const b = alive[i + 1];
      if (a && !b) {
        matches.push({ isBye: true, a: fighter(a, true, null), b: null, onPath: a.birdId === championBirdId });
        next.push(a);
      } else if (b && !a) {
        matches.push({ isBye: true, a: fighter(b, true, null), b: null, onPath: b.birdId === championBirdId });
        next.push(b);
      } else if (a && b) {
        // Whichever side exits on THIS round is the loser — the champion
        // (and anyone not eliminated yet) carries no eliminatedRound at all,
        // so this reads right even for the final.
        const winner = a.eliminatedRound === round ? b : a;
        matches.push({
          isBye: false,
          // Awards settle at the participant's final matchup: the loser
          // exits here, while the champion receives theirs after the final.
          a: fighter(a, winner === a, figureOf(a.birdId, b.birdId), winner !== a || round === totalRounds),
          b: fighter(b, winner === b, figureOf(b.birdId, a.birdId), winner !== b || round === totalRounds),
          onPath: winner.birdId === championBirdId,
        });
        next.push(winner);
      } else {
        next.push(null); // two ghost seats — shouldn't happen, see above
      }
    }
    rounds.push({ name: roundName(round, totalRounds, bracketSize), matches });
    alive = next;
  }
  return rounds;
}

// One grid row per bracket SEAT (not per match) — a round-r match spans
// 2^r of them, which is what makes a CSS grid line it up as a real tree with
// zero JS: a Quarterfinal card centers itself exactly between the two
// Round-of-16 cards that fed it, because it spans both their row ranges.
// ⚠ THE SEAT UNIT IS LOAD-BEARING, not taste: a round-1 card spans exactly
// TWO of these rows and clips (overflow: hidden) if its content is taller, so
// this is the tightest number that still fits the fullest possible round-1
// card. That card is two fighters × three lines each — identity, farm+awards,
// career (round 40) — plus the divider and .bmatch's own padding. Measured at
// the office's 13px base: ~14.5px a line (the 12px element sprite sets the
// first line's box), 3 lines ≈ 43px a fighter, ×2 = 86, + ~5px divider +
// ~9px padding + 2px border ≈ 102px ⇒ 51px a seat. 3.2rem (51.2px) is that
// minimum with nothing spare; round 40 cut the old 3.25rem's slack out of the
// LINES instead, which is what actually tightened the tree — every gap
// between round-1 cards was the difference between the card and 2 units.
const BRACKET_ROW_UNIT = "3.2rem";
const BRACKET_COL_WIDTH = "clamp(250px, 22vw, 320px)";

/**
 * The bracket tree for one completed championship — one column per round,
 * left to right, ending at the Final. There is no champion column (round 40
 * dropped it): the winner of the Final IS the champion, so it wears the 🏆
 * in the last card rather than being restated in a box of its own. Pure CSS
 * grid (see BRACKET_ROW_UNIT above) — no client JS, so this has to be a
 * server component throughout, same as the rest of the Stewards' Office.
 */
function Bracket({
  rounds,
  bracketSize,
}: {
  rounds: BracketRound[];
  bracketSize: number;
}) {
  // WHAT THIS SIDE TOOK HOME AT SETTLE-UP — purse GP and its cut of the land
  // pot, together, on the bird's last card only. Round 41 showed land on every
  // card because every crown fight minted some; round 42's single pot settles
  // once, so the line appears once (see BracketFighter.landCents).
  //
  // The `×K` beside the land is the bird's fight count, the numerator of its
  // share — appended INSIDE this line rather than on a line of its own, which
  // BRACKET_ROW_UNIT has no height for.
  const awards = (f: Pick<BracketFighter, "gpWonCents" | "landCents" | "landFights">) =>
    f.gpWonCents > 0 || f.landCents > 0 ? (
      <span className="bawards">
        {f.gpWonCents > 0 && <><GpIcon size={11} /> +{gpFmt(f.gpWonCents)}</>}
        {f.landCents > 0 && (
          <>
            <LtIcon size={11} /> +{ltFmt(f.landCents)}
            <span className="bfights" title={`${f.landFights} fights fought — the land pot divides by fights`}>
              ×{f.landFights}
            </span>
          </>
        )}
      </span>
    ) : null;
  /**
   * One side of a card: identity, farm + what it took home tonight, and the
   * career line. `crown` marks the Final's winner — the champion is named
   * here now rather than in a column of its own.
   */
  const Fighter = ({ f, crown }: { f: BracketFighter; crown: boolean }) => (
    <div className={`bfighter ${f.won ? "won" : "lost"}`}>
      <div className="btop">
        <span className="bidentity">
          <b className="grade" style={{ color: gradeColor(f.grade) }}>{f.grade}</b>{" "}
          <span className="bname">{f.bird}</span>
          {crown && " 🏆"}{" "}
          <span className="belement"><ElementSprite element={f.element} size={12} /> {f.stars}★</span>
        </span>
        {f.figure !== null && <span className="bfig">PF {f.figure}</span>}
      </div>
      <div className="bmeta">
        <span className="bfarm">{f.farm}</span>
        {awards(f)}
      </div>
      {/* THE CAREER LINE — record and NET lifetime GP as they stand after
          this fight. Net can be negative and is shown signed rather than
          floored at zero: a bird that has paid more into the pots than it
          has drawn out is the ordinary case, and hiding it would make every
          bracket look profitable. */}
      <div className="bmeta bcareer">
        <span className="brec">{f.wins}–{f.losses}</span>
        <span className={`bnet${f.netCents < 0 ? " neg" : ""}`}>
          <GpIcon size={11} /> {f.netCents < 0 ? "−" : "+"}{gpFmt(Math.abs(f.netCents))}
        </span>
      </div>
    </div>
  );
  const totalRounds = rounds.length;
  const colTemplate = `repeat(${totalRounds}, ${BRACKET_COL_WIDTH})`;
  return (
    // overflow-x: auto lives here, not on the page — a 64-bracket is six
    // columns wide and would otherwise blow out the whole admin layout.
    <div className="bracket-wrap">
      <div className="bracket-head" style={{ gridTemplateColumns: colTemplate }}>
        {rounds.map((r) => (
          <div key={r.name} className={r.name === "Final" ? "final" : ""}>
            {r.name}
          </div>
        ))}
      </div>
      <div
        className="bracket-grid"
        style={{ gridTemplateColumns: colTemplate, gridTemplateRows: `repeat(${bracketSize}, ${BRACKET_ROW_UNIT})` }}
      >
        {rounds.map((r, ri) => {
          const round = ri + 1;
          const span = 2 ** round; // how many leaf seats this round's card covers
          const isFinal = round === totalRounds;
          return r.matches.map((m, mi) => (
            <div
              key={`${round}-${mi}`}
              // has-prev/has-next grow the little connector stubs (see CSS) —
              // round one has nothing feeding it, and since round 40 the
              // Final has nothing to its right either, so its stub would
              // dangle into empty space.
              className={`bmatch${m.onPath ? " on-path" : ""}${round > 1 ? " has-prev" : ""}${isFinal ? "" : " has-next"}`}
              style={{ gridColumn: round, gridRow: `${mi * span + 1} / span ${span}` }}
            >
              {/* The 🏆 goes to whoever WON the Final — including the
                  degenerate bye case, where the unopposed side is still the
                  champion. */}
              <Fighter f={m.a} crown={isFinal && m.a.won} />
              {m.isBye ? (
                <div className="bfighter bye">— bye —</div>
              ) : (
                <Fighter f={m.b!} crown={isFinal && m.b!.won} />
              )}
            </div>
          ));
        })}
      </div>
    </div>
  );
}

/**
 * Where a pool accrual came from (round 22 widened this from two sources to
 * six). Anything unlabelled is a breed cut — the original inflow.
 */
const SOURCE_LABELS: Record<string, string> = {
  gacha: "gacha spend",
  genesis: "genesis seed",
  fight_rake: "fight rake",
  claim_rake: "claim rake",
  land_purchase: "land bought",
};

const TYPE_LABELS: Record<string, string> = {
  farm_registered: "register",
  check_in: "check-in",
  gacha: "gacha",
  hatch: "hatch",
  retire: "retire",
  breed: "breed",
  stud_income: "stud income",
  pool_accrual: "pools",
  stud_listed: "stud listed",
  stud_unlisted: "stud unlisted",
  entry: "entry",
  fight: "fight",
  card_settled: "night settled", // round 34: one entry, up to three fights
  refund: "refund",
  claim: "claim",
  claim_won: "claim won",
  claim_refund: "claim refund",
  tag_income: "tag income",
  staking_payout: "staking yield",
  stake: "stake",
  unstake: "unstake",
  buy_land: "buy land",
  tournament_entry: "pintakasi entry",
  tournament_bump: "committee bump",
  purse_payout: "purse",
  champion: "champion",
};

export default function Admin() {
  const d = db();
  const dbPath = defaultDbPath();
  const ticksEnabled = publicTicksEnabled();
  // The two offices render identically — this badge is the only loud
  // difference between inspecting a sim and staring at the live world.
  const isSimWorld = path.basename(dbPath).startsWith("sim-");

  const state = d.select().from(gameState).all()[0];
  if (!state)
    return (
      <main className="office">
        <h1>Not seeded — run bun db:seed (or bun run simulate)</h1>
      </main>
    );
  const clock = GameClock.stateOf(state.dayIndex);
  const week = clock.weekIndex;

  const allFarms = d.select().from(farms).all();
  const farmById = new Map(allFarms.map((f) => [f.id, f]));
  const allBirds = d.select().from(birds).all();
  const birdById = new Map(allBirds.map((b) => [b.id, b]));
  const log = d.select().from(battleLog).all();
  const rolls = d.select().from(gachaTokens).all().length;
  const allEntries = d.select().from(lobbyEntries).all();
  const pendingEntries = allEntries.filter((e) => e.status === "pending");
  const allClaims = d.select().from(claims).all();
  const pendingClaims = allClaims.filter((c) => c.status === "pending");
  const allEvents = d.select().from(events).all();
  // Wall-clock ms per simulated day — written by scripts/simulate.ts only, so
  // this is empty (and its chart absent) on a live world.
  const timingRows = d.select().from(simTimings).all();
  const birdCard = (id: string) => {
    const bird = birdById.get(id);
    const total = bird
      ? bird.agility + bird.sight + bird.stamina + bird.gameness + bird.station + bird.condition
      : 0;
    return {
      name: bird?.name ?? id,
      grade: overallGradeOf(total),
      element: bird?.element ?? "",
      stars: (bird?.halfStars ?? 0) / 2,
    };
  };

  // Farm display helpers — name + the two colors, everywhere a farm shows.
  const fname = (id: string | null) => (id ? (farmById.get(id)?.name ?? id) : "— world —");
  const fcolors = (id: string | null | undefined) => {
    const f = id ? farmById.get(id) : undefined;
    return f ? { P: f.primaryColor, S: f.secondaryColor } : { P: undefined, S: undefined };
  };

  // ── Top-line figures (round 16: shared with tick snapshots, diffed) ──────
  const now = computeTopline(d);
  // The last snapshot BEFORE today — the deltas span whatever the last tick
  // covered: one day, or one +1-Week jump.
  const base = baselineBefore(d, state.dayIndex);
  const winRows = log.filter((r) => r.result === "win"); // one per fight
  const bred = allBirds.filter((b) => b.motherId !== null);

  /**
   * Signed, colored delta badge — GP values in cents, LAND in hundredths of a
   * token (round 36), counts as-is. The diff is always taken on the RAW stored
   * figure and only the rendering scales, so a badge can never disagree with
   * the number it sits beside.
   */
  const delta = (key: keyof Topline, opts: { cents?: boolean; lt?: boolean } = {}) => {
    if (!base) return null;
    const diff = (now[key] as number) - (base[key] as number);
    // A snapshot written before this field existed parses to undefined, and
    // undefined arithmetic renders as NaN in the badge.
    if (!Number.isFinite(diff) || diff === 0) return null;
    const shown = opts.cents
      ? gpFmt(Math.abs(diff))
      : opts.lt
        ? ltFmt(Math.abs(diff))
        : Math.abs(diff).toLocaleString();
    return <span className={`diff ${diff > 0 ? "up" : "down"}`}>{diff > 0 ? "+" : "−"}{shown}</span>;
  };

  // ── The card (round 17) — the most recent day's schedule, lobby by lobby ──
  // Between manual ticks the board is empty (auto-play + resolve both happen
  // inside the tick), so this is usually the card that WENT OFF at the last
  // tick — the place to spot gaps: thin lobbies, odd fields, farm clumps.
  const allLobbies = d.select().from(lobbies).all();
  const cardDay = allLobbies.length ? Math.max(...allLobbies.map((l) => l.dayOpened)) : null;
  // One element for the whole card — every lobby below ran under it.
  const cardWeather = cardDay === null ? null : weatherOfDay(cardDay);
  const bname = (id: string) => birdCard(id).name;
  const cardLobbies = allLobbies
    .filter((l) => l.dayOpened === cardDay)
    .map((l) => {
      const entries = allEntries.filter((e) => e.lobbyId === l.id);
      // THE GROUP STAGE (round 34). `group_no` is stamped on the entry at
      // CLOSE, so it is the only thing that says which room a fight came out
      // of — battle_log never learned about groups. The bird → group map lets
      // the bouts below be filed under the room that produced them, which is
      // the whole point of showing a group stage rather than a list of fights.
      const groupOfBird = new Map(entries.map((e) => [e.birdId, e.groupNo]));
      const bouts = log
        .filter((r) => r.lobbyId === l.id && r.result === "win")
        .map((w) => ({
          group: groupOfBird.get(w.birdId) ?? 0,
          winner: birdCard(w.birdId),
          winnerFarm: fname(w.farmId),
          winnerFarmP: fcolors(w.farmId).P,
          winnerFarmS: fcolors(w.farmId).S,
          loser: birdCard(w.opponentBirdId),
          loserFarm: fname(w.opponentFarmId),
          loserFarmP: fcolors(w.opponentFarmId).P,
          loserFarmS: fcolors(w.opponentFarmId).S,
          figures: [w.pitFigure, log.find((r) => r.lobbyId === l.id && r.birdId === w.opponentBirdId)?.pitFigure ?? 0] as const,
        }));
      // Bouts filed by room, rooms in dealt order. A group with no bouts at
      // all can exist — two barn-mates alone together — and it is worth
      // showing empty, because a silent gap in the numbering reads as a bug.
      const groupNos = [...new Set(entries.map((e) => e.groupNo).filter((g): g is number => g !== null))].sort((a, b) => a - b);
      const groups = groupNos.map((n) => ({
        no: n,
        size: entries.filter((e) => e.groupNo === n).length,
        bouts: bouts.filter((b) => b.group === n),
      }));
      // HOW THE NIGHT ADDED UP, one line per entry — the round-34 shape. A
      // full card is FIGHTS_PER_GROUP_BIRD fights; anything less refunds the
      // unfought share of the fee (stakePerFight × the fights it missed), and
      // zero refunds all of it. The SHORT card is the number to watch: it is
      // what a barn-mate collision or a group of two or three actually costs,
      // and it did not exist as a category before this round.
      const settled = entries.filter((e) => e.status !== "pending");
      const short = settled
        .filter((e) => e.fights > 0 && e.fights < FIGHTS_PER_GROUP_BIRD)
        .map((e) => ({
          bird: bname(e.birdId),
          farm: fname(e.farmId),
          group: e.groupNo,
          fights: e.fights,
          refunded: e.fee - stakePerFight(e.fee) * e.fights,
        }));
      return {
        id: l.id,
        tags: [
          ...(l.mode === "juvenile" ? [{ label: "JUVENILE", kind: "juvenile" }] : []),
          { label: l.classType.toUpperCase(), kind: l.classType },
        ],
        label: `${l.price ? `${l.price} GP tag · ` : ""}${FORMATS[l.format as FightFormat].label}`,
        // No capacity any more (round 31): one unbounded lobby per posted key,
        // so the fill count is a bare number with nothing to divide it by.
        filled: entries.length,
        bouts,
        groups,
        full: settled.filter((e) => e.fights >= FIGHTS_PER_GROUP_BIRD).length,
        short,
        unmatched: entries
          .filter((e) => e.status === "unmatched")
          // Nothing was risked, so the whole fee comes home — `fee`, not a
          // share of it. (Kept as the refund rather than the fee so the line
          // says what the barn was PAID, same as the short-card line above.)
          .map((e) => ({ bird: bname(e.birdId), farm: fname(e.farmId), refunded: e.fee })),
        pending: entries
          .filter((e) => e.status === "pending")
          .map((e) => ({
            bird: bname(e.birdId),
            farm: fname(e.farmId),
            group: e.groupNo,
            // THE REVEAL, once the lobby has closed: the bird's group minus
            // itself and minus its own barn-mates — i.e. exactly who it fights
            // tonight, which is what EntryCard.drew reports to a player. An
            // EMPTY list is meaningful (alone in the room, refunds at post)
            // and must not render as an empty bullet.
            drew:
              e.groupNo === null
                ? null
                : entries
                    .filter(
                      (o) => o.groupNo === e.groupNo && o.id !== e.id && o.farmId !== e.farmId
                    )
                    .map((o) => ({ bird: bname(o.birdId), farm: fname(o.farmId) })),
          })),
      };
    });
  const cardFights = cardLobbies.reduce((s, l) => s + l.bouts.length, 0);
  const cardGroups = cardLobbies.reduce((s, l) => s + l.groups.length, 0);
  const cardFull = cardLobbies.reduce((s, l) => s + l.full, 0);
  const cardShort = cardLobbies.reduce((s, l) => s + l.short.length, 0);
  const cardCancelled = cardLobbies.reduce((s, l) => s + l.unmatched.length, 0);
  const cardPending = cardLobbies.reduce((s, l) => s + l.pending.length, 0);
  // The all-time view of the same question, from the engine — so `bun run
  // doctor` and this page can never disagree about how the card is doing.
  const card = cardHealth(d);

  // ── The Pintakasi (round 18) — the latest week's blade championships ──────
  const allTournaments = d.select().from(tournaments).all();
  const allTEntries = d.select().from(tournamentEntries).all();
  const pintakasiWeek = allTournaments.length
    ? Math.max(...allTournaments.map((t) => t.weekIndex))
    : null;
  const FORMAT_LABEL = (f: string) => FORMATS[f as FightFormat]?.label ?? f;
  // CAREER LOOKUPS for the bracket (round 40) — built ONCE by folding the two
  // ledgers already in memory, never per bird: a 32-bracket asking for its own
  // rows would be ~64 round trips per championship and there are several on
  // this page. The two sources are disjoint by construction — battle_log
  // carries the per-fight stake swing (signed, so a loser's row is negative),
  // tournament_entries carries the crown award, which is settled on the entry
  // and never written as a battle_log delta — so summing both is the bird's
  // whole GP life and double-counts nothing.
  const careerNetByBird = new Map<string, number>();
  for (const r of log)
    careerNetByBird.set(r.birdId, (careerNetByBird.get(r.birdId) ?? 0) + r.gpDeltaCents);
  // ⚠ THE FEE IS PART OF THE NET, and round 41 is the round that starts to
  // matter: the Majors were free from round 22 until now, so `- e.fee * 100`
  // was a no-op and its absence here was invisible. With an entry fee it is
  // not — a bird that enters four crowns and cashes none has spent real GP,
  // and a career line that counted only winnings would flatter every crown
  // entrant by the fee, every time. Refunded and bumped entries got their
  // money back and pay nothing, the same carve-out the per-bird LT/GP column
  // below makes.
  for (const e of allTEntries) {
    const refunded = e.status === "refunded" || e.status === "bumped";
    careerNetByBird.set(
      e.birdId,
      (careerNetByBird.get(e.birdId) ?? 0) + e.gpWonCents - (refunded ? 0 : e.fee * 100)
    );
  }
  // wins/losses come off the bird row rather than being counted out of the
  // log: the engine maintains them, and a championship has already written
  // tonight's result by the time this page reads it.
  const birdCareer = (id: string) => {
    const b = birdById.get(id);
    return { wins: b?.wins ?? 0, losses: b?.losses ?? 0, netCents: careerNetByBird.get(id) ?? 0 };
  };
  // ── FIGHTS FOUGHT PER CROWN ENTRY (round 42) ─────────────────────────────
  // The land pot divides by fights fought, so the bracket needs the count to
  // explain each bird's share. Counted out of battle_log in ONE pass over the
  // rows already in memory, keyed (tournamentId, birdId) — never a query per
  // bird, which a 32-bracket would turn into 32 round trips per championship
  // with several championships on the page.
  //
  // A BYE WRITES NO LOG ROW, which is why this is the right source and not,
  // say, the bird's depth in the tree: reaching the Semifinals on a bye is
  // three rounds but two fights, and the engine pays for the two.
  //
  // (This replaced a fold over `crown_land` events, the per-fight mint's own
  // signed rows. Round 42 stopped emitting them — the pot is one settlement
  // and rides `purse_payout`'s `lt`, mirrored onto the entry row as
  // `landGranted`, which is where every land figure below now reads from.)
  const crownFightsByBird = new Map<string, number>();
  for (const r of log) {
    if (!r.tournamentId) continue;
    const key = `${r.tournamentId}|${r.birdId}`;
    crownFightsByBird.set(key, (crownFightsByBird.get(key) ?? 0) + 1);
  }
  // Show the two most recent weeks: last week's crowns stay visible
  // while the new week's registrations gather.
  const pintakasiBoxes = allTournaments
    .filter((t) => pintakasiWeek !== null && t.weekIndex >= pintakasiWeek - 1)
    .map((t) => {
      const entries = allTEntries.filter((e) => e.tournamentId === t.id);
      const fieldEntries = entries.filter((e) => e.status !== "bumped" && e.status !== "refunded");
      const totalRounds = t.bracketSize ? Math.log2(t.bracketSize) : 0;
      const champion = entries.find((e) => e.status === "champion");
      // The tree only exists once the crown has actually run — open/cancelled
      // boxes fall back to the plain states below.
      const rounds =
        t.status === "completed" && t.bracketSize
          ? buildBracket(
              t.bracketSize,
              totalRounds,
              fieldEntries,
              log,
              t.id,
              birdCard,
              birdCareer,
              (birdId) => crownFightsByBird.get(`${t.id}|${birdId}`) ?? 0,
              fname,
              champion?.birdId ?? null
            )
          : [];
      return {
        id: t.id,
        weekIndex: t.weekIndex,
        division: t.division as Division,
        label: `${FORMAT_LABEL(t.format)} Championship · wk ${t.weekIndex}`,
        status: t.status,
        bracketSize: t.bracketSize,
        field: fieldEntries.length,
        pending: entries.filter((e) => e.status === "pending").length,
        purseCents: t.purseCents,
        // THE LAND POT THIS CROWN ACTUALLY PAID (round 42) — summed off the
        // entry rows, not read from DIVISION_RULES[division].landPot. The two
        // should be identical (the champion absorbs the floor remainder so the
        // pot pays out exactly), and that is precisely why the SUM is the one
        // worth printing here: it sits beside the per-bird shares in the tree,
        // so if the shares ever stop adding up to the configured pot this line
        // is where it shows. Quoting the config figure would agree with itself
        // no matter what the ledger did.
        landPotCents: fieldEntries.reduce((s, e) => s + e.landGranted, 0),
        // Only ever a render GUARD now (round 40 dropped the champion column):
        // a completed crown with no champion row is a broken tree, and the
        // 🏆 itself is drawn inside the Final.
        hasChampion: champion !== undefined,
        rounds,
      };
    })
    // This week's crowns first, last week's underneath.
    .sort((a, b) => b.weekIndex - a.weekIndex || a.id - b.id);

  // ── The chart strip (round 37) ────────────────────────────────────────────
  // Three histories of the whole world, one slot per game day from day 0 to
  // today. Days with nothing in them are kept as zeros rather than dropped:
  // a gap in the fight calendar is exactly the thing worth seeing, and a
  // compacted axis would hide it by closing the hole.
  const chartDays = Array.from({ length: state.dayIndex + 1 }, (_, i) => i);
  const perDay = (rows: { day: number; amount: number }[]) => {
    const out = new Array(chartDays.length).fill(0) as number[];
    // Anything stamped past today (or before day 0) would land outside the
    // axis — clamp it away rather than writing past the end of the array.
    for (const r of rows) if (r.day >= 0 && r.day < out.length) out[r.day] += r.amount;
    return out;
  };
  const running = (series: number[]) => {
    let total = 0;
    return series.map((v) => (total += v));
  };

  const fightsPerDay = perDay(winRows.map((r) => ({ day: r.dayIndex, amount: 1 })));

  // COVERS, off the events rather than off the bird rows: `breed` is emitted
  // once per cover with the buyer's signed GP on it, so the count and the
  // money come from the same row and cannot disagree. (A bird's own birthDay
  // would count the same covers, but its price would have to be re-derived
  // from config — and a fee change would then rewrite history.)
  const breedEvents = allEvents.filter((e) => e.type === "breed");
  const breedsPerDay = perDay(breedEvents.map((e) => ({ day: e.dayIndex, amount: 1 })));
  // The breeder's whole outlay — stud share + pool cuts together, i.e. the GP
  // that actually left a wallet. gpCents is negative on a purchase.
  const breedSpend = running(
    perDay(breedEvents.map((e) => ({ day: e.dayIndex, amount: -(e.gpCents ?? 0) / 100 })))
  );

  // CLAIMS are counted where they were SEALED (dayPlaced) — a claim is placed
  // and settled inside the same day's tick, so there is no second date to
  // choose between. Spend counts only the WON tags: several barns can claim
  // the same bird and the losers are refunded in full, so their escrow never
  // changed hands and quoting it as spend would overstate the barn's cost.
  const claimsPerDay = perDay(allClaims.map((c) => ({ day: c.dayPlaced, amount: 1 })));
  const claimSpend = running(
    perDay(
      allClaims.filter((c) => c.status === "won").map((c) => ({ day: c.dayPlaced, amount: c.price }))
    )
  );

  // POOL INFLOWS (round 46, Zane's ask) — the two subsidy pools' funding mix,
  // stacked by source so the question "who is actually paying for this?" is
  // answerable at a glance. Both read the same pool_accrual rows the doctor's
  // STAKER POOL section audits, so the chart and the report can't disagree.
  // Note the sources genuinely differ per pool: land purchases and the claim
  // rake feed ONLY the stakers, the genesis seed fed ONLY the juice — a
  // shared source list would draw four permanent zero-layers.
  const accrualRows = allEvents
    .filter((e) => e.type === "pool_accrual" && e.data)
    .map((e) => {
      const d = JSON.parse(e.data!) as {
        stakerPoolCents?: number;
        juicePoolCents?: number;
        source?: string;
      };
      return {
        day: e.dayIndex,
        source: (d.source ?? "breed").replace("_", " "),
        staker: (d.stakerPoolCents ?? 0) / 100,
        juice: (d.juicePoolCents ?? 0) / 100,
      };
    });
  const poolSeries = (field: "staker" | "juice") => {
    const totals = new Map<string, number>();
    for (const r of accrualRows) totals.set(r.source, (totals.get(r.source) ?? 0) + r[field]);
    // Largest source first, so it sits on the axis and the slivers stay legible.
    return [...totals.entries()]
      .filter(([, total]) => total > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([source], i) => ({
        label: source,
        color: SERIES_COLORS[i % SERIES_COLORS.length],
        values: perDay(
          accrualRows.filter((r) => r.source === source).map((r) => ({ day: r.day, amount: r[field] }))
        ),
      }));
  };
  const stackSum = (series: { values: number[] }[]) =>
    chartDays.map((_, i) => series.reduce((s, ser) => s + (ser.values[i] ?? 0), 0));

  const juiceSeries = poolSeries("juice");
  const stakerSeries = poolSeries("staker");

  const charts: (DayChartProps | StackedDayChartProps)[] = [
    {
      title: "Fights per day",
      days: chartDays,
      bars: fightsPerDay,
      barUnit: "fights",
      note: "every bout on every card, daily and Pintakasi",
    },
    {
      title: "Breeds per day",
      days: chartDays,
      bars: breedsPerDay,
      barUnit: "covers",
      line: breedSpend,
      lineUnit: "GP",
      lineLabel: "spent on covers to date",
      note: "covers bought, and the GP they cost",
    },
    {
      title: "Claims per day",
      days: chartDays,
      bars: claimsPerDay,
      barUnit: "claims",
      line: claimSpend,
      lineUnit: "GP",
      lineLabel: "paid for won tags to date",
      note: "tags sealed, and the GP that changed hands",
    },
    {
      title: "Juice pool inflows per day",
      days: chartDays,
      series: juiceSeries,
      barUnit: "GP",
      line: running(stackSum(juiceSeries)),
      lineUnit: "GP",
      lineLabel: "into the juice pool to date",
      note: "what funds the championship purses, by source",
    },
    {
      title: "Staker pool inflows per day",
      days: chartDays,
      series: stakerSeries,
      barUnit: "GP",
      line: running(stackSum(stakerSeries)),
      lineUnit: "GP",
      lineLabel: "to land stakers to date",
      note: "GP owed to staked land, by source",
    },
  ];

  // SIM COST (round 43, Zane's ask) — how long each simulated day took to run,
  // read straight off sim_timings. The shape is the story: per-day cost grows
  // superlinearly with the world (careers lengthen, so per-fight work rises),
  // and this chart is how a run that is quietly heading from minutes into
  // hours gets caught before anyone waits for it. Absent on a live world,
  // where a day has no meaningful wall clock.
  if (timingRows.length > 0) {
    const simSeconds = perDay(timingRows.map((r) => ({ day: r.dayIndex, amount: r.ms / 1000 })));
    charts.push({
      title: "Sim cost per day",
      days: chartDays,
      bars: simSeconds,
      barUnit: "seconds",
      // The cumulative line answers Zane's actual question at a glance — "how
      // long is this whole run going to take" — while the bars carry the
      // growth-curve warning.
      line: running(simSeconds),
      lineUnit: "s",
      lineLabel: "of total sim time to date",
      note: "wall-clock cost of simulating each day — read the growth curve, not the total",
    });
  }

  // ── Grid rows ─────────────────────────────────────────────────────────────
  const farmRows: FarmRowUI[] = allFarms.map((f) => {
    const mine = allBirds.filter((b) => b.farmId === f.id);
    return {
      name: f.name,
      bot: f.isBot === 1,
      farmP: f.primaryColor,
      farmS: f.secondaryColor,
      gp: (f.gp * 100 + f.gpCents) / 100,
      liquidLt: f.landTokensCents,
      stakedLt: f.stakedLandCents,
      birds: mine.length,
      wins: f.wins,
      losses: f.losses,
      studs: mine.filter((b) => b.listedStud === 1).length,
    };
  });

  const fightRows: FightRowUI[] = winRows.slice(-FIGHT_LIMIT).map((w) => {
    const mirror = log.find(
      (r) =>
        r.lobbyId === w.lobbyId &&
        r.tournamentId === w.tournamentId &&
        r.birdId === w.opponentBirdId &&
        r.opponentBirdId === w.birdId
    );
    return {
      day: w.dayIndex,
      card:
        (w.tournamentId ? "🏆 PINTAKASI" : cardLabel(w.mode, w.lobby)) +
        `${w.claimPrice ? ` @${w.claimPrice}` : ""} · ${w.format}`,
      winner: birdById.get(w.birdId)?.name ?? w.birdId,
      winnerFarm: fname(w.farmId),
      winnerFarmP: fcolors(w.farmId).P ?? "",
      winnerFarmS: fcolors(w.farmId).S ?? "",
      loser: w.opponentName,
      loserFarm: fname(w.opponentFarmId),
      loserFarmP: fcolors(w.opponentFarmId).P ?? "",
      loserFarmS: fcolors(w.opponentFarmId).S ?? "",
      winFigure: w.pitFigure,
      loseFigure: mirror?.pitFigure ?? 0,
      // The POT for this one fight, net of the staker rake — derived from the
      // winner's signed delta rather than from a fee, which is what keeps it
      // honest after round 34: a daily-card pot is now TWO STAKES (a third of
      // each side's entry), not two entry fees, and a Major's is still two
      // fees. The delta knows which; a fee lookup here would not.
      pot: (w.gpDeltaCents * 2) / 100,
      element: weatherOfDay(w.dayIndex),
      winnerGrade: w.selfGrade as Grade,
      loserGrade: w.opponentGrade as Grade,
      pintakasiRound: (() => {
        if (!w.tournamentId) return "";
        const tournament = allTournaments.find((t) => t.id === w.tournamentId);
        const loser = allTEntries.find(
          (e) => e.tournamentId === w.tournamentId && e.birdId === w.opponentBirdId
        );
        if (!tournament?.bracketSize || !loser?.eliminatedRound) return "";
        return roundName(
          loser.eliminatedRound,
          Math.log2(tournament.bracketSize),
          tournament.bracketSize
        );
      })(),
    };
  });

  // ── What each bird earned (round 19) ──────────────────────────────────────
  // GP: pots won less entries lost on the daily card (gpDeltaCents is already
  // the signed net, rake deducted), plus any Pintakasi purse — free entry
  // since round 22, so a registration costs the bird nothing either way.
  // (Round 41 gave the Majors an entry fee again, so the crown half of the GP
  // now nets the fee out — see the tournament pass below.)
  // LT: the land the bird's NIGHTS minted (both fighters are paid, win or
  // lose) plus its cut of any championship land pot.
  //
  // ⚠ ROUND 34 MOVED THIS OFF THE BATTLE LOG, and it had to. The column used
  // to add landForFight(fee-for-the-mode) per battle_log row — one award per
  // fight, on the whole entry fee. Under the group stage BOTH halves are
  // wrong: land pays ONCE PER ENTRY, and it pays on what the bird actually
  // risked (stakePerFight × fights), not on the fee. A bird with a full card
  // would have been credited three awards at three times the basis. There is
  // no honest per-fight land figure to show any more, so the LT for a daily
  // card is now summed off the ENTRY rows — which carry their own fee and
  // their own fight count, so this reproduces the engine's settle-up exactly
  // (see Lobbies.complete) rather than re-deriving a fee from the mode.
  // Crown land is a single settlement per entry as of round 42, so it comes
  // off the tournament ENTRY rows for the same reason — see below.
  // Both maps accumulate the engine's own integers — cents of GP, hundredths
  // of a token (round 36). Summing before scaling is the point: scale first
  // and a column of thousands of awards accretes float error a cent at a time.
  const netGpCents = new Map<string, number>();
  const netLt = new Map<string, number>();
  const bump = (map: Map<string, number>, key: string, by: number) =>
    map.set(key, (map.get(key) ?? 0) + by);
  for (const r of log) {
    bump(netGpCents, r.birdId, r.gpDeltaCents); // 0 on Pintakasi rows — the purse settles below
  }
  // ⚠ THE CROWN HALF OF THIS COLUMN IS NOW A SINGLE TERM — `e.landGranted` in
  // the tournament pass below, and nothing else. It took three tries to get
  // there, and the history is the argument for reading state instead of
  // recomputing: round 19 multiplied landForTournamentFight by a hard-coded
  // basis (wrong for every juvenile bracket, which minted off its own and
  // printed ~3× what it paid); round 41 summed the engine's own `crown_land`
  // rows plus the elimination grant; round 42 deleted the per-fight mint and
  // the grant ladder together, so there is one number, the pot share, and the
  // engine writes it onto the entry row.
  for (const e of allEntries) {
    if (e.fights === 0) continue; // unmatched, or not posted yet — land is for FIGHTING
    bump(netLt, e.birdId, landForFight(stakePerFight(e.fee) * e.fights));
  }
  for (const e of allTEntries) {
    if (e.status === "refunded" || e.status === "bumped") continue; // fee came back
    bump(netGpCents, e.birdId, e.gpWonCents - e.fee * 100);
    // The whole crown-land story for this bird in this tournament: its cut of
    // the fixed pot (round 42), 0 if it only ever drew byes.
    bump(netLt, e.birdId, e.landGranted);
  }

  const birdRows: BirdRowUI[] = allBirds.map((b) => {
    // The public book keeps the six-stat sheet sealed until retirement.
    // Overall grade, element, and stars remain visible as the bird's card.
    const inShell = b.status === "egg";
    const retired = b.status === "retired";
    const total = b.agility + b.sight + b.stamina + b.gameness + b.station + b.condition;
    const stat = (v: number) => (retired ? v : null);
    return {
    // The join key for the fight-history panel — never shown as a column,
    // only matched against BirdFightRowUI.birdId.
    id: b.id,
    name: b.name,
    grade: overallGradeOf(total),
    farm: fname(b.farmId),
    farmP: fcolors(b.farmId).P ?? "",
    farmS: fcolors(b.farmId).S ?? "",
    sex: inShell ? "?" : b.sex === "male" ? "rooster" : "hen",
    baseCoat: b.baseCoat,
    trimColor: b.trimColor,
    age: Math.max(0, ageOf(b, week)),
    stars: b.halfStars / 2,
    element: b.element,
    agility: stat(b.agility),
    sight: stat(b.sight),
    stamina: stat(b.stamina),
    gameness: stat(b.gameness),
    station: stat(b.station),
    condition: stat(b.condition),
    total,
    status: inShell
      ? "Egg" // the hen is pregnant; the bird is an egg (round 20)
      : b.listedStud
        ? "Studding" // a rooster registered in the breed barn (ruled round 15)
        : `${b.status}${b.retiredBy ? ` (${b.retiredBy})` : ""}`,
    wins: b.wins,
    losses: b.losses,
    netGp: (netGpCents.get(b.id) ?? 0) / 100,
    netLt: netLt.get(b.id) ?? 0,
    };
  });

  // ── Every bird's fight history (round 37) ─────────────────────────────────
  // Feeds the Birds grid's detail panel. One row per battle_log row — the
  // bird's OWN side of the fight — so a bout appears twice in this array,
  // once under each fighter, and the panel never has to know which seat its
  // bird sat in.
  //
  // The opponent's Pit Figure lives on the opponent's own row. Single
  // elimination in the Majors and one meeting per group on the daily card
  // (round 34) make (lobby|tournament, birdId, opponentBirdId) unique, so the
  // reciprocal row is addressable exactly — same reasoning the Fights grid's
  // `mirror` lookup runs on, done once as a map because this pass covers the
  // whole log rather than a thousand winners.
  const figureKey = (r: LogRow) => `${r.lobbyId}|${r.tournamentId}|${r.birdId}|${r.opponentBirdId}`;
  const figureByPair = new Map(log.map((r) => [figureKey(r), r.pitFigure]));
  // Which round of a bracket a fight was: a bird's `eliminatedRound` is the
  // round of the fight that beat it, so the LOSER's number names the bout for
  // both sides — and the champion, who never has one, reads off its victims.
  const eliminatedRound = new Map(
    allTEntries.map((e) => [`${e.tournamentId}|${e.birdId}`, e.eliminatedRound])
  );
  const birdFights: BirdFightRowUI[] = log.slice(-BIRD_FIGHT_LIMIT).map((r) => {
    const loserId = r.result === "win" ? r.opponentBirdId : r.birdId;
    const tournament = r.tournamentId ? allTournaments.find((t) => t.id === r.tournamentId) : undefined;
    const round = r.tournamentId ? eliminatedRound.get(`${r.tournamentId}|${loserId}`) : null;
    return {
      // Carried so the pane can ask the server to replay this exact fight.
      logId: r.id,
      birdId: r.birdId,
      day: r.dayIndex,
      card: r.tournamentId
        ? `🏆 ${FORMATS[r.format].label} PINTAKASI${
            tournament?.bracketSize && round
              ? ` · ${roundName(round, Math.log2(tournament.bracketSize), tournament.bracketSize)}`
              : ""
          }`
        : `${FORMATS[r.format].label} · ${cardLabel(r.mode, r.lobby)}${r.claimPrice ? ` @${r.claimPrice}` : ""}`,
      opponent: r.opponentName,
      opponentFarm: fname(r.opponentFarmId),
      opponentFarmP: fcolors(r.opponentFarmId).P ?? "",
      opponentFarmS: fcolors(r.opponentFarmId).S ?? "",
      result: r.result,
      figure: r.pitFigure,
      // Null rather than 0 when the mirror is missing — a Pit Figure of zero
      // is a legal (terrible) fight, and inventing one would read as a rout.
      opponentFigure: figureByPair.get(
        `${r.lobbyId}|${r.tournamentId}|${r.opponentBirdId}|${r.birdId}`
      ) ?? null,
      // The signed net for THIS bird, rake already deducted by the engine.
      // Pintakasi rows carry 0 — the purse settles on the tournament entry,
      // not per fight (see the netGpCents pass above).
      gp: r.gpDeltaCents / 100,
    };
  });

  const split = splitBreedFee(ECONOMY.BREED_FEE);
  const breedingRows: BreedingRowUI[] = bred.map((b, i) => {
    const father = b.fatherId ? birdById.get(b.fatherId) : undefined;
    const studFarmId = father?.farmId ?? null;
    return {
      seq: i,
      conceived: b.birthDay,
      egg: b.name,
      eggGrade: overallGradeOf(b.agility + b.sight + b.stamina + b.gameness + b.station + b.condition),
      hen: (b.motherId && birdById.get(b.motherId)?.name) || b.motherId || "?",
      henGrade: b.motherId ? birdCard(b.motherId).grade : overallGradeOf(0),
      rooster: father?.name ?? b.fatherId ?? "?",
      roosterGrade: b.fatherId ? birdCard(b.fatherId).grade : overallGradeOf(0),
      studFarm: fname(studFarmId),
      studFarmP: fcolors(studFarmId).P ?? "",
      studFarmS: fcolors(studFarmId).S ?? "",
      nestFarm: fname(b.farmId),
      nestFarmP: fcolors(b.farmId).P ?? "",
      nestFarmS: fcolors(b.farmId).S ?? "",
      stage: b.status === "egg" ? (b.birthWeek > week ? "pregnant" : "in the nest") : "hatched",
      fee: split.feeGp,
      studShare: split.studOwnerCents / 100,
    };
  });

  const gachaRows: GachaRowUI[] = allEvents
    .filter((e) => e.type === "gacha" && e.data)
    .map((e, i) => {
      const data = JSON.parse(e.data!) as {
        token: string;
        price: number;
        free: boolean;
        land: number;
        egg: string | null;
      };
      return {
        seq: i,
        day: e.dayIndex,
        farm: fname(e.farmId),
        farmP: fcolors(e.farmId).P ?? "",
        farmS: fcolors(e.farmId).S ?? "",
        token: data.token,
        cost: data.free ? "free" : `${data.price} GP`,
        lt: data.land,
        egg: data.egg ?? "",
      };
    });

  const gpRows: GpRowUI[] = [];
  for (const e of allEvents) {
    const base = {
      day: e.dayIndex,
      farm: fname(e.farmId),
      farmP: fcolors(e.farmId).P,
      farmS: fcolors(e.farmId).S,
    };
    if (e.type === "farm_registered") {
      gpRows.push({ seq: gpRows.length, ...base, flow: "starting purse", amount: (e.gpCents ?? ECONOMY.STARTING_GP * 100) / 100 });
    } else if (e.type === "check_in") {
      gpRows.push({ seq: gpRows.length, ...base, flow: "daily drip", amount: (e.gpCents ?? 0) / 100 });
    } else if (e.type === "pool_accrual" && e.data) {
      const pools = JSON.parse(e.data) as {
        stakerPoolCents: number;
        juicePoolCents: number;
        source?: string;
      };
      const cut = SOURCE_LABELS[pools.source ?? ""] ?? "breed cut";
      if (pools.stakerPoolCents > 0)
        gpRows.push({ seq: gpRows.length, ...base, flow: `→ staker pool (${cut})`, amount: pools.stakerPoolCents / 100 });
      if (pools.juicePoolCents > 0)
        gpRows.push({ seq: gpRows.length, ...base, flow: `→ juice pool (${cut})`, amount: pools.juicePoolCents / 100 });
    } else if (e.type === "staking_payout") {
      gpRows.push({ seq: gpRows.length, ...base, flow: "staking yield paid", amount: (e.gpCents ?? 0) / 100 });
    }
  }

  // ── The staking book (round 21) ───────────────────────────────────────────
  // Two numbers per barn: what it has STAKED, and what staking has PAID it.
  // The stake is live state on the farm row; the earnings are the sum of
  // every staking_payout it ever received, so the column is a lifetime total
  // and never rewrites itself when a farm stakes more.
  const book = stakingBook(d);
  const stakingPaid = book.byFarm;
  const totalStaked = book.totalStakedLand;
  const totalStakingPaidCents = book.totalPaidCents;
  const stakingDays = book.payoutDays;

  const stakingRows: StakingRowUI[] = allFarms.map((f) => {
    const paid = stakingPaid.get(f.id);
    const earnedGp = (paid?.cents ?? 0) / 100;
    return {
      farm: f.name,
      farmP: f.primaryColor,
      farmS: f.secondaryColor,
      bot: f.isBot === 1,
      stakedLt: f.stakedLandCents,
      liquidLt: f.landTokensCents,
      share: totalStaked > 0 ? f.stakedLandCents / totalStaked : 0,
      earnedGp,
      payouts: paid?.days ?? 0,
      perDay: paid?.days ? earnedGp / paid.days : 0,
      // Lifetime yield against TODAY's stake — the stake grew the whole way,
      // so read it as "what this pile has returned so far", not as a rate.
      // Per WHOLE token: the stake is hundredths since round 36, and dividing
      // by it unscaled would quote a hundredth's worth of yield as a token's.
      perLt: f.stakedLandCents > 0 ? earnedGp / (f.stakedLandCents / LT_CENTS) : 0,
      lastPaidDay: paid?.lastDay ?? null,
    };
  });

  // `purse_payout` carries TWO KINDS of row since round 42: the GP shares it
  // always did, and now the land-pot shares too (they settle in the same act at
  // the end of a bracket, so the engine gave them the same type rather than
  // resurrecting the retired `crown_land`). The static TYPE_LABELS map is keyed
  // by type alone and can't tell them apart, so the land ones are relabelled
  // here — a row reading "purse" with an empty GP column and an LT delta is the
  // kind of small confusion that costs somebody ten minutes.
  const ledgerType = (type: string, lt: number | null) =>
    type === "purse_payout" && lt ? "land pot" : (TYPE_LABELS[type] ?? type);
  const ledgerRows: LedgerRowUI[] = allEvents.slice(-LEDGER_LIMIT).map((e) => ({
    id: e.id,
    day: e.dayIndex,
    type: ledgerType(e.type, e.lt),
    farm: fname(e.farmId),
    farmP: fcolors(e.farmId).P,
    farmS: fcolors(e.farmId).S,
    message: e.message,
    gp: e.gpCents === null ? null : e.gpCents / 100,
    lt: e.lt,
  }));

  return (
    <main className="office">
      <style>{CSS + CHART_CSS}</style>
      <header>
        <h1>
          <img className="office-mark" src="/icon.svg" alt="" /> Pintakasi — Stewards&apos; Office{" "}
          <span className={`world-badge ${isSimWorld ? "sim" : "live"}`}>
            {isSimWorld ? "SIM WORLD" : "LIVE WORLD"}
          </span>
        </h1>
        <p className="clock">
          Day {state.dayIndex} · Week {week} · {clock.date}
          {clock.isHatchFriday ? " · HATCH FRIDAY" : ""}
          {" · "}weather: <b>{weatherOfDay(state.dayIndex)}</b> today,{" "}
          <span className="dim">{weatherOfDay(state.dayIndex + 1)} tomorrow</span>
        </p>
        {/* TONIGHT'S POSTED CARD (round 31). Derived, never stored — cardOfDay
            is pure, so this is the same schedule the engine enforces at the
            lobby door. It is the fastest way to read a sim: every lobby box
            below should trace back to a key on this line, and a key with no box
            is a fight nobody entered. */}
        <p className="clock">
          card: <b>{cardOfDay(state.dayIndex).length}</b> posted today{" "}
          <span className="dim">— {cardOfDay(state.dayIndex).map(cardKeyLabel).join(" · ")}</span>
        </p>
        <p className="dbpath">
          database: <b>{path.basename(dbPath)}</b> <span className="dim">({dbPath})</span>
        </p>
        {/* The player-facing handbook (round 22) — the rules, in one place, so
            nobody has to read the engine to learn how the game works. */}
        <p className="dbpath">
          <a className="handbook" href="/wiki">
            📖 The Pintakasi Handbook
          </a>{" "}
          <span className="dim">— the rules, the odds, the money</span>
        </p>
        {ticksEnabled ? (
          <TickControls />
        ) : (
          <p className="dim">Read-only public view — the world clock is operated from the host.</p>
        )}
      </header>

      <section className="cards topline">
        <div className="card">
          <div className="big">
            <GpIcon size={22} /> {gpFmt(now.gpCents)} GP {delta("gpCents", { cents: true })}
          </div>
          <div className="label">Golden Pesos in circulation</div>
          <div className="sub">
            wallets {gpFmt(now.walletCents)} · escrow {gpFmt(now.escrowCents)}
          </div>
        </div>
        <div className="card">
          <div className="big">
            <LtIcon size={22} /> {ltFmt(now.landMinted)} LT {delta("landMinted", { lt: true })}
          </div>
          <div className="label">Land Tokens minted</div>
          <div className="sub">
            {ltFmt(now.landStaked)} staked · {ltFmt(now.landLiquid)} liquid
          </div>
        </div>
        <div className="card">
          <div className="big">
            {now.fights.toLocaleString()} {delta("fights")}
          </div>
          <div className="label">fights fought</div>
          <div className="sub">across every card since day 0</div>
        </div>
        <div className="card">
          <div className="big">
            {now.cancelled.toLocaleString()} {delta("cancelled")}
          </div>
          <div className="label">entries that drew nobody</div>
          {/* Round 34: a bird sits out only if it was ALONE in its group —
              a short card still fought, and settles as a partial refund
              rather than a cancellation. */}
          <div className="sub">alone in the room — whole fee refunded, no land</div>
        </div>
        <div className="card">
          <div className="big">
            {now.covers.toLocaleString()} {delta("covers")}
          </div>
          <div className="label">covers bought</div>
          <div className="sub">the breeding barn&apos;s lifetime volume</div>
        </div>
        <div className="card">
          <div className="big">
            {now.rolls.toLocaleString()} {delta("rolls")}
          </div>
          <div className="label">gacha rolls</div>
          <div className="sub">every token pulled since day 0</div>
        </div>
        <div className="card">
          <div className="big">
            {now.birds.toLocaleString()} {delta("birds")}
          </div>
          <div className="label">birds</div>
          <div className="sub">
            {now.eggs} eggs · {now.active} active · {now.retired} retired · {now.farms} farms
          </div>
        </div>
        <div className="card">
          <div className="big">
            <GpIcon size={22} /> {gpFmt(now.juiceCents)} GP {delta("juiceCents", { cents: true })}
          </div>
          <div className="label">juice pool (fight schedule)</div>
          <div className="sub">breed cuts + paid gacha — the Pintakasi spends it every Thursday</div>
        </div>
        <div className="card">
          <div className="big">
            <GpIcon size={22} /> {gpFmt(now.stakerCents)} GP {delta("stakerCents", { cents: true })}
          </div>
          <div className="label">staker pool (undistributed)</div>
          <div className="sub">
            fight + claim rakes · gacha share · breed cut · land bought —{" "}
            {gpFmt(totalStakingPaidCents)} GP paid to date
          </div>
        </div>
      </section>

      {/* The trend strip lives in its own tab since round 43 — four charts
          above every table had become two screens of scrolling before the
          grids. The cards above keep saying where the world IS; the Charts
          tab says how it got there. */}
      <AdminTabs
        charts={<ChartStrip charts={charts} />}
        chartsCount={charts.length}
        farms={farmRows}
        fights={fightRows}
        birds={birdRows}
        birdFights={birdFights}
        breeding={breedingRows}
        gacha={gachaRows}
        gp={gpRows}
        staking={stakingRows}
        stakingSummary={
          <section className="cardday">
            <h2>
              Staking{" "}
              <span className="cardsum">
                staked land earns a slice of every GP that changes hands — 2% of each
                fight pot and claim tag, 10% of gacha spend, 5% of every breed fee, and
                the whole price of any Land Token bought — paid pro-rata at each day tick
              </span>
            </h2>
            <div className="cards stakecards">
              <div className="card">
                <div className="big">
                  <LtIcon size={22} /> {ltFmt(totalStaked)} LT
                </div>
                <div className="label">total Land Tokens staked</div>
                <div className="sub">
                  {ltFmt(now.landLiquid)} LT still idle ·{" "}
                  {stakingRows.filter((s) => s.stakedLt > 0).length} of {allFarms.length} barns
                  staking
                </div>
              </div>
              <div className="card">
                <div className="big">
                  <GpIcon size={22} /> {gpFmt(totalStakingPaidCents)} GP
                </div>
                <div className="label">total GP earned via staking</div>
                <div className="sub">
                  paid out over {stakingDays} day{stakingDays === 1 ? "" : "s"} ·{" "}
                  {/* Per WHOLE token — the stake is held in hundredths, so it
                      is scaled out before dividing or this reads 100× light. */}
                  {totalStaked > 0
                    ? `${(totalStakingPaidCents / 100 / (totalStaked / LT_CENTS)).toFixed(3)} GP per staked LT`
                    : "no stake yet"}
                </div>
              </div>
              <div className="card">
                <div className="big">
                  <GpIcon size={22} /> {gpFmt(now.stakerCents)} GP
                </div>
                <div className="label">waiting in the pool</div>
                <div className="sub">splits across staked land at the next tick</div>
              </div>
            </div>
          </section>
        }
        ledger={ledgerRows}
        cardCount={cardLobbies.length}
        card={
          cardDay === null ? (
            <p className="cardsum">No card has been posted yet — tick a day.</p>
          ) : (
            <section className="cardday">
              <h2>
                Day {cardDay}{" "}
                <span className="cardsum">
                  {/* The card's weather, stated once: it applied to every
                      lobby below, so every figure on this page was posted
                      under this element. */}
                  <b>{cardWeather}</b> ascendant ·{" "}
                  {cardPending > 0
                    ? `${cardPending} awaiting post time` +
                      // Between CLOSE and COMPLETE the groups are dealt but no
                      // fight has run — that window is the reveal, and worth
                      // saying out loud. Before close there is nothing to say.
                      (cardGroups > 0 ? ` · ${cardGroups} groups dealt` : "")
                    : `went off at the last tick · ${cardGroups} groups · ${cardFights} fights`}
                  {/* THE ROUND-34 NUMBER (not the fight count): how many birds
                      got a whole evening. Three-of-three is the design; a
                      short card means a barn-mate landed in the group or the
                      room was small, and the unfought stake went home. */}
                  {cardPending === 0 && (
                    <>
                      {" · "}
                      <b>{cardFull}</b> full cards ({FIGHTS_PER_GROUP_BIRD} fights) ·{" "}
                      <b>{cardShort}</b> short · <b>{cardCancelled}</b> drew nobody
                    </>
                  )}
                  {" · all time: "}
                  {(card.unmatchedRate * 100).toFixed(1)}% of entries never drew an opponent
                </span>
              </h2>
              <div className="lobbies">
                {cardLobbies.map((l) => (
                  <div className="lobby" key={l.id}>
                    <div className="lobby-head">
                      {l.tags.map((tag) => (
                        <span className={`fight-chip ${tag.kind}`} key={`${tag.kind}-${tag.label}`}>
                          {tag.label}
                        </span>
                      ))}
                      {l.label}
                      <span className="fill">
                        {l.filled} entrants
                        {/* The groups don't exist until the lobby CLOSES, so
                            an open room says nothing about them rather than
                            claiming zero of each. */}
                        {l.groups.length > 0 && (
                          <>
                            {" · "}
                            {l.groups.length} group{l.groups.length === 1 ? "" : "s"} ·{" "}
                            {l.bouts.length} fights
                          </>
                        )}{" "}
                        · #{l.id}
                      </span>
                    </div>
                    {/* ONE BLOCK PER GROUP (round 34). The lobby no longer
                        draws pairs, so a flat list of bouts hides the thing
                        worth reading: which room a fight came out of, and
                        whether that room gave everyone in it a full card. */}
                    {l.groups.map((g) => (
                      <div className="card-group" key={g.no}>
                        <div className="group-head">
                          GROUP {g.no + 1}
                          <span className="dim">
                            {" "}
                            {g.size} bird{g.size === 1 ? "" : "s"} · {g.bouts.length} fight
                            {g.bouts.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="card-bouts">
                      {g.bouts.map((b, i) => (
                        <div className="card-bout" key={i}>
                          <div className="card-fighter winner">
                            <div className="card-birdline">
                              <span className="card-bird">
                                <span className="grade" style={{ color: gradeColor(b.winner.grade) }}>
                                  {b.winner.grade}
                                </span>{" "}
                                {b.winner.name} <ElementSprite element={b.winner.element} size={12} /> {b.winner.stars}★
                              </span>
                              <span className="card-figure">PF {b.figures[0]}</span>
                            </div>
                            <div className="card-farm">
                              <span
                                className="dot"
                                style={{ background: b.winnerFarmP, borderColor: b.winnerFarmS }}
                              />
                              {b.winnerFarm}
                            </div>
                          </div>
                          <div className="card-fighter loser">
                            <div className="card-birdline">
                              <span className="card-bird">
                                <span className="grade" style={{ color: gradeColor(b.loser.grade) }}>
                                  {b.loser.grade}
                                </span>{" "}
                                {b.loser.name} <ElementSprite element={b.loser.element} size={12} /> {b.loser.stars}★
                              </span>
                              <span className="card-figure">PF {b.figures[1]}</span>
                            </div>
                            <div className="card-farm">
                              <span
                                className="dot"
                                style={{ background: b.loserFarmP, borderColor: b.loserFarmS }}
                              />
                              {b.loserFarm}
                            </div>
                          </div>
                        </div>
                      ))}
                        </div>
                      </div>
                    ))}
                    {/* THE SHORT CARD — fought, but not a full evening. The
                        refund is the mechanic made visible: the entry fee
                        escrows whole and only the fought share is ever at
                        risk, so the difference comes home the same night. */}
                    {l.short.map((s, i) => (
                      <div className="bout short" key={i}>
                        ▵ {s.bird} ({s.farm}) — group {(s.group ?? 0) + 1}: {s.fights} of{" "}
                        {FIGHTS_PER_GROUP_BIRD} fights, {s.refunded} GP unfought and returned
                      </div>
                    ))}
                    {l.unmatched.map((u, i) => (
                      <div className="bout cancelled" key={i}>
                        ✗ {u.bird} ({u.farm}) — drew nobody, {u.refunded} GP refunded
                      </div>
                    ))}
                    {l.pending.map((p, i) => (
                      <div className="bout pending" key={i}>
                        … {p.bird} ({p.farm}) —{" "}
                        {p.drew === null ? (
                          // Still OPEN: the groups aren't dealt until close,
                          // so there is no draw to reveal yet.
                          "on the card, awaiting the draw"
                        ) : p.drew.length === 0 ? (
                          // CLOSED and alone in the room — the empty list is
                          // the answer, not a missing one.
                          <>group {(p.group ?? 0) + 1}: drew nobody, refunds at post</>
                        ) : (
                          <>
                            group {(p.group ?? 0) + 1}, drew{" "}
                            {p.drew.map((o) => `${o.bird} (${o.farm})`).join(" · ")}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )
        }
        pintakasiCount={pintakasiBoxes.filter((t) => t.weekIndex === pintakasiWeek).length}
        pintakasi={
          pintakasiWeek === null ? (
            <p className="cardsum">No championship has been run yet — the crowns go off Thursdays.</p>
          ) : (
            <section className="cardday">
              <h2>
                🏆 The Pintakasi{" "}
                <span className="cardsum">
                  the blade championships — hardcore throughout, crowns every Thursday
                </span>
              </h2>
              {/* Stacked, not columned (round 24) — a bracket tree runs much
                  wider than the old text list ever did, and three of them
                  side by side left no room to breathe. Each gets the full
                  row width and scrolls its own bracket horizontally if it
                  outgrows it — see .bracket-wrap. */}
              <div className="crowns">
                {pintakasiBoxes.map((t) => (
                  <div className="lobby crownbox" key={t.id}>
                    <div className="lobby-head">
                      {t.label}
                      <span className={`division-tag ${t.division}`}>
                        {DIVISION_RULES[t.division].hardcore ? "MAJOR" : "JUVENILE"}
                      </span>
                      <span className="fill">
                        {t.status === "open"
                          ? `${t.pending} registered`
                          : t.status === "cancelled"
                            ? "cancelled"
                            : `bracket of ${t.bracketSize} · purse ${gpFmt(t.purseCents ?? 0)} GP · land pot ${ltFmt(t.landPotCents)} LT`}
                      </span>
                    </div>
                    {t.status === "completed" && t.bracketSize && t.hasChampion && (
                      <Bracket rounds={t.rounds} bracketSize={t.bracketSize} />
                    )}
                    {/* Hardcore is a Majors-only rule (round 23) — the
                        Juvenile Championship's losers fight another day. */}
                    {t.status === "completed" && DIVISION_RULES[t.division].hardcore && (
                      <div className="hardcore-note">All losing birds force-retired.</div>
                    )}
                    {t.status === "cancelled" && (
                      <div className="bout cancelled">
                        ✗ field too small — entries refunded, juice held
                      </div>
                    )}
                    {t.status === "open" && t.pending === 0 && (
                      <div className="bout pending">… no registrants yet</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )
        }
      />
    </main>
  );
}

const CSS = `
  body { margin: 0; }
  .office { font-family: ui-monospace, Menlo, monospace; background: #12100d; color: #e8e0d0;
    min-height: 100vh; padding: 1.5rem 2rem 4rem; font-size: 13px; }
  .office h1 { color: #e8b64c; font-size: 1.3rem; margin: 0 0 .25rem; }
  .office-mark { width: 1.15em; height: 1.15em; vertical-align: -.2em; object-fit: contain; }
  .world-badge { font-size: .55em; vertical-align: middle; padding: .2em .6em; border-radius: 4px;
    letter-spacing: .08em; border: 1px solid; }
  .world-badge.sim { color: #9fd3f0; background: #1e3542; border-color: #3d6a85; }
  .world-badge.live { color: #f0a49f; background: #42211e; border-color: #8a4a42; }
  .office .clock { color: #9a8f78; margin: 0; }
  .office .dbpath { color: #9a8f78; margin: .2rem 0 0; }
  .office .dbpath b { color: #e8b64c; }
  .office .dim { color: #6a6252; font-size: .85em; }
  .handbook { color: #e8b64c; text-decoration: none; border: 1px solid #3a342a;
    border-radius: 4px; padding: .15rem .5rem; }
  .handbook:hover { background: #1c1914; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: .75rem; margin-top: 1.25rem; }
  .cards.topline { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .card { background: #1c1914; border: 1px solid #3a342a; border-radius: 6px; padding: .75rem .9rem; }
  .card .big { font-size: 1.35rem; color: #f4e9d0; }
  .card .label { color: #e8b64c; margin-top: .15rem; }
  .card .sub { color: #9a8f78; font-size: .85em; margin-top: .25rem; }
  .tabs { margin: 1.5rem 0 .75rem; display: flex; gap: .4rem; flex-wrap: wrap; }
  .tabs button { font: inherit; cursor: pointer; color: #9a8f78; background: #1c1914;
    border: 1px solid #3a342a; border-radius: 4px; padding: .35rem .9rem; }
  .tabs button.on { color: #12100d; background: #e8b64c; border-color: #e8b64c; }
  .tabs .count { opacity: .7; font-size: .85em; margin-left: .3em; }
  .ticks { margin-top: .75rem; display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
  .ticks button { font: inherit; cursor: pointer; color: #12100d; background: #e8b64c;
    border: 1px solid #e8b64c; border-radius: 4px; padding: .35rem .9rem; font-weight: 600; }
  .ticks button:disabled { opacity: .5; cursor: wait; }
  .tick-last { color: #9a8f78; font-size: .9em; }
  .grade { color: #f4e9d0; }
  .statnum { color: #9a8f78; font-size: .88em; }
  .cardday { margin-top: 1.5rem; }
  /* The staking totals sit above their book — tighter than the page header set. */
  .cards.stakecards { margin-top: 0; margin-bottom: 1rem; }
  .cardday h2 { color: #e8b64c; font-size: 1rem; margin: 0 0 .6rem; }
  .cardday .cardsum { color: #9a8f78; font-weight: 400; font-size: .85em; margin-left: .5em; }
  .lobbies { display: flex; flex-direction: column; gap: .75rem; }
  /* Stacked, not columned (round 24) — a bracket tree is much wider than the
     old text list, so each championship now takes the full row and scrolls
     its own bracket sideways (.bracket-wrap) instead of squeezing three
     boxes into one width. */
  .crowns { display: flex; flex-direction: column; gap: .75rem; }
  .hardcore-note { color: #e07a6a; margin-top: .5rem; }
  .lobby { background: #1c1914; border: 1px solid #3a342a; border-radius: 6px; padding: .55rem .75rem; }
  .lobby-head { color: #e8b64c; margin-bottom: .3rem; }
  .lobby-head .fill { color: #9a8f78; float: right; }
  .fight-chip { display: inline-block; color: #e8e0d0; border: 1px solid; border-radius: 999px;
    font-size: .72em; letter-spacing: .04em; margin-right: .45rem; padding: .08rem .42rem; }
  .fight-chip.claimer { color: #c8c2b7; background: #34312d; border-color: #625d55; }
  .fight-chip.open { color: #9fd3f0; background: #1e3542; border-color: #3d6a85; }
  .fight-chip.juvenile { color: #9add9a; background: #1c3020; border-color: #3d6b45; }
  .fight-chip.nw3 { color: #f2d675; background: #3b341b; border-color: #756629; }
  .fight-chip.maiden { color: #efacd0; background: #40243a; border-color: #81506f; }
  /* One block per GROUP (round 34) — the rooms a lobby was dealt into. The
     rule down the left is the cheapest way to say "these fights belong
     together" without boxing every group in another border. */
  .card-group { margin-top: .5rem; padding-left: .5rem; border-left: 2px solid #2b271f; }
  .group-head { color: #9a8f78; font-size: .78em; letter-spacing: .06em; }
  .card-bouts { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
    gap: .45rem; margin-top: .3rem; }
  .card-bout { background: #171410; border: 1px solid #3a342a; border-radius: 5px;
    padding: .3rem .45rem; }
  .card-fighter { padding: .2rem .35rem; }
  .card-fighter + .card-fighter { border-top: 1px solid #2b271f; margin-top: .15rem; padding-top: .35rem; }
  .card-fighter.winner { border-left: 2px solid #e8b64c; }
  .card-fighter.winner .card-bird { color: #e8b64c; font-weight: 600; }
  .card-fighter.loser { color: #6a6252; }
  .card-birdline, .card-farm { display: flex; align-items: center; gap: .4rem; min-width: 0; }
  .card-birdline { justify-content: space-between; }
  .card-bird { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .card-figure { color: #9a8f78; font-variant-numeric: tabular-nums; flex: 0 0 auto; }
  .card-farm { color: #9a8f78; font-size: .82em; margin-top: .18rem; }
  .card-farm .dot { margin-right: 0; }
  /* The major/juvenile pill (round 24) — same shape as .world-badge, its own
     two colors: gold for the hardcore stage, green for the discovery one. */
  .division-tag { font-size: .68em; vertical-align: middle; margin-left: .5em; padding: .1em .5em;
    border-radius: 4px; letter-spacing: .06em; border: 1px solid; }
  .division-tag.major { color: #e8b64c; background: #3a2f1a; border-color: #6b5527; }
  .division-tag.juvenile { color: #7fc97f; background: #1c3020; border-color: #3d6b45; }
  .bout { color: #cfc6b2; padding: .12rem 0; }
  .bout b { color: #f4e9d0; }
  .bout .figs { color: #9a8f78; }
  .bout.cancelled { color: #e07a6a; }
  /* Amber, between the red of "no fight at all" and the plain white of a full
     card: a short card is a partial miss, and it should read as one. */
  .bout.short { color: #e8b64c; }
  .bout.pending { color: #9fd3f0; }
  /* ── The bracket tree (round 24) ─────────────────────────────────────────
     One CSS grid, no JS: BRACKET_ROW_UNIT-tall rows, one per leaf SEAT (not
     per match) — a round-r card spans 2^r of them, so it lands centered
     between the two feeder cards that produced it purely from grid math. */
  .crownbox { margin-top: .4rem; }
  .bracket-wrap { overflow-x: auto; margin-top: .5rem; padding-bottom: .3rem; }
  .bracket-head, .bracket-grid { display: grid; column-gap: 1.1rem; width: max-content; }
  .bracket-head > div { color: #9a8f78; font-size: .78em; letter-spacing: .06em; text-transform: uppercase;
    padding-bottom: .3rem; margin-bottom: .3rem; border-bottom: 1px solid #3a342a; }
  .bracket-head > div.final { color: #e8b64c; font-weight: 600; }
  .bmatch { align-self: center; position: relative; background: #171410; border: 1px solid #3a342a;
    border-radius: 5px; padding: .28rem .5rem; overflow: hidden; }
  /* The connector stubs — cheap CSS-only gesture at the lines a real bracket
     draws between rounds; on-path turns them gold so the champion's run is
     traceable at a glance across every column it touches. */
  .bmatch.has-prev::before, .bmatch.has-next::after { content: ""; position: absolute; top: 50%;
    width: 1.1rem; height: 1px; background: #3a342a; }
  .bmatch.has-prev::before { left: -1.1rem; }
  .bmatch.has-next::after { right: -1.1rem; }
  .bmatch.on-path.has-prev::before, .bmatch.on-path.has-next::after { background: #e8b64c; height: 2px; }
  /* Tight line-height (round 40): each fighter now carries THREE lines, and
     the seat unit is sized off exactly this figure — loosening it here will
     clip round-1 cards, which overflow: hidden above makes silent. */
  .bfighter { display: block; font-size: .82em; line-height: 1.25; min-width: 0; }
  .bfighter + .bfighter { border-top: 1px solid #2b271f; margin-top: .16rem; padding-top: .16rem; }
  .bfighter .btop, .bfighter .bmeta { display: flex; align-items: center; gap: .45em; min-width: 0; }
  .bfighter .btop { justify-content: space-between; }
  .bfighter .bmeta { margin-top: .04rem; }
  .bfighter.won { color: #f4e9d0; }
  .bfighter.won .bname { color: #e8b64c; font-weight: 600; }
  .bfighter.lost { color: #6a6252; }
  .bfighter.bye { color: #6a6252; font-style: italic; }
  .bfighter .bidentity { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bfighter .belement { color: #9a8f78; }
  /* nowrap is load-bearing since round 40, not cosmetic: a long farm name used
     to WRAP to a second line, and a round-1 card has no spare height left to
     absorb one — it would clip under overflow: hidden. Ellipsis instead.
     (text-overflow only ever worked with nowrap anyway.) */
  .bfighter .bfarm { color: #9a8f78; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; flex: 1; }
  .bfighter.lost .bfarm { color: #524b3d; }
  .bfighter .bfig { color: #9a8f78; font-variant-numeric: tabular-nums; flex: 0 0 auto; }
  .bfighter .bawards { display: inline-flex; align-items: center; gap: .25em; color: #7fc97f;
    font-variant-numeric: tabular-nums; flex: 0 0 auto; white-space: nowrap; }
  /* The land share's fight count (round 42) — muted, because it explains the
     figure beside it rather than being money itself. Deliberately in-line: the
     seat unit allows three lines per fighter and no fourth. */
  .bfighter .bfights { color: #4f7a4f; }
  .bfighter.lost .bfights { color: #3d5c3d; }
  /* The winner's side gets the gold rail the ask asked for; a bye still
     shows one (it IS the winner, just an unopposed one). */
  .bfighter.won { border-left: 2px solid #e8b64c; padding-left: .35em; margin-left: -.35em; }
  /* The career line (round 40): record left, net lifetime GP right. Muted
     against the farm row above it — it is context, not the result. */
  .bfighter .bcareer { justify-content: space-between; color: #9a8f78;
    font-variant-numeric: tabular-nums; }
  .bfighter.lost .bcareer { color: #524b3d; }
  .bfighter .brec { flex: 0 0 auto; }
  .bfighter .bnet { flex: 0 0 auto; display: inline-flex; align-items: center; gap: .25em; }
  /* Net can be negative — a subdued red, dimmer again on the losing side, so
     it reads as a fact about the bird rather than an error on the page. */
  .bfighter .bnet.neg { color: #b8695c; }
  .bfighter.lost .bnet.neg { color: #7d4b44; }
  .diff { font-size: .65em; font-weight: 600; margin-left: .35em; vertical-align: middle; }
  .up { color: #7fc97f; } .down { color: #e07a6a; }
  .farm-chip { white-space: nowrap; }
  .dot { display: inline-block; width: .65em; height: .65em; border-radius: 50%; border: 2px solid; margin-right: .4em; }
  .bot { color: #12100d; background: #9a8f78; border-radius: 3px; font-size: .7em; padding: 0 .3em; margin-left: .45em; vertical-align: middle; }
  .world { color: #9a8f78; font-style: italic; }
  @media (max-width: 1100px) {
    .cards.topline { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 620px) {
    .office { padding-left: 1rem; padding-right: 1rem; }
    .cards.topline { grid-template-columns: 1fr; }
    .card-bouts { grid-template-columns: 1fr; }
  }
`;
