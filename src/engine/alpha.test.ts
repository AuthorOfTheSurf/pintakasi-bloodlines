import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { birds, farms } from "@/db/schema";
import { Alpha, type ApplyInput } from "./alpha";
import { APPLICATION_LIMITS, BARN, ECONOMY } from "./config";
import { diagnose } from "./doctor";
import { Farms } from "./farms";
import { hatchDayOf } from "./lifecycle";
import { expectConserved, world } from "./testkit";

const APPLICANT: ApplyInput = {
  farmName: "Talisay Gamefarm",
  handler: "Lolo Ben",
  contact: "ben@example.com",
  country: "🇵🇭",
  primaryColor: "green",
  secondaryColor: "gold",
  background: "Thirty years of Kelsos in Cebu.",
};

function setup() {
  const w = world();
  return { ...w, alpha: new Alpha(w.db) };
}

describe("applying", () => {
  test("an application starts pending, with no farm and no claim token", () => {
    const { db, alpha } = setup();
    const before = db.select().from(farms).all().length;
    const app = alpha.apply(APPLICANT);
    expect(app.status).toBe("pending");
    expect(app.farmId).toBeNull();
    expect(app.claimToken).toBeNull();
    expect(app.contact).toBe("ben@example.com");
    // Applying creates nothing in the world: no farm, no stake.
    expect(db.select().from(farms).all().length).toBe(before);
    expectConserved(db);
  });

  test("the form's rules: required fields, palette colors, length caps", () => {
    const { alpha } = setup();
    expect(() => alpha.apply({ ...APPLICANT, farmName: "   " })).toThrow(/Farm name is required/);
    expect(() => alpha.apply({ ...APPLICANT, contact: "" })).toThrow(/reach you is required/);
    expect(() => alpha.apply({ ...APPLICANT, handler: "" })).toThrow(/Your name is required/);
    expect(() => alpha.apply({ ...APPLICANT, primaryColor: "chartreuse" })).toThrow(
      /must be one of/
    );
    expect(() =>
      alpha.apply({ ...APPLICANT, farmName: "x".repeat(APPLICATION_LIMITS.farmName + 1) })
    ).toThrow(/characters or fewer/);
    expect(() =>
      alpha.apply({ ...APPLICANT, background: "x".repeat(APPLICATION_LIMITS.background + 1) })
    ).toThrow(/characters or fewer/);
    expect(alpha.list()).toEqual([]);
  });

  test("a name is taken by an existing farm or a pending application, in any case", () => {
    const { alpha } = setup();
    // "Bukidnon Farms" is the dev farm the testkit world seeds.
    expect(() => alpha.apply({ ...APPLICANT, farmName: "BUKIDNON FARMS" })).toThrow(
      /already taken/
    );
    alpha.apply(APPLICANT);
    expect(() => alpha.apply({ ...APPLICANT, farmName: "talisay gamefarm" })).toThrow(
      /already taken/
    );
  });

  test("a declined name is free again", () => {
    const { alpha } = setup();
    alpha.decline(alpha.apply(APPLICANT).id);
    expect(alpha.apply(APPLICANT).status).toBe("pending");
  });
});

