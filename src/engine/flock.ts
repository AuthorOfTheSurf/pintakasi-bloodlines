import { count, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db/client";
import { battleLog, birds, type BirdRow } from "@/db/schema";
import { weatherOfDay, type Element, type FightFormat, type StatName } from "./config";
import { overallGradeOf, type Grade } from "./grades";
import { emit } from "./events";
import { GameClock } from "./game-clock";
import { nameTaken } from "./naming";
import { ageOf, canManualRetire, isEggAge, mustRetire } from "./lifecycle";

/**
 * A bird as the player sees it: row + derived age and display fields.
 *
 * THE FOG (round 28, Zane's ruling): the six fighting stats are `null`
 * while the bird can still fight — egg or active — and REVEALED only at
 * retirement, whatever ended the career (manual, hardcore loss, the age
 * cap). While a bird is live, the only read on it is its figures; that is
 * what makes discovery the game instead of a slogan. Stars, element,
 * carriage, sex (post-hatch), age and the record stay visible — they are
 * the card, not the sheet. Combat is untouched: the engine fights on raw
 * DB rows (lobbies.ts toCombatant), never on this view.
 *
 * ONE EXCEPTION, RULED IMMEDIATELY AFTER (Zane): `overallGrade` is ALWAYS
 * public. It says how strong the bird is, never how to use it — the six-stat
 * average can't tell a B+ sprinter from a B+ stayer, so it hints at power
 * without giving away the shape, which is the thing discovery is for. It also
 * gives a fresh hatch something to be excited about on day one, and gives the
 * claiming ring an honest read on a bird whose figures don't exist yet.
 */
export interface BirdView
  extends Omit<BirdRow, "sex" | StatName>,
    Record<StatName, number | null> {
  overallGrade: Grade; // the six-stat average as a letter — public even under the fog
  // `generation` rides in from BirdRow untouched, and deliberately so (round
  // 30): it is PEDIGREE, not shape. Knowing a chick is the fourth nest down a
  // line says nothing about which blade suits it, so the fog has no reason to
  // hide it — and it is exactly the sort of thing a barn brags about.
  sex: "male" | "female" | "hidden"; // hidden while an egg — revealed at hatch
  sexLabel: "rooster" | "hen" | null; // the sabong layer over male/female
  age: number; // eggs clamp to 0 (a pregnancy's derived age is negative)
  stars: string; // e.g. "1.5★ Metal" — 0★ still resolves to a type
  // The nest timeline (round 13): a cover makes the hen pregnant NOW; the
  // egg is LAID on the nearest Friday and hatches the Friday after.
  eggStage: "gestating" | "laid" | null; // null once hatched
}

/**
 * ── THE FORM BOOK — one past fight, with the day's weather on it ────────────
 *
 * The daily Element weather (round 24) leaks into the discovery signal: a
 * bird fighting under its own ascendant element carries WEATHER.EDGE scaled
 * by its stars (× halfStars/10, since the 2026-08-04 stars rework) on every
 * turn roll, which lifts its Pit Figure by a couple of points on average.
 * That is deliberately small for ordinary star levels — inside the
 * ±FIGURE.NOISE fog — but it is SYSTEMATIC and one-directional, so a form
 * line read without it slowly over-types a bird that happened to draw good
 * days. (A 0★ bird's `edge` flags are vacuous now; kept because the fog
 * discipline of reading them costs nothing and stars change at breeding.)
 *
 * Nothing is stored: `battleLog.dayIndex` plus the pure `weatherOfDay` is
 * enough to recover the ascendant element of any fight ever run, back to day
 * 0 and for worlds that were seeded before the weather existed.
 */
export interface FormLine {
  dayIndex: number;
  format: FightFormat;
  result: "win" | "loss";
  pitFigure: number;
  ascendant: Element; // the day's weather — the same for every fight on that card
  edge: boolean; // the bird's OWN element was ascendant: read this figure down a touch
}

/**
 * A bird's form lines plus the one comparison that decorrelates weather from
 * ability: the same bird's average figure on its days versus everyone else's.
 * A gap of roughly a band means "good days", not "good bird" — the split is
 * the whole point of carrying the element on the line at all.
 */
export interface FormBook {
  element: Element; // the bird's own element, so a line's `edge` reads without a lookup
  lines: FormLine[]; // oldest first — a career reads forward
  onEdge: { fights: number; avgFigure: number } | null; // null until it has fought one
  offEdge: { fights: number; avgFigure: number } | null;
}

export interface HatchFridayEvents {
  weekIndex: number;
  hatched: BirdView[]; // eggs that became age-1 chicks (name them!)
  forceRetired: BirdView[]; // birds that hit the fighting cap
}

export class Flock {
  constructor(
    private database: DB,
    private farmId: string
  ) {}

  private currentWeek(): number {
    return GameClock.weekOf(new GameClock(this.database).currentDay());
  }

  view(row: BirdRow, currentWeek = this.currentWeek()): BirdView {
    const isEgg = row.status === "egg";
    // The sheet reveals at retirement — same doctrine as the egg's sex:
    // decided long ago, but the surprise belongs to the moment.
    const revealed = row.status === "retired";
    return {
      ...row,
      agility: revealed ? row.agility : null,
      sight: revealed ? row.sight : null,
      stamina: revealed ? row.stamina : null,
      gameness: revealed ? row.gameness : null,
      station: revealed ? row.station : null,
      condition: revealed ? row.condition : null,
      // Power, always; shape, never (until retirement). See the doctrine above.
      overallGrade: overallGradeOf(
        row.agility + row.sight + row.stamina + row.gameness + row.station + row.condition
      ),
      // The 50-50 is decided at breeding, but the surprise belongs to hatch day.
      sex: isEgg ? "hidden" : row.sex,
      sexLabel: isEgg ? null : row.sex === "male" ? "rooster" : "hen",
      age: isEgg ? Math.max(0, ageOf(row, currentWeek)) : ageOf(row, currentWeek),
      stars: `${row.halfStars / 2}★ ${row.element}`,
      eggStage: isEgg ? (row.birthWeek > currentWeek ? "gestating" : "laid") : null,
    };
  }

  all(): BirdView[] {
    const week = this.currentWeek();
    return this.database
      .select()
      .from(birds)
      .where(eq(birds.farmId, this.farmId))
      .all()
      .map((row) => this.view(row, week));
  }

  byId(id: string): BirdView {
    const row = this.database.select().from(birds).where(eq(birds.id, id)).get();
    if (!row || row.farmId !== this.farmId) throw new Error(`No bird with id ${id} in your barn`);
    return this.view(row);
  }

  /**
   * The weather half of the discovery readout — see FormBook above. Pairs
   * with Lobbies.formatRecords(), which answers "which blade suits it"; this
   * answers "and how much of that was the day".
   *
   * Deliberately NOT farm-scoped, unlike byId(): claimer fields are the one
   * un-fogged class, and a bird you are about to claim is exactly the one
   * whose figures you most need to read honestly.
   */
  formBook(birdId: string): FormBook {
    const bird = this.database.select().from(birds).where(eq(birds.id, birdId)).get();
    if (!bird) throw new Error(`No bird with id ${birdId}`);
    const lines: FormLine[] = this.database
      .select()
      .from(battleLog)
      .where(eq(battleLog.birdId, birdId))
      .all()
      .map((row) => {
        const ascendant = weatherOfDay(row.dayIndex);
        return {
          dayIndex: row.dayIndex,
          format: row.format,
          result: row.result,
          pitFigure: row.pitFigure,
          ascendant,
          edge: ascendant === bird.element,
        };
      })
      .sort((a, b) => a.dayIndex - b.dayIndex);

    const mean = (of: FormLine[]) =>
      of.length === 0
        ? null
        : { fights: of.length, avgFigure: Math.round(of.reduce((s, l) => s + l.pitFigure, 0) / of.length) };
    return {
      element: bird.element,
      lines,
      onEdge: mean(lines.filter((l) => l.edge)),
      offEdge: mean(lines.filter((l) => !l.edge)),
    };
  }

  /**
   * Player-given names — eggs keep their auto-name until hatched + renamed.
   * Renaming satisfies the naming law (round 14): a bird cannot enter its
   * first fight while still wearing an auto-name.
   */
  rename(id: string, name: string): BirdView {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Name cannot be empty");
    if (nameTaken(this.database, trimmed, id))
      throw new Error(`The name "${trimmed}" is taken — bird names are unique across the world`);
    this.database.update(birds).set({ name: trimmed, named: 1 }).where(eq(birds.id, id)).run();
    return this.byId(id);
  }

  /**
   * Eggs count toward the barn — capacity is checked at breeding time.
   *
   * ⚠ A `COUNT(*)`, NOT `.all().length` (round 43). This sits on the breeding hot
   * path — `Breeding.breed` calls it per cover, not just the UI — so materialising
   * every row of a barn to discard all but its length was paid hundreds of times a
   * day. `ix_birds_farm_status` covers the farm side.
   */
  barnCount(): number {
    return (
      this.database
        .select({ n: count() })
        .from(birds)
        .where(eq(birds.farmId, this.farmId))
        .get()?.n ?? 0
    );
  }

  /**
   * Hatch Friday. Ages advance implicitly (derived from birthWeek), so this
   * only processes the state changes: eggs reaching age 1 hatch into chicks,
   * active birds reaching the cap force-retire. The WORLD hatches together —
   * every farm's birds are processed; the returned events are OWN-farm only.
   */
  processHatchFriday(weekIndex: number): HatchFridayEvents {
    const events: HatchFridayEvents = { weekIndex, hatched: [], forceRetired: [] };
    // ⚠ NARROWED TO EGGS AND ACTIVE BIRDS (round 43), and this is provably
    // equivalent rather than a shortcut: the loop below has exactly two branches,
    // one for `status === "egg"` and one for `status === "active"`, and nothing
    // ever transitions OUT of `retired`. So a retired bird was read, aged, and
    // matched against both branches every single week to do nothing.
    //
    // It matters more the longer a world runs. Retired birds never leave the barn
    // (the only outflow is being claimed away), so they become the MAJORITY of the
    // table — 43-70% of a full barn at day 91, and rising — which made this
    // world-wide weekly scan grow without bound in the one direction round 43
    // doubles. `ix_birds_status` covers it.
    for (const row of this.database
      .select()
      .from(birds)
      .where(inArray(birds.status, ["egg", "active"]))
      .all()) {
      const mine = row.farmId === this.farmId;
      const age = ageOf(row, weekIndex);
      if (row.status === "egg" && !isEggAge(age)) {
        this.database.update(birds).set({ status: "active" }).where(eq(birds.id, row.id)).run();
        emit(this.database, {
          type: "hatch",
          farmId: row.farmId,
          birdId: row.id,
          message: `${row.name} hatched — a ${row.sex === "male" ? "rooster" : "hen"}, ${row.halfStars / 2}★ ${row.element}`,
        });
        if (mine) events.hatched.push(this.view({ ...row, status: "active" }, weekIndex));
      } else if (row.status === "active" && mustRetire(age)) {
        this.database
          .update(birds)
          .set({ status: "retired", retiredBy: "age", retiredWeek: weekIndex })
          .where(eq(birds.id, row.id))
          .run();
        emit(this.database, {
          type: "retire",
          farmId: row.farmId,
          birdId: row.id,
          // Retirement is the reveal (round 28): the sheet goes public the
          // moment the career ends, and the event says so.
          message: `${row.name} reached the age cap — retired to the barn (${row.wins}–${row.losses}). The sheet is public: ${overallGradeOf(row.agility + row.sight + row.stamina + row.gameness + row.station + row.condition)} overall.`,
          data: { by: "age" },
        });
        if (mine)
          events.forceRetired.push(
            this.view({ ...row, status: "retired", retiredBy: "age", retiredWeek: weekIndex }, weekIndex)
          );
      }
    }
    return events;
  }

  /** Manual retirement — the safe arm of the age-3 fork. */
  retire(id: string): BirdView {
    const bird = this.byId(id);
    if (bird.status !== "active") throw new Error(`${bird.name} is not an active fighter`);
    if (!canManualRetire(bird.age))
      throw new Error(`${bird.name} is ${bird.age} — retirement unlocks at 3`);
    const week = this.currentWeek();
    // The view is fogged, so the reveal reads from the raw row (round 28).
    const row = this.database.select().from(birds).where(eq(birds.id, id)).get()!;
    const total = row.agility + row.sight + row.stamina + row.gameness + row.station + row.condition;
    this.database
      .update(birds)
      .set({ status: "retired", retiredBy: "manual", retiredWeek: week })
      .where(eq(birds.id, id))
      .run();
    emit(this.database, {
      type: "retire",
      farmId: this.farmId,
      birdId: id,
      message: `${bird.name} retired to the barn at ${bird.age} (${bird.wins}–${bird.losses}). The sheet is public: ${overallGradeOf(total)} overall.`,
      data: { by: "manual" },
    });
    return this.byId(id);
  }

  // NOTE: there is deliberately NO train() — stats are fixed at birth
  // (ruled 2026-08-03 round 13). Discovery = fighting the formats.

  /** Force-retire from a hardcore loss — the key rule's teeth. */
  hardcoreRetire(id: string): BirdView {
    const week = this.currentWeek();
    this.database
      .update(birds)
      .set({ status: "retired", retiredBy: "hardcore", retiredWeek: week })
      .where(eq(birds.id, id))
      .run();
    return this.byId(id);
  }
}
