"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColDef } from "ag-grid-community";
import type { FarmColor } from "@/engine/config";
import { keyId } from "@/engine/card-key";
import type { HonestDayReport } from "@/engine/auto-play";
import { honestDayLines } from "@/engine/day-summary";
import { LOG_LABELS, LOG_LABEL_KEYS, type FarmLogEntry, type LogLabel } from "@/engine/farm-log";
import type { FarmFightRowUI } from "../admin/bird-fights";
import type { BirdFightRowUI } from "../admin/grids";
import { ElementCell, FightReplayModal, GradeCell, useFightReplay } from "../grid-kit";
import { SWATCH } from "../join/swatches";
import type { CardResult } from "../api/card/route";
import type { FarmFightPage } from "../api/farm/fights/route";
import type { FarmLogResponse } from "../api/farm/log/route";
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

const VIEWS = ["Fighting", "Retired", "Eggs", "Results", "Log"] as const;
type View = (typeof VIEWS)[number];

const swatch = (c: string) => (c in SWATCH ? SWATCH[c as FarmColor] : c);
const record = (p: { data?: { wins: number; losses: number } }) =>
  p.data ? `${p.data.wins}–${p.data.losses}` : "";
/** A wallet to the hundredth, the way the ledger keeps it. */
const gp2 = (v: number) =>
  v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

/**
 * When tonight's card goes off, in words. A live-clock world turns at 00:00
 * UTC, so the browser can name that moment in its own zone; any other world
 * (a sim, `bun dev`) turns when someone ticks it, and a clock time there
 * would be invented.
 */
