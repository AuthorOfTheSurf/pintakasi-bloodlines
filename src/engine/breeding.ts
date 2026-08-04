import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { DB } from "@/db/client";
import { birds, farms, gameState, type BirdRow } from "@/db/schema";
import {
  BARN,
  BASE_COATS,
  BREEDING,
  BREED_SPLIT,
  COAT_MUTATION_CHANCE,
  COVERS,
  ECONOMY,
  ELEMENTS,
  STARS,
  STATS,
  STAT_NAMES,
  TRIM_BY_ELEMENT,
  type Carriage,
  type Element,
} from "./config";
import { emit, fmtGp } from "./events";
import { creditCents } from "./farms";
import { uniqueName } from "./naming";
import { Flock, type BirdView } from "./flock";
import { GameClock } from "./game-clock";
import { ageOf } from "./lifecycle";
import { freshSeed, mulberry32, randInt, type Rng } from "./rng";

export interface LineageNode {
  id: string;
  name: string;
  stars: string;
  mother: LineageNode | null;
  father: LineageNode | null;
}

/** A stud as the barn shows it — public card, own-stat fog intact. */
export interface StudView {
  birdId: string;
  farm: string;
  name: string;
  stars: string;
  age: number;
  career: { wins: number; losses: number };
  price: number; // locked to BREED_FEE for now — player pricing later
  coversLeft: number; // public slots left this week (owner slots tracked apart)
  mine: boolean;
}

/** How the cover fee decomposes — all integer centi-GP, sums exactly. */
export interface FeeSplit {
  feeGp: number;
  stakerPoolCents: number;
  juicePoolCents: number;
  studOwnerCents: number;
}

export function splitBreedFee(feeGp: number): FeeSplit {
  const total = feeGp * 100;
  const stakerPoolCents = Math.round(total * BREED_SPLIT.STAKER_SHARE);
  const rest = total - stakerPoolCents;
  const juicePoolCents = Math.round(rest * BREED_SPLIT.JUICE_SHARE_OF_REST);
  return { feeGp, stakerPoolCents, juicePoolCents, studOwnerCents: rest - juicePoolCents };
}

export class Breeding {
  private flock: Flock;

  constructor(
    private database: DB,
    private farmId: string,
    private rng: Rng = mulberry32(freshSeed())
  ) {
    this.flock = new Flock(database, farmId);
  }

