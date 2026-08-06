import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { birds, farms, gameState } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { Breeding } from "./breeding";
import { COVERS, ECONOMY, STATS } from "./config";
import { Flock } from "./flock";
import { Game } from "./game";
import { mulberry32 } from "./rng";

function freshGame(seed = 42) {
  const db = createDb(":memory:");
  const fid = seedGame(db, { flock: "legacy" }).farmId;
  return { db, farmId: fid, breeding: new Breeding(db, fid, mulberry32(seed)), flock: new Flock(db, fid) };
}

// Seed ids: starter-1 Tandang Pula (retired rooster), starter-2 Dalisay
// (retired hen), starter-3 Bagwis (retired rooster), starter-4 Perlas
// (retired hen).

describe("breed", () => {
  test("lays 'Egg of <mother>' at age 0; the fee SPLITS to the centi-GP", () => {
    const { db, breeding } = freshGame();
    const { egg, feePaid, split } = breeding.breed("starter-2", "starter-1");
    expect(egg.name).toBe("Egg of Dalisay");
    expect(egg.status).toBe("egg");
    expect(egg.age).toBe(0);
    expect(egg.motherId).toBe("starter-2");
    expect(egg.fatherId).toBe("starter-1");
    expect(feePaid).toBe(ECONOMY.BREED_FEE);
    // The ruled split, exact: 160 GP → 8.00 staker / 76.00 juice / 76.00 stud
    // owner — and the pieces sum back to the fee, to the cent. (The staker
    // cut doubled from 2.5% to 5% in round 22; it used to be 4/78/78.)
    expect(split).toEqual({ feeGp: 160, stakerPoolCents: 800, juicePoolCents: 7600, studOwnerCents: 7600 });
    expect(split.stakerPoolCents + split.juicePoolCents + split.studOwnerCents).toBe(16000);
    // Own stud: the 76.00 stud share flows straight back — net cost 84 GP.
    const farm = db.select().from(farms).where(eq(farms.id, "farm-1")).get()!;
    expect(farm.gp).toBe(ECONOMY.STARTING_GP - 84);
    expect(farm.gpCents).toBe(0);
    const state = db.select().from(gameState).where(eq(gameState.id, 1)).get()!;
    expect(state.stakerPoolCents).toBe(800);
    expect(state.juicePoolCents).toBe(ECONOMY.SEED_JUICE * 100 + 7600); // genesis seed + the cover's cut
  });

  test("child stats stay in bounds and near the parent average", () => {
    const { db, breeding, flock } = freshGame();
    const { egg } = breeding.breed("starter-2", "starter-1");
    // The fog (round 28): the egg's VIEW hides its stats — genetics are
    // asserted against the raw rows, which is also how the engine breeds.
    const eggRow = db.select().from(birds).where(eq(birds.id, egg.id)).get()!;
    const mother = db.select().from(birds).where(eq(birds.id, "starter-2")).get()!;
    const father = db.select().from(birds).where(eq(birds.id, "starter-1")).get()!;
    expect(egg.agility).toBeNull(); // the view is dark until retirement
    for (const stat of ["agility", "sight", "stamina", "gameness", "station", "condition"] as const) {
      expect(eggRow[stat]).toBeGreaterThanOrEqual(STATS.MIN);
      expect(eggRow[stat]).toBeLessThanOrEqual(STATS.MAX);
      // within variance + max mutation swing of the parent average
      const avg = (mother[stat] + father[stat]) / 2;
      expect(Math.abs(eggRow[stat] - avg)).toBeLessThanOrEqual(120 + 300 + 1);
    }
    expect(egg.halfStars).toBeGreaterThanOrEqual(0);
    expect(egg.halfStars).toBeLessThanOrEqual(10);
    expect(egg.element).toBeTruthy(); // 0★ would still resolve to a type
    expect(egg.sex).toBe("hidden"); // the 50-50 surprise belongs to hatch day
    expect(egg.sexLabel).toBeNull();
  });

  test("same seed → identical egg (deterministic)", () => {
    const a = freshGame(7).breeding.breed("starter-2", "starter-1").egg;
    const b = freshGame(7).breeding.breed("starter-2", "starter-1").egg;
    const { id: _a, ...restA } = a;
    const { id: _b, ...restB } = b;
    expect(restA).toEqual(restB);
  });

  test("active birds cannot breed; sexes must be hen × rooster", () => {
    const { breeding, flock } = freshGame();
    const sinag = flock.all().find((b) => b.name === "Sinag")!; // active hen
    expect(() => breeding.breed(sinag.id, "starter-1")).toThrow(/not retired/);
    expect(() => breeding.breed("starter-1", "starter-2")).toThrow(/must be a hen/);
  });

  test("insufficient GP blocks breeding", () => {
    const { db, breeding } = freshGame();
    db.update(farms).set({ gp: 100 }).where(eq(farms.id, "farm-1")).run();
    expect(() => breeding.breed("starter-2", "starter-1")).toThrow(/cover costs/);
  });
});

