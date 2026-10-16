import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { birds, farms, gameState } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { STUD_MARKET } from "./bot-config";
import { coverNet, priceStuds } from "./bots";
import { studMarket } from "./doctor";
import { Breeding, splitBreedFee } from "./breeding";
import { BREED_SPLIT, COVERS, ECONOMY, STUD_PRICE } from "./config";
import { mulberry32 } from "./rng";

type DB = ReturnType<typeof createDb>;

function retired(
  db: DB,
  id: string,
  farmId: string,
  sex: "male" | "female",
  stat = 600,
  birthDay = -42
) {
  db.insert(birds)
    .values({
      id,
      farmId,
      name: id,
      sex,
      status: "retired",
      agility: stat,
      sight: stat,
      stamina: stat,
      gameness: stat,
      station: stat,
      condition: stat,
      element: "Wood",
      halfStars: 6,
      birthWeek: -6,
      birthDay,
      retiredBy: "manual",
      retiredWeek: -1,
      motherId: null,
      fatherId: null,
    })
    .run();
}

function addFarm(db: DB, id: string) {
  db.insert(farms)
    .values({
      id,
      name: id,
      primaryColor: "black",
      secondaryColor: "red",
      apiKey: `fk_${id}`,
      gp: ECONOMY.STARTING_GP,
      landTokensCents: COVERS.STUD_LISTING_LT * 4,
    })
    .run();
}

/** The dev farm (farm-1, with its starter hens) and a rival standing one stud. */
function market() {
  const db = createDb(":memory:");
  seedGame(db, { flock: "legacy" });
  addFarm(db, "rival");
  retired(db, "rival-stud", "rival", "male");
  retired(db, "rival-hen", "rival", "female");
  const rival = new Breeding(db, "rival", mulberry32(2));
  rival.listStud("rival-stud");
  return { db, rival, buyer: new Breeding(db, "farm-1", mulberry32(1)) };
}

const gpOf = (db: DB, id: string) => {
  const f = db.select().from(farms).where(eq(farms.id, id)).get();
  if (!f) throw new Error(`no farm ${id}`);
  return f.gp * 100 + f.gpCents;
};

/** Wallets + both pools, in centi-GP: what a cover must leave unchanged. */
function worldCents(db: DB): number {
  const wallets = db
    .select()
    .from(farms)
    .all()
    .reduce((s, f) => s + f.gp * 100 + f.gpCents, 0);
  const st = db.select().from(gameState).where(eq(gameState.id, 1)).get();
  if (!st) throw new Error("no game state");
  return wallets + st.stakerPoolCents + st.juicePoolCents;
}

describe("the premium split", () => {
  test("the floor splits per BREED_SPLIT and the premium 80/20, summing to the cent", () => {
    const floor = splitBreedFee(STUD_PRICE.FLOOR);
    const capped = splitBreedFee(STUD_PRICE.CAP);
    const premiumCents = (STUD_PRICE.CAP - STUD_PRICE.FLOOR) * 100;
    // No staker cut on the premium: the staker slice is the floor's, unchanged.
    expect(capped.stakerPoolCents).toBe(floor.stakerPoolCents);
    expect(capped.premiumJuiceCents).toBe(premiumCents * STUD_PRICE.PREMIUM_SPLIT.JUICE);
    expect(capped.premiumOwnerCents).toBe(premiumCents * STUD_PRICE.PREMIUM_SPLIT.STUD_OWNER);
    expect(capped.juicePoolCents).toBe(floor.juicePoolCents + capped.premiumJuiceCents);
    expect(capped.studOwnerCents).toBe(floor.studOwnerCents + capped.premiumOwnerCents);
    expect(capped.stakerPoolCents + capped.juicePoolCents + capped.studOwnerCents).toBe(
      STUD_PRICE.CAP * 100
    );
    expect(floor.premiumJuiceCents + floor.premiumOwnerCents).toBe(0);
    expect(floor.stakerPoolCents).toBe(STUD_PRICE.FLOOR * 100 * BREED_SPLIT.STAKER);
  });

  test("an odd premium still sums exactly, the rounding landing on the owner", () => {
    const s = splitBreedFee(STUD_PRICE.FLOOR + 3);
    expect(s.stakerPoolCents + s.juicePoolCents + s.studOwnerCents).toBe(
      (STUD_PRICE.FLOOR + 3) * 100
    );
  });
});

