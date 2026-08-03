"use client";

import { useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * The office's grids — AG Grid Community (same as Genetic Tools), so every
 * table sorts and filters out of the box. One top-level tab bar switches
 * between them; the inactive grids stay mounted so sort/filter state
 * survives tab flips, and nothing ever scroll-jumps the page.
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
  primaryColor: string;
  secondaryColor: string;
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
  loser: string;
  loserFarm: string;
  winFigure: number;
  loseFigure: number;
  pot: number;
}

export interface BirdRowUI {
  name: string;
  farm: string;
  sex: string;
  age: number;
  stars: number;
  element: string;
  status: string;
  wins: number;
  losses: number;
  practiceWins: number;
  practiceLosses: number;
}

export interface LedgerRowUI {
  id: number;
  day: number;
  type: string;
  farm: string;
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

function FarmNameCell(p: { data?: FarmRowUI }) {
  if (!p.data) return null;
  return (
    <span className="farm-chip">
      <span className="dot" style={{ background: p.data.primaryColor, borderColor: p.data.secondaryColor }} />
      {p.data.name}
      {p.data.bot ? <span className="bot">BOT</span> : null}
    </span>
  );
}

const FARM_COLS: ColDef<FarmRowUI>[] = [
  { field: "name", headerName: "farm", cellRenderer: FarmNameCell, flex: 1, minWidth: 220 },
  { field: "gp", headerName: "GP", type: "rightAligned", valueFormatter: (p) => num(p.value), sort: "desc", width: 120 },
  { field: "liquidLt", headerName: "LT liquid", type: "rightAligned", width: 110 },
  { field: "stakedLt", headerName: "LT staked", type: "rightAligned", width: 110 },
  { field: "birds", headerName: "birds", type: "rightAligned", width: 90 },
  { field: "wins", headerName: "W", type: "rightAligned", width: 80 },
  { field: "losses", headerName: "L", type: "rightAligned", width: 80 },
  { field: "studs", headerName: "studs listed", type: "rightAligned", width: 120 },
];

const FIGHT_COLS: ColDef<FightRowUI>[] = [
  { field: "day", type: "rightAligned", width: 80, sort: "desc" },
  { field: "card", width: 220 },
  { field: "winner", width: 150 },
  { field: "winnerFarm", headerName: "winner's farm", width: 180 },
  { field: "loser", width: 150 },
  { field: "loserFarm", headerName: "loser's farm", width: 180 },
  {
    headerName: "figures",
    valueGetter: (p) => (p.data ? `${p.data.winFigure} / ${p.data.loseFigure}` : ""),
    width: 110,
    type: "rightAligned",
    sortable: false,
  },
  { field: "pot", headerName: "pot GP", type: "rightAligned", width: 100 },
];

const BIRD_COLS: ColDef<BirdRowUI>[] = [
  { field: "name", flex: 1, minWidth: 170 },
  { field: "farm", width: 180 },
  { field: "sex", width: 100 },
  { field: "age", type: "rightAligned", width: 80 },
  { field: "stars", headerName: "★", type: "rightAligned", width: 80, valueFormatter: (p) => `${p.value}★` },
  { field: "element", width: 100 },
  { field: "status", width: 150 },
  { field: "wins", headerName: "W", type: "rightAligned", width: 75 },
  { field: "losses", headerName: "L", type: "rightAligned", width: 75 },
  { field: "practiceWins", headerName: "aW", type: "rightAligned", width: 75 },
  { field: "practiceLosses", headerName: "aL", type: "rightAligned", width: 75 },
];

const LEDGER_COLS: ColDef<LedgerRowUI>[] = [
  { field: "id", hide: true, sort: "desc" },
  { field: "day", type: "rightAligned", width: 80 },
  { field: "type", width: 140 },
  { field: "farm", width: 190 },
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

const TABS = ["Farms", "Fights", "Birds", "The Ledger"] as const;
type Tab = (typeof TABS)[number];

export function AdminTabs({
  farms,
  fights,
  birds,
  ledger,
}: {
  farms: FarmRowUI[];
  fights: FightRowUI[];
  birds: BirdRowUI[];
  ledger: LedgerRowUI[];
}) {
  const [tab, setTab] = useState<Tab>("Farms");
  const counts: Record<Tab, number> = {
    Farms: farms.length,
    Fights: fights.length,
    Birds: birds.length,
    "The Ledger": ledger.length,
  };

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
      {pane(
        "Farms",
        420,
        <AgGridReact<FarmRowUI>
          theme={officeTheme}
          rowData={farms}
          columnDefs={FARM_COLS}
          defaultColDef={{ sortable: true, filter: true, resizable: true }}
        />
      )}
      {pane(
        "Fights",
        640,
        <AgGridReact<FightRowUI>
          theme={officeTheme}
          rowData={fights}
          columnDefs={FIGHT_COLS}
          defaultColDef={{ sortable: true, filter: true, resizable: true, floatingFilter: true }}
        />
      )}
      {pane(
        "Birds",
        640,
        <AgGridReact<BirdRowUI>
          theme={officeTheme}
          rowData={birds}
          columnDefs={BIRD_COLS}
          defaultColDef={{ sortable: true, filter: true, resizable: true, floatingFilter: true }}
        />
      )}
      {pane(
        "The Ledger",
        640,
        <AgGridReact<LedgerRowUI>
          theme={officeTheme}
          rowData={ledger}
          columnDefs={LEDGER_COLS}
          defaultColDef={{ sortable: true, filter: true, resizable: true, floatingFilter: true }}
        />
      )}
    </section>
  );
}
