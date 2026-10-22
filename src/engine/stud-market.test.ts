import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { birds, events, farmNotes, farms, gameState } from "@/db/schema";
import { seedGame } from "@/db/seed-data";
import { STUD_MARKET } from "./bot-config";
import { playHonestDay } from "./auto-play";
import { coverNet, priceStuds } from "./bots";
import { studMarket } from "./doctor";
import { Breeding, postStudPrices, splitBreedFee } from "./breeding";
import { BREED_SPLIT, COVERS, ECONOMY, STUD_PRICE } from "./config";
import { Game } from "./game";
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

/** Set a price and let the day tick post it, as an owner who priced yesterday. */
function priced(db: DB, owner: Breeding, studId: string, price: number) {
  owner.setStudPrice(studId, price);
  postStudPrices(db);
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
    expect(rival.setStudPrice("rival-stud", STUD_PRICE.CAP).pendingPrice).toBe(STUD_PRICE.CAP);
    expect(() => rival.setStudPrice("rival-stud", STUD_PRICE.FLOOR - 1)).toThrow(/from/);
    expect(() => rival.setStudPrice("rival-stud", STUD_PRICE.CAP + 1)).toThrow(/from/);
    expect(() => rival.setStudPrice("rival-stud", 200.5)).toThrow(/whole/);
    expect(() => rival.setStudPrice("rival-hen", 200)).toThrow(/hen/);
    expect(() => buyer.setStudPrice("rival-stud", 200)).toThrow();
  });

  test("browse_studs shows every hen the one posted price, the owner's own included", () => {
    const { db, rival, buyer } = market();
    priced(db, rival, "rival-stud", 500);
    const outside = buyer.browseStuds("starter-2").studs.find((s) => s.birdId === "rival-stud");
    expect(outside?.price).toBe(500);
    const own = rival.browseStuds("rival-hen").studs.find((s) => s.birdId === "rival-stud");
    expect(own?.price).toBe(500);
  });
});

describe("a posted price", () => {
  test("a reprice waits for the day tick, and only the owner sees it pending", () => {
    const { db, rival, buyer } = market();
    priced(db, rival, "rival-stud", 300);
    const set = rival.setStudPrice("rival-stud", 900);
    expect(set).toEqual({ stud: "rival-stud", price: 300, pendingPrice: 900 });
    const outside = () =>
      buyer.browseStuds("starter-2").studs.find((s) => s.birdId === "rival-stud");
    const own = () => rival.browseStuds("rival-hen").studs.find((s) => s.birdId === "rival-stud");
    expect(outside()).toMatchObject({ price: 300, pendingPrice: null });
    expect(own()).toMatchObject({ price: 300, pendingPrice: 900 });
    // Bought the same day, the cover is charged the price the buyer browsed.
    expect(buyer.breed("starter-2", "rival-stud").feePaid).toBe(300);
    postStudPrices(db);
    expect(outside()).toMatchObject({ price: 900, pendingPrice: null });
    expect(own()).toMatchObject({ price: 900, pendingPrice: null });
  });

  test("the last price set in a day is the one that posts", () => {
    const { db, rival, buyer } = market();
    rival.setStudPrice("rival-stud", 900);
    rival.setStudPrice("rival-stud", 240);
    postStudPrices(db);
    const stud = buyer.browseStuds("starter-2").studs.find((s) => s.birdId === "rival-stud");
    expect(stud?.price).toBe(240);
  });

  test("a rooster not yet listed takes his price at once, and stands at it from the first cover", () => {
    const { db, rival, buyer } = market();
    retired(db, "rival-new", "rival", "male");
    expect(rival.setStudPrice("rival-new", 600)).toEqual({
      stud: "rival-new",
      price: 600,
      pendingPrice: null,
    });
    rival.listStud("rival-new");
    expect(buyer.breed("starter-2", "rival-new").feePaid).toBe(600);
  });

  test("auto-play prices a new stud before listing him, so his listing day sells at his ask", () => {
    const { db, buyer } = market();
    retired(db, "rival-ace", "rival", "male", 900);
    playHonestDay(db, "rival");
    const ace = buyer.browseStuds("starter-2").studs.find((s) => s.birdId === "rival-ace");
    expect(ace?.price).toBeGreaterThan(STUD_PRICE.FLOOR);
    expect(ace?.pendingPrice).toBeNull();
    // Listed first and priced after, his ask waited for the tick and this
    // cover sold at the floor: 223 of them in round 70's 182-day world.
    expect(buyer.breed("starter-2", "rival-ace").feePaid).toBe(ace?.price ?? 0);
  });

  test("a pulled stud's waiting price posts when he is priced again, and a repeat press notes nothing", () => {
    const { db, rival } = market();
    priced(db, rival, "rival-stud", 300);
    rival.setStudPrice("rival-stud", 350); // waits for the tick
    rival.unlistStud("rival-stud");
    const notes = () =>
      db
        .select()
        .from(farmNotes)
        .where(eq(farmNotes.kind, "stud_price"))
        .all()
        .map((n) => JSON.parse(n.data ?? "{}") as { from: number | null; to: number });

    // Not standing, so 350 posts now: the change is from the 300 he carries.
    expect(rival.setStudPrice("rival-stud", 350)).toEqual({
      stud: "rival-stud",
      price: 350,
      pendingPrice: null,
    });
    expect(notes().at(-1)).toMatchObject({ from: 300, to: 350 });
    const count = notes().length;
    rival.setStudPrice("rival-stud", 350);
    rival.listStud("rival-stud");
    rival.setStudPrice("rival-stud", 400);
    rival.setStudPrice("rival-stud", 400);
    expect(notes().length).toBe(count + 1);
    // Standing at the price he posts, asking for it again queues nothing.
    postStudPrices(db);
    expect(rival.setStudPrice("rival-stud", 400)).toMatchObject({ price: 400, pendingPrice: null });
    expect(notes().length).toBe(count + 1);
  });

  test("a never-priced stud asked for the floor he stands at queues nothing and notes nothing", () => {
    const { db, rival } = market();
    const row = () => db.select().from(birds).where(eq(birds.id, "rival-stud")).get();
    expect(row()?.studPrice).toBeNull();
    expect(rival.setStudPrice("rival-stud", STUD_PRICE.FLOOR)).toMatchObject({
      price: STUD_PRICE.FLOOR,
      pendingPrice: null,
    });
    expect(row()?.studPriceNext).toBeNull();
    expect(db.select().from(farmNotes).where(eq(farmNotes.kind, "stud_price")).all()).toEqual([]);
    // A real change on the same stud still waits for the tick.
    expect(rival.setStudPrice("rival-stud", STUD_PRICE.FLOOR + 50).pendingPrice).toBe(
      STUD_PRICE.FLOOR + 50
    );
  });

  test("the game's day tick posts it", () => {
    const { db, rival, buyer } = market();
    rival.setStudPrice("rival-stud", 700);
    new Game(db, "farm-1").tickDay({ players: "hands-off" });
    const stud = buyer.browseStuds("starter-2").studs.find((s) => s.birdId === "rival-stud");
    expect(stud?.price).toBe(700);
  });
});