/**
 * THE GENERATION MARKER (round 30, Zane's ruling). It gates nothing and no
 * fight reads it — it exists so the doctor can answer "is the flock actually
 * getting better?", which is the entire promise of the breed loop and was
 * previously invisible. So the thing worth pinning is the COUNTING RULE.
 */
describe("generation", () => {
  test("starters are generation 0 and a chick is its DAM's generation + 1", () => {
    const { db, breeding } = freshGame();
    for (const id of ["starter-1", "starter-2"])
      expect(db.select().from(birds).where(eq(birds.id, id)).get()!.generation).toBe(0);
    const { egg } = breeding.breed("starter-2", "starter-1");
    expect(egg.generation).toBe(1); // and it rides the VIEW — pedigree isn't fogged
  });

  test("the SIRE's generation is ignored — the count follows the hen's line", () => {
    const { db, breeding } = freshGame();
    // A deep hen covered by a founder rooster, and the mirror image. If the
    // rule were max(dam, sire) or sire + 1, exactly one of these would break.
    db.update(birds).set({ generation: 3 }).where(eq(birds.id, "starter-2")).run();
    db.update(birds).set({ generation: 7 }).where(eq(birds.id, "starter-3")).run();
    expect(breeding.breed("starter-2", "starter-1").egg.generation).toBe(4);
    expect(breeding.breed("starter-4", "starter-3").egg.generation).toBe(1);
  });
});

describe("the nest (pregnant now, laid Friday, hatched the next)", () => {
  test("one pregnancy per hen; laying frees her before the first egg hatches", () => {
    const w = freshGame(7);
    const game = new Game(w.db, w.farmId);
    const first = w.breeding.breed("starter-2", "starter-1").egg; // Dalisay conceives
    expect(first.eggStage).toBe("gestating");
    expect(() => w.breeding.breed("starter-2", "starter-3")).toThrow(/already pregnant/);
    // The OTHER hen is free — the rule is per pregnancy, not per farm.
    expect(() => w.breeding.breed("starter-4", "starter-3")).not.toThrow();
    game.tickWeek(); // Friday 1 — the egg is LAID, and the hen is free
    expect(w.flock.byId(first.id).eggStage).toBe("laid");
    const { egg } = w.breeding.breed("starter-2", "starter-3");
    expect(egg.name).toBe("Egg of Dalisay II");
    expect(egg.eggStage).toBe("gestating");
    game.tickWeek(); // Friday 2 — first egg hatches; second egg is laid
    expect(w.flock.byId(first.id).status).toBe("active");
    expect(w.flock.byId(egg.id).eggStage).toBe("laid");
  });
});

