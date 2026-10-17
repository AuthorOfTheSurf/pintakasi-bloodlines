"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColDef } from "ag-grid-community";
import type { FarmColor } from "@/engine/config";
import { keyId } from "@/engine/card-key";
import type { HonestDayReport } from "@/engine/auto-play";
import type { FarmFightRowUI } from "../admin/bird-fights";
import type { BirdFightRowUI } from "../admin/grids";
import { ElementCell, FightReplayModal, GradeCell, useFightReplay } from "../grid-kit";
import { SWATCH } from "../join/swatches";
import type { CardResult } from "../api/card/route";
import { BirdDetail } from "./bird-detail";
import {
  EggNameCell,
  NameCell,
  SparkCell,
  TonightCell,
  tonightText,
  type FightingGridRow,
  type TonightContext,
} from "./cells";
import type { EggRowUI, FarmPageData, RetiredRowUI } from "./data";
import { FarmGrid } from "./farm-grid";

const VIEWS = ["Fighting", "Retired", "Eggs", "Results"] as const;
type View = (typeof VIEWS)[number];

const swatch = (c: string) => (c in SWATCH ? SWATCH[c as FarmColor] : c);
const record = (p: { data?: { wins: number; losses: number } }) =>
  p.data ? `${p.data.wins}–${p.data.losses}` : "";
const signed = (v: number) => (v === 0 ? "" : `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`);
const nameCol = {
  colId: "name",
  field: "name",
  headerName: "Bird",
  pinned: "left",
  lockPinned: true,
  cellRenderer: NameCell,
  minWidth: 170,
} as const;

/** The Fighting view. The fog holds: no stat columns exist to show. */
const FIGHTING_COLS: ColDef<FightingGridRow>[] = [
  nameCol,
  {
    colId: "tonight",
    field: "tonightText",
    headerName: "Tonight",
    cellRenderer: TonightCell,
    minWidth: 230,
  },
  { colId: "sex", field: "sexLabel", headerName: "Sex" },
  { colId: "age", field: "age", headerName: "Age", type: "rightAligned" },
  { colId: "element", field: "element", headerName: "Element", cellRenderer: ElementCell },
  {
    colId: "stars",
    field: "halfStars",
    headerName: "Stars",
    type: "rightAligned",
    valueFormatter: (p) => `${(p.value ?? 0) / 2}★`,
  },
  { colId: "carriage", field: "carriage", headerName: "Carriage" },
  { colId: "record", headerName: "Record", valueGetter: record, comparator: undefined },
  { colId: "stakesWins", field: "stakesWins", headerName: "Stakes wins", type: "rightAligned" },
  {
    colId: "figures",
    headerName: "Last figures",
    cellRenderer: SparkCell,
    sortable: false,
    filter: false,
  },
  {
    colId: "value",
    field: "value",
    headerName: "Game value",
    type: "rightAligned",
    valueFormatter: (p) => (p.value == null ? "" : `${p.value} GP`),
  },
  { colId: "bestBlade", field: "bestBlade", headerName: "Best blade" },
  { colId: "generation", field: "generation", headerName: "Gen", type: "rightAligned" },
];
const FIGHTING_SECONDARY = [
  "sex",
  "age",
  "element",
  "stars",
  "carriage",
  "stakesWins",
  "bestBlade",
  "generation",
];

const statCol = (field: keyof RetiredRowUI & string, headerName: string): ColDef<RetiredRowUI> => ({
  colId: field,
  field,
  headerName,
  type: "rightAligned",
  cellRenderer: GradeCell,
});

