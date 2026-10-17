import { farmFightRows, type FarmFightRowUI } from "@/app/admin/bird-fights";
import type { DB } from "@/db/client";
import { AUTO_RESERVE } from "@/engine/auto-play";
import { keyId } from "@/engine/card-key";
import {
  FORMATS,
  STAT_NAMES,
  cardOfDay,
  weatherOfDay,
  type Element,
  type StatName,
} from "@/engine/config";
import { Farms, readWorldState, type FarmView } from "@/engine/farms";
import { Flock, type BirdView } from "@/engine/flock";
import { GameClock, type ClockState } from "@/engine/game-clock";
import { hatchDayOf } from "@/engine/lifecycle";
import { Lobbies, labelOf } from "@/engine/lobbies";
import { tonightFor, type TonightChoice } from "@/engine/tonight";

/**
 * ── WHAT THE FARM PAGE SHIPS — one farm, serialized once per render ───────
 *
 * Built on the server from the engine's own views and handed to the client as
 * props, so nothing the client holds was computed twice. THE FOG HOLDS HERE:
 * the six stats travel only on retired rows, where `BirdView` has already
 * revealed them; a fighting row has no field to carry them in.
 */

/** What every bird row shares: the card, never the sheet. */
interface BirdBase {
  id: string;
  name: string;
  named: boolean;
  grade: BirdView["overallGrade"];
  sex: BirdView["sex"];
  sexLabel: BirdView["sexLabel"];
  age: number;
  generation: number;
  element: Element;
  stars: string;
  halfStars: number;
  carriage: string;
  wins: number;
  losses: number;
  stakesWins: number;
  baseCoat: string;
  trimColor: string;
}

export interface FightingRowUI extends BirdBase {
  /** The last few Pit Figures this barn saw, oldest first. */
  figures: { figure: number; result: "win" | "loss" }[];
  value: number | null;
  /** Where the scout's evidence points, once the bird has fought. */
  bestBlade: string | null;
  tonight: TonightChoice;
}

export type StatLine = Record<StatName, number>;

export interface RetiredRowUI extends BirdBase, StatLine {
  total: number;
  retiredBy: string | null;
  listedStud: boolean;
  studPrice: number | null;
}

export interface EggRowUI {
  id: string;
  name: string;
  stage: "gestating" | "laid";
  hatchDay: number;
  hatchDate: string;
  element: Element;
  stars: string;
  baseCoat: string;
}

export interface FarmPageData {
  farm: FarmView;
  clock: ClockState;
  barn: { count: number; capacity: number; fighting: number; retired: number; eggs: number };
  weather: { today: Element; tomorrow: Element };
  fighting: FightingRowUI[];
  retired: RetiredRowUI[];
  eggs: EggRowUI[];
  results: FarmFightRowUI[]; // newest first
  /** Tonight's card keys by `keyId`, as the board names them. */
  cardLabels: Record<string, string>;
  autoReserve: number;
}

/** How many figures the Fighting grid's sparkline draws. */
const SPARK_FIGHTS = 6;

function base(b: BirdView): BirdBase {
  return {
    id: b.id,
    name: b.name,
    named: b.named === 1,
    grade: b.overallGrade,
    sex: b.sex,
    sexLabel: b.sexLabel,
    age: b.age,
    generation: b.generation,
    element: b.element,
    stars: b.stars,
    halfStars: b.halfStars,
    carriage: b.carriage,
    wins: b.wins,
    losses: b.losses,
    stakesWins: b.stakesWins,
    baseCoat: b.baseCoat,
    trimColor: b.trimColor,
  };
}

/**
 * The revealed sheet, or nothing. A retired bird's stats are never null in
 * `BirdView`, so a null here means the fog is still down and the row must not
 * be built as a retired one.
 */
function sheetOf(b: BirdView): StatLine | null {
  const { agility, sight, stamina, gameness, station, condition } = b;
  if (
    agility === null ||
    sight === null ||
    stamina === null ||
    gameness === null ||
    station === null ||
    condition === null
  )
    return null;
  return { agility, sight, stamina, gameness, station, condition };
}

export function farmPageData(db: DB, farmId: string): FarmPageData {
  const day = readWorldState(db).dayIndex;
  const farmsApi = new Farms(db);
  const flock = new Flock(db, farmId);
  const all = flock.all();
  const results = farmFightRows(db, farmId);

  const recent = new Map<string, FightingRowUI["figures"]>();
  for (const r of results) {
    const line = recent.get(r.birdId) ?? [];
    line.push({ figure: r.figure, result: r.result === "win" ? "win" : "loss" });
    if (line.length > SPARK_FIGHTS) line.shift();
    recent.set(r.birdId, line);
  }

  const active = all.filter((b) => b.status === "active");
  const reports = new Lobbies(db, farmId).scoutReports(active.map((b) => b.id));
  const tonight = new Map(tonightFor(db, farmId).map((t) => [t.birdId, t]));

  const fighting = active.flatMap((b): FightingRowUI[] => {
    const choice = tonight.get(b.id);
    if (!choice) return [];
    const report = reports.get(b.id);
    return [
      {
        ...base(b),
        figures: recent.get(b.id) ?? [],
        value: b.value,
        bestBlade: report && report.totalFights > 0 ? FORMATS[report.bestBlade].label : null,
        tonight: choice,
      },
    ];
  });

  const retired = all.flatMap((b): RetiredRowUI[] => {
    const sheet = b.status === "retired" ? sheetOf(b) : null;
    if (!sheet) return [];
    return [
      {
        ...base(b),
        ...sheet,
        total: STAT_NAMES.reduce((sum, s) => sum + sheet[s], 0),
        retiredBy: b.retiredBy,
        listedStud: b.listedStud === 1,
        studPrice: b.studPrice,
      },
    ];
  });

  const eggs = all.flatMap((b): EggRowUI[] =>
    b.eggStage
      ? [
          {
            id: b.id,
            name: b.name,
            stage: b.eggStage,
            hatchDay: hatchDayOf(b.birthWeek),
            hatchDate: GameClock.dateOf(hatchDayOf(b.birthWeek)),
            element: b.element,
            stars: b.stars,
            baseCoat: b.baseCoat,
          },
        ]
      : []
  );

  return {
    farm: farmsApi.view(farmsApi.rowById(farmId)),
    clock: GameClock.stateOf(day),
    barn: {
      count: flock.barnCount(),
      capacity: flock.capacity(),
      fighting: fighting.length,
      retired: retired.length,
      eggs: eggs.length,
    },
    weather: { today: weatherOfDay(day), tomorrow: weatherOfDay(day + 1) },
    fighting,
    retired,
    eggs,
    results: results.slice().reverse(),
    cardLabels: Object.fromEntries(
      cardOfDay(day).map((k) => [keyId(k), labelOf({ ...k, price: k.price ?? null })])
    ),
    autoReserve: AUTO_RESERVE,
  };
}
