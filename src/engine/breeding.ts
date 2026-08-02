import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { DB } from "@/db/client";
import { birds, gameState, type BirdRow } from "@/db/schema";
import { BARN, BREEDING, ECONOMY, ELEMENTS, STATS, STAT_NAMES, type Element } from "./config";
import { Flock, type BirdView } from "./flock";
import { GameClock } from "./game-clock";
import { freshSeed, mulberry32, randInt, type Rng } from "./rng";

export interface LineageNode {
  id: string;
  name: string;
  stars: string;
  mother: LineageNode | null;
  father: LineageNode | null;
}

export class Breeding {
  private flock: Flock;

  constructor(
    private database: DB,
    private rng: Rng = mulberry32(freshSeed())
  ) {
    this.flock = new Flock(database);
  }

  /**
   * The career→barn pipe: only retired birds breed. Enforces the bloodline
   * restriction, charges the breed fee, and lays an egg ("Egg of <mother>",
   * age 0) that hatches next Hatch Friday.
   */
  breed(motherId: string, fatherId: string): { egg: BirdView; feePaid: number } {
    const mother = this.flock.byId(motherId);
    const father = this.flock.byId(fatherId);

    if (mother.sex !== "female")
      throw new Error(`${mother.name} is not female — the mother must be a hen`);
    if (father.sex !== "male")
      throw new Error(`${father.name} is not male — the father must be a rooster`);
    for (const parent of [mother, father]) {
      if (parent.status !== "retired")
        throw new Error(`${parent.name} is not retired — only retired birds breed`);
    }

    const forbidden = this.forbiddenReason(mother, father);
    if (forbidden) throw new Error(`Bloodline restriction: ${forbidden}`);

    if (this.flock.barnCount() >= BARN.CAPACITY)
      throw new Error(`The barn is full (${BARN.CAPACITY})`);

    const state = this.database.select().from(gameState).where(eq(gameState.id, 1)).get()!;
    if (state.gp < ECONOMY.BREED_FEE)
      throw new Error(`Breeding costs ${ECONOMY.BREED_FEE} GP — you have ${state.gp}`);
    this.database
      .update(gameState)
      .set({ gp: state.gp - ECONOMY.BREED_FEE })
      .where(eq(gameState.id, 1))
      .run();

    const day = state.dayIndex;
    const week = GameClock.weekOf(day);
    const stats = this.inheritStats(mother, father);
    const { element, halfStars } = this.inheritStars(mother, father);

    const egg = {
      id: randomUUID(),
      name: `Egg of ${mother.name}`,
      // 50-50, decided now but hidden from every view until hatch day.
      sex: this.rng() < BREEDING.FEMALE_CHANCE ? ("female" as const) : ("male" as const),
      status: "egg" as const,
      ...stats,
      element,
      halfStars,
      birthWeek: week,
      birthDay: day,
      motherId: mother.id,
      fatherId: father.id,
    };
    this.database.insert(birds).values(egg).run();
    return { egg: this.flock.byId(egg.id), feePaid: ECONOMY.BREED_FEE };
  }

  /** Child stat = parent average ± variance, with a rare mutation swing. */
  private inheritStats(
    mother: Pick<BirdRow, (typeof STAT_NAMES)[number]>,
    father: Pick<BirdRow, (typeof STAT_NAMES)[number]>
  ): Record<(typeof STAT_NAMES)[number], number> {
    const out = {} as Record<(typeof STAT_NAMES)[number], number>;
    for (const stat of STAT_NAMES) {
      let value =
        Math.round((mother[stat] + father[stat]) / 2) +
        randInt(this.rng, -BREEDING.STAT_VARIANCE, BREEDING.STAT_VARIANCE);
      if (this.rng() < BREEDING.MUTATION_CHANCE) {
        const swing = randInt(this.rng, 1, BREEDING.MUTATION_SWING);
        value += this.rng() < 0.5 ? -swing : swing;
      }
      out[stat] = Math.min(STATS.MAX, Math.max(STATS.MIN, value));
    }
    return out;
  }

  /**
   * Star inheritance, PFL preference-pair style: half-stars drawn around the
   * parents' average; the element leans toward the higher-starred parent.
   * 0★ still resolves to a type.
   */
  private inheritStars(
    mother: Pick<BirdRow, "halfStars" | "element">,
    father: Pick<BirdRow, "halfStars" | "element">
  ): { element: Element; halfStars: number } {
    const avg = (mother.halfStars + father.halfStars) / 2;
    const halfStars = Math.min(
      10,
      Math.max(
        0,
        Math.round(avg) + randInt(this.rng, -BREEDING.STAR_SPREAD_HALF_STARS, BREEDING.STAR_SPREAD_HALF_STARS)
      )
    );

    const [stronger, weaker] =
      mother.halfStars === father.halfStars
        ? this.rng() < 0.5
          ? [mother, father]
          : [father, mother]
        : mother.halfStars > father.halfStars
          ? [mother, father]
          : [father, mother];

    const roll = this.rng();
    const element: Element =
      roll < 0.7
        ? (stronger.element as Element)
        : roll < 0.95
          ? (weaker.element as Element)
          : ELEMENTS[randInt(this.rng, 0, ELEMENTS.length - 1)];

    return { element, halfStars };
  }

  /**
   * Bloodline restriction (Genetic Tools heritage): no breeding with
   * siblings, parents, grandparents, or great-grandparents.
   */
  forbiddenReason(
    a: Pick<BirdRow, "id" | "name" | "motherId" | "fatherId">,
    b: Pick<BirdRow, "id" | "name" | "motherId" | "fatherId">
  ): string | null {
    const aAncestors = this.ancestorIds(a, BREEDING.ANCESTOR_DEPTH);
    const bAncestors = this.ancestorIds(b, BREEDING.ANCESTOR_DEPTH);
    if (aAncestors.has(b.id)) return `${b.name} is an ancestor of ${a.name}`;
    if (bAncestors.has(a.id)) return `${a.name} is an ancestor of ${b.name}`;
    const sharedParent =
      (a.motherId && a.motherId === b.motherId) || (a.fatherId && a.fatherId === b.fatherId);
    if (sharedParent) return `${a.name} and ${b.name} are siblings`;
    return null;
  }

  /** Ancestor ids up to `depth` generations (3 = through great-grandparents). */
  ancestorIds(bird: Pick<BirdRow, "motherId" | "fatherId">, depth: number): Set<string> {
    const out = new Set<string>();
    let frontier = [bird.motherId, bird.fatherId].filter((x): x is string => !!x);
    for (let gen = 0; gen < depth && frontier.length > 0; gen++) {
      const next: string[] = [];
      for (const id of frontier) {
        if (out.has(id)) continue;
        out.add(id);
        const row = this.database.select().from(birds).where(eq(birds.id, id)).get();
        if (row?.motherId) next.push(row.motherId);
        if (row?.fatherId) next.push(row.fatherId);
      }
      frontier = next;
    }
    return out;
  }

  /** The parent tree, derived on demand (unoptimized — views later). */
  lineage(id: string, depth: number = BREEDING.ANCESTOR_DEPTH): LineageNode | null {
    if (depth < 0) return null;
    const row = this.database.select().from(birds).where(eq(birds.id, id)).get();
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      stars: `${row.halfStars / 2}★ ${row.element}`,
      mother: row.motherId ? this.lineage(row.motherId, depth - 1) : null,
      father: row.fatherId ? this.lineage(row.fatherId, depth - 1) : null,
    };
  }
}