describe("the breeding barn (breeding PvP)", () => {
  function withRival(seed = 42) {
    const w = freshGame(seed);
    const rivalId = "rival-farm";
    w.db
      .insert(farms)
      .values({
        id: rivalId,
        name: "Rival Gamefarm",
        primaryColor: "black",
        secondaryColor: "red",
        apiKey: "fk_rival",
        gp: ECONOMY.STARTING_GP,
      })
      .run();
    // The rival's foundation birds — unrelated to the dev starters. Three
    // hens, because a hen sits on ONE egg at a time (round 12): the
    // owner-covers test needs a fresh hen per cover.
    for (const [id, sex] of [
      ["rival-stud", "male"],
      ["rival-hen", "female"],
      ["rival-hen-2", "female"],
      ["rival-hen-3", "female"],
    ] as const) {
      w.db
        .insert(birds)
        .values({
          id, farmId: rivalId, name: id, sex, status: "retired",
          agility: 600, sight: 600, stamina: 600, gameness: 600, station: 600, condition: 600,
          element: "Wood", halfStars: 6, birthWeek: -6, birthDay: -42,
          retiredBy: "manual", retiredWeek: -1, motherId: null, fatherId: null,
        })
        .run();
    }
    // A stud seat costs 100 LT since round 23 — stake the rival barn with
    // enough land to open one, the way a barn that had fought would have.
    w.db
      .update(farms)
      .set({ landTokens: COVERS.STUD_LISTING_LT * 4 })
      .where(eq(farms.id, rivalId))
      .run();
    return { ...w, rivalId, rivalBreeding: new Breeding(w.db, rivalId, mulberry32(seed + 1)) };
  }

  test("an unlisted foreign rooster refuses; listing opens the cover", () => {
    const w = withRival();
    expect(() => w.breeding.breed("starter-2", "rival-stud")).toThrow(/not listed/);
    w.rivalBreeding.listStud("rival-stud");
    const { egg, split } = w.breeding.breed("starter-2", "rival-stud");
    // Hens keep the egg; the stud's owner banks 78.00 GP.
    expect(egg.farmId).toBe("farm-1");
    const rival = w.db.select().from(farms).where(eq(farms.id, w.rivalId)).get()!;
    expect(rival.gp).toBe(ECONOMY.STARTING_GP + split.studOwnerCents / 100);
    const dev = w.db.select().from(farms).where(eq(farms.id, "farm-1")).get()!;
    expect(dev.gp).toBe(ECONOMY.STARTING_GP - ECONOMY.BREED_FEE);
  });

  test("browse_studs: eligible listed, kin NAMED in exclusions, own studs included", () => {
    const w = withRival();
    w.rivalBreeding.listStud("rival-stud");
    const { studs, excluded } = w.breeding.browseStuds("starter-2"); // Dalisay
    const names = studs.map((s) => s.name).sort();
    // Both own retired roosters (unlisted — owner slots) + the listed rival.
    expect(names).toEqual(["Bagwis", "Tandang Pula", "rival-stud"]);
    expect(studs.find((s) => s.name === "rival-stud")!.mine).toBe(false);
    expect(studs.find((s) => s.name === "rival-stud")!.coversLeft).toBe(14);
    // Kin exclusion is NAMED, not hidden: breed a daughter, browse with her.
    w.breeding.breed("starter-2", "starter-1");
    const egg = w.db.select().from(birds).all().find((b) => b.name === "Egg of Dalisay")!;
    w.db.update(birds).set({ status: "retired", sex: "female" }).where(eq(birds.id, egg.id)).run();
    const view = w.breeding.browseStuds(egg.id);
    const kinExcluded = view.excluded.find((e) => e.name === "Tandang Pula");
    expect(kinExcluded?.reason).toMatch(/ancestor/);
    expect(excluded.length).toBe(0);
  });

  test("covers cap: 14 public a week, 2 owner-reserved — and they overflow", () => {
    const w = withRival();
    w.rivalBreeding.listStud("rival-stud");
    // Owner slots: two of the rival's own hens cover, the third refuses.
    w.rivalBreeding.breed("rival-hen", "rival-stud");
    w.rivalBreeding.breed("rival-hen-2", "rival-stud");
    expect(() => w.rivalBreeding.breed("rival-hen-3", "rival-stud")).toThrow(/owner covers/);
    // Public slots: 14 outside hens, the 15th refuses.
    for (let i = 0; i < 14; i++) {
      w.db
        .insert(birds)
        .values({
          id: `hen-${i}`, farmId: "farm-1", name: `hen-${i}`, sex: "female", status: "retired",
          agility: 500, sight: 500, stamina: 500, gameness: 500, station: 500, condition: 500,
          element: "Fire", halfStars: 4, birthWeek: -5, birthDay: -35,
          retiredBy: "manual", retiredWeek: 0, motherId: null, fatherId: null,
        })
        .run();
      w.breeding.breed(`hen-${i}`, "rival-stud");
    }
    expect(() => w.breeding.breed("starter-2", "rival-stud")).toThrow(/covered out/);
    // The barn now shows it as excluded — demand overflows to other studs.
    const { studs, excluded } = w.breeding.browseStuds("starter-2");
    expect(excluded.some((e) => e.name === "rival-stud" && /covered out/.test(e.reason))).toBe(true);
    expect(studs.some((s) => s.name === "Tandang Pula")).toBe(true);
  });
});

