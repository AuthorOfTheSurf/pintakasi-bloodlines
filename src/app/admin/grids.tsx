"use client";

import { useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from "ag-grid-community";
import { gradeColor, gradeOf, overallGradeOf } from "@/engine/grades";
import { BASE_COAT_HEX, BirdSprite, EggSprite, ElementSprite, TOKEN_EGG_HEX } from "./sprites";

ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * The office's grids — AG Grid Community (same as Genetic Tools): every
 * column sorts and filters out of the box. One top-level tab bar switches
 * between them; inactive grids stay mounted so sort/filter state survives
 * tab flips, and nothing ever scroll-jumps the page.
 */

const officeTheme = themeQuartz.withParams({
  backgroundColor: "#1c1914",
  foregroundColor: "#e8e0d0",
  headerBackgroundColor: "#171410",
  headerTextColor: "#9a8f78",
  accentColor: "#e8b64c",
  borderColor: "#3a342a",
  rowHoverColor: "#242019",
  oddRowBackgroundColor: "#1a1712",
  fontFamily: "ui-monospace, Menlo, monospace",
  fontSize: 12.5,
});

export interface FarmRowUI {
  name: string;
  bot: boolean;
  farmP: string;
  farmS: string;
  gp: number;
  liquidLt: number;
  stakedLt: number;
  birds: number;
  wins: number;
  losses: number;
  studs: number;
}

export interface FightRowUI {
  day: number;
  card: string;
  winner: string;
  winnerFarm: string;
  winnerFarmP: string;
  winnerFarmS: string;
  loser: string;
  loserFarm: string;
  loserFarmP: string;
  loserFarmS: string;
  winFigure: number;
  loseFigure: number;
  pot: number;
}

export interface BirdRowUI {
  name: string;
  farm: string;
  farmP: string;
  farmS: string;
  sex: string;
  baseCoat: string;
  trimColor: string;
  age: number;
  stars: number;
  element: string;
  // null while the bird is still in the shell — an egg's book is closed
  // (round 20). Element and stars stay visible from the day it's laid.
  agility: number | null;
  sight: number | null;
  stamina: number | null;
  gameness: number | null;
  station: number | null;
  condition: number | null;
  total: number | null; // the six stats summed — the raw-material score
  status: string;
  wins: number;
  losses: number;
  // What the bird has actually EARNED (round 19), across every card it ever
  // fought: purses and pots net of its own entry fees, and the land its
  // fights minted. The answer to "was this bird worth feeding?"
  netGp: number;
  netLt: number;
}

export interface BreedingRowUI {
  seq: number;
  conceived: number; // day the cover was bought
  egg: string;
  hen: string;
  rooster: string;
  studFarm: string;
  studFarmP: string;
  studFarmS: string;
  nestFarm: string;
  nestFarmP: string;
  nestFarmS: string;
  lays: number; // day index of the lay Friday
  hatches: number; // day index of the hatch Friday
  stage: string; // pregnant · in the nest · hatched
  fee: number;
  studShare: number;
}

export interface GachaRowUI {
  seq: number;
  day: number;
  farm: string;
  farmP: string;
  farmS: string;
  token: string;
  cost: string; // "free" or "8 GP"
  lt: number;
  egg: string;
}

export interface GpRowUI {
  seq: number;
  day: number;
  flow: string;
  farm: string;
  farmP?: string;
  farmS?: string;
  amount: number; // GP, signed
}

export interface LedgerRowUI {
  id: number;
  day: number;
  type: string;
  farm: string;
  farmP?: string;
  farmS?: string;
  message: string;
  gp: number | null;
  lt: number | null;
}

const num = (v: number | null | undefined, dp = 2) =>
  v == null ? "" : v.toLocaleString("en-US", { maximumFractionDigits: dp });

const signed = (v: number | null | undefined) =>
  v == null || v === 0 ? "" : `${v > 0 ? "+" : "−"}${num(Math.abs(v))}`;

const deltaClasses = {
  up: (p: { value: number | null }) => (p.value ?? 0) > 0,
  down: (p: { value: number | null }) => (p.value ?? 0) < 0,
};

/**
 * The farm chip — name + the two-color dot, wherever a farm is shown.
 * cellRendererParams name the fields holding the colors (and, optionally,
 * the bot flag). Rows without colors (world events) render plain.
 */
function FarmCell(props: {
  value?: string;
  data?: Record<string, unknown>;
  p?: string;
  s?: string;
  bot?: string;
}) {
  const d = props.data ?? {};
  const primary = props.p ? (d[props.p] as string | undefined) : undefined;
  if (!props.value || !primary) return <span className="world">{props.value ?? ""}</span>;
  const secondary = props.s ? (d[props.s] as string | undefined) : undefined;
  const isBot = props.bot ? Boolean(d[props.bot]) : false;
  return (
    <span className="farm-chip">
      <span className="dot" style={{ background: primary, borderColor: secondary }} />
      {props.value}
      {isBot ? <span className="bot">BOT</span> : null}
    </span>
  );
}

const farmCol = (field: string, header: string, prefix: string): ColDef => ({
  field,
  headerName: header,
  cellRenderer: FarmCell,
  cellRendererParams: { p: `${prefix}P`, s: `${prefix}S` },
  width: 190,
});

const FARM_COLS: ColDef<FarmRowUI>[] = [
  {
    field: "name",
    headerName: "farm",
    cellRenderer: FarmCell,
    cellRendererParams: { p: "farmP", s: "farmS", bot: "bot" },
    flex: 1,
    minWidth: 220,
  },
  { field: "gp", headerName: "GP", type: "rightAligned", valueFormatter: (p) => num(p.value), sort: "desc", width: 120 },
  { field: "wins", headerName: "W", type: "rightAligned", width: 80 },
  { field: "losses", headerName: "L", type: "rightAligned", width: 80 },
  { field: "liquidLt", headerName: "LT liquid", type: "rightAligned", width: 110 },
  { field: "stakedLt", headerName: "LT staked", type: "rightAligned", width: 110 },
  { field: "birds", headerName: "birds", type: "rightAligned", width: 90 },
  { field: "studs", headerName: "studs listed", type: "rightAligned", width: 120 },
];

const FIGHT_COLS: ColDef<FightRowUI>[] = [
  { field: "day", type: "rightAligned", width: 80, sort: "desc" },
  { field: "card", width: 200 },
  { field: "winner", width: 140 },
  farmCol("winnerFarm", "winner's farm", "winnerFarm"),
  { field: "loser", width: 140 },
  farmCol("loserFarm", "loser's farm", "loserFarm"),
  {
    headerName: "figures",
    valueGetter: (p) => (p.data ? `${p.data.winFigure} / ${p.data.loseFigure}` : ""),
    width: 100,
    type: "rightAligned",
    sortable: false,
  },
  { field: "pot", headerName: "pot GP", type: "rightAligned", width: 95 },
];

/** The profile photo — egg sprite while in the shell, coat + trim after. */
function BirdAvatarCell(props: { data?: BirdRowUI }) {
  const d = props.data;
  if (!d) return null;
  if (d.status === "Egg")
    return <EggSprite shell={BASE_COAT_HEX[d.baseCoat] ?? BASE_COAT_HEX.Cream} size={24} />;
  return <BirdSprite sex={d.sex} baseCoat={d.baseCoat} trimColor={d.trimColor} size={30} />;
}

/**
 * Grade prominent — colored per family (round 15: C blue · B orange ·
 * A green · S purple · O amber) — raw number in secondary grey.
 */
function GradeCell(props: { value?: number }) {
  if (props.value == null) return null;
  const grade = gradeOf(props.value);
  return (
    <span>
      <b className="grade" style={{ color: gradeColor(grade) }}>{grade}</b>{" "}
      <span className="statnum">{props.value}</span>
    </span>
  );
}

function TotalCell(props: { value?: number }) {
  if (props.value == null) return null;
  const grade = overallGradeOf(props.value);
  return (
    <span>
      <b className="grade" style={{ color: gradeColor(grade) }}>{grade}</b>{" "}
      <span className="statnum">{props.value}</span>
    </span>
  );
}

/** Element with its pixel icon. */
function ElementCell(props: { value?: string }) {
  if (!props.value) return null;
  return (
    <span>
      <ElementSprite element={props.value} size={14} /> {props.value}
    </span>
  );
}

/** The mystery-egg column — the shell tinted by the token that dropped it. */
function GachaEggCell(props: { value?: string; data?: GachaRowUI }) {
  if (!props.value || !props.data) return null;
  return (
    <span>
      <EggSprite shell={TOKEN_EGG_HEX[props.data.token] ?? TOKEN_EGG_HEX.White} size={18} />{" "}
      {props.value}
    </span>
  );
}

// The six stats, spelled out and all the same width (round 19) — abbreviated
// headers ("agi / sig / sta") read like a spreadsheet nobody explained, and
// ragged widths made the block hard to scan across rows.
const STAT_COL_WIDTH = 130;
const statCol = (field: keyof BirdRowUI): ColDef<BirdRowUI> => ({
  field,
  headerName: field,
  type: "rightAligned",
  width: STAT_COL_WIDTH,
  minWidth: STAT_COL_WIDTH,
  maxWidth: STAT_COL_WIDTH,
  cellRenderer: GradeCell,
});

const BIRD_COLS: ColDef<BirdRowUI>[] = [
  {
    colId: "avatar",
    headerName: "",
    width: 64,
    pinned: "left",
    sortable: false,
    filter: false,
    resizable: false,
    cellRenderer: BirdAvatarCell,
    // Kill the default cell padding — it was squeezing the sprite and
    // showing an overflow ellipsis beside it.
    cellStyle: { padding: 0, display: "flex", alignItems: "center", justifyContent: "center" },
  },
  { field: "name", minWidth: 150, pinned: "left" },
  farmCol("farm", "farm", "farm"),
  { field: "sex", width: 95 },
  { field: "age", type: "rightAligned", width: 75 },
  // Element first, then its star rating — the type, then how much of it.
  { field: "element", width: 115, cellRenderer: ElementCell },
  { field: "stars", headerName: "★", type: "rightAligned", width: 75, valueFormatter: (p) => `${p.value}★` },
  { field: "total", headerName: "Overall", type: "rightAligned", width: 120, sort: "desc", cellRenderer: TotalCell },
  statCol("agility"),
  statCol("sight"),
  statCol("stamina"),
  statCol("gameness"),
  statCol("station"),
  statCol("condition"),
  { field: "status", width: 150 },
  { field: "wins", headerName: "W", type: "rightAligned", width: 70 },
  { field: "losses", headerName: "L", type: "rightAligned", width: 70 },
  {
    field: "netGp",
    headerName: "net GP",
    type: "rightAligned",
    width: 110,
    valueFormatter: (p) => signed(p.value),
    cellClassRules: deltaClasses,
  },
  {
    field: "netLt",
    headerName: "net LT",
    type: "rightAligned",
    width: 110,
    valueFormatter: (p) => (p.value ? `+${num(p.value, 0)}` : ""),
    cellClass: "up",
  },
  // Unimportant — parked at the far end (ruled round 15).
  { field: "baseCoat", headerName: "coat", width: 95 },
  { field: "trimColor", headerName: "trim", width: 105 },
];

const BREEDING_COLS: ColDef<BreedingRowUI>[] = [
  { field: "seq", hide: true, sort: "desc" },
  { field: "conceived", headerName: "day", type: "rightAligned", width: 80 },
  { field: "egg", minWidth: 170 },
  { field: "hen", width: 140 },
  { field: "rooster", width: 140 },
  farmCol("studFarm", "stud's farm", "studFarm"),
  farmCol("nestFarm", "nest (egg's farm)", "nestFarm"),
  { field: "lays", headerName: "lays (day)", type: "rightAligned", width: 100 },
  { field: "hatches", headerName: "hatches (day)", type: "rightAligned", width: 120 },
  { field: "stage", width: 120 },
  { field: "fee", headerName: "fee GP", type: "rightAligned", width: 90 },
  { field: "studShare", headerName: "stud share GP", type: "rightAligned", width: 125 },
];

const GACHA_COLS: ColDef<GachaRowUI>[] = [
  { field: "seq", hide: true, sort: "desc" },
  { field: "day", type: "rightAligned", width: 80 },
  farmCol("farm", "farm", "farm"),
  { field: "token", width: 110 },
  { field: "cost", width: 100 },
  { field: "lt", headerName: "+LT", type: "rightAligned", width: 80 },
  { field: "egg", headerName: "mystery egg", minWidth: 170, cellRenderer: GachaEggCell },
];

const GP_COLS: ColDef<GpRowUI>[] = [
  { field: "seq", hide: true, sort: "desc" },
  { field: "day", type: "rightAligned", width: 80 },
  { field: "flow", width: 190 },
  farmCol("farm", "farm", "farm"),
  {
    field: "amount",
    headerName: "GP",
    type: "rightAligned",
    width: 120,
    valueFormatter: (p) => signed(p.value),
    cellClassRules: deltaClasses,
  },
];

const LEDGER_COLS: ColDef<LedgerRowUI>[] = [
  { field: "id", hide: true, sort: "desc" },
  { field: "day", type: "rightAligned", width: 80 },
  { field: "type", width: 140 },
  farmCol("farm", "farm", "farm"),
  { field: "message", headerName: "what happened", flex: 1, minWidth: 460, tooltipField: "message" },
  {
    field: "gp",
    headerName: "ΔGP",
    type: "rightAligned",
    width: 110,
    valueFormatter: (p) => signed(p.value),
    cellClassRules: deltaClasses,
  },
  {
    field: "lt",
    headerName: "ΔLT",
    type: "rightAligned",
    width: 90,
    valueFormatter: (p) => signed(p.value),
    cellClassRules: deltaClasses,
  },
];

// "Higher is better" is the better assumption (ruled round 15): every
// numeric (right-aligned) column sorts DESCENDING on the first click.
const DESC_FIRST: ("desc" | "asc" | null)[] = ["desc", "asc", null];
for (const cols of [
  FARM_COLS,
  FIGHT_COLS,
  BIRD_COLS,
  BREEDING_COLS,
  GACHA_COLS,
  GP_COLS,
  LEDGER_COLS,
] as ColDef[][]) {
  for (const c of cols) {
    if (c.type === "rightAligned" && c.sortable !== false) c.sortingOrder = DESC_FIRST;
  }
}

// "The Card" and "The Pintakasi" ride in the tab bar too (rounds 19–20) —
// worth a look each, not two thirds of the page above every table.
const TABS = [
  "Farms", "Fights", "Birds", "Breeding", "Gacha", "GP", "The Ledger",
  "The Card", "🏆 The Pintakasi",
] as const;
type Tab = (typeof TABS)[number];

export function AdminTabs({
  farms,
  fights,
  birds,
  breeding,
  gacha,
  gp,
  ledger,
  card,
  cardCount,
  pintakasi,
  pintakasiCount,
}: {
  farms: FarmRowUI[];
  fights: FightRowUI[];
  birds: BirdRowUI[];
  breeding: BreedingRowUI[];
  gacha: GachaRowUI[];
  gp: GpRowUI[];
  ledger: LedgerRowUI[];
  card: React.ReactNode; // rendered server-side — the lobby boxes
  cardCount: number;
  pintakasi: React.ReactNode; // …and the week's three championship columns
  pintakasiCount: number;
}) {
  const [tab, setTab] = useState<Tab>("Farms");
  const counts: Record<Tab, number> = {
    Farms: farms.length,
    Fights: fights.length,
    Birds: birds.length,
    Breeding: breeding.length,
    Gacha: gacha.length,
    GP: gp.length,
    "The Ledger": ledger.length,
    "The Card": cardCount,
    "🏆 The Pintakasi": pintakasiCount,
  };

  const base = { sortable: true, filter: true, resizable: true };
  const pane = (name: Tab, height: number, grid: React.ReactNode) => (
    <div style={{ display: tab === name ? "block" : "none", height }}>{grid}</div>
  );

  return (
    <section>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t} <span className="count">{counts[t]}</span>
          </button>
        ))}
      </nav>
      {pane("Farms", 420, <AgGridReact<FarmRowUI> theme={officeTheme} rowData={farms} columnDefs={FARM_COLS} defaultColDef={base} />)}
      {pane("Fights", 640, <AgGridReact<FightRowUI> theme={officeTheme} rowData={fights} columnDefs={FIGHT_COLS} defaultColDef={{ ...base, floatingFilter: true }} />)}
      {pane("Birds", 640, <AgGridReact<BirdRowUI> theme={officeTheme} rowData={birds} columnDefs={BIRD_COLS} defaultColDef={{ ...base, floatingFilter: true }} rowHeight={38} />)}
      {pane("Breeding", 640, <AgGridReact<BreedingRowUI> theme={officeTheme} rowData={breeding} columnDefs={BREEDING_COLS} defaultColDef={{ ...base, floatingFilter: true }} />)}
      {pane("Gacha", 640, <AgGridReact<GachaRowUI> theme={officeTheme} rowData={gacha} columnDefs={GACHA_COLS} defaultColDef={{ ...base, floatingFilter: true }} />)}
      {pane("GP", 640, <AgGridReact<GpRowUI> theme={officeTheme} rowData={gp} columnDefs={GP_COLS} defaultColDef={{ ...base, floatingFilter: true }} />)}
      {pane("The Ledger", 640, <AgGridReact<LedgerRowUI> theme={officeTheme} rowData={ledger} columnDefs={LEDGER_COLS} defaultColDef={{ ...base, floatingFilter: true }} />)}
      <div style={{ display: tab === "The Card" ? "block" : "none" }}>{card}</div>
      <div style={{ display: tab === "🏆 The Pintakasi" ? "block" : "none" }}>{pintakasi}</div>
    </section>
  );
}