describe("setting the price", () => {
  test("whole GP between floor and cap, on your own retired rooster only", () => {
    const { rival, buyer } = market();
    expect(rival.setStudPrice("rival-stud", STUD_PRICE.CAP).price).toBe(STUD_PRICE.CAP);
    expect(() => rival.setStudPrice("rival-stud", STUD_PRICE.FLOOR - 1)).toThrow(/from/);
    expect(() => rival.setStudPrice("rival-stud", STUD_PRICE.CAP + 1)).toThrow(/from/);
    expect(() => rival.setStudPrice("rival-stud", 200.5)).toThrow(/whole/);
    expect(() => rival.setStudPrice("rival-hen", 200)).toThrow(/hen/);
    expect(() => buyer.setStudPrice("rival-stud", 200)).toThrow();
  });

  test("browse_studs shows the ask to an outside hen and the floor to the owner's own", () => {
    const { rival, buyer } = market();
    rival.setStudPrice("rival-stud", 500);
    const outside = buyer.browseStuds("starter-2").studs.find((s) => s.birdId === "rival-stud");
    expect(outside?.price).toBe(500);
    const own = rival.browseStuds("rival-hen").studs.find((s) => s.birdId === "rival-stud");
    expect(own?.price).toBe(STUD_PRICE.FLOOR);
  });
});

describe("buying a priced cover", () => {
  test("an outside hen pays the ask, split to owner and juice, and no GP is made or lost", () => {
    const { db, rival, buyer } = market();
    rival.setStudPrice("rival-stud", 800);
    const before = worldCents(db);
    const buyerBefore = gpOf(db, "farm-1");
    const ownerBefore = gpOf(db, "rival");
    const { feePaid, split } = buyer.breed("starter-2", "rival-stud");
    expect(feePaid).toBe(800);
    expect(gpOf(db, "farm-1")).toBe(buyerBefore - 80_000);
    expect(gpOf(db, "rival")).toBe(ownerBefore + split.studOwnerCents);
    expect(split.premiumOwnerCents).toBe(640 * 100 * STUD_PRICE.PREMIUM_SPLIT.STUD_OWNER);
    expect(worldCents(db)).toBe(before);
  });

  test("the owner's own hen pays the floor whatever he asks", () => {
    const { db, rival } = market();
    rival.setStudPrice("rival-stud", STUD_PRICE.CAP);
    const before = gpOf(db, "rival");
    const { feePaid } = rival.breed("rival-hen", "rival-stud");
    expect(feePaid).toBe(STUD_PRICE.FLOOR);
    // Own stud: the owner share comes straight back.
    expect(gpOf(db, "rival")).toBe(
      before - STUD_PRICE.FLOOR * 100 + splitBreedFee(STUD_PRICE.FLOOR).studOwnerCents
    );
  });

  test("maxPrice refuses a cover repriced above what the buyer read", () => {
    const { rival, buyer } = market();
    rival.setStudPrice("rival-stud", 900);
    expect(() => buyer.breed("starter-2", "rival-stud", { maxPrice: 400 })).toThrow(
      /above your limit/
    );
    expect(buyer.breed("starter-2", "rival-stud", { maxPrice: 900 }).feePaid).toBe(900);
  });

  test("income goes to whoever owns the stud NOW, and his price travels with him", () => {
    const { db, rival, buyer } = market();
    rival.setStudPrice("rival-stud", 400);
    addFarm(db, "new-owner");
    // A change of hands (the marketplace is coming; today only the row moves).
    db.update(birds).set({ farmId: "new-owner" }).where(eq(birds.id, "rival-stud")).run();
    const listedBefore = gpOf(db, "rival");
    const newBefore = gpOf(db, "new-owner");
    const { split } = buyer.breed("starter-2", "rival-stud");
    expect(split.feeGp).toBe(400);
    expect(gpOf(db, "new-owner")).toBe(newBefore + split.studOwnerCents);
    expect(gpOf(db, "rival")).toBe(listedBefore);
  });
});