describe("bloodline restriction", () => {
  /** Insert a retired bird with given parents. */
  function insertRetired(
    db: ReturnType<typeof createDb>,
    id: string,
    sex: "female" | "male",
    motherId: string | null,
    fatherId: string | null
  ) {
    db.insert(birds)
      .values({
        id,
        farmId: "farm-1",
        name: id,
        sex,
        status: "retired",
        agility: 500, sight: 500, stamina: 500, gameness: 500, station: 500, condition: 500,
        element: "Fire",
        halfStars: 4,
        birthWeek: -5,
        birthDay: -35,
        retiredBy: "manual",
        retiredWeek: 0,
        motherId,
        fatherId,
      })
      .run();
  }

  test("parent × child is forbidden", () => {
    const { db, breeding } = freshGame();
    insertRetired(db, "daughter", "female", "starter-2", "starter-1");
    expect(() => breeding.breed("daughter", "starter-1")).toThrow(/ancestor/);
  });

  test("grandparent and great-grandparent are forbidden", () => {
    const { db, breeding } = freshGame();
    insertRetired(db, "gen1-hen", "female", "starter-2", "starter-1");
    insertRetired(db, "gen2-hen", "female", "gen1-hen", "starter-3");
    insertRetired(db, "gen3-hen", "female", "gen2-hen", "bagwis-line"); // father id not in ancestor path
    // starter-1 is grandfather of gen2-hen and great-grandfather of gen3-hen
    expect(() => breeding.breed("gen2-hen", "starter-1")).toThrow(/ancestor/);
    expect(() => breeding.breed("gen3-hen", "starter-1")).toThrow(/ancestor/);
  });

  test("siblings are forbidden (shared either parent)", () => {
    const { db, breeding } = freshGame();
    insertRetired(db, "sib-hen", "female", "starter-2", "starter-1");
    insertRetired(db, "sib-rooster", "male", "starter-2", "starter-3"); // half-siblings via mother
    expect(() => breeding.breed("sib-hen", "sib-rooster")).toThrow(/siblings/);
  });

  test("unrelated retired pairs may breed", () => {
    const { db, breeding } = freshGame();
    insertRetired(db, "line-a-hen", "female", "starter-2", "starter-1");
    insertRetired(db, "line-b-rooster", "male", "starter-4", "starter-3");
    expect(() => breeding.breed("line-a-hen", "line-b-rooster")).not.toThrow();
  });
});

describe("the stud sheet (round 28 — retirement is the reveal)", () => {
  test("browseStuds carries the full revealed sheet and an overall grade", () => {
    // WHY (round 28: the fog): a stud is retired by definition, so its sheet
    // is public — the revealed stats ARE the sales pitch. If this ever came
    // back nulled or dropped the grade, stud shopping would go blind and the
    // whole point of retiring well (your sheet becomes your price) is gone.
    const { db, breeding } = freshGame();
    const { studs } = breeding.browseStuds("starter-2"); // Dalisay browses her own barn
    expect(studs.length).toBeGreaterThan(0); // both retired dev roosters stand
    for (const stud of studs) {
      const row = db.select().from(birds).where(eq(birds.id, stud.birdId)).get()!;
      for (const stat of ["agility", "sight", "stamina", "gameness", "station", "condition"] as const) {
        expect(typeof stud.sheet[stat]).toBe("number");
        expect(stud.sheet[stat]).toBe(row[stat]); // the TRUE numbers, not a view through fog
      }
      expect(typeof stud.overallGrade).toBe("string");
      expect(stud.overallGrade.length).toBeGreaterThan(0); // one glanceable letter for shoppers
    }
  });
});

describe("lineage", () => {
  test("parent tree is derivable through great-grandparents", () => {
    const { db, breeding } = freshGame();
    db.insert(birds)
      .values({
        id: "kid",
        farmId: "farm-1",
        name: "Kid",
        sex: "female",
        status: "egg",
        agility: 500, sight: 500, stamina: 500, gameness: 500, station: 500, condition: 500,
        element: "Water",
        halfStars: 4,
        birthWeek: 0,
        birthDay: 0,
        motherId: "starter-2",
        fatherId: "starter-1",
      })
      .run();
    const tree = breeding.lineage("kid")!;
    expect(tree.mother?.name).toBe("Dalisay");
    expect(tree.father?.name).toBe("Tandang Pula");
    expect(tree.mother?.mother).toBeNull(); // starters have no recorded parents
  });
});
