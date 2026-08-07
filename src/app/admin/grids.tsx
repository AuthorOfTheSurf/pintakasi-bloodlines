"use client";

import { useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type SizeColumnsToContentStrategy,
} from "ag-grid-community";
import { LT_CENTS } from "@/engine/config";
import { gradeColor, gradeOf, overallGradeOf, type Grade } from "@/engine/grades";
import {
  BASE_COAT_HEX,
  BirdSprite,
  EggSprite,
  ElementSprite,
  GpIcon,
  LtIcon,
  TOKEN_EGG_HEX,
} from "./sprites";

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

/**
 * Every grid sizes itself to its contents on first render (round 37) — the
 * hand-tuned pixel widths below are only a starting guess, and the office was
 * being read with half the headers and half the farm names clipped, which meant
 * dragging columns wider by hand on every visit.
 *
 * `skipHeader: false` is the point of the exercise: measure the HEADER as well
 * as the cells, so "GP per staked LT" gets its own column back. The scale-up
 * pass then spends whatever width is left over on the columns that can take it,
 * which is what `flex` used to be doing for one column per grid.
 *
 * Two things are deliberately NOT here. There is no `defaultMaxWidth` /
 * `defaultMinWidth`: those OVERRIDE a column's own min/max, which would unlock
 * the six stat columns from their identical width (see `statCol`) and let them
 * go ragged again — the exact complaint round 19 fixed. Instead the one column
 * that can genuinely run away, the ledger's free-text message, is capped by
 * name; it has `tooltipField` for the overflow. And nothing here is sticky: the
 * grid stays `resizable`, so a drag afterwards still wins.
 */
const AUTOSIZE: SizeColumnsToContentStrategy = {
  type: "fitCellContents",
  skipHeader: false,
  scaleUpToFitGridWidth: true,
  columnLimits: [{ colId: "message", maxWidth: 620 }],
};

export interface FarmRowUI {
  name: string;
  bot: boolean;
  farmP: string;
  farmS: string;
  gp: number;
  // Land, in hundredths of a token since round 36 — raw so the grid sorts on
  // it; ltNum is the only thing that divides. Same for every `…Lt` below.
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
  pintakasiRound: string;
  element: string;
  winner: string;
  winnerGrade: Grade;
  winnerFarm: string;
  winnerFarmP: string;
  winnerFarmS: string;
  loser: string;
  loserGrade: Grade;
  loserFarm: string;
  loserFarmP: string;
  loserFarmS: string;
  winFigure: number;
  loseFigure: number;
  pot: number;
}

export interface BirdRowUI {
  id: string; // never shown — the key the fight-history pane filters on
  name: string;
  grade: Grade;
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
  netLt: number; // hundredths of a token (round 36)
}

/**
 * One row per fight a bird has had (round 37). The Fights tab answers "what
 * happened in the pit last night"; this answers the other question a barn asks
 * — "what has THIS bird actually done?" — which used to mean filtering the
 * Fights grid twice, once on winner and once on loser.
 *
 * Rows arrive for every bird at once and the pane filters on `birdId` in the
 * browser: the whole set is already in memory for the Birds grid, and a
 * per-click round trip would be the only thing on the page that talks to the
 * server.
 */
export interface BirdFightRowUI {
  birdId: string;
  day: number;
  card: string;
  opponent: string;
  opponentFarm: string;
  opponentFarmP: string;
  opponentFarmS: string;
  result: string; // "win" | "loss"
  figure: number;
  opponentFigure: number | null;
  gp: number; // signed whole GP
}

