import { and, gte, isNull, lt, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { battleLog } from "@/db/schema";
import { CLAIMER, FIGURE, PAR, type FightMode, type Lobby } from "./config";
import type { Grade } from "./grades";

/**
 * THE CLASS PARS — the typical winning Pit Figure at every class rung, posted
 * for everyone (see config PAR for the ruling and the knobs).
 *
 * A rung is a division, a class and, for claimers, a tag. The blade is not part
 * of it: a figure reads the same at every blade by construction, and pooling
 * the five blades gives each rung five times the winners to take a median of.
 */
export type ClassRung = { mode: FightMode; classType: Lobby; price?: number | null };

export interface ParBook {
  /** The par a lobby on this rung shows, measured or estimated; null before any open par exists. */
  par(rung: ClassRung): number | null;
  /**
   * What a bird of this public overall grade typically posts: the median
   * figure, wins and losses, of every daily-card fight its grade fought in the
   * window. The whole field's median when the grade is thin; null with no
   * fights at all. The game value starts an unproven bird here.
   */
  prior(grade: Grade): number | null;
  /**
   * The rung's LEVEL: the median figure of everyone who fought there in the
   * window, wins and losses — the form an even-money bird brings to that
   * class. Not printed on the board (the par is the public headline); the game
   * value reads it, because how far an average figure must sit under the par
   * to be even money depends on how spread out the class's field is. Null on a
   * thin rung.
   */
  level(rung: ClassRung): number | null;
}

// Loose on `mode` because battle_log rows still carry the retired hardcore mode.
const keyOf = (r: { mode: string; classType: Lobby; price?: number | null }) =>
  `${r.mode}|${r.classType}|${r.price ?? ""}`;

/**
 * ONE BOOK PER WORLD PER DAY, keyed on the day alone. The window ends at
 * yesterday, and a day's fights all carry today's day index, so nothing the
 * day does can move today's pars: the book is fixed from the morning on. Not
 * keyed on the scout's book version, which bumps on every recorded fight —
 * that would rebuild the book once per fight through the whole tick. Keyed by
 * the DB handle, like bookVersion, so parallel test worlds never share one.
 */
const memo = new WeakMap<object, { day: number; book: ParBook }>();

/**
 * A fight was just recorded on `day`. A book for any LATER day was read before
 * that fight existed — the tick turns the day and then resolves yesterday's
 * card, and anything that read the new day's pars in between (Hatch Friday's
 * bird views, for one) would otherwise keep a window short a whole day.
 */
export function forgetBooksAfter(db: DB, day: number): void {
  const hit = memo.get(db);
  if (hit && hit.day > day) memo.delete(db);
}

export function parBook(db: DB, today: number): ParBook {
  const hit = memo.get(db);
  if (hit && hit.day === today) return hit.book;
  const { pars, priors } = measuredPars(db, today);
  const book = buildParBook(pars, priors);
  memo.set(db, { day: today, book });
  return book;
}

/**
 * The median winning figure per rung over the window, and the median of every
 * grown figure (the field). Figures are posted in bands of FIGURE.BAND, so a
 * raw median would only ever move in whole bands; the grouped median
 * interpolates inside the median's band, which turns a field getting a little
 * weaker into a par that drops a little instead of not at all. One grouped
 * query: a few hundred rows however long the world has run.
 */
function measuredPars(
  db: DB,
  today: number
): { pars: Map<string, number>; priors: Map<string, number> } {
  const rows = db
    .select({
      mode: battleLog.mode,
      classType: battleLog.lobby,
      price: battleLog.claimPrice,
      result: battleLog.result,
      grade: battleLog.selfGrade,
      figure: battleLog.pitFigure,
      n: sql<number>`count(*)`,
    })
    .from(battleLog)
    .where(
      and(
        gte(battleLog.dayIndex, today - PAR.WINDOW_DAYS),
        lt(battleLog.dayIndex, today),
        isNull(battleLog.tournamentId)
      )
    )
    .groupBy(
      battleLog.mode,
      battleLog.lobby,
      battleLog.claimPrice,
      battleLog.result,
      battleLog.selfGrade,
      battleLog.pitFigure
    )
    .orderBy(battleLog.pitFigure)
    .all();
  const bins = new Map<string, { figure: number; n: number }[]>();
  const add = (key: string, figure: number, n: number) => {
    const list = bins.get(key) ?? [];
    const last = list[list.length - 1];
    if (last && last.figure === figure) last.n += n;
    else list.push({ figure, n });
    bins.set(key, list);
  };
  for (const r of rows) {
    if (r.result === "win") add(keyOf(r), r.figure, r.n);
    add(`${LEVEL}${keyOf(r)}`, r.figure, r.n);
    add(`${GRADE}${r.grade}`, r.figure, r.n);
    add(GRADE, r.figure, r.n);
  }
  const pars = new Map<string, number>();
  const priors = new Map<string, number>();
  for (const [key, list] of bins) {
    const total = list.reduce((s, b) => s + b.n, 0);
    if (total < PAR.MIN_WINS) continue;
    if (key.startsWith(GRADE)) priors.set(key, groupedMedian(list, total));
    else pars.set(key, groupedMedian(list, total));
  }
  return { pars, priors };
}
// The priors' keys: GRADE alone is the whole field, GRADE + a letter one grade.
// LEVEL + a rung's key is that rung's every-runner median (see ParBook.level).
const GRADE = "grade:";
const LEVEL = "level:";

/** Bins arrive sorted by figure. Each bin spans ±BAND/2 around its figure. */
function groupedMedian(bins: { figure: number; n: number }[], total: number): number {
  const half = total / 2;
  let below = 0;
  for (const b of bins) {
    if (below + b.n >= half) {
      const value = b.figure - FIGURE.BAND / 2 + ((half - below) / b.n) * FIGURE.BAND;
      return Math.round(value * 10) / 10;
    }
    below += b.n;
  }
  throw new Error("groupedMedian: the bins sum to less than their own total");
}

/** Measured pars plus the estimates for thin rungs (see PAR.RUNG_STEP). */
export function buildParBook(
  measured: ReadonlyMap<string, number>,
  priors: ReadonlyMap<string, number> = new Map()
): ParBook {
  return {
    level(rung) {
      return measured.get(`${LEVEL}${keyOf(rung)}`) ?? null;
    },
    prior(grade) {
      return priors.get(`${GRADE}${grade}`) ?? priors.get(GRADE) ?? null;
    },
    par(rung) {
      const exact = measured.get(keyOf(rung));
      if (exact !== undefined) return exact;
      const open = measured.get(keyOf({ mode: rung.mode, classType: "open" })) ?? null;
      if (rung.classType !== "claimer") return open;
      // Chained down from the next dearer rung, not counted down from the open:
      // when the dear tag's field has already gone soft, a thin cheap tag must
      // not read as HARDER than it, or the estimate sends every bird up the
      // ladder and the cheap tags never fill to get a par of their own.
      const index = CLAIMER.PRICES.indexOf(rung.price as (typeof CLAIMER.PRICES)[number]);
      const dearer =
        index + 1 < CLAIMER.PRICES.length
          ? this.par({ mode: rung.mode, classType: "claimer", price: CLAIMER.PRICES[index + 1] })
          : open;
      return dearer === null ? null : dearer - PAR.RUNG_STEP;
    },
  };
}
