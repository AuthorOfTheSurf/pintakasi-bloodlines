import { db } from "@/db/client";
import { battleLog, birds, claims, events, farms, gachaTokens, gameState, lobbyEntries } from "@/db/schema";
import { GameClock } from "@/engine/game-clock";
import { ageOf } from "@/engine/lifecycle";

export const dynamic = "force-dynamic";

/**
 * The Stewards' Office — the admin view. Top-line figures, the unified
 * ledger, and the tables: fights, farms, birds. Read-only; everything here
 * is derived from the same SQLite the game runs on.
 */

const LOG_LIMIT = 250;

function gpFmt(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function deltaCell(cents: number | null): { text: string; cls: string } {
  if (cents === null || cents === 0) return { text: "", cls: "" };
  return { text: `${cents > 0 ? "+" : "−"}${gpFmt(Math.abs(cents))}`, cls: cents > 0 ? "up" : "down" };
}

const TYPE_LABELS: Record<string, string> = {
  farm_registered: "register",
  check_in: "check-in",
  gacha: "gacha",
  train: "train",
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

export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; farm?: string }>;
}) {
  const { type: typeFilter, farm: farmFilter } = await searchParams;
  const d = db();

  const state = d.select().from(gameState).all()[0];
  if (!state) return <main className="office"><h1>Not seeded — run bun db:seed</h1></main>;
  const clock = GameClock.stateOf(state.dayIndex);
  const week = clock.weekIndex;

  const allFarms = d.select().from(farms).all();
  const farmById = new Map(allFarms.map((f) => [f.id, f]));
  const allBirds = d.select().from(birds).all();
  const birdFarm = new Map(allBirds.map((b) => [b.id, b.farmId]));
  const log = d.select().from(battleLog).all();
  const rolls = d.select().from(gachaTokens).all().length;
  const pendingEntries = d.select().from(lobbyEntries).all().filter((e) => e.status === "pending");
  const pendingClaims = d.select().from(claims).all().filter((c) => c.status === "pending");
  const allEvents = d.select().from(events).all().reverse(); // newest first

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
  const fightRows = log.filter((r) => r.result === "win"); // one per fight
  const covers = allBirds.filter((b) => b.motherId !== null).length;

  // ── The fights table: pair each win row with its mirror ─────────────────
  const fights = [...fightRows].reverse().slice(0, 40).map((w) => {
    const mirror = log.find((r) => r.lobbyId === w.lobbyId && r.birdId === w.opponentBirdId);
    return { w, loserFigure: mirror?.pitFigure ?? 0 };
  });

  // ── The unified log, filtered ────────────────────────────────────────────
  const typesPresent = [...new Set(allEvents.map((e) => e.type))];
  const filtered = allEvents
    .filter((e) => !typeFilter || e.type === typeFilter)
    .filter((e) => !farmFilter || e.farmId === farmFilter)
    .slice(0, LOG_LIMIT);

  const qs = (params: Record<string, string | undefined>) => {
    const merged = { type: typeFilter, farm: farmFilter, ...params };
    const parts = Object.entries(merged)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`);
    return parts.length ? `?${parts.join("&")}` : "/admin";
  };

  const farmChip = (farmId: string | null) => {
    if (!farmId) return <span className="world">world</span>;
    const f = farmById.get(farmId);
    if (!f) return <span className="world">{farmId}</span>;
    return (
      <span className="farm-chip">
        <span className="dot" style={{ background: f.primaryColor, borderColor: f.secondaryColor }} />
        {f.name}
        {f.isBot ? <span className="bot">BOT</span> : null}
      </span>
    );
  };

  return (
    <main className="office">
      <style>{CSS}</style>
      <header>
        <h1>🐓 Pintakasi — Stewards&apos; Office</h1>
        <p className="clock">
          Day {state.dayIndex} · Week {week} · {clock.date}
          {clock.isHatchFriday ? " · HATCH FRIDAY" : ""}
        </p>
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
          <div className="big">{fightRows.length}</div>
          <div className="label">fights fought</div>
          <div className="sub">{covers} covers bought · {rolls} gacha rolls</div>
        </div>
        <div className="card">
          <div className="big">{allBirds.length}</div>
          <div className="label">birds</div>
          <div className="sub">
            {byStatus.egg} eggs · {byStatus.active} active · {byStatus.retired} retired
          </div>
        </div>
      </section>

      <section>
        <h2>Farms</h2>
        <table>
          <thead>
            <tr>
              <th>farm</th><th>GP</th><th>LT liquid</th><th>LT staked</th>
              <th>birds</th><th>career W–L</th><th>studs listed</th>
            </tr>
          </thead>
          <tbody>
            {[...allFarms]
              .sort((a, b) => b.gp * 100 + b.gpCents - (a.gp * 100 + a.gpCents))
              .map((f) => {
                const mine = allBirds.filter((b) => b.farmId === f.id);
                const rec = log.filter((r) => r.farmId === f.id && r.mode !== "practice");
                return (
                  <tr key={f.id}>
                    <td>{farmChip(f.id)}</td>
                    <td className="num">{gpFmt(f.gp * 100 + f.gpCents)}</td>
                    <td className="num">{f.landTokens}</td>
                    <td className="num">{f.stakedLand}</td>
                    <td className="num">{mine.length}</td>
                    <td className="num">
                      {rec.filter((r) => r.result === "win").length}–{rec.filter((r) => r.result === "loss").length}
                    </td>
                    <td className="num">{mine.filter((b) => b.listedStud === 1).length}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Fights <span className="dim">(latest {fights.length} of {fightRows.length})</span></h2>
        <table>
          <thead>
            <tr>
              <th>day</th><th>card</th><th>result</th><th>figures</th><th>pot</th>
            </tr>
          </thead>
          <tbody>
            {fights.map(({ w, loserFigure }) => (
              <tr key={w.id}>
                <td className="num">{w.dayIndex}</td>
                <td>
                  {w.mode.toUpperCase()}
                  {w.lobby !== "open" ? `·${w.lobby.toUpperCase()}` : ""}
                  {w.claimPrice ? ` @${w.claimPrice}` : ""} · {w.format}
                </td>
                <td>
                  <b>{farmById.get(w.farmId)?.name ?? w.farmId}</b>&apos;s bird def.{" "}
                  {w.opponentName} ({farmById.get(w.opponentFarmId)?.name ?? w.opponentFarmId})
                </td>
                <td className="num">{w.pitFigure} / {loserFigure}</td>
                <td className="num">{w.gpDelta * 2} GP</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Birds</h2>
        <table>
          <thead>
            <tr>
              <th>bird</th><th>farm</th><th>sex</th><th>age</th><th>stars</th>
              <th>status</th><th>career</th><th>amateur</th>
            </tr>
          </thead>
          <tbody>
            {[...allBirds]
              .sort((a, b) =>
                a.farmId === b.farmId ? ageOf(b, week) - ageOf(a, week) : a.farmId.localeCompare(b.farmId)
              )
              .map((b) => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                  <td>{farmChip(b.farmId)}</td>
                  <td>{b.status === "egg" ? "?" : b.sex === "male" ? "rooster" : "hen"}</td>
                  <td className="num">{ageOf(b, week)}</td>
                  <td>{b.halfStars / 2}★ {b.element}</td>
                  <td>
                    {b.status}
                    {b.retiredBy ? ` (${b.retiredBy})` : ""}
                    {b.listedStud ? " · at stud" : ""}
                  </td>
                  <td className="num">{b.wins}–{b.losses}</td>
                  <td className="num">{b.practiceWins}–{b.practiceLosses}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>The Ledger <span className="dim">(latest {filtered.length} of {allEvents.length})</span></h2>
        <p className="chips">
          <a className={!typeFilter ? "on" : ""} href={qs({ type: undefined })}>all</a>
          {typesPresent.map((t) => (
            <a key={t} className={typeFilter === t ? "on" : ""} href={qs({ type: t })}>
              {TYPE_LABELS[t] ?? t}
            </a>
          ))}
        </p>
        <p className="chips">
          <a className={!farmFilter ? "on" : ""} href={qs({ farm: undefined })}>every farm</a>
          {allFarms.map((f) => (
            <a key={f.id} className={farmFilter === f.id ? "on" : ""} href={qs({ farm: f.id })}>
              {f.name}
            </a>
          ))}
        </p>
        <table>
          <thead>
            <tr><th>day</th><th>type</th><th>farm</th><th>what happened</th><th>ΔGP</th><th>ΔLT</th></tr>
          </thead>
          <tbody>
            {filtered.map((e) => {
              const gp = deltaCell(e.gpCents);
              return (
                <tr key={e.id}>
                  <td className="num">{e.dayIndex}</td>
                  <td><span className={`type t-${e.type}`}>{TYPE_LABELS[e.type] ?? e.type}</span></td>
                  <td>{farmChip(e.farmId)}</td>
                  <td className="msg">{e.message}</td>
                  <td className={`num ${gp.cls}`}>{gp.text}</td>
                  <td className={`num ${e.lt ? (e.lt > 0 ? "up" : "down") : ""}`}>
                    {e.lt ? (e.lt > 0 ? `+${e.lt}` : e.lt) : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}

const CSS = `
  .office { font-family: ui-monospace, Menlo, monospace; background: #12100d; color: #e8e0d0;
    min-height: 100vh; padding: 1.5rem 2rem 4rem; font-size: 13px; }
  .office h1 { color: #e8b64c; font-size: 1.3rem; margin: 0 0 .25rem; }
  .office h2 { color: #e8b64c; font-size: 1rem; margin: 2rem 0 .5rem; border-bottom: 1px solid #3a342a; padding-bottom: .3rem; }
  .office .clock { color: #9a8f78; margin: 0; }
  .office .dim { color: #9a8f78; font-weight: normal; font-size: .85em; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: .75rem; margin-top: 1.25rem; }
  .card { background: #1c1914; border: 1px solid #3a342a; border-radius: 6px; padding: .75rem .9rem; }
  .card .big { font-size: 1.35rem; color: #f4e9d0; }
  .card .label { color: #e8b64c; margin-top: .15rem; }
  .card .sub { color: #9a8f78; font-size: .85em; margin-top: .25rem; }
  .office table { border-collapse: collapse; width: 100%; margin-top: .25rem; }
  .office th { text-align: left; color: #9a8f78; font-weight: normal; border-bottom: 1px solid #3a342a;
    padding: .3rem .6rem .3rem 0; }
  .office td { border-bottom: 1px solid #241f18; padding: .32rem .6rem .32rem 0; vertical-align: top; }
  .office td.num, .office th.num { text-align: right; white-space: nowrap; }
  .office td.msg { color: #cfc6b2; }
  .up { color: #7fc97f; } .down { color: #e07a6a; }
  .farm-chip { white-space: nowrap; }
  .dot { display: inline-block; width: .65em; height: .65em; border-radius: 50%; border: 2px solid; margin-right: .4em; }
  .bot { color: #12100d; background: #9a8f78; border-radius: 3px; font-size: .7em; padding: 0 .3em; margin-left: .45em; vertical-align: middle; }
  .world { color: #9a8f78; font-style: italic; }
  .type { border: 1px solid #3a342a; border-radius: 3px; padding: 0 .35em; font-size: .85em; white-space: nowrap; }
  .t-fight { color: #e8b64c; border-color: #e8b64c; }
  .t-breed, .t-stud_income, .t-hatch { color: #7fc97f; border-color: #4a6a4a; }
  .t-retire { color: #e07a6a; border-color: #6a4a4a; }
  .t-claim, .t-claim_won, .t-tag_income { color: #a8c0e0; border-color: #4a5a6a; }
  .t-staking_payout, .t-stake, .t-unstake, .t-buy_land { color: #c9a8e0; border-color: #5a4a6a; }
  .chips a { color: #9a8f78; text-decoration: none; border: 1px solid #3a342a; border-radius: 3px;
    padding: .1em .5em; margin: 0 .3em .3em 0; display: inline-block; }
  .chips a.on { color: #12100d; background: #e8b64c; border-color: #e8b64c; }
`;