export interface BreedingRowUI {
  seq: number;
  // Day the cover was bought. No longer a column of its own (round 37) — the
  // stage tells the story and the sprite wanted the room — but kept on the row
  // because it is the natural thing to show if the book ever grows a detail view.
  conceived: number;
  egg: string;
  eggGrade: Grade;
  hen: string;
  henGrade: Grade;
  rooster: string;
  roosterGrade: Grade;
  studFarm: string;
  studFarmP: string;
  studFarmS: string;
  nestFarm: string;
  nestFarmP: string;
  nestFarmS: string;
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
  lt: number; // hundredths of a token (round 36)
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

/**
 * One row per farm in the staking book (round 21). The two headline numbers
 * are `stakedLt` — what the barn has committed to the pool — and `earnedGp`,
 * every centavo of staking yield it has ever been paid. The rest is context
 * for reading those two: how big a slice of the pool the stake buys, and
 * what it has returned.
 */
export interface StakingRowUI {
  farm: string;
  farmP: string;
  farmS: string;
  bot: boolean;
  stakedLt: number; // hundredths of a token (round 36), like liquidLt
  liquidLt: number; // land sitting idle — staked land is the working kind
  share: number; // fraction of the pool this stake commands TODAY
  earnedGp: number; // lifetime staking yield, all payouts summed
  payouts: number; // days this farm was paid
  perDay: number; // average yield on a paid day
  // Lifetime yield ÷ TODAY's stake — a rough return, not a rate. GP per WHOLE
  // token: the divisor is scaled back out of hundredths at the source, because
  // a "GP per staked LT" that quoted hundredths would read 100× too small.
  perLt: number;
  lastPaidDay: number | null;
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
  lt: number | null; // signed, in hundredths of a token (round 36)
}

/**
 * GP, always to the centavo (round 37). The minimum matters as much as the
 * maximum: with only a maximum, a column of purses rendered "40", "40.5" and
 * "39.75" down the same rail, three different-looking units for one currency —
 * the same complaint `ltNum` below was written to answer for land. Callers that
 * pass a `dp` are quoting a RATE, not an amount; they get that many places,
 * fixed, for the same reason.
 */
const num = (v: number | null | undefined, dp = 2) =>
  v == null
    ? ""
    : v.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

const signed = (v: number | null | undefined) =>
  v == null || v === 0 ? "" : `${v > 0 ? "+" : "−"}${num(Math.abs(v))}`;

/**
 * ⚠ EVERY LT FIGURE IN THESE ROWS IS HUNDREDTHS OF A TOKEN (round 36) — the
 * rows carry the engine's raw integers and this is the ONLY place they are
 * divided. That split is deliberate: AG Grid sorts and filters on the row
 * value, so scaling at the source would put floats in the sort key, and
 * formatting at the source would sort "9.90" above "10.00" as strings.
 *
 * Always two decimals. A land column that renders 673 as "6.73" and 500 as "5"
 * reads as two different units, which is the confusion this round is about.
 */
const ltNum = (v: number | null | undefined) =>
  v == null
    ? ""
    : (v / LT_CENTS).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const signedLt = (v: number | null | undefined) =>
  v == null || v === 0 ? "" : `${v > 0 ? "+" : "−"}${ltNum(Math.abs(v))}`;

const deltaClasses = {
  up: (p: { value: number | null }) => (p.value ?? 0) > 0,
  down: (p: { value: number | null }) => (p.value ?? 0) < 0,
};

/** A bird name led by its colored overall grade. */
function GradedNameCell(props: {
  value?: string;
  data?: Record<string, unknown>;
  gradeField?: string;
}) {
  const grade = props.gradeField
    ? (props.data?.[props.gradeField] as Grade | undefined)
    : undefined;
  if (!props.value) return null;
  return (
    <span>
      {grade ? (
        <>
          <b className="grade" style={{ color: gradeColor(grade) }}>{grade}</b>{" "}
        </>
      ) : null}
      {props.value}
    </span>
  );
}

/** A numeric token amount with the currency icon kept beside the value. */
function TokenAmountCell(props: {
  value?: number | null;
  token: "gp" | "lt";
  display?: "signed" | "positive" | "plain";
  dp?: number;
}) {
  if (props.value == null) return null;
  // The token decides the SCALE, not just the icon: GP rows arrive in whole GP,
  // land rows in hundredths of a token (round 36). `dp` only means anything to
  // GP — land is fixed at two places by ltNum.
  const isLt = props.token === "lt";
  // Two places whichever door the value comes through: the "positive" path used
  // to round to whole units, so one column of the same currency disagreed with
  // its neighbours about how much precision GP has (round 37).
  const mag = (v: number) => (isLt ? ltNum(v) : num(v, props.dp ?? 2));
  const text = props.display === "signed"
    ? (isLt ? signedLt(props.value) : signed(props.value))
    : props.display === "positive"
      ? (props.value ? `+${mag(props.value)}` : "")
      : mag(props.value);
  if (!text) return null;
  return (
    <span>
      {props.token === "gp" ? <GpIcon size={14} /> : <LtIcon size={14} />} {text}
    </span>
  );
}

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
    headerName: "name",
    cellRenderer: FarmCell,
    cellRendererParams: { p: "farmP", s: "farmS", bot: "bot" },
    width: 190,
  },
  {
    field: "gp",
    headerName: "GP",
    type: "rightAligned",
    cellRenderer: TokenAmountCell,
    cellRendererParams: { token: "gp" },
    width: 120,
  },
  {
    colId: "record",
    headerName: "record",
    valueGetter: (p) => p.data ? `${p.data.wins}-${p.data.losses}` : "",
    comparator: (_a, _b, nodeA, nodeB) => {
      const a = nodeA.data as FarmRowUI | undefined;
      const b = nodeB.data as FarmRowUI | undefined;
      if (!a || !b) return 0;
      return a.wins - b.wins || b.losses - a.losses;
    },
    sort: "desc",
    sortIndex: 0,
    type: "rightAligned",
    width: 90,
  },
  {
    field: "liquidLt",
    headerName: "LT liquid",
    type: "rightAligned",
    width: 110,
    valueFormatter: (p) => ltNum(p.value),
  },
  {
    field: "stakedLt",
    headerName: "LT staked",
    type: "rightAligned",
    width: 110,
    valueFormatter: (p) => ltNum(p.value),
  },
  { field: "birds", headerName: "birds", type: "rightAligned", width: 90 },
  { field: "studs", headerName: "studs listed", type: "rightAligned", width: 120 },
];

