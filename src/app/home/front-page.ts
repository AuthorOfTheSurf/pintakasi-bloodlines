import { and, count, desc, eq, inArray, isNotNull, max } from "drizzle-orm";
import type { DB } from "@/db/client";
import { battleLog, birds, gameState, tournamentEntries, tournaments } from "@/db/schema";
import { FORMATS, type FightFormat } from "@/engine/config";
import { replayFight } from "@/engine/replay";
import { exhibitionBout, goodShow, type WatchableReplay } from "./exhibition";

/**
 * ── WHAT THE FRONT PAGE READS FROM THE WORLD ───────────────────────────────
 *
 * Every query here is bounded: a LIMIT, an indexed WHERE, or an aggregate
 * SQLite answers off an index. The Stewards' Office once took 17 s on a
 * 330k-row world because it loaded whole tables to show a few numbers, and
 * this page is the one a stranger loads first.
 *
 * Every field can be empty. A freshly seeded world has birds but no fights,
 * no Majors and no bred chicks, and the page has to read well on it.
 */

/** A bird as the page draws it: a sprite, a name, and only public facts. */
export interface ShownBird {
  id: string;
  name: string;
  sex: "male" | "female";
  baseCoat: string;
  trimColor: string;
  generation: number;
  wins: number;
  losses: number;
  status: "egg" | "active" | "retired";
}

export interface FeaturedFight {
  /** Where the fight came from, in words: "The final of the B3 Major, week 25". */
  caption: string;
  replay: WatchableReplay;
}

export interface Lineage {
  /** What the bird is, on its card: "Champion" or "Fighting today". */
  role: string;
  /** Why this bird is the one shown: "Won the B2 Major in week 25". */
  claim: string;
  bird: ShownBird;
  dam: ShownBird | null;
  sire: ShownBird | null;
}

export interface FrontPage {
  dayIndex: number;
  activeBirds: number;
  fightsFought: number;
  majorsRun: number;
  deepestGeneration: number;
  parade: ShownBird[];
  /** Always a fight: a real one when the world has a good one, else the exhibition. */
  featured: FeaturedFight;
  lineage: Lineage | null;
}

const SHOWN = {
  id: birds.id,
  name: birds.name,
  sex: birds.sex,
  baseCoat: birds.baseCoat,
  trimColor: birds.trimColor,
  generation: birds.generation,
  wins: birds.wins,
  losses: birds.losses,
  status: birds.status,
} as const;

const PARADE_SIZE = 8;
// How many recent Majors to try before settling for a close daily-card fight.
// A Major fought under an older engine replays as drifted, and drifted fights
// are never animated, so the page walks back until one replays clean.
const MAJORS_TO_TRY = 6;
const CLOSE_FIGHTS_TO_TRY = 8;
// The tail of the battle log the close-fight fallback reads. Read by rowid,
// newest first, so it costs the same on any size of world.
const RECENT_ROWS = 400;

export function loadFrontPage(d: DB): FrontPage {
  const dayIndex = d.select({ v: gameState.dayIndex }).from(gameState).get()?.v ?? 0;
  const activeBirds =
    d.select({ n: count() }).from(birds).where(eq(birds.status, "active")).get()?.n ?? 0;
  // Every fight writes two mirrored rows, one per bird.
  const fightsFought = Math.floor((d.select({ n: count() }).from(battleLog).get()?.n ?? 0) / 2);
  const majorsRun =
    d
      .select({ n: count() })
      .from(tournaments)
      .where(and(eq(tournaments.division, "major"), eq(tournaments.status, "completed")))
      .get()?.n ?? 0;
  const deepestGeneration =
    d
      .select({ g: max(birds.generation) })
      .from(birds)
      .get()?.g ?? 0;

  const recentMajors = d
    .select({
      id: tournaments.id,
      format: tournaments.format,
      weekIndex: tournaments.weekIndex,
    })
    .from(tournaments)
    .where(and(eq(tournaments.division, "major"), eq(tournaments.status, "completed")))
    .orderBy(desc(tournaments.dayResolved), desc(tournaments.id))
    .limit(MAJORS_TO_TRY)
    .all();

  return {
    dayIndex,
    activeBirds,
    fightsFought,
    majorsRun,
    deepestGeneration,
    parade: parade(d),
    featured: majorFinal(d, recentMajors) ??
      closeFight(d) ?? {
        caption:
          "An exhibition bout between two demo birds, fought by the same engine as every real fight",
        replay: exhibitionBout(),
      },
    lineage: lineage(d, recentMajors),
  };
}

type MajorRow = { id: number; format: FightFormat; weekIndex: number };

const majorName = (m: MajorRow) => `${FORMATS[m.format].label} Major`;

/**
 * The best birds fighting right now, by career wins, one per look. Eight
 * copies of the same brown rooster would say less than eight different birds.
 * A fresh world has nothing hatched yet, so it shows its eggs instead.
 */
function parade(d: DB): ShownBird[] {
  const fighters = pickLooks(top(d, "active"));
  return fighters.length > 0 ? fighters : pickLooks(top(d, "egg"));
}

function top(d: DB, status: "active" | "egg"): ShownBird[] {
  return d
    .select(SHOWN)
    .from(birds)
    .where(and(eq(birds.status, status), eq(birds.named, 1)))
    .orderBy(desc(birds.wins), birds.id)
    .limit(PARADE_SIZE * 6)
    .all();
}

