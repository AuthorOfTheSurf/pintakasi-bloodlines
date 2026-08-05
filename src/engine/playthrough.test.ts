import { beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { birds, farms, gameState } from "@/db/schema";
import { seedGame, seedStarterFlock } from "@/db/seed-data";
import { Breeding } from "./breeding";
import { BARN } from "./config";
import { Flock, type BirdView } from "./flock";
import { Game } from "./game";
import { Lobbies, type LobbySpec } from "./lobbies";
import { mulberry32 } from "./rng";

/**
 * The acceptance test — now in the PURE PvP world: two farms, and every
 * fight is a carded duel that goes off on the tick. Breed → next-Friday
 * hatch → discovery year → real stakes → the age-3 fork → retirement →
 * breed the retiree → next generation on the ground.
 */
function world() {
  const db = createDb(":memory:");
  const dev = seedGame(db, { flock: "legacy" });
  const game = new Game(db, dev.farmId);
  const { farm: rivalFarm } = game.farms.register({
    name: "Rival Gamefarm",
    primaryColor: "black",
    secondaryColor: "red",
  });
  seedStarterFlock(db, rivalFarm.id, { seed: 42, idPrefix: "rival", shape: "legacy" });
  return {
    db,
    farmId: dev.farmId,
    game,
    flock: game.flock,
    breeding: new Breeding(db, dev.farmId, mulberry32(11)),
    rival: new Lobbies(db, rivalFarm.id),
    rivalFlock: new Flock(db, rivalFarm.id),
  };
}

// Rival birds by canonical STARTER slot — names are world-unique now (the
// rival draws pool names), but the seed ids stay deterministic.
const RIVAL_SLOT: Record<string, number> = {
  "Tandang Pula": 1, Dalisay: 2, Bagwis: 3, Perlas: 4,
  Kidlat: 5, Alab: 6, Sinag: 7, "Batong Buhay": 8,
};
const rivalByName = (w: ReturnType<typeof world>, name: string) =>
  w.rivalFlock.byId(RIVAL_SLOT[name] ? `rival-${RIVAL_SLOT[name]}` : name);

/** Card my bird against a rival bird and let the night go off. */
function duel(w: ReturnType<typeof world>, myBirdId: string, rivalName: string, spec: LobbySpec, seed: number) {
  w.game.lobbies.enter(myBirdId, spec, seed);
  w.rival.enter(rivalByName(w, rivalName).id, spec);
  const tick = w.game.tickDay();
  return tick.card.find((l) => l.fights.length > 0)!.fights[0];
}

/**
 * The acceptance narrative, staged. This used to be one ~100-line test() —
 * provable end to end, but a single bad assertion anywhere in the middle
 * hid every stage after it, so one broken thing cost a full edit/run cycle
 * per stage to find. Splitting into sequential test()s makes each stage
 * report on its own; a `beforeAll`-built world is shared across them so the
 * story still reads top to bottom.
 *
 * ⚠ These stages are NOT independent — each mutates state the next one
 * depends on (an egg conceived → laid → hatched → aged → retired → bred
 * again), so they must run in file order. Bun runs the test()s inside one
 * describe sequentially in declaration order (never in parallel), which is
 * what makes sharing `w` and the module-scoped narrative variables safe.
 * No assertion below was weakened from the original single test — same
 * checks, same order, just reporting per stage instead of all at once.
 */
describe("the full breeding-lifecycle loop closes — PvP edition", () => {
  let w: ReturnType<typeof world>;
  let egg: BirdView;
  let chick: BirdView;
  let retiree: BirdView;
  let gen2: BirdView;

  beforeAll(() => {
    w = world();
  });

  test("1. breeding two retired starters lays an egg — auto-named, age 0, sex hidden", () => {
    const { egg: laid } = w.breeding.breed("starter-2", "starter-1");
    egg = laid;
    expect(egg.name).toBe("Egg of Dalisay");
    expect(egg.age).toBe(0);
    expect(egg.sex).toBe("hidden");
    expect(egg.eggStage).toBe("gestating"); // pregnant now — lays Friday
  });

  test("2. the nest timeline: laid the first Friday, hatched the second", () => {
    // The hen is pregnant now; the egg is LAID on the first Friday and
    // HATCHES on the second, as an age-1 chick whose 50-50 sex is revealed
    // for the player to name.
    let tick = w.game.tickWeek(); // Friday 1 — laid, not hatched
    expect(tick.fridays[0].hatched.length).toBe(0);
    expect(w.flock.byId(egg.id).eggStage).toBe("laid");
    tick = w.game.tickWeek(); // Friday 2 — the hatch
    expect(tick.fridays[0].hatched.map((b) => b.id)).toContain(egg.id);
    chick = w.flock.rename(egg.id, "Alon");
    expect(chick.age).toBe(1);
    expect(["male", "female"]).toContain(chick.sex);
    expect(["rooster", "hen"]).toContain(chick.sexLabel!);
  });

  test("3. the discovery year: a juvenile card against a same-age rival banks one record", () => {
    // Round 20 closed the juvenile division to age 1, so the rival's own
    // seeded "Kidlat" (three by now) can no longer make the weight — the
    // rival hatches a contemporary instead.
    const week = Math.floor(
      w.db.select().from(gameState).where(eq(gameState.id, 1)).get()!.dayIndex / 7
    );
    w.db
      .insert(birds)
      .values({
        id: "rival-chick", farmId: rivalByName(w, "Kidlat").farmId, name: "Rival Chick",
        sex: "male", status: "active",
        agility: 300, sight: 300, stamina: 300, gameness: 300, station: 300, condition: 300,
        element: "Wood", halfStars: 2, birthWeek: week - 1, birthDay: (week - 1) * 7, named: 1,
      })
      .run();
    const juvenile = duel(w, chick.id, "rival-chick", { mode: "juvenile", classType: "open", format: "b2" }, 21);
    expect(juvenile.birds).toContain("Alon");
    const afterJuvenile = w.flock.byId(chick.id);
    // ONE lifetime record (round 15): juvenile fights count like any other.
    expect(afterJuvenile.wins + afterJuvenile.losses).toBe(1);
    // Stats are FIXED at birth (round 13) — no training; discovery is fought.
  });

  test("4. age 2 opens real stakes; hardcore still gated at 3", () => {
    w.game.tickWeek();
    expect(w.flock.byId(chick.id).age).toBe(2);
    expect(() =>
      w.game.lobbies.enter(chick.id, { mode: "hardcore", classType: "open", format: "b2" })
    ).toThrow(/age 3/);
    duel(w, chick.id, "Alab", { mode: "real", classType: "open", format: "b2" }, 33);
    const afterReal = w.flock.byId(chick.id);
    expect(afterReal.wins + afterReal.losses).toBe(2); // juvenile + real — one record
  });

  test("5. age 3 opens the fork — hardcore AND retirement — as a package", () => {
    w.game.tickWeek();
    expect(w.flock.byId(chick.id).age).toBe(3);
    // Ride the career one more carded fight, then take the safe arm.
    duel(w, chick.id, "Sinag", { mode: "real", classType: "open", format: "b2" }, 44);
    retiree = w.flock.retire(chick.id);
    expect(retiree.status).toBe("retired");
    expect(retiree.retiredBy).toBe("manual");
  });

  test("6. the career→barn pipe: breed the retiree with an unrelated retiree, never its own parent", () => {
    const partner = retiree.sex === "female" ? "starter-3" : "starter-4";
    gen2 = w.breeding.breed(
      retiree.sex === "female" ? retiree.id : partner,
      retiree.sex === "female" ? partner : retiree.id
    ).egg;
    expect(gen2.status).toBe("egg");

    // ...but NOT with its own parent (the bloodline restriction holds).
    const parent = retiree.sex === "female" ? "starter-1" : "starter-2";
    expect(() =>
      w.breeding.breed(
        retiree.sex === "female" ? retiree.id : parent,
        retiree.sex === "female" ? parent : retiree.id
      )
    ).toThrow(/Bloodline restriction/);
  });

  test("7. two Fridays on: generation 2 hatches, and the lineage shows the line", () => {
    w.game.tickWeek(); // laid
    const tick = w.game.tickWeek(); // hatched
    expect(tick.fridays[0].hatched.map((b) => b.id)).toContain(gen2.id);
    const tree = w.breeding.lineage(gen2.id)!;
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
    const gp = w.db.select().from(farms).where(eq(farms.id, w.farmId)).get()!.gp;
    expect(Number.isInteger(gp)).toBe(true);
  });
});

describe("the cold start (every stable begins with BARN.STARTER_EGGS eggs)", () => {
  test("named age-0 eggs; nobody fights week one; Friday hatches the flock", () => {
    const db = createDb(":memory:");
    const dev = seedGame(db); // PRODUCTION shape — no legacy flock
    const game = new Game(db, dev.farmId);
    const flock = new Flock(db, dev.farmId);

    const eggs = flock.all();
    expect(eggs.length).toBe(BARN.STARTER_EGGS);
    expect(eggs.every((b) => b.status === "egg" && b.age === 0 && b.named === 1)).toBe(true);
    expect(eggs.filter((b) => b.sex === "hidden").length).toBe(BARN.STARTER_EGGS); // sexes hidden until hatch
    expect(new Set(eggs.map((b) => b.element)).size).toBe(5); // every element is represented

    // Week one: eggs can't be carded at all.
    expect(() =>
      game.lobbies.enter(eggs[0].id, { mode: "juvenile", classType: "open", format: "b2" })
    ).toThrow(/not an active fighter/);

    // Friday: the whole flock hatches at age 1 — juvenile year opens.
    const tick = game.tickWeek();
    expect(tick.fridays[0].hatched.length).toBe(BARN.STARTER_EGGS);
    const chick = flock.all()[0];
    expect(chick.age).toBe(1);
    expect(["rooster", "hen"]).toContain(chick.sexLabel!);
    expect(
      game.lobbies.enter(chick.id, { mode: "juvenile", classType: "open", format: "b2" })
        .entryId
    ).toBeGreaterThan(0);
  });
});

describe("hardcore arm of the loop", () => {
  test("a hardcore loss ends the career straight into the barn — still breedable", () => {
    // Hunt a lobby seed where OUR Sinag loses the hardcore duel.
    for (let seed = 1; seed < 200; seed++) {
      const w = world();
      const sinag = w.flock.all().find((b) => b.name === "Sinag")!; // age 3, at the fork
      const fight = duel(w, sinag.id, "Sinag", { mode: "hardcore", classType: "open", format: "b2" }, seed);
      if (fight.winnerFarm === "Bukidnon Farms") continue; // we won — wrong arm, next seed
      const after = w.flock.byId(sinag.id);
      expect(after.status).toBe("retired");
      expect(after.retiredBy).toBe("hardcore");
      // The loss is a conversion, not a destruction: she can breed immediately.
      expect(() => new Breeding(w.db, w.farmId, mulberry32(5)).breed(sinag.id, "starter-1")).not.toThrow();
      return;
    }
    throw new Error("no losing seed found");
  });
});
