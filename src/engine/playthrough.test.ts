import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { farms } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { Battle } from "./battle";
import { Breeding } from "./breeding";
import { Flock } from "./flock";
import { Game } from "./game";
import { ECONOMY } from "./config";
import { mulberry32 } from "./rng";

/**
 * The acceptance test: the spec's "what playable and testable means" loop,
 * played end to end in one sitting. Breed → next-Friday hatch → discovery
 * year → real stakes → the age-3 fork → career → retirement → breed the
 * retiree → next generation on the ground.
 */
test("the full breeding-lifecycle loop closes", () => {
  const db = createDb(":memory:");
  const { farmId } = seedGame(db);
  const game = new Game(db, farmId);
  const breeding = new Breeding(db, farmId, mulberry32(11));
  const battle = new Battle(db, farmId);
  const flock = new Flock(db, farmId);

  // 1. Breed two retired starters — an egg, auto-named, age 0, sex hidden.
  const { egg } = breeding.breed("starter-2", "starter-1");
  expect(egg.name).toBe("Egg of Dalisay");
  expect(egg.age).toBe(0);
  expect(egg.sex).toBe("hidden");

  // 2. Next Hatch Friday it hatches into an age-1 chick; the 50-50 sex is
  //    revealed and the player names it.
  let tick = game.tickWeek();
  expect(tick.fridays[0].hatched.map((b) => b.id)).toContain(egg.id);
  const chick = flock.rename(egg.id, "Alon");
  expect(chick.age).toBe(1);
  expect(["male", "female"]).toContain(chick.sex);
  expect(["rooster", "hen"]).toContain(chick.sexLabel!);

  // 3. The discovery year: amateur fights (small stakes, own record) and training.
  const practice = battle.fight(chick.id, "practice", "shortKnife", 21);
  expect(practice.gpDelta).toBe(
    practice.result === "win" ? ECONOMY.PRACTICE_ENTRY_FEE : -ECONOMY.PRACTICE_ENTRY_FEE
  );
  expect(practice.bird.wins + practice.bird.losses).toBe(0); // career untouched
  expect(practice.bird.practiceWins + practice.bird.practiceLosses).toBe(1);
  const gamenessBefore = chick.gameness;
  game.tickDay(); // fresh training day
  flock.train(chick.id, "gameness");
  flock.train(chick.id, "gameness");
  expect(flock.byId(chick.id).gameness).toBe(gamenessBefore + 40);

  // 4. Age 2 — real stakes open, the record starts.
  tick = game.tickWeek();
  expect(flock.byId(chick.id).age).toBe(2);
  expect(() => battle.fight(chick.id, "hardcore", "shortKnife", 1)).toThrow(/age 3/);
  const real = battle.fight(chick.id, "real", "shortKnife", 33);
  expect(real.bird.wins + real.bird.losses).toBe(1);

  // 5. Age 3 — the fork opens as a package: hardcore AND retirement.
  tick = game.tickWeek();
  const atFork = flock.byId(chick.id);
  expect(atFork.age).toBe(3);
  // Ride the career one more real fight, then take the safe arm.
  battle.fight(chick.id, "real", "shortKnife", 44);
  const retiree = flock.retire(chick.id);
  expect(retiree.status).toBe("retired");
  expect(retiree.retiredBy).toBe("manual");
  expect(retiree.studValue).toBeGreaterThan(0);

  // 6. The career→barn pipe: breed the retiree with an UNRELATED retiree.
  const partner = retiree.sex === "female" ? "starter-3" : "starter-4";
  const gen2 = breeding.breed(
    retiree.sex === "female" ? retiree.id : partner,
    retiree.sex === "female" ? partner : retiree.id
  ).egg;
  expect(gen2.status).toBe("egg");

  // ...but NOT with its own parent (the bloodline restriction holds).
  const parent = retiree.sex === "female" ? "starter-1" : "starter-2";
  expect(() =>
    breeding.breed(
      retiree.sex === "female" ? retiree.id : parent,
      retiree.sex === "female" ? parent : retiree.id
    )
  ).toThrow(/Bloodline restriction/);

  // 7. Next Friday: generation 2 is on the ground, lineage shows the line.
  tick = game.tickWeek();
  expect(tick.fridays[0].hatched.map((b) => b.id)).toContain(gen2.id);
  const tree = breeding.lineage(gen2.id)!;
  const parents = [tree.mother!.name, tree.father!.name];
  expect(parents).toContain("Alon");
  const grandparents = [
    tree.mother?.mother?.name,
    tree.mother?.father?.name,
    tree.father?.mother?.name,
    tree.father?.father?.name,
  ].filter(Boolean);
  expect(grandparents).toContain("Dalisay"); // Alon's mother, gen2's grandmother

  // The wallet stayed a single closed number all game.
  const gp = db.select().from(farms).where(eq(farms.id, farmId)).get()!.gp;
  expect(Number.isInteger(gp)).toBe(true);
});

describe("hardcore arm of the loop", () => {
  test("a hardcore loss ends the career straight into the barn — still breedable", () => {
    const db = createDb(":memory:");
    const { farmId } = seedGame(db);
    const battle = new Battle(db, farmId);
    const flock = new Flock(db, farmId);
    const breeding = new Breeding(db, farmId, mulberry32(5));

    const sinag = flock.all().find((b) => b.name === "Sinag")!; // age 3, at the fork
    // Find a losing seed deterministically.
    let lossSeed = -1;
    for (let seed = 1; seed < 200; seed++) {
      const probe = createDb(":memory:");
      const probeFarm = seedGame(probe).farmId;
      const pSinag = new Flock(probe, probeFarm).all().find((b) => b.name === "Sinag")!;
      if (new Battle(probe, probeFarm).fight(pSinag.id, "hardcore", "shortKnife", seed).result === "loss") {
        lossSeed = seed;
        break;
      }
    }
    expect(lossSeed).toBeGreaterThan(0);

    const r = battle.fight(sinag.id, "hardcore", "shortKnife", lossSeed);
    expect(r.forcedRetirement).toBe(true);
    expect(r.bird.retiredBy).toBe("hardcore");
    // The loss is a conversion, not a destruction: she can breed immediately.
    expect(() => breeding.breed(sinag.id, "starter-1")).not.toThrow();
  });
});