const FIGHT_COLS: ColDef<FightRowUI>[] = [
  { field: "day", type: "rightAligned", width: 80, sort: "desc" },
  { field: "card", width: 200 },
  { field: "pintakasiRound", headerName: "Pintakasi round", width: 145 },
  {
    field: "winner",
    width: 165,
    cellRenderer: GradedNameCell,
    cellRendererParams: { gradeField: "winnerGrade" },
  },
  farmCol("winnerFarm", "winner's farm", "winnerFarm"),
  {
    field: "loser",
    width: 165,
    cellRenderer: GradedNameCell,
    cellRendererParams: { gradeField: "loserGrade" },
  },
  farmCol("loserFarm", "loser's farm", "loserFarm"),
  {
    headerName: "figures",
    valueGetter: (p) => (p.data ? `${p.data.winFigure} / ${p.data.loseFigure}` : ""),
    width: 100,
    type: "rightAligned",
    sortable: false,
  },
  { field: "pot", headerName: "pot GP", type: "rightAligned", width: 95, valueFormatter: (p) => num(p.value) },
  { field: "element", width: 115, cellRenderer: ElementCell },
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
  if (props.value == null) return <span className="statnum">?</span>;
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

/**
 * The breeding book's egg — sprite, then grade, then name (round 37). It reads
 * as a clutch rather than a spreadsheet, which is what the tab is for; the day
 * the cover was bought went away to make room, since `stage` already says where
 * in the pregnant → nest → hatched arc the egg is.
 *
 * The shell is Cream for everything: a breeding row carries no coat, and the
 * coat isn't decided until the chick hatches anyway. To tint these properly the
 * row would need a coat field fed from the egg record.
 */
function BreedingEggCell(props: { value?: string; data?: BreedingRowUI }) {
  if (!props.value || !props.data) return null;
  return (
    <span>
      <EggSprite shell={BASE_COAT_HEX.Cream} size={18} />{" "}
      <b className="grade" style={{ color: gradeColor(props.data.eggGrade) }}>
        {props.data.eggGrade}
      </b>{" "}
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
  headerName: field.charAt(0).toUpperCase() + field.slice(1),
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
    // A sprite has no text to measure, so leave it out of the auto-size pass —
    // fitting it to "contents" would squeeze the photo against the row edge.
    suppressAutoSize: true,
    cellRenderer: BirdAvatarCell,
    // Kill the default cell padding — it was squeezing the sprite and
    // showing an overflow ellipsis beside it.
    cellStyle: { padding: 0, display: "flex", alignItems: "center", justifyContent: "center" },
  },
  {
    field: "name",
    minWidth: 175,
    pinned: "left",
    cellRenderer: GradedNameCell,
    cellRendererParams: { gradeField: "grade" },
  },
  farmCol("farm", "farm", "farm"),
  { field: "sex", width: 95 },
  { field: "age", type: "rightAligned", width: 75 },
  { field: "total", headerName: "Overall", type: "rightAligned", width: 120, cellRenderer: TotalCell },
  { field: "element", width: 115, cellRenderer: ElementCell },
  { field: "stars", headerName: "★", type: "rightAligned", width: 75, valueFormatter: (p) => `${p.value}★` },
  statCol("agility"),
  statCol("sight"),
  statCol("stamina"),
  statCol("gameness"),
  statCol("station"),
  statCol("condition"),
  { field: "status", width: 150 },
  {
    colId: "record",
    headerName: "Record",
    valueGetter: (p) => p.data ? `${p.data.wins}-${p.data.losses}` : "",
    comparator: (_a, _b, nodeA, nodeB) => {
      const a = nodeA.data as BirdRowUI | undefined;
      const b = nodeB.data as BirdRowUI | undefined;
      if (!a || !b) return 0;
      return a.wins - b.wins || b.losses - a.losses;
    },
    type: "rightAligned",
    width: 90,
  },
  {
    field: "netGp",
    headerName: "net GP",
    sort: "desc",
    sortIndex: 0,
    type: "rightAligned",
    width: 110,
    cellRenderer: TokenAmountCell,
    cellRendererParams: { token: "gp", display: "signed" },
    cellClassRules: deltaClasses,
  },
  {
    field: "netLt",
    headerName: "net LT",
    type: "rightAligned",
    width: 110,
    cellRenderer: TokenAmountCell,
    cellRendererParams: { token: "lt", display: "positive" },
    cellClass: "up",
  },
  // Unimportant — parked at the far end (ruled round 15).
  { field: "baseCoat", headerName: "coat", width: 95 },
  { field: "trimColor", headerName: "trim", width: 105 },
];

const BIRD_FIGHT_COLS: ColDef<BirdFightRowUI>[] = [
  // Most recent fight first — a bird's history is read backwards from tonight.
  { field: "day", type: "rightAligned", width: 80, sort: "desc", sortIndex: 0 },
  { field: "card", minWidth: 200 },
  { field: "opponent", width: 175 },
  farmCol("opponentFarm", "opponent's farm", "opponentFarm"),
  {
    field: "result",
    width: 100,
    // Same green/red the ΔGP columns use, so a losing streak is visible from
    // across the room without reading a word.
    cellClassRules: {
      up: (p) => p.value === "win",
      down: (p) => p.value === "loss",
    },
  },
  {
    colId: "figures",
    headerName: "figures",
    // Its own figure first, always — the Fights tab reads winner/loser, this one
    // reads mine/theirs, which is the only way to see a bird beaten by a shorter
    // price. A null opponent figure means the bout had no quoted counter-price.
    valueGetter: (p) =>
      p.data ? `${p.data.figure} / ${p.data.opponentFigure ?? "—"}` : "",
    width: 110,
    type: "rightAligned",
    sortable: false,
  },
  {
    field: "gp",
    headerName: "GP",
    type: "rightAligned",
    width: 110,
    cellRenderer: TokenAmountCell,
    cellRendererParams: { token: "gp", display: "signed" },
    cellClassRules: deltaClasses,
  },
];

const BREEDING_COLS: ColDef<BreedingRowUI>[] = [
  // Newest cover first. This is the sort key, not the (now removed) day column,
  // so dropping the visible day changes nothing about the order.
  { field: "seq", hide: true, sort: "desc" },
  { field: "egg", minWidth: 190, cellRenderer: BreedingEggCell },
  {
    field: "hen",
    width: 165,
    cellRenderer: GradedNameCell,
    cellRendererParams: { gradeField: "henGrade" },
  },
  {
    field: "rooster",
    width: 165,
    cellRenderer: GradedNameCell,
    cellRendererParams: { gradeField: "roosterGrade" },
  },
  farmCol("studFarm", "stud's farm", "studFarm"),
  farmCol("nestFarm", "nest (egg's farm)", "nestFarm"),
  { field: "stage", width: 120 },
  { field: "fee", headerName: "fee GP", type: "rightAligned", width: 90, valueFormatter: (p) => num(p.value) },
  {
    field: "studShare",
    headerName: "stud share GP",
    type: "rightAligned",
    width: 125,
    valueFormatter: (p) => num(p.value),
  },
];

const GACHA_COLS: ColDef<GachaRowUI>[] = [
  { field: "seq", hide: true, sort: "desc" },
  { field: "day", type: "rightAligned", width: 80 },
  farmCol("farm", "farm", "farm"),
  { field: "token", width: 110 },
  { field: "cost", width: 100 },
  {
    field: "lt",
    headerName: "+LT",
    type: "rightAligned",
    width: 90,
    valueFormatter: (p) => ltNum(p.value),
  },
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
    cellRenderer: TokenAmountCell,
    cellRendererParams: { token: "gp", display: "signed" },
    cellClassRules: deltaClasses,
  },
];