/** The Retired view: the fog has lifted, so the six stats are here. */
const RETIRED_COLS: ColDef<RetiredRowUI>[] = [
  nameCol,
  { colId: "sex", field: "sexLabel", headerName: "Sex" },
  { colId: "age", field: "age", headerName: "Age", type: "rightAligned" },
  { colId: "element", field: "element", headerName: "Element", cellRenderer: ElementCell },
  {
    colId: "stars",
    field: "halfStars",
    headerName: "Stars",
    type: "rightAligned",
    valueFormatter: (p) => `${(p.value ?? 0) / 2}★`,
  },
  { colId: "record", headerName: "Record", valueGetter: record },
  statCol("agility", "Agility"),
  statCol("sight", "Sight"),
  statCol("stamina", "Stamina"),
  statCol("gameness", "Gameness"),
  statCol("station", "Station"),
  statCol("condition", "Condition"),
  { colId: "total", field: "total", headerName: "Total", type: "rightAligned" },
  {
    colId: "listedStud",
    field: "listedStud",
    headerName: "At stud",
    valueFormatter: (p) => (p.value ? "listed" : ""),
  },
  {
    colId: "studPrice",
    field: "studPrice",
    headerName: "Stud price",
    type: "rightAligned",
    valueFormatter: (p) => (p.value == null ? "" : `${p.value} GP`),
  },
  { colId: "retiredBy", field: "retiredBy", headerName: "Retired by" },
  { colId: "carriage", field: "carriage", headerName: "Carriage" },
];
const RETIRED_SECONDARY = ["sex", "age", "element", "stars", "carriage", "retiredBy", "listedStud"];

const EGG_COLS: ColDef<EggRowUI>[] = [
  {
    colId: "name",
    field: "name",
    headerName: "Egg",
    pinned: "left",
    lockPinned: true,
    cellRenderer: EggNameCell,
    minWidth: 170,
  },
  { colId: "stage", field: "stage", headerName: "Stage" },
  {
    colId: "hatchDay",
    field: "hatchDay",
    headerName: "Hatches",
    type: "rightAligned",
    valueFormatter: (p) => p.data?.hatchDate ?? "",
  },
  { colId: "element", field: "element", headerName: "Element", cellRenderer: ElementCell },
  { colId: "stars", field: "stars", headerName: "Stars" },
];

const RESULT_COLS: ColDef<FarmFightRowUI>[] = [
  {
    colId: "day",
    field: "day",
    headerName: "Day",
    type: "rightAligned",
    pinned: "left",
    lockPinned: true,
    width: 80,
  },
  { colId: "birdName", field: "birdName", headerName: "Bird" },
  { colId: "card", field: "card", headerName: "Card" },
  {
    colId: "result",
    field: "result",
    headerName: "Result",
    cellClassRules: { up: (p) => p.value === "win", down: (p) => p.value === "loss" },
  },
  { colId: "figure", field: "figure", headerName: "Figure", type: "rightAligned" },
  { colId: "opponent", field: "opponent", headerName: "Opponent" },
  { colId: "opponentFarm", field: "opponentFarm", headerName: "Their stable" },
  {
    colId: "opponentFigure",
    field: "opponentFigure",
    headerName: "Their figure",
    type: "rightAligned",
  },
  {
    colId: "gp",
    field: "gp",
    headerName: "GP",
    type: "rightAligned",
    valueFormatter: (p) => signed(p.value ?? 0),
    cellClassRules: { up: (p) => (p.value ?? 0) > 0, down: (p) => (p.value ?? 0) < 0 },
  },
  {
    colId: "valueBefore",
    field: "valueBefore",
    headerName: "Value before",
    type: "rightAligned",
    valueFormatter: (p) => (p.value == null ? "" : `${p.value} GP`),
  },
];
const RESULT_SECONDARY = ["opponentFarm", "opponentFigure", "valueBefore", "card"];

type OpenFight = { logId: number; title: string };
type Busy = "idle" | "checkin" | "autoplay" | "card" | "name";

/** The local time the game day turns (00:00 UTC), once the browser knows its own zone. */
function useDayTurn(): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    setText(next.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }, []);
  return text;
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error =
      json && typeof json === "object" && "error" in json
        ? String(json.error)
        : `HTTP ${res.status}`;
    throw new Error(error);
  }
  return json as T;
}