function useCardCloses(liveClock: boolean): string {
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => {
    if (!liveClock) return;
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    setLocal(next.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }, [liveClock]);
  if (!liveClock) return "card goes off at the next tick";
  return local ? `card closes ${local} your time` : "card closes at midnight UTC";
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  return readJson<T>(
    await fetch(url, {
      method: "POST",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );
}

async function readJson<T>(res: Response): Promise<T> {
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

/**
 * The Results view's rows, fetched when the view opens and a page at a time
 * after that (GET /api/farm/fights). Refetched from the top whenever the
 * server's fight count moves, which is how a tick or a refresh shows up.
 */
function useFarmFights(open: boolean, total: number) {
  const [rows, setRows] = useState<FarmFightRowUI[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<number | null>(null);

  const load = useCallback(async (before?: number) => {
    setLoading(true);
    setError(null);
    try {
      const page = await readJson<FarmFightPage>(
        await fetch(`/api/farm/fights${before === undefined ? "" : `?before=${before}`}`)
      );
      setRows((cur) => (before === undefined ? page.rows : [...cur, ...page.rows]));
      setMore(page.more);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || loadedFor === total) return;
    setLoadedFor(total);
    void load();
  }, [open, total, loadedFor, load]);

  const oldest = rows.at(-1)?.logId;
  const older = useCallback(() => {
    if (oldest !== undefined) void load(oldest);
  }, [load, oldest]);
  return { rows, more, loading, error, older };
}

/**
 * The Log view's lines, newest first (GET /api/farm/log), loaded the way the
 * Results view loads its fights: when the view opens, from the top again
 * whenever the server's line count moves or the filter changes, and a page
 * at a time after that from the oldest loaded line's cursor.
 */
function useFarmLog(open: boolean, total: number, who: LogLabel | null) {
  const [entries, setEntries] = useState<FarmLogEntry[]>([]);
  const [counts, setCounts] = useState<FarmLogResponse["counts"] | null>(null);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const load = useCallback(
    async (before?: string) => {
      setLoading(true);
      setError(null);
      const q = new URLSearchParams();
      if (before !== undefined) q.set("before", before);
      if (who) q.set("who", who);
      try {
        const page = await readJson<FarmLogResponse>(await fetch(`/api/farm/log?${q}`));
        setEntries((cur) => (before === undefined ? page.entries : [...cur, ...page.entries]));
        setCounts(page.counts);
        setMore(page.more);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [who]
  );

  const key = `${total}:${who ?? ""}`;
  useEffect(() => {
    if (!open || loadedFor === key) return;
    setLoadedFor(key);
    void load();
  }, [open, key, loadedFor, load]);

  const oldest = entries.at(-1)?.cursor;
  const older = useCallback(() => {
    if (oldest !== undefined) void load(oldest);
  }, [load, oldest]);
  return { entries, counts, more, loading, error, older };
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
  const cardCloses = useCardCloses(data.liveClock);
  const fights = useFarmFights(view === "Results", data.results.fights);
  const [logWho, setLogWho] = useState<LogLabel | null>(null);
  const log = useFarmLog(view === "Log", data.logLines, logWho);
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
  const byLog = useMemo(() => fights.rows.slice().sort((a, b) => a.logId - b.logId), [fights.rows]);
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
    Results: data.results.fights,
    Log: data.logLines,
  };
  const openLog = () => {
    setView("Log");
    setSelected(null);
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
            <b>Game {data.gameWeekday}</b> · day {data.clock.dayIndex} · {cardCloses}
            <br />
            <span className="dim" title={GAME_CALENDAR_NOTE}>
              Game calendar: {data.clock.date}
            </span>
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
          <AutoPanel knobs={data.autoDay} onGo={playDay} onCancel={() => setConfirmAuto(false)} />
        ) : null}
        {busy === "autoplay" ? <p className="world">The house is playing your day…</p> : null}
        {autoReport ? (
          <AutoSummary
            report={autoReport}
            onClose={() => setAutoReport(null)}
            onOpenLog={openLog}
          />
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
          rowId={byId}
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
          rowId={byId}
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
          secondary={NONE}
          searchOf={eggSearch}
          rowId={byId}
          placeholder="Search: a name or an element"
        />
      ) : null}
      {view === "Results" ? (
        <>
          <p className="summary">
            All time: {data.results.fights.toLocaleString()} fights · {data.results.wins}–
            {data.results.fights - data.results.wins} ·{" "}
            <span className={data.results.netGp >= 0 ? "up" : "down"}>
              {signed(data.results.netGp) || "0.00"} GP net
            </span>
          </p>
          <FarmGrid<FarmFightRowUI>
            gridId="results"
            label="Results"
            rows={fights.rows}
            columns={RESULT_COLS}
            secondary={RESULT_SECONDARY}
            searchOf={resultSearch}
            rowId={byLogId}
            rowClass="opens-fight"
            onRowClicked={(r) => watch(r, r.birdName)}
            summary={resultsSummary}
            placeholder="Search the loaded fights: a bird, an opponent, a stable, win or loss"
          />
          <div className="row">
            {fights.error ? (
              <p className="down" role="alert">
                {fights.error}
              </p>
            ) : null}
            {fights.loading ? <p className="dim">Loading fights…</p> : null}
            {!fights.loading && fights.more ? (
              <button type="button" className="btn ghost" onClick={fights.older}>
                Load older fights
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {view === "Log" ? (
        <FarmLog log={log} who={logWho} setWho={setLogWho} isEmpty={data.logLines === 0} />
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
                <CardReport
                  report={cardReport}
                  onClose={() => setCardReport(null)}
                  onOpenLog={openLog}
                />
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

// Module-level, so the grid sees the same function every render: a new one
// would refilter, hand the grid new rows, and loop through its summary.
const eggSearch = (r: EggRowUI) => ({ text: r.name, element: r.element });
const resultSearch = (r: FarmFightRowUI) => ({
  text: `${r.birdName} ${r.opponent} ${r.opponentFarm} ${r.card} ${r.result}`,
});
const byId = (r: { id: string }) => r.id;
const NONE: string[] = [];
const byLogId = (r: { logId: number }) => String(r.logId);

const GAME_CALENDAR_NOTE =
  "The game's own calendar, not today's date. Its weekday is the one Hatch Friday and the Majors run on.";

/**
 * Recomputed from the rows the grid is showing, so a filter on one bird sums
 * that bird. It says "loaded" because it only knows the pages fetched so far;
 * the all-time line above the grid is the server's count of every fight.
 */
function resultsSummary(shown: FarmFightRowUI[]) {
  const wins = shown.filter((r) => r.result === "win").length;
  const net = shown.reduce((sum, r) => sum + r.gp, 0);
  return (
    <>
      Loaded and shown: {shown.length.toLocaleString()} fights · {wins}–{shown.length - wins} ·{" "}
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
  knobs,
  onGo,
  onCancel,
}: {
  knobs: FarmPageData["autoDay"];
  onGo: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="panel" id="autopanel">
      <h3>The house will play today like a careful beginner:</h3>
      <ul>
        <li>Check in, and spend your free gacha pulls (never a paid roll).</li>
        <li>
          Price your retired roosters and list them at stud. On Hatch Friday it also reprices every
          stud you have standing by last week&apos;s demand. That replaces any price you set by
          hand.
        </li>
        <li>
          Buy the next barn expansion if the barn is within {knobs.expandHeadroom} slots of full. It
          unstakes Land Tokens to pay. If your staked land is not enough, it buys the rest with GP,
          at {knobs.landGpPer100} GP per 100 LT. That purchase does not keep {knobs.reserve} GP
          back.
        </li>
        <li>Stake all your loose Land Tokens.</li>
        <li>Breed one hen whose nest is empty, to the stud it rates best.</li>
        <li>Give every unnamed bird a name from the house list.</li>
        <li>
          Register crown birds for this week&apos;s championships. The Majors are hardcore: a loss
          there retires the bird.
        </li>
        <li>
          Enter every fighting bird it can on tonight&apos;s card, keeping {knobs.reserve} GP back.
          Its picks are like the Tonight suggestions, but not always the same ones.
        </li>
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

function AutoSummary({
  report,
  onClose,
  onOpenLog,
}: {
  report: HonestDayReport;
  onClose: () => void;
  onOpenLog: () => void;
}) {
  const diff = report.gpAfter - report.gpBefore;
  // The same builder writes the run's line in the farm log, so this panel
  // and the log can never describe the day differently.
  const lines = honestDayLines(report);
  return (
    <div className="panel" role="status">
      <h3>The house played your day.</h3>
      <ul>
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {report.studsRepriced.length ? (
        <details>
          <summary>New stud prices</summary>
          <ul className="report">
            {report.studsRepriced.map((r) => (
              <li key={r.birdId}>
                <b>{r.name}</b>: {r.from} → {r.to} GP
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <p style={{ margin: 0 }}>
        GP {gp2(report.gpBefore)} → {gp2(report.gpAfter)}{" "}
        <span className={diff >= 0 ? "up" : "down"}>({signed(diff) || "0.00"})</span>
      </p>
      <SavedToLog onOpenLog={onOpenLog} />
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
  onOpenLog,
}: {
  report: { name: string; result: CardResult }[];
  onClose: () => void;
  onOpenLog: () => void;
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
      <SavedToLog onOpenLog={onOpenLog} />
    </div>
  );
}

/**
 * Said under a button's result, because the panel goes away and a new player
 * should know the record does not.
 */
function SavedToLog({ onOpenLog }: { onOpenLog: () => void }) {
  return (
    <p className="saved">
      This is saved in your farm log.{" "}
      <button type="button" className="btn ghost small" onClick={onOpenLog}>
        Open the log
      </button>
    </p>
  );
}

/** A button press's own summary line. The moves it made follow below it. */
const RUN_HEADS = new Set(["play_my_day", "card"]);

function Delta({ value, unit }: { value: number | null; unit: string }) {
  if (value === null || value === 0) return null;
  return (
    <span className={value > 0 ? "up" : "down"}>
      {signed(value)} {unit}
    </span>
  );
}

function rowClass(e: FarmLogEntry): string | undefined {
  if (RUN_HEADS.has(e.kind)) return "head";
  return e.runId === null ? undefined : "inrun";
}

/**
 * The Log view. A list, not a grid: every line is a sentence of its own
 * length, and a grid cell would cut it off on a phone where a list item just
 * wraps. There is nothing to sort by but time, which the server already did.
 */
function FarmLog({
  log,
  who,
  setWho,
  isEmpty,
}: {
  log: ReturnType<typeof useFarmLog>;
  who: LogLabel | null;
  setWho: (who: LogLabel | null) => void;
  isEmpty: boolean;
}) {
  const { counts } = log;
  // Only the labels this farm has lines under: a new player's log has no
  // "LLM barn" moves, and a filter that always comes back empty is noise.
  const labels = counts ? LOG_LABEL_KEYS.filter((k) => counts[k] > 0) : [];
  const total = counts ? labels.reduce((sum, k) => sum + counts[k], 0) : 0;
  return (
    <>
      <p className="summary">Every move on your farm, newest first, and who made it.</p>
      {labels.length > 1 ? (
        <div className="logfilter" role="group" aria-label="Who made the move">
          <button type="button" aria-pressed={who === null} onClick={() => setWho(null)}>
            All <span className="count">{total}</span>
          </button>
          {labels.map((k) => (
            <button key={k} type="button" aria-pressed={who === k} onClick={() => setWho(k)}>
              {LOG_LABELS[k]} <span className="count">{counts?.[k]}</span>
            </button>
          ))}
        </div>
      ) : null}
      {isEmpty ? <p className="dim">Nothing has happened on your farm yet.</p> : null}
      <ol className="farmlog">
        {log.entries.map((e) => (
          <li key={e.cursor} className={rowClass(e)}>
            <span className="meta">
              <span className="dim">day {e.day}</span>{" "}
              <span className={`chip who-${e.who}`}>{LOG_LABELS[e.who]}</span>
              {e.who === "you" && e.via === "mcp" ? <span className="dim"> via Claude</span> : null}
            </span>
            <span className="msg">{e.message}</span>
            <span className="deltas">
              <Delta value={e.gp} unit="GP" /> <Delta value={e.lt} unit="LT" />
            </span>
          </li>
        ))}
      </ol>
      <div className="row">
        {log.error ? (
          <p className="down" role="alert">
            {log.error}
          </p>
        ) : null}
        {log.loading ? <p className="dim">Loading the log…</p> : null}
        {!log.loading && log.more ? (
          <button type="button" className="btn ghost" onClick={log.older}>
            Older
          </button>
        ) : null}
      </div>
    </>
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