describe("buying a priced cover", () => {
  test("an outside hen pays the ask, split to owner and juice, and no GP is made or lost", () => {
    const { db, rival, buyer } = market();
    priced(db, rival, "rival-stud", 800);
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

  test("the owner's own hen pays his posted price, and nets the house share", () => {
    const { db, rival } = market();
    priced(db, rival, "rival-stud", 660);
    const before = gpOf(db, "rival");
    const world = worldCents(db);
    const { feePaid, split } = rival.breed("rival-hen", "rival-stud");
    expect(feePaid).toBe(660);
    // He pays 660 and the owner share comes straight back: his net is the
    // stakers' and juice's part of the floor plus 20% of the 500 premium.
    const floor = splitBreedFee(STUD_PRICE.FLOOR);
    const net =
      floor.stakerPoolCents + floor.juicePoolCents + 500 * 100 * STUD_PRICE.PREMIUM_SPLIT.JUICE;
    expect(gpOf(db, "rival")).toBe(before - net);
    expect(split.stakerPoolCents + split.juicePoolCents).toBe(net);
    expect(worldCents(db)).toBe(world);
  });

  test("a priced stud's owner-reserved covers stay the owner's, and leave public slots alone", () => {
    const { db, rival, buyer } = market();
    priced(db, rival, "rival-stud", 400);
    for (let i = 0; i < COVERS.OWNER_RESERVED; i++) {
      retired(db, `rival-hen-${i}`, "rival", "female");
      expect(rival.breed(`rival-hen-${i}`, "rival-stud").feePaid).toBe(400);
    }
    retired(db, "rival-hen-extra", "rival", "female");
    expect(() => rival.breed("rival-hen-extra", "rival-stud")).toThrow(/owner covers/);
    const outside = buyer.browseStuds("starter-2").studs.find((s) => s.birdId === "rival-stud");
    expect(outside?.coversLeft).toBe(COVERS.PER_WEEK);
  });

  test("maxPrice refuses a cover repriced above what the buyer read", () => {
    const { db, rival, buyer } = market();
    priced(db, rival, "rival-stud", 900);
    expect(() => buyer.breed("starter-2", "rival-stud", { maxPrice: 400 })).toThrow(
      /above your limit/
    );
    expect(buyer.breed("starter-2", "rival-stud", { maxPrice: 900 }).feePaid).toBe(900);
  });

  test("income goes to whoever owns the stud NOW, and his price travels with him", () => {
    const { db, rival, buyer } = market();
    priced(db, rival, "rival-stud", 400);
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
    const row = (id: string) => db.select().from(birds).where(eq(birds.id, id)).get();
    // A bot's ask goes up the same way a player's does: pending, then posted.
    expect(row("rival-ace")?.studPrice).toBeNull();
    const opening = STUD_PRICE.FLOOR * (1 + STUD_MARKET.OPENING_SPREAD * 0.5);
    expect(row("rival-ace")?.studPriceNext).toBe(opening);
    postStudPrices(db);
    // Two studs: the ace tops the sheet rank (1) and ties on earnings (0).
    expect(row("rival-ace")?.studPrice).toBe(opening);
    expect(row("rival-stud")?.studPrice).toBe(STUD_PRICE.FLOOR);
  });

  test("on the week's first day: sold out raises, cold cuts toward the floor", () => {
    const { db, rival } = market();
    retired(db, "rival-cold", "rival", "male");
    rival.listStud("rival-cold");
    priced(db, rival, "rival-stud", 400);
    priced(db, rival, "rival-cold", 400);
    for (let i = 0; i < COVERS.PER_WEEK; i++) egg(db, `e${i}`, "rival-stud", 2);
    // Mid-week: nothing moves.
    priceStuds(db, "rival", 9, 1);
    postStudPrices(db);
    const ask = (id: string) => db.select().from(birds).where(eq(birds.id, id)).get()?.studPrice;
    expect(ask("rival-stud")).toBe(400);
    priceStuds(db, "rival", 7, 1);
    expect(ask("rival-stud")).toBe(400); // pending until the tick
    postStudPrices(db);
    expect(ask("rival-stud")).toBe(400 * (1 + STUD_MARKET.RAISE_SOLD_OUT));
    const cut = 400 - (400 - STUD_PRICE.FLOOR) * STUD_MARKET.CUT_COLD;
    expect(ask("rival-cold")).toBe(
      Math.floor(cut / STUD_MARKET.PRICE_STEP) * STUD_MARKET.PRICE_STEP
    );
  });

  test("a buyer weighs the premium, and a rich wallet feels it less", () => {
    expect(coverNet(300, STUD_PRICE.FLOOR, 1, 8_000, false)).toBe(300);
    const poor = coverNet(300, 800, 1, 8_000, false);
    const rich = coverNet(300, 800, 1, 128_000, false);
    expect(poor).toBeLessThan(rich);
    expect(rich).toBeLessThan(300);
    expect(coverNet(300, 800, 0.4, 8_000, false)).toBeLessThan(poor);
  });

  test("on his own stud a barn weighs only the juice share of the premium", () => {
    const outside = 300 - coverNet(300, 800, 1, 8_000, false);
    const own = 300 - coverNet(300, 800, 1, 8_000, true);
    expect(own).toBeCloseTo(outside * STUD_PRICE.PREMIUM_SPLIT.JUICE, 9);
  });
});

describe("the doctor's stud market", () => {
  test("counts sales apart from own covers, and reads prices and premiums off the ledger", () => {
    const { db, rival, buyer } = market();
    priced(db, rival, "rival-stud", 660);
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

  test("price against outcome bands each old-enough cover and nets its chick's earnings", () => {
    const { db, rival, buyer } = market();
    priced(db, rival, "rival-stud", 660);
    const sale = buyer.breed("starter-2", "rival-stud").egg.id; // 501+
    buyer.breed("starter-4", "starter-1"); // farm-1's own stud, at the floor
    db.insert(events)
      .values({ dayIndex: 0, type: "purse_payout", birdId: sale, gpCents: 100_000, message: "x" })
      .run();
    const at = (day: number) => {
      db.update(gameState).set({ dayIndex: day }).where(eq(gameState.id, 1)).run();
      return studMarket(db);
    };
    // The covers were bought on day 0. The window is the doctor's own knob.
    const window = 500 - at(500).outcomeCutoffDay;
    expect(window).toBeGreaterThan(0);
    const tooSoon = at(window - 1).outcome;
    expect(tooSoon.reduce((s, r) => s + r.chicks, 0)).toBe(0);
    const rows = at(window).outcome;
    const band = (name: string) => rows.find((r) => r.band === name);
    expect(band("501+")).toMatchObject({
      chicks: 1,
      own: 0,
      avgEarnedCents: 100_000,
      avgNetCents: 100_000 - 66_000,
      paidBack: 1,
    });
    expect(band(`${STUD_PRICE.FLOOR} own`)).toMatchObject({
      chicks: 1,
      own: 1,
      avgEarnedCents: 0,
      avgNetCents: -STUD_PRICE.FLOOR * 100,
      paidBack: 0,
    });
    expect(band(`${STUD_PRICE.FLOOR} outside`)?.chicks).toBe(0);
  });
});