export function FarmApp({ data }: { data: FarmPageData }) {
  const router = useRouter();
  const [view, setView] = useState<View>("Fighting");
  const [busy, setBusy] = useState<Busy>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmAuto, setConfirmAuto] = useState(false);
  const [autoReport, setAutoReport] = useState<HonestDayReport | null>(null);
  const [cardReport, setCardReport] = useState<{ name: string; result: CardResult }[] | null>(null);
  // Only the picks the player changed. Everything else shows the suggestion,
  // so a refresh after entering brings fresh suggestions for the rest.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [openFight, setOpenFight] = useState<OpenFight | null>(null);
  const [naming, setNaming] = useState<{ birdId: string; current: string } | null>(null);
  const replay = useFightReplay(openFight?.logId ?? null);
  const dayTurn = useDayTurn();
  const { farm } = data;

  const refresh = useCallback(() => router.refresh(), [router]);

  const fightingRows: FightingGridRow[] = useMemo(
    () =>
      data.fighting.map((b) => {
        const suggested = b.tonight.suggestion ? keyId(b.tonight.suggestion) : "";
        const pick = b.tonight.entered || b.tonight.blocked ? "" : (overrides[b.id] ?? suggested);
        return { ...b, pick, tonightText: tonightText(b, pick, data.cardLabels) };
      }),
    [data.fighting, data.cardLabels, overrides]
  );

  const toEnter = fightingRows.flatMap((r) => {
    if (!r.pick) return [];
    const option = r.tonight.options.find((o) => keyId(o.key) === r.pick);
    return option ? [{ row: r, option }] : [];
  });
  const fees = toEnter.reduce((sum, e) => sum + e.option.fee, 0);

  const tonightContext: TonightContext = useMemo(
    () => ({
      labels: data.cardLabels,
      setPick: (birdId, pick) => setOverrides((o) => ({ ...o, [birdId]: pick })),
      askName: (birdId, current) => setNaming({ birdId, current }),
    }),
    [data.cardLabels]
  );

  const run = async (what: Busy, fn: () => Promise<void>) => {
    setBusy(what);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("idle");
      refresh();
    }
  };

  const checkIn = () =>
    run("checkin", async () => {
      const r = await post<{ gpDripped: number; freePullsGranted: number }>("/api/checkin");
      setNotice(`Checked in: +${r.gpDripped} GP and ${r.freePullsGranted} free pull.`);
    });

  const playDay = () =>
    run("autoplay", async () => {
      setConfirmAuto(false);
      setAutoReport(await post<HonestDayReport>("/api/autoplay"));
      setOverrides({});
    });

  const enterCard = () =>
    run("card", async () => {
      const names = new Map(toEnter.map((e) => [e.row.id, e.row.name]));
      const { results } = await post<{ results: CardResult[] }>("/api/card", {
        entries: toEnter.map((e) => ({ birdId: e.row.id, key: e.option.key })),
      });
      setCardReport(
        results.map((result) => ({ name: names.get(result.birdId) ?? result.birdId, result }))
      );
      setOverrides({});
    });

  const allBirds = [...data.fighting, ...data.retired];
  const selectedBird = selected ? (allBirds.find((b) => b.id === selected) ?? null) : null;
  const watch = (f: BirdFightRowUI | FarmFightRowUI, who: string) =>
    setOpenFight({ logId: f.logId, title: `day ${f.day} · ${f.card} · ${who} vs ${f.opponent}` });

  // Results "earlier" and "later" step through this farm's fights by log id,
  // which rises with time whatever the grid is sorted by.
  const byLog = useMemo(
    () => data.results.slice().sort((a, b) => a.logId - b.logId),
    [data.results]
  );
  const step = (by: -1 | 1) => {
    if (!openFight) return undefined;
    const at = byLog.findIndex((f) => f.logId === openFight.logId);
    const next = at === -1 ? undefined : byLog[at + by];
    return next ? () => watch(next, next.birdName) : undefined;
  };

  const counts: Record<View, number> = {
    Fighting: data.fighting.length,
    Retired: data.retired.length,
    Eggs: data.eggs.length,
    Results: data.results.length,
  };

  return (
    <div className="wrap">
      <section className="farm-head" aria-label="Your farm">
        <div className="farm-top">
          <div className="farm-name">
            <span
              className="crest"
              aria-hidden="true"
              style={{
                background: `linear-gradient(135deg, ${swatch(farm.primaryColor)} 50%, ${swatch(farm.secondaryColor)} 50%)`,
              }}
            />
            <span>
              {farm.country ? `${farm.country} ` : ""}
              {farm.name}
            </span>
          </div>
          <div className="clock">
            Day {data.clock.dayIndex} · {data.clock.date}
            {dayTurn ? ` · card closes ${dayTurn} your time` : ""}
          </div>
        </div>
        <div className="wallet">
          <span>
            <b>{Math.floor(farm.gp).toLocaleString()}</b> GP
          </span>
          <span>
            <b>{(farm.landTokensCents / 100).toFixed(2)}</b> LT loose
          </span>
          <span>
            {data.barn.count} / {data.barn.capacity} in the barn · {data.barn.fighting} fighting ·{" "}
            {data.barn.retired} retired · {data.barn.eggs} eggs
          </span>
          <span className="dim">
            Weather: {data.weather.today} today, {data.weather.tomorrow} tomorrow
          </span>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn"
            onClick={checkIn}
            disabled={farm.checkedInToday || busy !== "idle"}
          >
            {farm.checkedInToday ? "Checked in" : "Check in"}
            <small>
              {farm.checkedInToday ? "Back tomorrow for more" : "Today's GP and free pull"}
            </small>
          </button>
          <button
            type="button"
            className="btn ghost"
            aria-expanded={confirmAuto}
            aria-controls="autopanel"
            onClick={() => setConfirmAuto((v) => !v)}
            disabled={busy !== "idle"}
          >
            Play my day for me<small>The house plays today for you</small>
          </button>
          <form method="post" action="/api/session/sign-out">
            <button type="submit" className="btn ghost">
              Sign out
            </button>
          </form>
        </div>
        {confirmAuto ? (
          <AutoPanel
            reserve={data.autoReserve}
            onGo={playDay}
            onCancel={() => setConfirmAuto(false)}
          />
        ) : null}
        {busy === "autoplay" ? <p className="world">The house is playing your day…</p> : null}
        {autoReport ? (
          <AutoSummary report={autoReport} onClose={() => setAutoReport(null)} />
        ) : null}
        {notice ? (
          <p className="panel" role="status">
            {notice}
          </p>
        ) : null}
      </section>

      <div className="views" role="group" aria-label="View">
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => {
              setView(v);
              setSelected(null);
            }}
          >
            {v} <span className="count">{counts[v]}</span>
          </button>
        ))}
      </div>

      {view === "Fighting" ? (
        <FarmGrid<FightingGridRow>
          gridId="fighting"
          label="Fighting birds"
          rows={fightingRows}
          columns={FIGHTING_COLS}
          secondary={FIGHTING_SECONDARY}
          searchOf={birdSearch}
          rowId={(r) => r.id}
          onRowClicked={(r) => setSelected((cur) => (cur === r.id ? null : r.id))}
          selectedId={selected}
          context={tonightContext}
          placeholder="Search: a name, hen, rooster, a grade like B+, an element"
        />
      ) : null}
      {view === "Retired" ? (
        <FarmGrid<RetiredRowUI>
          gridId="retired"
          label="Retired birds"
          rows={data.retired}
          columns={RETIRED_COLS}
          secondary={RETIRED_SECONDARY}
          searchOf={birdSearch}
          rowId={(r) => r.id}
          onRowClicked={(r) => setSelected((cur) => (cur === r.id ? null : r.id))}
          selectedId={selected}
          placeholder="Search: a name, hen, rooster, a grade, an element"
        />
      ) : null}
      {view === "Eggs" ? (
        <FarmGrid<EggRowUI>
          gridId="eggs"
          label="Eggs"
          rows={data.eggs}
          columns={EGG_COLS}
          secondary={[]}
          searchOf={(r) => ({ text: r.name, element: r.element })}
          rowId={(r) => r.id}
          placeholder="Search: a name or an element"
        />
      ) : null}
      {view === "Results" ? (
        <FarmGrid<FarmFightRowUI>
          gridId="results"
          label="Results"
          rows={data.results}
          columns={RESULT_COLS}
          secondary={RESULT_SECONDARY}
          searchOf={(r) => ({
            text: `${r.birdName} ${r.opponent} ${r.opponentFarm} ${r.card} ${r.result}`,
          })}
          rowId={(r) => String(r.logId)}
          rowClass="opens-fight"
          onRowClicked={(r) => watch(r, r.birdName)}
          summary={resultsSummary}
          placeholder="Search: a bird, an opponent, a stable, win or loss"
        />
      ) : null}

      {selectedBird && (view === "Fighting" || view === "Retired") ? (
        <BirdDetail
          key={selectedBird.id}
          birdId={selectedBird.id}
          title={
            <>
              {selectedBird.name}{" "}
              <span className="dim">
                {selectedBird.grade} · {selectedBird.stars} · {selectedBird.wins}–
                {selectedBird.losses}
              </span>
            </>
          }
          onClose={() => setSelected(null)}
          onWatch={(f) => watch(f, selectedBird.name)}
        />
      ) : null}

      {view === "Fighting" ? (
        <div className="bar" role="region" aria-label="Tonight's card">
          <div className="bar-in">
            <div>
              <p>
                <b>{toEnter.length}</b> birds · <b>{fees.toLocaleString()}</b> GP in fees
                {fees > farm.gp ? <span className="down"> · more than you have</span> : null}
              </p>
              {cardReport ? (
                <CardReport report={cardReport} onClose={() => setCardReport(null)} />
              ) : null}
            </div>
            <button
              type="button"
              className="btn"
              onClick={enterCard}
              disabled={toEnter.length === 0 || busy !== "idle"}
            >
              {busy === "card" ? "Entering…" : "Enter card"}
            </button>
          </div>
        </div>
      ) : null}

      {naming ? (
        <NameDialog
          current={naming.current}
          busy={busy === "name"}
          onClose={() => setNaming(null)}
          onSave={(name) =>
            run("name", async () => {
              await post(`/api/birds/${encodeURIComponent(naming.birdId)}/name`, { name });
              setNaming(null);
              setNotice(`Named ${name}.`);
            })
          }
        />
      ) : null}

      {openFight ? (
        <FightReplayModal
          fight={openFight}
          state={replay}
          onClose={() => setOpenFight(null)}
          onEarlier={view === "Results" ? step(-1) : undefined}
          onLater={view === "Results" ? step(1) : undefined}
        />
      ) : null}
    </div>
  );
}

