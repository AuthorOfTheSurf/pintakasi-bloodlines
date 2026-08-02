import { and, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { birds, trainingLog, type BirdRow } from "@/db/schema";
import { STATS, TRAINING, type StatName } from "./config";
import { GameClock } from "./game-clock";
import { ageOf, canManualRetire, canTrain, isEggAge, mustRetire, studValue } from "./lifecycle";

/** A bird as the player sees it: row + derived age and display fields. */
export interface BirdView extends BirdRow {
  age: number;
  stars: string; // e.g. "1.5★ Metal" — 0★ still resolves to a type
  studValue: number | null; // only meaningful once retired
}

export interface HatchFridayEvents {
  weekIndex: number;
  hatched: BirdView[]; // eggs that became age-1 chicks (name them!)
  forceRetired: BirdView[]; // birds that hit the fighting cap
}

export class Flock {
  constructor(private database: DB) {}

  private currentWeek(): number {
    return GameClock.weekOf(new GameClock(this.database).currentDay());
  }

  view(row: BirdRow, currentWeek = this.currentWeek()): BirdView {
    return {
      ...row,
      age: ageOf(row, currentWeek),
      stars: `${row.halfStars / 2}★ ${row.element}`,
      studValue: row.status === "retired" ? studValue(row) : null,
    };
  }

  all(): BirdView[] {
    const week = this.currentWeek();
    return this.database
      .select()
      .from(birds)
      .all()
      .map((row) => this.view(row, week));
  }

  byId(id: string): BirdView {
    const row = this.database.select().from(birds).where(eq(birds.id, id)).get();
    if (!row) throw new Error(`No bird with id ${id}`);
    return this.view(row);
  }

  /** Player-given names — eggs keep their auto-name until hatched + renamed. */
  rename(id: string, name: string): BirdView {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Name cannot be empty");
    this.database.update(birds).set({ name: trimmed }).where(eq(birds.id, id)).run();
    return this.byId(id);
  }

  /** Eggs count toward the barn — capacity is checked at breeding time. */
  barnCount(): number {
    return this.database.select().from(birds).all().length;
  }

  /**
   * Hatch Friday. Ages advance implicitly (derived from birthWeek), so this
   * only processes the state changes: eggs reaching age 1 hatch into chicks,
   * active birds reaching the cap force-retire.
   */
  processHatchFriday(weekIndex: number): HatchFridayEvents {
    const events: HatchFridayEvents = { weekIndex, hatched: [], forceRetired: [] };
    for (const row of this.database.select().from(birds).all()) {
      const age = ageOf(row, weekIndex);
      if (row.status === "egg" && !isEggAge(age)) {
        this.database.update(birds).set({ status: "active" }).where(eq(birds.id, row.id)).run();
        events.hatched.push(this.view({ ...row, status: "active" }, weekIndex));
      } else if (row.status === "active" && mustRetire(age)) {
        this.database
          .update(birds)
          .set({ status: "retired", retiredBy: "age", retiredWeek: weekIndex })
          .where(eq(birds.id, row.id))
          .run();
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
    this.database
      .update(birds)
      .set({ status: "retired", retiredBy: "manual", retiredWeek: week })
      .where(eq(birds.id, id))
      .run();
    return this.byId(id);
  }

  /** Training — the age-1 discovery year: small gains, capped per day. */
  train(id: string, stat: StatName): { bird: BirdView; gained: number; sessionsLeftToday: number } {
    const bird = this.byId(id);
    if (bird.status !== "active") throw new Error(`${bird.name} is not active`);
    if (!canTrain(bird.age))
      throw new Error(`${bird.name} is ${bird.age} — training belongs to the discovery year (age 1)`);

    const day = new GameClock(this.database).currentDay();
    const today = this.database
      .select()
      .from(trainingLog)
      .where(and(eq(trainingLog.birdId, id), eq(trainingLog.dayIndex, day)))
      .all();
    if (today.length >= TRAINING.SESSIONS_PER_DAY)
      throw new Error(`${bird.name} is spent — ${TRAINING.SESSIONS_PER_DAY} sessions per day (tick a day)`);

    const gained = Math.min(TRAINING.GAIN_PER_SESSION, STATS.MAX - bird[stat]);
    if (gained > 0) {
      this.database
        .update(birds)
        .set({ [stat]: bird[stat] + gained })
        .where(eq(birds.id, id))
        .run();
    }
    this.database.insert(trainingLog).values({ dayIndex: day, birdId: id, stat }).run();
    return {
      bird: this.byId(id),
      gained,
      sessionsLeftToday: TRAINING.SESSIONS_PER_DAY - today.length - 1,
    };
  }

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