describe("how bots price and buy", () => {
  function egg(db: DB, id: string, fatherId: string, birthDay: number) {
    retired(db, id, "farm-1", "female", 300, birthDay);
    db.update(birds).set({ status: "egg", fatherId }).where(eq(birds.id, id)).run();
  }

  test("a stud's opening ask ranks his sheet among the studs standing", () => {
    const { db } = market();
    retired(db, "rival-ace", "rival", "male", 900);
    new Breeding(db, "rival", mulberry32(3)).listStud("rival-ace");
    priceStuds(db, "rival", 3, 1);
    const ask = (id: string) => db.select().from(birds).where(eq(birds.id, id)).get()?.studPrice;
    // Two studs: the ace tops the sheet rank (1) and ties on earnings (0).
    expect(ask("rival-ace")).toBe(STUD_PRICE.FLOOR * (1 + STUD_MARKET.OPENING_SPREAD * 0.5));
    expect(ask("rival-stud")).toBe(STUD_PRICE.FLOOR);
  });

  test("on the week's first day: sold out raises, cold cuts toward the floor", () => {
    const { db, rival } = market();
    retired(db, "rival-cold", "rival", "male");
    rival.listStud("rival-cold");
    rival.setStudPrice("rival-stud", 400);
    rival.setStudPrice("rival-cold", 400);
    for (let i = 0; i < COVERS.PER_WEEK; i++) egg(db, `e${i}`, "rival-stud", 2);
    // Mid-week: nothing moves.
    priceStuds(db, "rival", 9, 1);
    const ask = (id: string) => db.select().from(birds).where(eq(birds.id, id)).get()?.studPrice;
    expect(ask("rival-stud")).toBe(400);
    priceStuds(db, "rival", 7, 1);
    expect(ask("rival-stud")).toBe(400 * (1 + STUD_MARKET.RAISE_SOLD_OUT));
    const cut = 400 - (400 - STUD_PRICE.FLOOR) * STUD_MARKET.CUT_COLD;
    expect(ask("rival-cold")).toBe(
      Math.floor(cut / STUD_MARKET.PRICE_STEP) * STUD_MARKET.PRICE_STEP
    );
  });

  test("a buyer weighs the premium, and a rich wallet feels it less", () => {
    expect(coverNet(300, STUD_PRICE.FLOOR, 1, 8_000)).toBe(300);
    const poor = coverNet(300, 800, 1, 8_000);
    const rich = coverNet(300, 800, 1, 128_000);
    expect(poor).toBeLessThan(rich);
    expect(rich).toBeLessThan(300);
    expect(coverNet(300, 800, 0.4, 8_000)).toBeLessThan(poor);
  });
});

describe("the doctor's stud market", () => {
  test("counts sales apart from own covers, and reads prices and premiums off the ledger", () => {
    const { db, rival, buyer } = market();
    rival.setStudPrice("rival-stud", 660);
    buyer.breed("starter-2", "rival-stud"); // a sale at 660
    buyer.breed("starter-4", "starter-1"); // farm-1's own stud: floor, not a sale
    const m = studMarket(db);
    expect(m.covers).toBe(2);
    expect(m.sold).toBe(1);
    expect(m.soldAboveFloor).toBe(1);
    expect(m.price).toEqual({ median: 660, p90: 660, max: 660 });
    const split = splitBreedFee(660);
    expect(m.premiumOwnerCents).toBe(split.premiumOwnerCents);
    expect(m.premiumJuiceCents).toBe(split.premiumJuiceCents);
    expect(m.saleIncomeCents).toBe(split.studOwnerCents);
    expect(m.top3).toEqual([{ farm: "rival", cents: split.studOwnerCents }]);
  });
});