const STAKING_COLS: ColDef<StakingRowUI>[] = [
  {
    field: "farm",
    headerName: "farm",
    cellRenderer: FarmCell,
    cellRendererParams: { p: "farmP", s: "farmS", bot: "bot" },
    flex: 1,
    minWidth: 220,
  },
  {
    field: "stakedLt",
    headerName: "LT staked",
    type: "rightAligned",
    width: 130,
    sort: "desc",
    valueFormatter: (p) => ltNum(p.value),
  },
  {
    field: "share",
    headerName: "pool share",
    type: "rightAligned",
    width: 120,
    valueFormatter: (p) => (p.value ? `${(p.value * 100).toFixed(1)}%` : ""),
  },
  {
    field: "earnedGp",
    headerName: "GP earned staking",
    type: "rightAligned",
    width: 170,
    valueFormatter: (p) => (p.value ? `+${num(p.value)}` : ""),
    cellClass: "up",
  },
  { field: "payouts", headerName: "days paid", type: "rightAligned", width: 115 },
  {
    field: "perDay",
    headerName: "avg / paid day",
    type: "rightAligned",
    width: 140,
    valueFormatter: (p) => num(p.value),
  },
  {
    field: "perLt",
    headerName: "GP per staked LT",
    type: "rightAligned",
    width: 160,
    // The one money-ish column that is NOT two places: this is a rate, and at
    // two places most barns would read a flat "0.01".
    valueFormatter: (p) => num(p.value, 3),
  },
  {
    field: "lastPaidDay",
    headerName: "last paid (day)",
    type: "rightAligned",
    width: 140,
    valueFormatter: (p) => (p.value == null ? "never" : String(p.value)),
  },
  {
    field: "liquidLt",
    headerName: "LT idle",
    type: "rightAligned",
    width: 110,
    valueFormatter: (p) => ltNum(p.value),
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
    width: 100,
    valueFormatter: (p) => signedLt(p.value),
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
  BIRD_FIGHT_COLS,
  BREEDING_COLS,
  GACHA_COLS,
  GP_COLS,
  STAKING_COLS,
  LEDGER_COLS,
] as ColDef[][]) {
  for (const c of cols) {
    if (c.type === "rightAligned" && c.sortable !== false) c.sortingOrder = DESC_FIRST;
  }
}

