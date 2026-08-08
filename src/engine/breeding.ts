import { and, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { DB } from "@/db/client";
import { birds, farms, gameState, type BirdRow } from "@/db/schema";
import {
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
  CALENDAR,
  type Carriage,
  type Element,
  type StatName,
  LT_CENTS,
  fmtLt,
} from "./config";
import { emit, fmtGp } from "./events";
import { creditCents } from "./farms";
import { overallGradeOf, type Grade } from "./grades";
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

/**
 * A stud as the barn shows it. Since round 28 the card carries the FULL
 * SHEET: retirement is the reveal, and every stud is retired by definition —
 * the revealed stats are the sales pitch. (Before the fog, this view hid
 * stats on principle; now the principle cuts the other way.)
 */
export interface StudView {
  birdId: string;
  farm: string;
  name: string;
  stars: string;
  /** The same rating as a number — stars are the element wheel's volume knob
   *  (round 26), so a shopper comparing bloodlines wants to do arithmetic on
   *  it, not parse "2.5★ Fire". Added round 29 for the bots' breeding plan. */
  halfStars: number;
  age: number;
  career: { wins: number; losses: number };
  sheet: Record<StatName, number>; // the revealed stats — what you're buying half of
  overallGrade: Grade; //             one glanceable letter for shoppers
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
  const stakerPoolCents = Math.round(total * BREED_SPLIT.STAKER);
  const juicePoolCents = Math.round(total * BREED_SPLIT.JUICE);
  // The stud owner takes the remainder, so the three parts sum to the fee
  // exactly — rounding drift lands on the owner, never printed or burned.
  return { feeGp, stakerPoolCents, juicePoolCents, studOwnerCents: total - stakerPoolCents - juicePoolCents };
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

    // One PREGNANCY per hen at a time: the cover makes her pregnant now and
    // the egg lays Friday. Once it is laid, her biological work is done, so
    // she is immediately free to take another cover while the first egg sits
    // until next Friday's hatch. This raises supply without weakening the
    // rooster-side 14+2 cover cap.
    const pregnancies = this.database
      .select()
      .from(birds)
      .where(and(eq(birds.motherId, mother.id), eq(birds.status, "egg")))
      .all()
      .filter((egg) => egg.birthWeek > week);
    if (pregnancies.length > 0)
      throw new Error(
        `${mother.name} is already pregnant with ${pregnancies[0].name} — one pregnancy per hen until it lays`
      );

    // Against the farm's OWN ceiling since round 43 — capacity grows with
    // bought expansions, so "full" is a state a stable can spend its way out of.
    const cap = this.flock.capacity();
    if (this.flock.barnCount() >= cap)
      throw new Error(`The barn is full (${cap}) — expand it for Land Tokens`);

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
    // Inheritance reads the RAW rows: the hen's view is fogged by type
    // (round 28), but both parents are retired here — their sheets are
    // public — and the genetics never depended on the view anyway.
    const motherRow = this.database.select().from(birds).where(eq(birds.id, motherId)).get()!;
    const stats = this.inheritStats(motherRow, fatherRow);
    const { element, halfStars } = this.inheritStars(motherRow, fatherRow);
    const { carriage, carriageHalfStars } = this.inheritCarriage(motherRow, fatherRow);

    // Coat v0 (round 14): take a parent's base coat, small mutation chance;
    // trim keys off the chick's own element. Real coat genetics come later.
    const baseCoat =
      this.rng() < COAT_MUTATION_CHANCE
        ? BASE_COATS[randInt(this.rng, 0, BASE_COATS.length - 1)]
        : this.rng() < 0.5
          ? mother.baseCoat
          : fatherRow.baseCoat;
    const trimColor = TRIM_BY_ELEMENT[element][this.rng() < 0.5 ? 0 : 1];

    // The nest timeline: the cover makes the hen pregnant NOW; the egg is
    // LAID on the nearest coming Friday (birthWeek = week + 1), which frees
    // her for another cover, and hatches the Friday after that as an age-1
    // chick. birthDay keeps the conception day for history.
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
      // The generation marker (round 30) counts nests down the DAM's line —
      // the hen owns the egg, so her depth is the one that carries.
      generation: motherRow.generation + 1,
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
      data: {
        stakerPoolCents: split.stakerPoolCents,
        juicePoolCents: split.juicePoolCents,
        // Named since round 24 — this was the ONE accrual site with no source,
        // which is why the office carried a "?? breed cut" fallback for it.
        source: "breed",
      },
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
      if (farm.landTokensCents < COVERS.STUD_LISTING_LT)
        throw new Error(
          `Standing ${bird.name} at stud costs ${COVERS.STUD_LISTING_LT / LT_CENTS} LT — ${farm.name} holds ` +
            `${farm.landTokensCents} liquid (unstake some, or earn more in the pit)`
        );
      this.database
        .update(farms)
        .set({ landTokensCents: farm.landTokensCents - COVERS.STUD_LISTING_LT })
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
          `(${COVERS.STUD_LISTING_LT / LT_CENTS} LT paid for the seat)`,
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

    // ── BATCHED READS (round 43) — this loop is the bots' shopping aisle ────
    // It used to run 2 queries + a ~28-query pedigree walk PER ROOSTER, per
    // hen, per bot, per day, over a stud book that only ever grows (retired
    // roosters never leave). The profile put the whole breeding step at 107s
    // of a 218s sim — half the world's wall clock. Three reads replace all of
    // it; the per-rooster loop below touches no database at all.
    const farmById = new Map(
      this.database.select().from(farms).all().map((f) => [f.id, f])
    );
    // Every egg sired THIS WEEK, in one query — the birthDay range is exactly
    // `GameClock.weekOf(birthDay) === week` (floor division by 7), which is
    // the filter coversThisWeek applies one father at a time.
    const weekStart = week * CALENDAR.DAYS_PER_WEEK;
    const eggsByFather = new Map<string, { farmId: string }[]>();
    for (const egg of this.database
      .select({ fatherId: birds.fatherId, farmId: birds.farmId })
      .from(birds)
      .where(
        and(
          isNotNull(birds.fatherId),
          gte(birds.birthDay, weekStart),
          lt(birds.birthDay, weekStart + CALENDAR.DAYS_PER_WEEK)
        )
      )
      .all()) {
      const list = eggsByFather.get(egg.fatherId!) ?? [];
      list.push({ farmId: egg.farmId });
      eggsByFather.set(egg.fatherId!, list);
    }
    // The pedigree, prefetched to ANCESTOR_DEPTH generations for the hen and
    // every candidate at once — one chunked query per generation instead of
    // one per ancestor. `ancestorsVia` then walks this map with the exact
    // traversal `ancestorIds` uses against the database.
    const pedigree = new Map<string, { motherId: string | null; fatherId: string | null }>();
    let frontier = [
      ...new Set(
        [hen, ...candidates]
          .flatMap((b) => [b.motherId, b.fatherId])
          .filter((x): x is string => !!x)
      ),
    ];
    for (let gen = 0; gen < BREEDING.ANCESTOR_DEPTH && frontier.length > 0; gen++) {
      const CHUNK = 500; // stay under SQLite's bound-parameter ceiling
      const fetched: { id: string; motherId: string | null; fatherId: string | null }[] = [];
      for (let i = 0; i < frontier.length; i += CHUNK)
        fetched.push(
          ...this.database
            .select({ id: birds.id, motherId: birds.motherId, fatherId: birds.fatherId })
            .from(birds)
            .where(inArray(birds.id, frontier.slice(i, i + CHUNK)))
            .all()
        );
      const next = new Set<string>();
      for (const row of fetched) {
        pedigree.set(row.id, { motherId: row.motherId, fatherId: row.fatherId });
        if (row.motherId && !pedigree.has(row.motherId)) next.add(row.motherId);
        if (row.fatherId && !pedigree.has(row.fatherId)) next.add(row.fatherId);
      }
      frontier = [...next];
    }
    const fromPedigree = (id: string) => pedigree.get(id);
    const henAncestors = ancestorsVia(hen, BREEDING.ANCESTOR_DEPTH, fromPedigree);

    const studs: StudView[] = [];
    const excluded: { name: string; farm: string; reason: string }[] = [];
    for (const rooster of candidates) {
      const farm = farmById.get(rooster.farmId)!;
      const mine = rooster.farmId === this.farmId;
      const weekEggs = eggsByFather.get(rooster.id) ?? [];
      const owner = weekEggs.filter((e) => e.farmId === rooster.farmId).length;
      const covers = { owner, public: weekEggs.length - owner };
      const kin = kinVerdict(
        hen,
        rooster,
        henAncestors,
        ancestorsVia(rooster, BREEDING.ANCESTOR_DEPTH, fromPedigree)
      );
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
        const total =
          rooster.agility + rooster.sight + rooster.stamina +
          rooster.gameness + rooster.station + rooster.condition;
        studs.push({
          birdId: rooster.id,
          farm: farm.name,
          name: rooster.name,
          stars: `${rooster.halfStars / 2}★ ${rooster.element}`,
          halfStars: rooster.halfStars,
          age: ageOf(rooster, week),
          career: { wins: rooster.wins, losses: rooster.losses },
          sheet: {
            agility: rooster.agility,
            sight: rooster.sight,
            stamina: rooster.stamina,
            gameness: rooster.gameness,
            station: rooster.station,
            condition: rooster.condition,
          },
          overallGrade: overallGradeOf(total),
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
    return kinVerdict(a, b, aAncestors, bAncestors);
  }

  /** Ancestor ids up to `depth` generations (3 = through great-grandparents). */
  ancestorIds(bird: Pick<BirdRow, "motherId" | "fatherId">, depth: number): Set<string> {
    return ancestorsVia(bird, depth, (id) =>
      this.database
        .select({ motherId: birds.motherId, fatherId: birds.fatherId })
        .from(birds)
        .where(eq(birds.id, id))
        .get()
    );
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

/**
 * ── THE KINSHIP VERDICT AND THE PEDIGREE WALK, SHARED (round 43) ─────────────
 *
 * These two used to live inline in `forbiddenReason`, which was fine while it
 * had one caller a day and fatal once `browseStuds` became the bots' shopping
 * loop: pricing a barn's hens re-ran the walk PER (HEN, STUD) PAIR with one
 * query per ancestor — up to ~28 queries a pair, hens × studs × bots × days.
 * The round-43 profile put the whole breeding step at 107s of a 218s sim, half
 * the world's wall clock, spent almost entirely here.
 *
 * The fix is to let `browseStuds` prefetch the pedigree in bulk and walk it in
 * memory — but a SECOND copy of the traversal or the verdict would drift, and
 * kinship drift is invisible (both entry paths swallow refusals). So the logic
 * lives here once, parametrised over WHERE a parent row comes from: the
 * db-backed lookup for one-off checks, a Map for the batched browse. Same
 * traversal, same verdicts, byte-identical messages.
 */
type ParentRef = { motherId: string | null; fatherId: string | null } | undefined;

export function ancestorsVia(
  bird: Pick<BirdRow, "motherId" | "fatherId">,
  depth: number,
  lookup: (id: string) => ParentRef
): Set<string> {
  const out = new Set<string>();
  let frontier = [bird.motherId, bird.fatherId].filter((x): x is string => !!x);
  for (let gen = 0; gen < depth && frontier.length > 0; gen++) {
    const next: string[] = [];
    for (const id of frontier) {
      if (out.has(id)) continue;
      out.add(id);
      const row = lookup(id);
      if (row?.motherId) next.push(row.motherId);
      if (row?.fatherId) next.push(row.fatherId);
    }
    frontier = next;
  }
  return out;
}

export function kinVerdict(
  a: Pick<BirdRow, "id" | "name" | "motherId" | "fatherId">,
  b: Pick<BirdRow, "id" | "name" | "motherId" | "fatherId">,
  aAncestors: Set<string>,
  bAncestors: Set<string>
): string | null {
  if (aAncestors.has(b.id)) return `${b.name} is an ancestor of ${a.name}`;
  if (bAncestors.has(a.id)) return `${a.name} is an ancestor of ${b.name}`;
  const sharedParent =
    (a.motherId && a.motherId === b.motherId) || (a.fatherId && a.fatherId === b.fatherId);
  if (sharedParent) return `${a.name} and ${b.name} are siblings`;
  return null;
}
