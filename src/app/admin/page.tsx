import path from "node:path";
import { db, defaultDbPath } from "@/db/client";
import { TickControls } from "./tick-controls";
import { battleLog, birds, claims, events, farms, gachaTokens, gameState, lobbyEntries } from "@/db/schema";
import { ECONOMY } from "@/engine/config";
import { splitBreedFee } from "@/engine/breeding";
import { GameClock } from "@/engine/game-clock";
import { ageOf } from "@/engine/lifecycle";
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
  const pendingEntries = d.select().from(lobbyEntries).all().filter((e) => e.status === "pending");
  const pendingClaims = d.select().from(claims).all().filter((c) => c.status === "pending");
  const allEvents = d.select().from(events).all();

  // Farm display helpers — name + the two colors, everywhere a farm shows.
  const fname = (id: string | null) => (id ? (farmById.get(id)?.name ?? id) : "— world —");
  const fcolors = (id: string | null | undefined) => {
    const f = id ? farmById.get(id) : undefined;
    return f ? { P: f.primaryColor, S: f.secondaryColor } : { P: undefined, S: undefined };
  };

  // ── Top-line figures ──────────────────────────────────────────────────────
  const walletCents = allFarms.reduce((s, f) => s + f.gp * 100 + f.gpCents, 0);
  const escrowCents =
    pendingEntries.reduce((s, e) => s + e.fee * 100, 0) +
    pendingClaims.reduce((s, c) => s + c.price * 100, 0);
  const totalCents = walletCents + escrowCents + state.stakerPoolCents + state.juicePoolCents;
  const liquidLt = allFarms.reduce((s, f) => s + f.landTokens, 0);
  const stakedLt = allFarms.reduce((s, f) => s + f.stakedLand, 0);
  const byStatus = { egg: 0, active: 0, retired: 0 };
  for (const b of allBirds) byStatus[b.status]++;
  const winRows = log.filter((r) => r.result === "win"); // one per fight
  const bred = allBirds.filter((b) => b.motherId !== null);

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
        : `${b.status}${b.retiredBy ? ` (${b.retiredBy})` : ""}${b.listedStud ? " · at stud" : ""}`,
    wins: b.wins,
    losses: b.losses,
    practiceWins: b.practiceWins,
    practiceLosses: b.practiceLosses,
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
      const pools = JSON.parse(e.data) as { stakerPoolCents: number; juicePoolCents: number };
      gpRows.push({ seq: gpRows.length, ...base, flow: "→ staker pool (breed cut)", amount: pools.stakerPoolCents / 100 });
      gpRows.push({ seq: gpRows.length, ...base, flow: "→ juice pool (breed cut)", amount: pools.juicePoolCents / 100 });
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
          <div className="big">{gpFmt(totalCents)} GP</div>
          <div className="label">in circulation</div>
          <div className="sub">
            wallets {gpFmt(walletCents)} · escrow {gpFmt(escrowCents)}
          </div>
        </div>
        <div className="card">
          <div className="big">{gpFmt(state.juicePoolCents)} GP</div>
          <div className="label">juice pool (fight schedule)</div>
          <div className="sub">accruing — Wednesday finals will spend it</div>
        </div>
        <div className="card">
          <div className="big">{gpFmt(state.stakerPoolCents)} GP</div>
          <div className="label">staker pool (undistributed)</div>
          <div className="sub">pays pro-rata at every day tick</div>
        </div>
        <div className="card">
          <div className="big">{(liquidLt + stakedLt).toLocaleString()} LT</div>
          <div className="label">land minted</div>
          <div className="sub">
            {stakedLt.toLocaleString()} staked · {liquidLt.toLocaleString()} liquid
          </div>
        </div>
        <div className="card">
          <div className="big">{winRows.length}</div>
          <div className="label">fights fought</div>
          <div className="sub">
            {bred.length} covers bought · {rolls} gacha rolls
          </div>
        </div>
        <div className="card">
          <div className="big">{allBirds.length}</div>
          <div className="label">birds</div>
          <div className="sub">
            {byStatus.egg} eggs · {byStatus.active} active · {byStatus.retired} retired
          </div>
        </div>
      </section>

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
  .up { color: #7fc97f; } .down { color: #e07a6a; }
  .farm-chip { white-space: nowrap; }
  .dot { display: inline-block; width: .65em; height: .65em; border-radius: 50%; border: 2px solid; margin-right: .4em; }
  .bot { color: #12100d; background: #9a8f78; border-radius: 3px; font-size: .7em; padding: 0 .3em; margin-left: .45em; vertical-align: middle; }
  .world { color: #9a8f78; font-style: italic; }
`;