  /**
   * Buy a cover: YOUR retired hen × a retired rooster — your own, or any
   * farm's LISTED stud (the breeding barn — breeding PvP, ruled 2026-08-03).
   * The hen's owner pays the fee and keeps the egg ("Egg of <mother>", age
   * 0, hatches next Hatch Friday). The fee SPLITS: staker pool / juice
   * pool / the stud's owner. Covers are capped per rooster per week.
   */
  breed(motherId: string, fatherId: string): { egg: BirdView; feePaid: number; split: FeeSplit } {
    const mother = this.flock.byId(motherId); // must be OWN — hens keep the egg
    const fatherRow = this.database.select().from(birds).where(eq(birds.id, fatherId)).get();
    if (!fatherRow) throw new Error(`No bird with id ${fatherId}`);

    if (mother.sex !== "female")
      throw new Error(`${mother.name} is not female — the mother must be a hen`);
    if (fatherRow.sex !== "male")
      throw new Error(`${fatherRow.name} is not male — the father must be a rooster`);
    if (mother.status !== "retired")
      throw new Error(`${mother.name} is not retired — only retired birds breed`);
    if (fatherRow.status !== "retired")
      throw new Error(`${fatherRow.name} is not retired — only retired birds breed`);
    const ownStud = fatherRow.farmId === this.farmId;
    if (!ownStud && !fatherRow.listedStud)
      throw new Error(`${fatherRow.name} is not listed in the breeding barn`);

    const state = this.database.select().from(gameState).where(eq(gameState.id, 1)).get()!;
    const day = state.dayIndex;
    const week = GameClock.weekOf(day);

    // Permanent law before temporal state: an illegal PAIRING is refused as
    // such even while the hen happens to be pregnant.
    const forbidden = this.forbiddenReason(mother, fatherRow);
    if (forbidden) throw new Error(`Bloodline restriction: ${forbidden}`);

    // One egg per hen at a time (ruled round 12, timeline round 13): the
    // cover makes her pregnant now, the egg lays Friday, hatches the Friday
    // after — and she's blocked until the hatch. This is the hen-side cap;
    // the rooster side has the 14+2.
    const sitting = this.database
      .select()
      .from(birds)
      .where(and(eq(birds.motherId, mother.id), eq(birds.status, "egg")))
      .all();
    if (sitting.length > 0)
      throw new Error(
        `${mother.name} is already ${sitting[0].birthWeek > week ? "pregnant with" : "sitting on"} ${sitting[0].name} — one egg per hen until it hatches`
      );

    if (this.flock.barnCount() >= BARN.CAPACITY)
      throw new Error(`The barn is full (${BARN.CAPACITY})`);

    // The weekly cover caps: public slots for outside hens, a reserved
    // handful for the owner's own. Top studs capping out is the POINT —
    // demand overflows into other studs.
    const covers = this.coversThisWeek(fatherRow.id, fatherRow.farmId, week);
    if (ownStud && covers.owner >= COVERS.OWNER_RESERVED)
      throw new Error(
        `${fatherRow.name} has used all ${COVERS.OWNER_RESERVED} owner covers this week`
      );
    if (!ownStud && covers.public >= COVERS.PER_WEEK)
      throw new Error(`${fatherRow.name} is covered out this week (${COVERS.PER_WEEK}/${COVERS.PER_WEEK})`);

    const farm = this.database.select().from(farms).where(eq(farms.id, this.farmId)).get()!;
    if (farm.gp < ECONOMY.BREED_FEE)
      throw new Error(`A cover costs ${ECONOMY.BREED_FEE} GP — you have ${farm.gp}`);

    // The split (ruled 2026-08-03): per 80 GP — 2 to the staker pool, the
    // rest 50/50 juice pool / stud owner. Exact in centi-GP.
    const split = splitBreedFee(ECONOMY.BREED_FEE);
    this.database
      .update(farms)
      .set({ gp: farm.gp - ECONOMY.BREED_FEE })
      .where(eq(farms.id, this.farmId))
      .run();
    creditCents(this.database, fatherRow.farmId, split.studOwnerCents);
    this.database
      .update(gameState)
      .set({
        stakerPoolCents: state.stakerPoolCents + split.stakerPoolCents,
        juicePoolCents: state.juicePoolCents + split.juicePoolCents,
      })
      .where(eq(gameState.id, 1))
      .run();
    const stats = this.inheritStats(mother, fatherRow);
    const { element, halfStars } = this.inheritStars(mother, fatherRow);
    const { carriage, carriageHalfStars } = this.inheritCarriage(mother, fatherRow);

    // Coat v0 (round 14): take a parent's base coat, small mutation chance;
    // trim keys off the chick's own element. Real coat genetics come later.
    const baseCoat =
      this.rng() < COAT_MUTATION_CHANCE
        ? BASE_COATS[randInt(this.rng, 0, BASE_COATS.length - 1)]
        : this.rng() < 0.5
          ? mother.baseCoat
          : fatherRow.baseCoat;
    const trimColor = TRIM_BY_ELEMENT[element][this.rng() < 0.5 ? 0 : 1];

    // The nest timeline (ruled 2026-08-03 round 13): the cover makes the
    // hen pregnant NOW; the egg is LAID on the nearest coming Friday
    // (birthWeek = week + 1) and hatches the Friday after that, as an
    // age-1 chick. birthDay keeps the conception day for history.
    const egg = {
      id: randomUUID(),
      farmId: this.farmId, // the hen's farm — hens keep the egg
      name: uniqueName(this.database, `Egg of ${mother.name}`),
      // 50-50, decided now but hidden from every view until hatch day.
      sex: this.rng() < BREEDING.FEMALE_CHANCE ? ("female" as const) : ("male" as const),
      status: "egg" as const,
      ...stats,
      element,
      halfStars,
      carriage,
      carriageHalfStars,
      birthWeek: week + 1,
      birthDay: day,
      motherId: mother.id,
      fatherId: fatherRow.id,
      named: 0, // auto-named "Egg of <hen>" — the naming law wants a real one
      baseCoat,
      trimColor,
    };
    this.database.insert(birds).values(egg).run();

    const studFarm = this.database.select().from(farms).where(eq(farms.id, fatherRow.farmId)).get()!;
    emit(this.database, {
      type: "breed",
      farmId: this.farmId,
      birdId: egg.id,
      gpCents: -ECONOMY.BREED_FEE * 100,
      message: `bought a cover: ${mother.name} × ${fatherRow.name}${ownStud ? " (own stud)" : ` (${studFarm.name}'s stud)`} → ${egg.name} (lays Friday, hatches the Friday after)`,
      data: split,
    });
    emit(this.database, {
      type: "stud_income",
      farmId: fatherRow.farmId,
      birdId: fatherRow.id,
      gpCents: split.studOwnerCents,
      message: `${fatherRow.name} covered ${mother.name} — stud share +${fmtGp(split.studOwnerCents)} GP`,
    });
    emit(this.database, {
      type: "pool_accrual",
      message: `breed-fee cuts: +${fmtGp(split.stakerPoolCents)} GP staker pool · +${fmtGp(split.juicePoolCents)} GP juice pool`,
      data: { stakerPoolCents: split.stakerPoolCents, juicePoolCents: split.juicePoolCents },
    });

    return { egg: this.flock.byId(egg.id), feePaid: ECONOMY.BREED_FEE, split };
  }

  // ── The breeding barn ──────────────────────────────────────────────────────

  /** List a retired rooster for covers from any farm. Idempotent. */
  listStud(birdId: string): { stud: string; listed: true; price: number; landSpent: number } {
    const bird = this.flock.byId(birdId); // own birds only
    if (bird.sex !== "male") throw new Error(`${bird.name} is a hen — the barn lists roosters`);
    if (bird.status !== "retired") throw new Error(`${bird.name} must be retired to stand stud`);
    // Re-listing a rooster that's already up is free — the land bought the
    // seat, and pulling a stud out shouldn't tax putting him back.
    let landSpent = 0;
    if (!bird.listedStud) {
      // THE LAND SINK (round 23): a stud seat costs LAND, not GP. Spent —
      // not staked, not refundable. It's the first thing in the game that
      // takes Land Tokens OUT of the world, which is what gives the yield a
      // price to be measured against.
      const farm = this.database.select().from(farms).where(eq(farms.id, this.farmId)).get()!;
      if (farm.landTokens < COVERS.STUD_LISTING_LT)
        throw new Error(
          `Standing ${bird.name} at stud costs ${COVERS.STUD_LISTING_LT} LT — ${farm.name} holds ` +
            `${farm.landTokens} liquid (unstake some, or earn more in the pit)`
        );
      this.database
        .update(farms)
        .set({ landTokens: farm.landTokens - COVERS.STUD_LISTING_LT })
        .where(eq(farms.id, this.farmId))
        .run();
      landSpent = COVERS.STUD_LISTING_LT;
      emit(this.database, {
        type: "stud_listed",
        farmId: this.farmId,
        birdId,
        lt: -COVERS.STUD_LISTING_LT,
        message:
          `${bird.name} stands at stud — ${ECONOMY.BREED_FEE} GP a cover ` +
          `(${COVERS.STUD_LISTING_LT} LT paid for the seat)`,
      });
    }
    this.database.update(birds).set({ listedStud: 1 }).where(eq(birds.id, birdId)).run();
    return { stud: bird.name, listed: true, price: ECONOMY.BREED_FEE, landSpent };
  }

  /** Pull a rooster from the barn. Covers already sold this week stand. */
  unlistStud(birdId: string): { stud: string; listed: false } {
    const bird = this.flock.byId(birdId);
    if (bird.listedStud)
      emit(this.database, {
        type: "stud_unlisted",
        farmId: this.farmId,
        birdId,
        message: `${bird.name} pulled from the breeding barn`,
      });
    this.database.update(birds).set({ listedStud: 0 }).where(eq(birds.id, birdId)).run();
    return { stud: bird.name, listed: false };
  }

  /**
   * The barn, from one hen's point of view: every stud she CAN breed with,
   * plus the ones she can't and WHY (kin overlap is a natural question —
   * name it rather than hiding the bird). Candidates: every farm's listed
   * studs + your own retired roosters (listed or not — owner slots).
   */
  browseStuds(henId: string): {
    hen: string;
    studs: StudView[];
    excluded: { name: string; farm: string; reason: string }[];
  } {
    const hen = this.flock.byId(henId);
    if (hen.sex !== "female") throw new Error(`${hen.name} is a rooster — browse with a hen`);
    if (hen.status !== "retired") throw new Error(`${hen.name} must be retired to breed`);

    const week = GameClock.weekOf(
      this.database.select().from(gameState).where(eq(gameState.id, 1)).get()!.dayIndex
    );
    const candidates = this.database
      .select()
      .from(birds)
      .where(and(eq(birds.sex, "male"), eq(birds.status, "retired")))
      .all()
      .filter((r) => r.listedStud === 1 || r.farmId === this.farmId);

    const studs: StudView[] = [];
    const excluded: { name: string; farm: string; reason: string }[] = [];
    for (const rooster of candidates) {
      const farm = this.database.select().from(farms).where(eq(farms.id, rooster.farmId)).get()!;
      const mine = rooster.farmId === this.farmId;
      const covers = this.coversThisWeek(rooster.id, rooster.farmId, week);
      const kin = this.forbiddenReason(hen, rooster);
      const coversLeft = mine
        ? COVERS.OWNER_RESERVED - covers.owner
        : COVERS.PER_WEEK - covers.public;
      if (kin) {
        excluded.push({ name: rooster.name, farm: farm.name, reason: kin });
      } else if (coversLeft <= 0) {
        excluded.push({
          name: rooster.name,
          farm: farm.name,
          reason: mine
            ? `owner covers used (${COVERS.OWNER_RESERVED}/${COVERS.OWNER_RESERVED} this week)`
            : `covered out this week (${COVERS.PER_WEEK}/${COVERS.PER_WEEK})`,
        });
      } else {
        studs.push({
          birdId: rooster.id,
          farm: farm.name,
          name: rooster.name,
          stars: `${rooster.halfStars / 2}★ ${rooster.element}`,
          age: ageOf(rooster, week),
          career: { wins: rooster.wins, losses: rooster.losses },
          price: ECONOMY.BREED_FEE,
          coversLeft,
          mine,
        });
      }
    }
    return { hen: hen.name, studs, excluded };
  }

  /**
   * Covers already bought against a rooster this game-week — counted by
   * CONCEPTION day (birthDay), since the egg's birthWeek is the coming
   * lay-Friday, not the week the cover was sold.
   */
  private coversThisWeek(
    fatherId: string,
    fatherFarmId: string,
    week: number
  ): { owner: number; public: number } {
    const eggs = this.database
      .select()
      .from(birds)
      .where(eq(birds.fatherId, fatherId))
      .all()
      .filter((e) => GameClock.weekOf(e.birthDay) === week);
    const owner = eggs.filter((e) => e.farmId === fatherFarmId).length;
    return { owner, public: eggs.length - owner };
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
   * CARRIAGE inheritance (round 23) — the same preference-pair maths as
   * elements, on the Ground/Air axis: the magnitude is drawn around the
   * parents' average and the LEAN follows the stronger-rated parent, with a
   * small chance of flipping. Breeding two Ground birds usually makes another
   * shuffler; crossing a strong flyer over a weak shuffler usually makes a
   * flyer. That's the whole point of a preference pair — it's selectable.
   */
  private inheritCarriage(
    mother: Pick<BirdRow, "carriageHalfStars" | "carriage">,
    father: Pick<BirdRow, "carriageHalfStars" | "carriage">
  ): { carriage: Carriage; carriageHalfStars: number } {
    const avg = (mother.carriageHalfStars + father.carriageHalfStars) / 2;
    const carriageHalfStars = Math.min(
      STARS.MAX_HALF_STARS,
      Math.max(
        0,
        Math.round(avg) +
          randInt(this.rng, -BREEDING.STAR_SPREAD_HALF_STARS, BREEDING.STAR_SPREAD_HALF_STARS)
      )
    );
    const [stronger, weaker] =
      mother.carriageHalfStars === father.carriageHalfStars
        ? this.rng() < 0.5
          ? [mother, father]
          : [father, mother]
        : mother.carriageHalfStars > father.carriageHalfStars
          ? [mother, father]
          : [father, mother];
    const roll = this.rng();
    const carriage: Carriage =
      roll < BREEDING.CARRIAGE_LEAN_STRONGER
        ? (stronger.carriage as Carriage)
        : (weaker.carriage as Carriage);
    return { carriage, carriageHalfStars };
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
