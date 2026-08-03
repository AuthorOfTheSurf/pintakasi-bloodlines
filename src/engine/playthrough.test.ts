import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { birds, farms, gameState } from "@/db/schema";
import { seedGame, seedStarterFlock } from "@/db/seed-data";
import { Breeding } from "./breeding";
import { Flock } from "./flock";
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

test("the full breeding-lifecycle loop closes — PvP edition", () => {
  const w = world();
  const { game, flock, breeding } = w;

  // 1. Breed two retired starters — an egg, auto-named, age 0, sex hidden.
  const { egg } = breeding.breed("starter-2", "starter-1");
  expect(egg.name).toBe("Egg of Dalisay");
  expect(egg.age).toBe(0);
  expect(egg.sex).toBe("hidden");
  expect(egg.eggStage).toBe("gestating"); // pregnant now — lays Friday

  // 2. The nest timeline (round 13): the hen is pregnant now; the egg is
  //    LAID on the first Friday and HATCHES on the second, as an age-1
  //    chick whose 50-50 sex is revealed for the player to name.
  let tick = game.tickWeek(); // Friday 1 — laid, not hatched
  expect(tick.fridays[0].hatched.length).toBe(0);
  expect(flock.byId(egg.id).eggStage).toBe("laid");
  tick = game.tickWeek(); // Friday 2 — the hatch
  expect(tick.fridays[0].hatched.map((b) => b.id)).toContain(egg.id);
  const chick = flock.rename(egg.id, "Alon");
  expect(chick.age).toBe(1);
  expect(["male", "female"]).toContain(chick.sex);
  expect(["rooster", "hen"]).toContain(chick.sexLabel!);

  // 3. The discovery year: a juvenile card against a rival chick of the same
  // age. Round 20 closed the juvenile division to age 1, so the rival's own
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
  const juvenile = duel(w, chick.id, "rival-chick", { mode: "juvenile", classType: "open", format: "shortKnife" }, 21);
  expect(juvenile.birds).toContain("Alon");
  const afterJuvenile = flock.byId(chick.id);
  // ONE lifetime record (round 15): juvenile fights count like any other.
  expect(afterJuvenile.wins + afterJuvenile.losses).toBe(1);
  // Stats are FIXED at birth (round 13) — no training; discovery is fought.

  // 4. Age 2 — real stakes open, the record starts.
  tick = game.tickWeek();
  expect(flock.byId(chick.id).age).toBe(2);
  expect(() =>
    game.lobbies.enter(chick.id, { mode: "hardcore", classType: "open", format: "shortKnife" })
  ).toThrow(/age 3/);
  duel(w, chick.id, "Alab", { mode: "real", classType: "open", format: "shortKnife" }, 33);
  const afterReal = flock.byId(chick.id);
  expect(afterReal.wins + afterReal.losses).toBe(2); // juvenile + real — one record

  // 5. Age 3 — the fork opens as a package: hardcore AND retirement.
  tick = game.tickWeek();
  expect(flock.byId(chick.id).age).toBe(3);
  // Ride the career one more carded fight, then take the safe arm.
  duel(w, chick.id, "Sinag", { mode: "real", classType: "open", format: "shortKnife" }, 44);
  const retiree = flock.retire(chick.id);
  expect(retiree.status).toBe("retired");
  expect(retiree.retiredBy).toBe("manual");

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

  // 7. Two Fridays on (lay, then hatch): generation 2 is on the ground,
  //    and the lineage shows the line.
  tick = game.tickWeek(); // laid
  tick = game.tickWeek(); // hatched
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
  const gp = w.db.select().from(farms).where(eq(farms.id, w.farmId)).get()!.gp;
  expect(Number.isInteger(gp)).toBe(true);
});

describe("the cold start (round 15 — every stable begins with 4 eggs)", () => {
  test("four named age-0 eggs; nobody fights week one; Friday hatches the flock", () => {
    const db = createDb(":memory:");
    const dev = seedGame(db); // PRODUCTION shape — no legacy flock
    const game = new Game(db, dev.farmId);
    const flock = new Flock(db, dev.farmId);

    const eggs = flock.all();
    expect(eggs.length).toBe(4);
    expect(eggs.every((b) => b.status === "egg" && b.age === 0 && b.named === 1)).toBe(true);
    expect(eggs.filter((b) => b.sex === "hidden").length).toBe(4); // sexes hidden until hatch
    expect(new Set(eggs.map((b) => b.element)).size).toBe(4); // four distinct elements

    // Week one: eggs can't be carded at all.
    expect(() =>
      game.lobbies.enter(eggs[0].id, { mode: "juvenile", classType: "open", format: "shortKnife" })
    ).toThrow(/not an active fighter/);

    // Friday: the whole flock hatches at age 1 — juvenile year opens.
    const tick = game.tickWeek();
    expect(tick.fridays[0].hatched.length).toBe(4);
    const chick = flock.all()[0];
    expect(chick.age).toBe(1);
    expect(["rooster", "hen"]).toContain(chick.sexLabel!);
    expect(
      game.lobbies.enter(chick.id, { mode: "juvenile", classType: "open", format: "shortKnife" })
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
      const fight = duel(w, sinag.id, "Sinag", { mode: "hardcore", classType: "open", format: "shortKnife" }, seed);
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