const birdSearch = (r: {
  name: string;
  sexLabel: "rooster" | "hen" | null;
  grade: string;
  element: string;
}) => ({
  text: r.name,
  sexLabel: r.sexLabel,
  grade: r.grade,
  element: r.element,
});

/** Recomputed from the rows the grid is showing, so a filter on one bird sums that bird. */
function resultsSummary(shown: FarmFightRowUI[]) {
  const wins = shown.filter((r) => r.result === "win").length;
  const net = shown.reduce((sum, r) => sum + r.gp, 0);
  return (
    <>
      {shown.length.toLocaleString()} fights · {wins}–{shown.length - wins} ·{" "}
      <span className={net >= 0 ? "up" : "down"}>{signed(net) || "0.00"} GP net</span>
    </>
  );
}

/**
 * The confirm step, in the page rather than a browser pop-up. The list is the
 * honest day's own order (auto-play.ts playHonestDay), said plainly, because
 * this button does things that cannot be taken back.
 */
function AutoPanel({
  reserve,
  onGo,
  onCancel,
}: {
  reserve: number;
  onGo: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="panel" id="autopanel">
      <h3>The house will play today like a careful beginner:</h3>
      <ul>
        <li>Check in, and spend your free gacha pulls (never a paid roll).</li>
        <li>Price your retired roosters and list them at stud.</li>
        <li>Buy the next barn expansion if the barn is nearly full.</li>
        <li>Stake all your loose Land Tokens.</li>
        <li>Breed one hen whose nest is empty, to the stud it rates best.</li>
        <li>Give every unnamed bird a name from the house list.</li>
        <li>
          Register crown birds for this week&apos;s championships. The Majors are hardcore: a loss
          there retires the bird.
        </li>
        <li>Enter every fighting bird it can on tonight&apos;s card, keeping {reserve} GP back.</li>
      </ul>
      <p className="dim" style={{ margin: 0 }}>
        Birds you already entered stay as they are. Entries are binding: once the house enters a
        bird you cannot take it back.
      </p>
      <div className="row">
        <button type="button" className="btn" onClick={onGo}>
          Play it
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          Not today
        </button>
      </div>
    </div>
  );
}

