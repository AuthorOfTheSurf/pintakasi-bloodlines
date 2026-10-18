import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { farms } from "@/db/schema";
import { seedStarterFlock } from "@/db/seed-data";
import { FARM_COLORS } from "./config";
import { Farms, readWorldState } from "./farms";
import { withActor } from "./actor";
import { GameClock } from "./game-clock";
import { freshSeed } from "./rng";

/**
 * LATECOMERS (simulate --latecomers). The alpha world will take real players
 * weeks after launch, and the owner's question is whether a stable that joins
 * late can catch the ones that started on day 0. So the simulator can admit
 * one new stable on every Hatch Friday after genesis, and the doctor's
 * COHORTS block compares each one, at the same age, with the stables that
 * were there from the start.
 *
 * A latecomer is a PLAYER farm, not a bot: auto-play runs it exactly as it
 * runs the genesis dev farm, so the dev farm is the control (same strategy,
 * joined on day 0) and the only difference left is the world each one was
 * born into. It joins through the alpha's own path (Farms.register, then the
 * starter eggs), so it gets the normal stake and eggs that hatch next Friday.
 *
 * Off unless the flag is passed: a world without it is the one every
 * identity check and balance number before this round was measured on.
 */

/** Gamefarm-style names, one per joining week, in order. */
const LATECOMER_NAMES = [
  "Antipolo Pula Gamefarm",
  "Bacolod Bulik Breeders",
  "Cebu Hatchmark Farm",
  "Davao Durian Gamefowl",
  "Iloilo Talahib Stables",
  "Pampanga Sagu Farm",
  "Tarlac Talisayin Lines",
  "Zambales Hulma Breeders",
  "Quezon Kalaw Gamefarm",
  "Leyte Lasak Stables",
  "Samar Sigbin Farm",
  "Negros Ginto Lines",
  "Bohol Bagwis Gamefarm",
  "Palawan Pugad Farm",
  "Ilocos Ibon Breeders",
  "Isabela Sinag Gamefowl",
  "Nueva Ecija Uhay Farm",
  "Marinduque Moriones Stables",
  "Romblon Marmol Gamefarm",
  "Aklan Ati Breeders",
  "Capiz Kapis Lines",
  "Masbate Rodeo Gamefarm",
  "Sorsogon Butanding Farm",
  "Surigao Alon Stables",
  "Benguet Pino Breeders",
  "Abra Tingguian Gamefarm",
] as const;

/** The farm id a week's latecomer gets. Fixed, so a seeded world replays. */
export function latecomerId(week: number): string {
  return `latecomer-wk${String(week).padStart(2, "0")}`;
}

/** A name past the list's end repeats it with the joining week, so it stays unique. */
function latecomerName(week: number): string {
  const base = LATECOMER_NAMES[(week - 1) % LATECOMER_NAMES.length];
  return week <= LATECOMER_NAMES.length ? base : `${base} (wk ${week})`;
}

/**
 * Admit today's latecomer, if today is a Hatch Friday after genesis and none
 * has joined yet. Returns the new farm's id, or null when there is nothing to
 * do. Running it twice on one day admits one farm, so a `--keep` run that
 * resumes on a Friday does not double up.
 */
export function admitLatecomer(db: DB): string | null {
  const day = readWorldState(db).dayIndex;
  // Day 0 is the genesis hatch: everyone joining then is not late.
  if (day === 0 || !GameClock.isFriday(day)) return null;
  const week = GameClock.weekOf(day);
  const id = latecomerId(week);
  if (db.select({ id: farms.id }).from(farms).where(eq(farms.id, id)).get()) return null;

  // Colors walk the palette so neighbouring weeks never share a pair.
  const primary = FARM_COLORS[week % FARM_COLORS.length];
  const secondary = FARM_COLORS[(week + FARM_COLORS.length / 2) % FARM_COLORS.length];
  // One transaction, as in the alpha's approve: a farm without its eggs
  // would be a stable with nothing to play.
  // A steward's act in a live world (approving an application); the sim
  // admits latecomers on the stewards' behalf.
  db.transaction(() =>
    withActor(db, { kind: "steward" }, () => {
      new Farms(db).register(
        {
          name: latecomerName(week),
          country: "🇵🇭",
          primaryColor: primary,
          secondaryColor: secondary,
        },
        { id }
      );
      seedStarterFlock(db, id, { seed: freshSeed() });
    })
  );
  return id;
}