// "The Card" and "The Pintakasi" ride in the tab bar too (rounds 19–20) —
// worth a look each, not two thirds of the page above every table.
const TABS = [
  "Farms", "Fights", "Birds", "Breeding", "Gacha", "GP", "Staking", "The Ledger",
  "The Card", "🏆 The Pintakasi",
] as const;
type Tab = (typeof TABS)[number];

export function AdminTabs({
  farms,
  fights,
  birds,
  birdFights,
  breeding,
  gacha,
  gp,
  staking,
  stakingSummary,
  ledger,
  card,
  cardCount,
  pintakasi,
  pintakasiCount,
}: {
  farms: FarmRowUI[];
  fights: FightRowUI[];
  birds: BirdRowUI[];
  birdFights: BirdFightRowUI[]; // every bird's fights; the pane filters by birdId
  breeding: BreedingRowUI[];
  gacha: GachaRowUI[];
  gp: GpRowUI[];
  staking: StakingRowUI[];
  stakingSummary: React.ReactNode; // the world's two totals, above the book
  ledger: LedgerRowUI[];
  card: React.ReactNode; // rendered server-side — the lobby boxes
  cardCount: number;
  pintakasi: React.ReactNode; // …and the week's three championship columns
  pintakasiCount: number;
}) {
  const [tab, setTab] = useState<Tab>("Farms");
  // Which bird's fight history is open under the Birds grid, by id. Clicking the
  // same row again closes it, so the click that opened the pane is also the way
  // out of it.
  const [openBird, setOpenBird] = useState<string | null>(null);
  const selectedBird = openBird ? birds.find((b) => b.id === openBird) ?? null : null;
  const selectedFights = selectedBird
    ? birdFights.filter((f) => f.birdId === selectedBird.id)
    : [];
  const counts: Record<Tab, number> = {
    Farms: farms.length,
    Fights: fights.length,
    Birds: birds.length,
    Breeding: breeding.length,
    Gacha: gacha.length,
    GP: gp.length,
    Staking: staking.filter((s) => s.stakedLt > 0).length, // barns actually staking
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
      {pane("Farms", 720, <AgGridReact<FarmRowUI> theme={officeTheme} rowData={farms} columnDefs={FARM_COLS} defaultColDef={base} autoSizeStrategy={AUTOSIZE} />)}
      {pane("Fights", 640, <AgGridReact<FightRowUI> theme={officeTheme} rowData={fights} columnDefs={FIGHT_COLS} defaultColDef={{ ...base, floatingFilter: true }} autoSizeStrategy={AUTOSIZE} />)}
      {/*
        Birds is the one tab that stacks two grids (round 37): the flock on top,
        and — once a row is clicked — that bird's fight history underneath. It
        can't go through `pane` because of the second grid, but it keeps the same
        display:none trick, so the flock grid stays mounted and its sort, filters
        and the open bird all survive a trip to another tab and back.
      */}
      <div style={{ display: tab === "Birds" ? "block" : "none" }}>
        {/* The flock gives up height when the history opens, so both fit on one screen. */}
        <div style={{ height: selectedBird ? 420 : 640 }}>
          <AgGridReact<BirdRowUI>
            theme={officeTheme}
            rowData={birds}
            columnDefs={BIRD_COLS}
            defaultColDef={{ ...base, floatingFilter: true }}
            rowHeight={38}
            autoSizeStrategy={AUTOSIZE}
            onRowClicked={(e) =>
              setOpenBird((cur) => (cur === e.data?.id ? null : e.data?.id ?? null))
            }
            getRowStyle={(p) =>
              p.data && p.data.id === openBird ? { background: "#33291a" } : undefined
            }
          />
        </div>
        {selectedBird ? (
          <div style={{ marginTop: "1rem" }}>
            <h3 style={{ margin: "0 0 .5rem", fontSize: ".95rem" }}>
              <b className="grade" style={{ color: gradeColor(selectedBird.grade) }}>
                {selectedBird.grade}
              </b>{" "}
              {selectedBird.name}{" "}
              <span className="world">
                {selectedBird.farm} · {selectedBird.wins}-{selectedBird.losses}
              </span>{" "}
              {/* Clicking the row again closes it too — this is the affordance
                  for anyone who doesn't guess that. */}
              <button
                onClick={() => setOpenBird(null)}
                style={{
                  font: "inherit",
                  fontSize: ".8em",
                  cursor: "pointer",
                  color: "#9a8f78",
                  background: "transparent",
                  border: "1px solid #3a342a",
                  borderRadius: 4,
                  padding: ".1rem .5rem",
                  marginLeft: ".4rem",
                }}
              >
                close ✕
              </button>
            </h3>
            {selectedFights.length === 0 ? (
              // An empty grid reads as a loading bug. Say the plain thing instead:
              // most birds on this list are eggs, chicks, or simply unmatched.
              <p className="world">
                {selectedBird.name} has never been in the pit — no fight history yet.
              </p>
            ) : (
              <div style={{ height: 300 }}>
                <AgGridReact<BirdFightRowUI>
                  theme={officeTheme}
                  rowData={selectedFights}
                  columnDefs={BIRD_FIGHT_COLS}
                  defaultColDef={base}
                  autoSizeStrategy={AUTOSIZE}
                />
              </div>
            )}
          </div>
        ) : null}
      </div>
      {pane("Breeding", 640, <AgGridReact<BreedingRowUI> theme={officeTheme} rowData={breeding} columnDefs={BREEDING_COLS} defaultColDef={{ ...base, floatingFilter: true }} autoSizeStrategy={AUTOSIZE} />)}
      {pane("Gacha", 640, <AgGridReact<GachaRowUI> theme={officeTheme} rowData={gacha} columnDefs={GACHA_COLS} defaultColDef={{ ...base, floatingFilter: true }} autoSizeStrategy={AUTOSIZE} />)}
      {pane("GP", 640, <AgGridReact<GpRowUI> theme={officeTheme} rowData={gp} columnDefs={GP_COLS} defaultColDef={{ ...base, floatingFilter: true }} autoSizeStrategy={AUTOSIZE} />)}
      {/* Staking leads with the world's two totals, then the farm-by-farm book. */}
      <div style={{ display: tab === "Staking" ? "block" : "none" }}>
        {stakingSummary}
        <div style={{ height: 420 }}>
          <AgGridReact<StakingRowUI> theme={officeTheme} rowData={staking} columnDefs={STAKING_COLS} defaultColDef={base} autoSizeStrategy={AUTOSIZE} />
        </div>
      </div>
      {pane("The Ledger", 640, <AgGridReact<LedgerRowUI> theme={officeTheme} rowData={ledger} columnDefs={LEDGER_COLS} defaultColDef={{ ...base, floatingFilter: true }} autoSizeStrategy={AUTOSIZE} />)}
      <div style={{ display: tab === "The Card" ? "block" : "none" }}>{card}</div>
      <div style={{ display: tab === "🏆 The Pintakasi" ? "block" : "none" }}>{pintakasi}</div>
    </section>
  );
}