function AutoSummary({ report, onClose }: { report: HonestDayReport; onClose: () => void }) {
  const diff = report.gpAfter - report.gpBefore;
  const lines = [
    report.checkedIn ? "Checked in." : null,
    report.pullsSpent
      ? `Spent ${report.pullsSpent} free pull${report.pullsSpent === 1 ? "" : "s"}.`
      : null,
    report.studsListed
      ? `Listed ${report.studsListed} stud${report.studsListed === 1 ? "" : "s"}.`
      : null,
    report.barnExpanded ? "Expanded the barn." : null,
    report.ltStaked ? `Staked ${report.ltStaked} LT.` : null,
    report.covers ? `Bred ${report.covers} hen${report.covers === 1 ? "" : "s"}.` : null,
    report.named.length ? `Named ${report.named.map((n) => n.name).join(", ")}.` : null,
    report.crownsEntered
      ? `Registered ${report.crownsEntered} bird${report.crownsEntered === 1 ? "" : "s"} for a crown.`
      : null,
    `Entered ${report.birdsEntered} bird${report.birdsEntered === 1 ? "" : "s"} on tonight's card.`,
  ].filter((l): l is string => l !== null);
  return (
    <div className="panel" role="status">
      <h3>The house played your day.</h3>
      <ul>
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p style={{ margin: 0 }}>
        GP {Math.floor(report.gpBefore).toLocaleString()} →{" "}
        {Math.floor(report.gpAfter).toLocaleString()}{" "}
        <span className={diff >= 0 ? "up" : "down"}>({signed(diff) || "0.00"})</span>
      </p>
      <div className="row">
        <button type="button" className="btn ghost small" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

function CardReport({
  report,
  onClose,
}: {
  report: { name: string; result: CardResult }[];
  onClose: () => void;
}) {
  const ok = report.filter((r) => r.result.ok).length;
  const refused = report.filter((r) => !r.result.ok);
  return (
    <div role="status">
      <p>
        Entered {ok} of {report.length}.{" "}
        <button type="button" className="btn ghost small" onClick={onClose}>
          Dismiss
        </button>
      </p>
      {refused.length ? (
        <ul className="report">
          {refused.map((r) => (
            <li key={r.result.birdId}>
              <b>{r.name}</b>: {r.result.error}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function NameDialog({
  current,
  busy,
  onClose,
  onSave,
}: {
  current: string;
  busy: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);
  return (
    <dialog ref={dialog} className="name-dialog" onClose={onClose} aria-label={`Name ${current}`}>
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim());
        }}
      >
        <label htmlFor="bird-name">
          A bird needs a real name before its first fight. Name <b>{current}</b>:
        </label>
        <input
          id="bird-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          required
        />
        <div style={{ display: "flex", gap: ".6rem" }}>
          <button type="submit" className="btn" disabled={busy}>
            Name it
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
