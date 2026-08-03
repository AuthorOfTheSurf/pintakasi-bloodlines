import path from "node:path";
import { db, defaultDbPath } from "@/db/client";
import { TickControls } from "./tick-controls";
import { battleLog, birds, claims, events, farms, gachaTokens, gameState, lobbies, lobbyEntries, tournamentEntries, tournaments } from "@/db/schema";
import { ECONOMY, FORMATS, type FightFormat } from "@/engine/config";
import { splitBreedFee } from "@/engine/breeding";
import { GameClock } from "@/engine/game-clock";
import { ageOf } from "@/engine/lifecycle";
import { baselineBefore, computeTopline, type Topline } from "@/engine/snapshots";
import { GpIcon, LtIcon } from "./sprites";
import {
  AdminTabs,
  type BirdRowUI,
  type BreedingRowUI,
  type FarmRowUI,
  type FightRowUI,
  type GachaRowUI,
  type GpRowUI,
  type LedgerRowUI,
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

function gpFmt(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

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
  const pendingClaims = d.select().from(claims).all().filter((c) => c.status === "pending");
  const allEvents = d.select().from(events).all();

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

  /** Signed, colored delta badge — GP values in cents, counts as-is. */
  const delta = (key: keyof Topline, opts: { cents?: boolean } = {}) => {
    if (!base) return null;
    const diff = (now[key] as number) - (base[key] as number);
    if (diff === 0) return null;
    const shown = opts.cents ? gpFmt(Math.abs(diff)) : Math.abs(diff).toLocaleString();
    return <span className={`diff ${diff > 0 ? "up" : "down"}`}>{diff > 0 ? "+" : "−"}{shown}</span>;
  };

  // ── The card (round 17) — the most recent day's schedule, lobby by lobby ──
  // Between manual ticks the board is empty (auto-play + resolve both happen
  // inside the tick), so this is usually the card that WENT OFF at the last
  // tick — the place to spot gaps: thin lobbies, odd fields, farm clumps.
  const allLobbies = d.select().from(lobbies).all();
  const cardDay = allLobbies.length ? Math.max(...allLobbies.map((l) => l.dayOpened)) : null;
  const bname = (id: string) => birdById.get(id)?.name ?? id;
  const cardLobbies = allLobbies
    .filter((l) => l.dayOpened === cardDay)
    .map((l) => {
      const entries = allEntries.filter((e) => e.lobbyId === l.id);
      const bouts = log
        .filter((r) => r.lobbyId === l.id && r.result === "win")
        .map((w) => ({
          winner: bname(w.birdId),
          winnerFarm: fname(w.farmId),
          loser: w.opponentName,
          loserFarm: fname(w.opponentFarmId),
          figures: [w.pitFigure, log.find((r) => r.lobbyId === l.id && r.birdId === w.opponentBirdId)?.pitFigure ?? 0] as const,
        }));
      return {
        id: l.id,
        label:
          `${l.mode.toUpperCase()}${l.classType === "open" ? "" : "·" + l.classType.toUpperCase()}` +
          `${l.price ? ` @ ${l.price} GP tag` : ""} · ${FORMATS[l.format as FightFormat].label}`,
        hardcore: l.mode === "hardcore",
        filled: entries.length,
        capacity: l.capacity,
        bouts,
        unmatched: entries
          .filter((e) => e.status === "unmatched")
          .map((e) => ({ bird: bname(e.birdId), farm: fname(e.farmId), fee: e.fee })),
        pending: entries
          .filter((e) => e.status === "pending")
          .map((e) => ({ bird: bname(e.birdId), farm: fname(e.farmId) })),
      };
    });
  const cardFights = cardLobbies.reduce((s, l) => s + l.bouts.length, 0);
  const cardCancelled = cardLobbies.reduce((s, l) => s + l.unmatched.length, 0);
  const cardPending = cardLobbies.reduce((s, l) => s + l.pending.length, 0);

  // ── The Pintakasi (round 18) — the latest week's blade championships ──────
  const allTournaments = d.select().from(tournaments).all();
  const allTEntries = d.select().from(tournamentEntries).all();
  const pintakasiWeek = allTournaments.length
    ? Math.max(...allTournaments.map((t) => t.weekIndex))
    : null;
  const FORMAT_LABEL = (f: string) => FORMATS[f as FightFormat]?.label ?? f;
  // Show the two most recent weeks: last Wednesday's crowns stay visible
  // while the new week's registrations gather.
  const pintakasiBoxes = allTournaments
    .filter((t) => pintakasiWeek !== null && t.weekIndex >= pintakasiWeek - 1)
    .map((t) => {
      const entries = allTEntries.filter((e) => e.tournamentId === t.id);
      const elimRound = new Map(entries.map((e) => [e.birdId, e.eliminatedRound]));
      const totalRounds = t.bracketSize ? Math.log2(t.bracketSize) : 0;
      const roundName = (r: number) => {
        const fromFinal = totalRounds - r;
        if (fromFinal === 0) return "Final";
        if (fromFinal === 1) return "Semifinals";
        if (fromFinal === 2) return "Quarterfinals";
        return `Round of ${(t.bracketSize ?? 0) / Math.pow(2, r - 1)}`;
      };
      const bouts = log
        .filter((r) => r.tournamentId === t.id && r.result === "win")
        .map((w) => ({
          round: elimRound.get(w.opponentBirdId) ?? 1,
          winner: bname(w.birdId),
          winnerFarm: fname(w.farmId),
          loser: w.opponentName,
          loserFarm: fname(w.opponentFarmId),
          figures: [w.pitFigure, log.find((r) => r.tournamentId === t.id && r.birdId === w.opponentBirdId && r.opponentBirdId === w.birdId)?.pitFigure ?? 0] as const,
        }))
        .sort((a, b) => b.round - a.round);
      const champion = entries.find((e) => e.status === "champion");
      return {
        id: t.id,
        label: `${FORMAT_LABEL(t.format)} Championship · wk ${t.weekIndex}`,
        status: t.status,
        bracketSize: t.bracketSize,
        field: entries.filter((e) => e.status !== "bumped" && e.status !== "refunded").length,
        pending: entries.filter((e) => e.status === "pending").length,
        purseCents: t.purseCents,
        champion: champion
          ? { bird: bname(champion.birdId), farm: fname(champion.farmId), wonCents: champion.gpWonCents }
          : null,
        rounds: [...new Set(bouts.map((b) => b.round))].map((r) => ({
          name: roundName(r),
          bouts: bouts.filter((b) => b.round === r),
        })),
      };
    });

  // ── Grid rows ─────────────────────────────────────────────────────────────
  const farmRows: FarmRowUI[] = allFarms.map((f) => {
    const mine = allBirds.filter((b) => b.farmId === f.id);
    return {
      name: f.name,
      bot: f.isBot === 1,
      farmP: f.primaryColor,
      farmS: f.secondaryColor,
      gp: (f.gp * 100 + f.gpCents) / 100,
      liquidLt: f.landTokens,
      stakedLt: f.stakedLand,
      birds: mine.length,
      wins: f.wins,
      losses: f.losses,
      studs: mine.filter((b) => b.listedStud === 1).length,
    };
  });

  const fightRows: FightRowUI[] = winRows.slice(-FIGHT_LIMIT).map((w) => {
    const mirror = log.find((r) => r.lobbyId === w.lobbyId && r.birdId === w.opponentBirdId);
    return {
      day: w.dayIndex,
      card:
        `${w.mode.toUpperCase()}${w.lobby !== "open" ? "·" + w.lobby.toUpperCase() : ""}` +
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
      pot: w.gpDelta * 2,
    };
  });

  const birdRows: BirdRowUI[] = allBirds.map((b) => ({
    name: b.name,
    farm: fname(b.farmId),
    farmP: fcolors(b.farmId).P ?? "",
    farmS: fcolors(b.farmId).S ?? "",
    sex: b.status === "egg" ? "?" : b.sex === "male" ? "rooster" : "hen",
    baseCoat: b.baseCoat,
    trimColor: b.trimColor,
    age: Math.max(0, ageOf(b, week)),
    stars: b.halfStars / 2,
    element: b.element,
    agility: b.agility,
    sight: b.sight,
    stamina: b.stamina,
    gameness: b.gameness,
    station: b.station,
    condition: b.condition,
    total: b.agility + b.sight + b.stamina + b.gameness + b.station + b.condition,
    status:
      b.status === "egg"
        ? b.birthWeek > week
          ? "pregnant"
          : "in the nest"
        : b.listedStud
          ? "Studding" // a rooster registered in the breed barn (ruled round 15)
          : `${b.status}${b.retiredBy ? ` (${b.retiredBy})` : ""}`,
    wins: b.wins,
    losses: b.losses,
  }));

  const split = splitBreedFee(ECONOMY.BREED_FEE);
  const breedingRows: BreedingRowUI[] = bred.map((b, i) => {
    const father = b.fatherId ? birdById.get(b.fatherId) : undefined;
    const studFarmId = father?.farmId ?? null;
    return {
      seq: i,
      conceived: b.birthDay,
      egg: b.name,
      hen: (b.motherId && birdById.get(b.motherId)?.name) || b.motherId || "?",
      rooster: father?.name ?? b.fatherId ?? "?",
      studFarm: fname(studFarmId),
      studFarmP: fcolors(studFarmId).P ?? "",
      studFarmS: fcolors(studFarmId).S ?? "",
      nestFarm: fname(b.farmId),
      nestFarmP: fcolors(b.farmId).P ?? "",
      nestFarmS: fcolors(b.farmId).S ?? "",
      lays: b.birthWeek * 7,
      hatches: (b.birthWeek + 1) * 7,
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
      const cut = pools.source === "gacha" ? "gacha spend" : "breed cut";
      if (pools.stakerPoolCents > 0)
        gpRows.push({ seq: gpRows.length, ...base, flow: `→ staker pool (${cut})`, amount: pools.stakerPoolCents / 100 });
      if (pools.juicePoolCents > 0)
        gpRows.push({ seq: gpRows.length, ...base, flow: `→ juice pool (${cut})`, amount: pools.juicePoolCents / 100 });
    } else if (e.type === "staking_payout") {
      gpRows.push({ seq: gpRows.length, ...base, flow: "staking yield paid", amount: (e.gpCents ?? 0) / 100 });
    }
  }

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
      <style>{CSS}</style>
      <header>
        <h1>
          🐓 Pintakasi — Stewards&apos; Office{" "}
          <span className={`world-badge ${isSimWorld ? "sim" : "live"}`}>
            {isSimWorld ? "SIM WORLD" : "LIVE WORLD"}
          </span>
        </h1>
        <p className="clock">
          Day {state.dayIndex} · Week {week} · {clock.date}
          {clock.isHatchFriday ? " · HATCH FRIDAY" : ""}
        </p>
        <p className="dbpath">
          database: <b>{path.basename(dbPath)}</b> <span className="dim">({dbPath})</span>
        </p>
        <TickControls />
      </header>

      <section className="cards">
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
            <GpIcon size={22} /> {gpFmt(now.juiceCents)} GP {delta("juiceCents", { cents: true })}
          </div>
          <div className="label">juice pool (fight schedule)</div>
          <div className="sub">breed cuts + paid gacha — the Pintakasi spends it every Wednesday</div>
        </div>
        <div className="card">
          <div className="big">
            <GpIcon size={22} /> {gpFmt(now.stakerCents)} GP {delta("stakerCents", { cents: true })}
          </div>
          <div className="label">staker pool (undistributed)</div>
          <div className="sub">pays pro-rata at every day tick</div>
        </div>
        <div className="card">
          <div className="big">
            <LtIcon size={22} /> {now.landMinted.toLocaleString()} LT {delta("landMinted")}
          </div>
          <div className="label">Land Tokens minted</div>
          <div className="sub">
            {now.landStaked.toLocaleString()} staked · {now.landLiquid.toLocaleString()} liquid
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
          <div className="label">cancelled fights</div>
          <div className="sub">birds without a matchup — fee refunded, no land</div>
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
      </section>

      {cardDay !== null && (
        <section className="cardday">
          <h2>
            The Card — Day {cardDay}{" "}
            <span className="cardsum">
              {cardPending > 0
                ? `${cardPending} awaiting post time`
                : `went off at the last tick · ${cardFights} fights · ${cardCancelled} cancelled`}
            </span>
          </h2>
          <div className="lobbies">
            {cardLobbies.map((l) => (
              <div className="lobby" key={l.id}>
                <div className="lobby-head">
                  {l.label}
                  <span className="fill">
                    {l.filled}/{l.capacity} · #{l.id}
                  </span>
                </div>
                {l.bouts.map((b, i) => (
                  <div className="bout" key={i}>
                    ✓ <b>{b.winner}</b> ({b.winnerFarm}) def. {b.loser} ({b.loserFarm}){" "}
                    <span className="figs">
                      figures {b.figures[0]}/{b.figures[1]}
                      {l.hardcore ? " · loser force-retired" : ""}
                    </span>
                  </div>
                ))}
                {l.unmatched.map((u, i) => (
                  <div className="bout cancelled" key={i}>
                    ✗ {u.bird} ({u.farm}) — drew nobody, {u.fee} GP refunded
                  </div>
                ))}
                {l.pending.map((p, i) => (
                  <div className="bout pending" key={i}>
                    … {p.bird} ({p.farm}) — on the card, awaiting post
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {pintakasiWeek !== null && (
        <section className="cardday">
          <h2>
            🏆 The Pintakasi{" "}
            <span className="cardsum">
              the blade championships — hardcore throughout, crowns every Wednesday
            </span>
          </h2>
          <div className="lobbies">
            {pintakasiBoxes.map((t) => (
              <div className="lobby" key={t.id}>
                <div className="lobby-head">
                  {t.label}
                  <span className="fill">
                    {t.status === "open"
                      ? `${t.pending} registered`
                      : t.status === "cancelled"
                        ? "cancelled"
                        : `bracket of ${t.bracketSize} · purse ${gpFmt(t.purseCents ?? 0)} GP`}
                  </span>
                </div>
                {t.champion && (
                  <div className="bout crown">
                    🏆 <b>{t.champion.bird}</b> ({t.champion.farm}) — champion, +{gpFmt(t.champion.wonCents)} GP
                  </div>
                )}
                {t.rounds.map((r) => (
                  <div key={r.name}>
                    <div className="roundname">{r.name}</div>
                    {r.bouts.map((b, i) => (
                      <div className="bout" key={i}>
                        ✓ <b>{b.winner}</b> ({b.winnerFarm}) def. {b.loser} ({b.loserFarm}){" "}
                        <span className="figs">figures {b.figures[0]}/{b.figures[1]} · loser force-retired</span>
                      </div>
                    ))}
                  </div>
                ))}
                {t.status === "cancelled" && (
                  <div className="bout cancelled">✗ field too small — entries refunded, juice held</div>
                )}
                {t.status === "open" && t.pending === 0 && (
                  <div className="bout pending">… no registrants yet</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <AdminTabs
        farms={farmRows}
        fights={fightRows}
        birds={birdRows}
        breeding={breedingRows}
        gacha={gachaRows}
        gp={gpRows}
        ledger={ledgerRows}
      />
    </main>
  );
}

const CSS = `
  body { margin: 0; }
  .office { font-family: ui-monospace, Menlo, monospace; background: #12100d; color: #e8e0d0;
    min-height: 100vh; padding: 1.5rem 2rem 4rem; font-size: 13px; }
  .office h1 { color: #e8b64c; font-size: 1.3rem; margin: 0 0 .25rem; }
  .world-badge { font-size: .55em; vertical-align: middle; padding: .2em .6em; border-radius: 4px;
    letter-spacing: .08em; border: 1px solid; }
  .world-badge.sim { color: #9fd3f0; background: #1e3542; border-color: #3d6a85; }
  .world-badge.live { color: #f0a49f; background: #42211e; border-color: #8a4a42; }
  .office .clock { color: #9a8f78; margin: 0; }
  .office .dbpath { color: #9a8f78; margin: .2rem 0 0; }
  .office .dbpath b { color: #e8b64c; }
  .office .dim { color: #6a6252; font-size: .85em; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: .75rem; margin-top: 1.25rem; }
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
  .cardday h2 { color: #e8b64c; font-size: 1rem; margin: 0 0 .6rem; }
  .cardday .cardsum { color: #9a8f78; font-weight: 400; font-size: .85em; margin-left: .5em; }
  .lobbies { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: .6rem; }
  .lobby { background: #1c1914; border: 1px solid #3a342a; border-radius: 6px; padding: .55rem .75rem; }
  .lobby-head { color: #e8b64c; margin-bottom: .3rem; }
  .lobby-head .fill { color: #9a8f78; float: right; }
  .bout { color: #cfc6b2; padding: .12rem 0; }
  .bout b { color: #f4e9d0; }
  .bout .figs { color: #9a8f78; }
  .bout.cancelled { color: #e07a6a; }
  .bout.pending { color: #9fd3f0; }
  .bout.crown { color: #ffbf00; }
  .roundname { color: #9a8f78; font-size: .85em; margin-top: .35rem; letter-spacing: .05em; }
  .diff { font-size: .65em; font-weight: 600; margin-left: .35em; vertical-align: middle; }
  .up { color: #7fc97f; } .down { color: #e07a6a; }
  .farm-chip { white-space: nowrap; }
  .dot { display: inline-block; width: .65em; height: .65em; border-radius: 50%; border: 2px solid; margin-right: .4em; }
  .bot { color: #12100d; background: #9a8f78; border-radius: 3px; font-size: .7em; padding: 0 .3em; margin-left: .45em; vertical-align: middle; }
  .world { color: #9a8f78; font-style: italic; }
`;