function pickLooks(candidates: ShownBird[]): ShownBird[] {
  const seen = new Set<string>();
  const shown: ShownBird[] = [];
  for (const b of candidates) {
    // An egg shows only its shell, and a fresh world's starters share three
    // shells between them, so eggs are not thinned by look.
    const look = b.status === "egg" ? b.id : `${b.sex}/${b.baseCoat}/${b.trimColor}`;
    if (seen.has(look)) continue;
    seen.add(look);
    shown.push(b);
    if (shown.length === PARADE_SIZE) break;
  }
  return shown;
}

function watchable(d: DB, logId: number): WatchableReplay | null {
  const replay = replayFight(d, logId);
  return replay && !replay.drifted ? replay : null;
}

/** The last bout of the newest Major that still replays clean. */
function majorFinal(d: DB, majors: MajorRow[]): FeaturedFight | null {
  for (const m of majors) {
    const final = d
      .select({ id: battleLog.id })
      .from(battleLog)
      .where(eq(battleLog.tournamentId, m.id))
      .orderBy(desc(battleLog.id))
      .limit(1)
      .get();
    if (!final) continue;
    const replay = watchable(d, final.id);
    if (replay)
      return {
        caption: `The final of the ${majorName(m)}, week ${m.weekIndex}`,
        replay,
      };
  }
  return null;
}

/**
 * No Major yet (or none that replays clean): the closest recent fight on the
 * daily card, judged by how near the two Pit Figures finished.
 */
function closeFight(d: DB): FeaturedFight | null {
  const rows = d
    .select({
      id: battleLog.id,
      dayIndex: battleLog.dayIndex,
      seed: battleLog.seed,
      side: battleLog.side,
      pitFigure: battleLog.pitFigure,
      format: battleLog.format,
    })
    .from(battleLog)
    .where(eq(battleLog.mode, "real"))
    .orderBy(desc(battleLog.id))
    .limit(RECENT_ROWS)
    .all();
  const bouts = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.dayIndex}:${r.seed}`;
    bouts.set(key, [...(bouts.get(key) ?? []), r]);
  }
  const ranked = [...bouts.values()]
    .filter((pair) => pair.length === 2)
    .map((pair) => ({
      sideA: pair.find((r) => r.side === 0) ?? pair[0],
      gap: Math.abs(pair[0].pitFigure - pair[1].pitFigure),
    }))
    .sort((x, y) => x.gap - y.gap)
    .slice(0, CLOSE_FIGHTS_TO_TRY);
  for (const { sideA } of ranked) {
    const replay = watchable(d, sideA.id);
    // A Major final is worth showing however it went. A daily-card fight has
    // to earn the slot over the exhibition by being a good one.
    if (replay && goodShow(replay.timeline))
      return {
        caption: `A close ${FORMATS[sideA.format].label} fight from day ${sideA.dayIndex}`,
        replay,
      };
  }
  return null;
}

/**
 * A recent Major champion and the two birds that made it. Prefers a bred
 * champion, because a gacha bird has no parents to show.
 */
function lineage(d: DB, majors: MajorRow[]): Lineage | null {
  if (majors.length === 0) return bredFallback(d);
  const champs = d
    .select({ birdId: tournamentEntries.birdId, tournamentId: tournamentEntries.tournamentId })
    .from(tournamentEntries)
    .where(
      and(
        inArray(
          tournamentEntries.tournamentId,
          majors.map((m) => m.id)
        ),
        eq(tournamentEntries.status, "champion")
      )
    )
    .all();
  const champBirds = champs.length
    ? d
        .select({ ...SHOWN, motherId: birds.motherId, fatherId: birds.fatherId })
        .from(birds)
        .where(
          inArray(
            birds.id,
            champs.map((c) => c.birdId)
          )
        )
        .all()
    : [];
  // Walk the Majors newest first, so the pick is stable and recent.
  for (const m of majors) {
    const champ = champs.find((c) => c.tournamentId === m.id);
    const bird = champBirds.find((b) => b.id === champ?.birdId && b.motherId !== null);
    if (bird)
      return withParents(d, bird, "Champion", `Won the ${majorName(m)} in week ${m.weekIndex}`);
  }
  return bredFallback(d);
}

/** No bred Major champion: the deepest-bred bird still fighting, if any. */
function bredFallback(d: DB): Lineage | null {
  const bird = d
    .select({ ...SHOWN, motherId: birds.motherId, fatherId: birds.fatherId })
    .from(birds)
    .where(and(eq(birds.status, "active"), isNotNull(birds.motherId), eq(birds.named, 1)))
    .orderBy(desc(birds.generation), desc(birds.wins))
    .limit(1)
    .get();
  return bird
    ? withParents(d, bird, "Fighting today", "The deepest-bred bird fighting today")
    : null;
}

function withParents(
  d: DB,
  bird: ShownBird & { motherId: string | null; fatherId: string | null },
  role: string,
  claim: string
): Lineage {
  const ids = [bird.motherId, bird.fatherId].filter((id): id is string => id !== null);
  const parents = ids.length ? d.select(SHOWN).from(birds).where(inArray(birds.id, ids)).all() : [];
  const { motherId, fatherId, ...shown } = bird;
  return {
    role,
    claim,
    bird: shown,
    dam: parents.find((p) => p.id === motherId) ?? null,
    sire: parents.find((p) => p.id === fatherId) ?? null,
  };
}
