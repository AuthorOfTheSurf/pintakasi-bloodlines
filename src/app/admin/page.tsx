import path from "node:path";
import { db, defaultDbPath } from "@/db/client";
import { TickControls } from "./tick-controls";
import { battleLog, birds, claims, events, farms, gachaTokens, gameState, lobbies, lobbyEntries, tournamentEntries, tournaments } from "@/db/schema";
import {
  ECONOMY,
  FIGHTS_PER_GROUP_BIRD,
  FORMATS,
  LT_CENTS,
  PINTAKASI,
  landForFight,
  landForTournamentFight,
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
import { CHART_CSS, ChartStrip, type DayChartProps } from "./charts";
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
  landGranted: number; // hundredths of a token (round 36) — render via ltFmt
  won: boolean;
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
  const fighter = (
    e: EntryRow,
    won: boolean,
    figure: number | null,
    showAwards = false
  ): BracketFighter => {
    const card = birdCard(e.birdId);
    return {
      bird: card.name,
      farm: fname(e.farmId),
      grade: card.grade,
      element: card.element,
      stars: card.stars,
      figure,
      gpWonCents: showAwards ? e.gpWonCents : 0,
      landGranted: showAwards ? e.landGranted : 0,
      won,
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
const BRACKET_ROW_UNIT = "3.25rem";
const BRACKET_COL_WIDTH = "clamp(250px, 22vw, 320px)";

/**
 * The bracket tree for one completed championship — round columns left to
 * right, the champion's own card at the far right. Pure CSS grid (see
 * BRACKET_ROW_UNIT above) — no client JS, so this has to be a server
 * component throughout, same as the rest of the Stewards' Office.
 */
function Bracket({
  rounds,
  champion,
  bracketSize,
}: {
  rounds: BracketRound[];
  champion: {
    bird: string;
    farm: string;
    grade: Grade;
    element: string;
    stars: number;
    wonCents: number;
    landGranted: number;
  };
  bracketSize: number;
}) {
  const fighterName = (f: Pick<BracketFighter, "bird" | "grade" | "element" | "stars">) => (
    <>
      <b className="grade" style={{ color: gradeColor(f.grade) }}>{f.grade}</b>{" "}
      <span className="bname">{f.bird}</span>{" "}
      <span className="belement"><ElementSprite element={f.element} size={12} /> {f.stars}★</span>
    </>
  );
  const awards = (f: Pick<BracketFighter, "gpWonCents" | "landGranted">) =>
    f.gpWonCents > 0 || f.landGranted > 0 ? (
      <span className="bawards">
        {f.gpWonCents > 0 && <><GpIcon size={11} /> +{gpFmt(f.gpWonCents)}</>}
        {f.landGranted > 0 && <><LtIcon size={11} /> +{ltFmt(f.landGranted)}</>}
      </span>
    ) : null;
  const totalRounds = rounds.length;
  const columns = totalRounds + 1; // + the champion's own column
  const colTemplate = `repeat(${columns}, ${BRACKET_COL_WIDTH})`;
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
        <div className="final">Champion</div>
      </div>
      <div
        className="bracket-grid"
        style={{ gridTemplateColumns: colTemplate, gridTemplateRows: `repeat(${bracketSize}, ${BRACKET_ROW_UNIT})` }}
      >
        {rounds.map((r, ri) => {
          const round = ri + 1;
          const span = 2 ** round; // how many leaf seats this round's card covers
          return r.matches.map((m, mi) => (
            <div
              key={`${round}-${mi}`}
              // has-prev/has-next grow the little connector stubs (see CSS) —
              // round one has nothing feeding it, every round feeds either
              // the next round or the champion box.
              className={`bmatch${m.onPath ? " on-path" : ""}${round > 1 ? " has-prev" : ""} has-next`}
              style={{ gridColumn: round, gridRow: `${mi * span + 1} / span ${span}` }}
            >
              <div className={`bfighter ${m.a.won ? "won" : "lost"}`}>
                <div className="btop">
                  <span className="bidentity">{fighterName(m.a)}</span>
                  {m.a.figure !== null && <span className="bfig">PF {m.a.figure}</span>}
                </div>
                <div className="bmeta">
                  <span className="bfarm">{m.a.farm}</span>
                  {awards(m.a)}
                </div>
              </div>
              {m.isBye ? (
                <div className="bfighter bye">— bye —</div>
              ) : (
                <div className={`bfighter ${m.b!.won ? "won" : "lost"}`}>
                  <div className="btop">
                    <span className="bidentity">{fighterName(m.b!)}</span>
                    {m.b!.figure !== null && <span className="bfig">PF {m.b!.figure}</span>}
                  </div>
                  <div className="bmeta">
                    <span className="bfarm">{m.b!.farm}</span>
                    {awards(m.b!)}
                  </div>
                </div>
              )}
            </div>
          ));
        })}
        <div
          className="bmatch bchamp has-prev on-path"
          style={{ gridColumn: columns, gridRow: `1 / span ${bracketSize}` }}
        >
          <div className="bfighter won champ">
            <div className="btop">
              🏆 <span className="bidentity">{fighterName(champion)}</span>
            </div>
            <div className="bmeta"><span className="bfarm">{champion.farm}</span></div>
          </div>
          <div className="bpurse">
            <GpIcon size={11} /> +{gpFmt(champion.wonCents)}
            {champion.landGranted > 0 && <> · <LtIcon size={11} /> +{ltFmt(champion.landGranted)}</>}
          </div>
        </div>
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
          ? buildBracket(t.bracketSize, totalRounds, fieldEntries, log, t.id, birdCard, fname, champion?.birdId ?? null)
          : [];
      const championCard = champion ? birdCard(champion.birdId) : null;
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
        champion: champion
          ? {
              bird: championCard!.name,
              farm: fname(champion.farmId),
              grade: championCard!.grade,
              element: championCard!.element,
              stars: championCard!.stars,
              wonCents: champion.gpWonCents,
              landGranted: champion.landGranted,
            }
          : null,
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

  const charts: DayChartProps[] = [
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
  ];

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
  // LT: the land the bird's NIGHTS minted (both fighters are paid, win or
  // lose) plus the championship's elimination grant.
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
  // Tournament land stays per fight: the Majors never joined the group stage.
  // Both maps accumulate the engine's own integers — cents of GP, hundredths
  // of a token (round 36). Summing before scaling is the point: scale first
  // and a column of thousands of awards accretes float error a cent at a time.
  const netGpCents = new Map<string, number>();
  const netLt = new Map<string, number>();
  const bump = (map: Map<string, number>, key: string, by: number) =>
    map.set(key, (map.get(key) ?? 0) + by);
  for (const r of log) {
    bump(netGpCents, r.birdId, r.gpDeltaCents); // 0 on Pintakasi rows — the purse settles below
    if (r.tournamentId)
      bump(netLt, r.birdId, landForTournamentFight(PINTAKASI.LAND_BASIS)); // free entry, fixed basis (round 22)
  }
  for (const e of allEntries) {
    if (e.fights === 0) continue; // unmatched, or not posted yet — land is for FIGHTING
    bump(netLt, e.birdId, landForFight(stakePerFight(e.fee) * e.fights));
  }
  for (const e of allTEntries) {
    if (e.status === "refunded" || e.status === "bumped") continue; // fee came back
    bump(netGpCents, e.birdId, e.gpWonCents - e.fee * 100);
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

  const ledgerRows: LedgerRowUI[] = allEvents.slice(-LEDGER_LIMIT).map((e) => ({
    id: e.id,
    day: e.dayIndex,
    type: TYPE_LABELS[e.type] ?? e.type,
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
        <TickControls />
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

      {/* The trend strip sits between the standing totals and the grids: the
          cards say where the world IS, these say how it got there, and both
          are readable before anyone has to pick a tab. */}
      <ChartStrip charts={charts} />

      <AdminTabs
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
                            : `bracket of ${t.bracketSize} · purse ${gpFmt(t.purseCents ?? 0)} GP`}
                      </span>
                    </div>
                    {t.status === "completed" && t.bracketSize && t.champion && (
                      <Bracket rounds={t.rounds} champion={t.champion} bracketSize={t.bracketSize} />
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
    border-radius: 5px; padding: .35rem .55rem; overflow: hidden; }
  /* The connector stubs — cheap CSS-only gesture at the lines a real bracket
     draws between rounds; on-path turns them gold so the champion's run is
     traceable at a glance across every column it touches. */
  .bmatch.has-prev::before, .bmatch.has-next::after { content: ""; position: absolute; top: 50%;
    width: 1.1rem; height: 1px; background: #3a342a; }
  .bmatch.has-prev::before { left: -1.1rem; }
  .bmatch.has-next::after { right: -1.1rem; }
  .bmatch.on-path.has-prev::before, .bmatch.on-path.has-next::after { background: #e8b64c; height: 2px; }
  .bfighter { display: block; font-size: .82em; line-height: 1.45; min-width: 0; }
  .bfighter + .bfighter { border-top: 1px solid #2b271f; margin-top: .2rem; padding-top: .25rem; }
  .bfighter .btop, .bfighter .bmeta { display: flex; align-items: center; gap: .45em; min-width: 0; }
  .bfighter .btop { justify-content: space-between; }
  .bfighter .bmeta { margin-top: .08rem; }
  .bfighter.won { color: #f4e9d0; }
  .bfighter.won .bname { color: #e8b64c; font-weight: 600; }
  .bfighter.lost { color: #6a6252; }
  .bfighter.bye { color: #6a6252; font-style: italic; }
  .bfighter .bidentity { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bfighter .belement { color: #9a8f78; }
  .bfighter .bfarm { color: #9a8f78; overflow: hidden; text-overflow: ellipsis; flex: 1; }
  .bfighter.lost .bfarm { color: #524b3d; }
  .bfighter .bfig { color: #9a8f78; font-variant-numeric: tabular-nums; flex: 0 0 auto; }
  .bfighter .bawards { display: inline-flex; align-items: center; gap: .25em; color: #7fc97f;
    font-variant-numeric: tabular-nums; }
  /* The winner's side gets the gold rail the ask asked for; a bye still
     shows one (it IS the winner, just an unopposed one). */
  .bfighter.won { border-left: 2px solid #e8b64c; padding-left: .35em; margin-left: -.35em; }
  .bmatch.bchamp { display: flex; flex-direction: column; align-items: stretch; gap: .25rem;
    justify-content: center; padding: .5rem .6rem; }
  .bfighter.champ { font-size: .95em; border-left: none; padding-left: 0; margin-left: 0; }
  .bfighter.champ .bname { font-size: 1.05em; }
  .bpurse { color: #7fc97f; font-size: .82em; }
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