describe("deciding", () => {
  test("approve creates the farm with the starting stake and the starter flock", () => {
    const { db, alpha } = setup();
    const { id } = alpha.apply(APPLICANT);
    const { application, farm, apiKey, claimToken } = alpha.approve(id);

    expect(application.status).toBe("approved");
    expect(application.farmId).toBe(farm.id);
    expect(application.decidedAt).not.toBeNull();
    expect(claimToken.length).toBeGreaterThanOrEqual(40);
    expect(farm.name).toBe(APPLICANT.farmName);
    expect(farm.gp).toBe(ECONOMY.STARTING_GP);
    expect(farm.primaryColor).toBe("green");
    expect(new Farms(db).byKey(apiKey).id).toBe(farm.id);
    const row = db.select().from(farms).where(eq(farms.id, farm.id)).get();
    expect(row?.handler).toBe("Lolo Ben");
    expect(db.select().from(birds).where(eq(birds.farmId, farm.id)).all().length).toBe(
      BARN.STARTER_EGGS
    );

    // The stake came through the one faucet, so the doctor's proof still holds.
    expectConserved(db);
    for (const inv of diagnose(db, ":memory:").invariants) expect(inv.passed).toBe(true);
  });

  test("decline leaves no farm and no token", () => {
    const { db, alpha } = setup();
    const before = db.select().from(farms).all().length;
    const declined = alpha.decline(alpha.apply(APPLICANT).id);
    expect(declined.status).toBe("declined");
    expect(declined.claimToken).toBeNull();
    expect(declined.decidedAt).not.toBeNull();
    expect(db.select().from(farms).all().length).toBe(before);
  });

  test("only pending moves: a decided application cannot be decided again", () => {
    const { alpha } = setup();
    const a = alpha.apply(APPLICANT).id;
    alpha.approve(a);
    expect(() => alpha.approve(a)).toThrow(/already approved/);
    expect(() => alpha.decline(a)).toThrow(/already approved/);

    const b = alpha.apply({ ...APPLICANT, farmName: "Second Barn" }).id;
    alpha.decline(b);
    expect(() => alpha.approve(b)).toThrow(/already declined/);
    expect(() => alpha.decline(b)).toThrow(/already declined/);
    expect(() => alpha.approve(9999)).toThrow(/No application #9999/);
  });

  test("approve fails cleanly and stays pending if the name was taken since applying", () => {
    const { db, alpha } = setup();
    const { id } = alpha.apply(APPLICANT);
    // Someone registered the name by another door (a dev world's open one).
    new Farms(db).register({
      name: APPLICANT.farmName,
      primaryColor: "red",
      secondaryColor: "red",
    });
    const farmsBefore = db.select().from(farms).all().length;
    const birdsBefore = db.select().from(birds).all().length;

    expect(() => alpha.approve(id)).toThrow(/already exists/);
    const [app] = alpha.list();
    expect(app.status).toBe("pending");
    expect(app.claimToken).toBeNull();
    expect(db.select().from(farms).all().length).toBe(farmsBefore);
    expect(db.select().from(birds).all().length).toBe(birdsBefore);
    expectConserved(db);
  });
});

describe("day zero", () => {
  test("the welcome page's hatch day is the day the starter eggs really hatch", () => {
    // A fresh live world is approved on day 0, so the claim page tells the
    // player when their eggs hatch. That date has to be the engine's, not a
    // second opinion about it.
    const { db, game, alpha } = setup();
    const { farm } = alpha.approve(alpha.apply(APPLICANT).id);
    const eggs = () =>
      db
        .select()
        .from(birds)
        .where(eq(birds.farmId, farm.id))
        .all()
        .filter((b) => b.status === "egg");
    const hatchDay = hatchDayOf(Math.min(...eggs().map((b) => b.birthWeek)));
    expect(hatchDay).toBeGreaterThan(0);

    while (game.clock.currentDay() < hatchDay - 1) game.tickDay();
    expect(eggs().length).toBe(BARN.STARTER_EGGS);
    game.tickDay();
    expect(game.clock.currentDay()).toBe(hatchDay);
    expect(eggs().length).toBe(0);
  });
});

describe("claiming", () => {
  test("the claim token finds the farm; anything else finds nothing", () => {
    const { alpha } = setup();
    const { id } = alpha.apply(APPLICANT);
    const { claimToken, apiKey } = alpha.approve(id);
    const found = alpha.byClaimToken(claimToken);
    expect(found?.farm.apiKey).toBe(apiKey);
    expect(alpha.byClaimToken("")).toBeNull();
    expect(alpha.byClaimToken("not-a-token")).toBeNull();
  });

  test("markClaimed stamps the first view only", () => {
    const { alpha } = setup();
    const { id } = alpha.apply(APPLICANT);
    alpha.approve(id);
    alpha.markClaimed(id);
    const first = alpha.list()[0].claimedAt;
    expect(first).not.toBeNull();
    alpha.markClaimed(id);
    expect(alpha.list()[0].claimedAt).toBe(first);
  });
});
