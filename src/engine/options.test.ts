/**
 * The options brief's three guarantees, pinned (round 63 — see
 * runs/options-brief-spec.md):
 *
 *   1. LEGALITY — a row that renders is a row the engine would accept:
 *      mode law, maiden law, the 400 GP reserve. The silent-refusal class
 *      dies at generation time, so the tests attack it at build time.
 *   2. DETERMINISM — same view, same plan, bit for bit. The EV-capture
 *      metric ("did the barn take the top row?") is only meaningful if the
 *      rows are reproducible.
 *   3. TRANSLATION — a pick is a LOOKUP, never an interpretation: unknown
 *      letters drop, duplicate birds drop, rest counts, offMenu passes
 *      through the legacy grammar untouched.
 *
 * Views are synthetic on purpose: buildOptions is a pure function of the
 * view, and these tests are the proof that it stays one.
 */
import { describe, expect, test } from "bun:test";
import type { BotView } from "./bot-brain";
import { ECONOMY, JUVENILE_MAJOR, PINTAKASI, type FightFormat } from "./config";
import { digestOptions, toActionsFromPicks } from "./decider-ollama";
import { buildOptions, GP_RESERVE, OPTION_ROWS_PER_BIRD } from "./options";

const FORMAT_KEYS: FightFormat[] = ["b1", "b2", "b3", "b4", "b5"];

const blade = (score: number) => ({ wins: 0, losses: 0, fights: 0, avgFigure: 0, score });

const scoutOf = (best: FightFormat, totalFights = 0, bestScore = 60) => ({
  blades: Object.fromEntries(FORMAT_KEYS.map((f) => [f, blade(f === best ? bestScore : 30)])),
  bestBlade: best,
  bestEvidence: null,
  totalFights,
});

let nextBird = 0;
const bird = (over: Record<string, unknown> = {}) => ({
  id: `bird-${++nextBird}`,
  name: `Bird ${nextBird}`,
  status: "active",
  age: 4,
  stars: "3★ Fire",
  halfStars: 6,
  wins: 0,
  losses: 0,
  stakesWins: 0,
  sexLabel: "rooster",
  listedStud: 0,
  named: 1,
  ...over,
});

const viewOf = (over: Record<string, unknown> = {}): BotView => {
  const { farm: farmOver, ...rest } = over;
  return {
    day: 10,
    weather: { today: "Fire", tomorrow: "Water" },
    card: { today: [], tomorrow: [] },
    farm: {
      id: "bot-t",
      name: "Test Barn",
      gp: 5_000,
      landTokensCents: 0,
      stakedLandCents: 0,
      freePulls: 0,
      checkedInToday: false,
      barn: { count: 5, capacity: 100 },
      ...((farmOver as object) ?? {}),
    },
    flock: [],
    board: [],
    claimerBoard: [],
    scout: {},
    crowns: { weekFormats: [], eligibleBirdIds: [], juvenileFormats: [], juvenileEligibleBirdIds: [] },
    studMarket: [],
    ledger: { cardNetGp: 0, crownFeesGp: 0, crownWinningsGp: 0 },
    ...rest,
  } as unknown as BotView;
};

describe("legality: a rendered row is a row the engine would accept", () => {
  test("the mode law is structural — an age-1 bird sees only juvenile rows, a grown bird only real", () => {
    const chick = bird({ age: 1 });
    const vet = bird({ age: 4 });
    const view = viewOf({
      flock: [chick, vet],
      scout: { [chick.id]: scoutOf("b2"), [vet.id]: scoutOf("b2") },
      card: {
        today: [
          { classType: "maiden", format: "b2", mode: "juvenile" },
          { classType: "maiden", format: "b2", mode: "real" },
        ],
        tomorrow: [],
      },
    });
    const plan = buildOptions(view);
    const enters = (id: string) =>
      plan.birds
        .find((b) => b.birdId === id)!
        .options.filter((o) => o.action?.do === "enter")
        .map((o) => o.do);
    expect(enters(chick.id).every((d) => d.includes("juvenile"))).toBe(true);
    expect(enters(chick.id).length).toBeGreaterThan(0);
    expect(enters(vet.id).every((d) => d.includes("real"))).toBe(true);
    expect(enters(vet.id).length).toBeGreaterThan(0);
  });

  test("the maiden law reads the right season's record", () => {
    // A juvenile with a juvenile win is out of juvenile maidens; a grown
    // bird with juvenile wins but no STAKES wins still qualifies for grown
    // maidens — entryRefusal's own subtlety, inherited not re-implemented.
    const provenChick = bird({ age: 1, wins: 1 });
    const freshVet = bird({ age: 4, wins: 3, stakesWins: 0 });
    const view = viewOf({
      flock: [provenChick, freshVet],
      scout: { [provenChick.id]: scoutOf("b2"), [freshVet.id]: scoutOf("b2") },
      card: {
        today: [
          { classType: "maiden", format: "b2", mode: "juvenile" },
          { classType: "maiden", format: "b2", mode: "real" },
        ],
        tomorrow: [],
      },
    });
    const plan = buildOptions(view);
    const rows = (id: string) =>
      plan.birds.find((b) => b.birdId === id)!.options.filter((o) => o.action?.do === "enter");
    expect(rows(provenChick.id)).toHaveLength(0); // won already — no maiden for it
    expect(rows(freshVet.id)).toHaveLength(1); // stakes-fresh — grown maiden open
  });

  test("the 400 GP reserve prices rows out instead of trusting the model", () => {
    const b = bird({ age: 4 });
    const cards = {
      today: [
        { classType: "maiden", format: "b2", mode: "real" }, // fee 60
        { classType: "open", format: "b2", mode: "real" }, //   fee 300
      ],
      tomorrow: [],
    };
    const rich = buildOptions(
      viewOf({ flock: [b], scout: { [b.id]: scoutOf("b2") }, card: cards })
    );
    const poor = buildOptions(
      viewOf({
        flock: [b],
        scout: { [b.id]: scoutOf("b2") },
        card: cards,
        farm: { gp: GP_RESERVE + 100 }, // covers the maiden, not the open
      })
    );
    const enterCount = (plan: ReturnType<typeof buildOptions>) =>
      plan.birds[0].options.filter((o) => o.action?.do === "enter").length;
    expect(enterCount(rich)).toBe(2);
    expect(enterCount(poor)).toBe(1);
  });
});

describe("the rows themselves", () => {
  test("sorted by value, rest always last at value 0, at most the cap, picks lettered A…", () => {
    const b = bird({ age: 1 });
    const view = viewOf({
      flock: [b, bird({ age: 4 }), bird({ age: 4 }), bird({ age: 4 })],
      scout: { [b.id]: scoutOf("b2") },
      crowns: {
        weekFormats: [],
        eligibleBirdIds: [],
        juvenileFormats: ["b2", "b4"],
        juvenileEligibleBirdIds: [b.id],
      },
      card: {
        today: [
          { classType: "maiden", format: "b2", mode: "juvenile" },
          { classType: "open", format: "b2", mode: "juvenile" },
          { classType: "claimer", format: "b2", mode: "juvenile", price: 90 },
        ],
        tomorrow: [],
      },
    });
    const card = buildOptions(view).birds.find((x) => x.birdId === b.id)!;
    expect(card.options.length).toBeLessThanOrEqual(OPTION_ROWS_PER_BIRD);
    const last = card.options[card.options.length - 1];
    expect(last.do).toBe("rest");
    expect(last.value).toBe(0);
    expect(last.action).toBeNull();
    for (let i = 1; i < card.options.length; i++)
      expect(card.options[i].value).toBeLessThanOrEqual(card.options[i - 1].value);
    expect(card.options.map((o) => o.pick)).toEqual(
      card.options.map((_, i) => String.fromCharCode(65 + i))
    );
  });

  test("crown rows: juvenile 9 at its blade and never hardcore; major carries hardcore; age-8 shot reads free", () => {
    const chick = bird({ age: 1, wins: 2 });
    const champ = bird({ age: 5, stakesWins: 4 });
    const vet = bird({ age: 8, stakesWins: 4 });
    const view = viewOf({
      flock: [chick, champ, vet, bird({ age: 4 })],
      scout: {
        [chick.id]: scoutOf("b2"),
        [champ.id]: scoutOf("b1"),
        [vet.id]: scoutOf("b1"),
      },
      crowns: {
        weekFormats: ["b1", "b3", "b5"],
        eligibleBirdIds: [champ.id, vet.id],
        juvenileFormats: ["b2", "b4"],
        juvenileEligibleBirdIds: [chick.id],
      },
    });
    const plan = buildOptions(view);
    const rowOf = (id: string, verb: string) =>
      plan.birds.find((b) => b.birdId === id)!.options.find((o) => o.do.startsWith(verb));

    const juvi = rowOf(chick.id, "crown juvenile")!;
    expect(juvi.value).toBe(9);
    expect(juvi.hardcore).toBeUndefined();
    expect(juvi.fee).toBe(JUVENILE_MAJOR.ENTRY_FEE);
    expect(juvi.action).toEqual({ do: "crown", birdId: chick.id, format: "b2", division: "juvenile" });

    const major = rowOf(champ.id, "crown major")!;
    expect(major.hardcore).toBe(true);
    expect(major.value).toBe(8); // at its proven blade
    expect(major.fee).toBe(PINTAKASI.ENTRY_FEE);

    expect(rowOf(vet.id, "crown major")!.value).toBe(9); // retires at 9 anyway
  });

  test("retire appears exactly when the pipeline logic says so", () => {
    const loserHen = bird({ age: 3, sexLabel: "hen", wins: 1, losses: 5 });
    const chick = bird({ age: 1 });
    const filler = [bird({ age: 4 }), bird({ age: 4 })];
    const emptyShed = buildOptions(viewOf({ flock: [loserHen, chick, ...filler] }));
    const retireRow = emptyShed.birds
      .find((b) => b.birdId === loserHen.id)!
      .options.find((o) => o.action?.do === "retire");
    expect(retireRow).toBeDefined();
    expect(retireRow!.value).toBe(8); // 1 + empty-shed 4 + loser 3
    expect(retireRow!.why).toContain("EMPTY");

    // Age gates it (manual retirement is 3+)…
    const chickRows = emptyShed.birds.find((b) => b.birdId === chick.id)!.options;
    expect(chickRows.some((o) => o.action?.do === "retire")).toBe(false);

    // …and a roster at fighting-strength minimum never offers it.
    const thin = buildOptions(viewOf({ flock: [loserHen, chick] }));
    expect(
      thin.birds.find((b) => b.birdId === loserHen.id)!.options.some((o) => o.action?.do === "retire")
    ).toBe(false);
  });

  test("barn rows: pre-paired breeding (market studs included), gacha, expansion wall, claims — '@' picks", () => {
    const hen = bird({ status: "retired", sexLabel: "hen", halfStars: 8 });
    const view = viewOf({
      flock: [hen, bird({ age: 4 }), bird({ age: 4 }), bird({ age: 4 }), bird({ age: 4 })],
      studMarket: [{ id: "stud-m", name: "Cruel Beak", stars: 4.5, farm: "bot-9" }],
      farm: { freePulls: 2, barn: { count: 99, capacity: 100 } },
      claimerBoard: [
        {
          price: 90,
          entries: [
            {
              entryId: 7,
              mine: false,
              bird: { name: "Thunderclap", age: 3, stars: "3.5★ Water", career: { wins: 4, losses: 1 } },
            },
          ],
        },
      ],
    });
    const { barn } = buildOptions(view);
    expect(barn.map((r) => r.pick)).toEqual(barn.map((_, i) => `@${i + 1}`));

    const breed = barn.find((r) => r.action?.do === "breed")!;
    expect(breed.do).toContain("Cruel Beak");
    expect(breed.fee).toBe(ECONOMY.BREED_FEE);
    expect(breed.action).toEqual({ do: "breed", motherId: hen.id, fatherId: "stud-m" });

    expect(barn.some((r) => r.action?.do === "expand_barn")).toBe(true);
    expect(barn.find((r) => r.action?.do === "roll_gacha")!.do).toContain("× 2");

    const claim = barn.find((r) => r.action?.do === "claim")!;
    expect(claim.action).toEqual({ do: "claim", entryId: 7 });
    expect(claim.fee).toBe(90);
  });

  test("no breed row without a hen, without space, or without the fee", () => {
    const hen = bird({ status: "retired", sexLabel: "hen" });
    const stud = { id: "s", name: "S", stars: 3, farm: "x" };
    const noHen = buildOptions(viewOf({ studMarket: [stud] }));
    const noSpace = buildOptions(
      viewOf({ flock: [hen], studMarket: [stud], farm: { barn: { count: 100, capacity: 100 } } })
    );
    const noFee = buildOptions(
      viewOf({ flock: [hen], studMarket: [stud], farm: { gp: GP_RESERVE + ECONOMY.BREED_FEE - 1 } })
    );
    for (const plan of [noHen, noSpace, noFee])
      expect(plan.barn.some((r) => r.action?.do === "breed")).toBe(false);
  });
});

describe("determinism", () => {
  test("same view, same plan — bit for bit", () => {
    const make = () => {
      nextBird = 100; // pin ids so the two views are truly identical
      const chick = bird({ age: 1, wins: 2 });
      return viewOf({
        flock: [chick, bird({ age: 4, losses: 3 }), bird({ age: 8, stakesWins: 4 }), bird({ status: "retired", sexLabel: "hen" })],
        scout: { [chick.id]: scoutOf("b2", 3) },
        crowns: {
          weekFormats: ["b1"],
          eligibleBirdIds: [],
          juvenileFormats: ["b2", "b4"],
          juvenileEligibleBirdIds: [chick.id],
        },
        card: { today: [{ classType: "maiden", format: "b2", mode: "juvenile" }], tomorrow: [] },
        studMarket: [{ id: "s", name: "S", stars: 3, farm: "x" }],
        farm: { freePulls: 1 },
      });
    };
    expect(JSON.stringify(buildOptions(make()))).toBe(JSON.stringify(buildOptions(make())));
  });
});

describe("translation: a pick is a lookup, never an interpretation", () => {
  const translationView = () => {
    nextBird = 200;
    const a = bird({ age: 4 });
    const b = bird({ age: 4 });
    return {
      a,
      b,
      view: viewOf({
        flock: [a, b, bird({ age: 4 }), bird({ age: 4 })],
        scout: { [a.id]: scoutOf("b2"), [b.id]: scoutOf("b3") },
        card: { today: [{ classType: "maiden", format: "b2", mode: "real" }], tomorrow: [] },
        farm: { freePulls: 2 },
      }),
    };
  };

  test("valid picks land, case-insensitively; the brief never leaks engine actions", () => {
    const { a, view } = translationView();
    const { brief, maps, offeredRows } = digestOptions(view);
    expect(JSON.stringify(brief)).not.toContain(a.id); // real ids stay engine-side
    expect(JSON.stringify(brief)).not.toContain('"action"');
    expect(offeredRows).toBeGreaterThan(0);

    const out = toActionsFromPicks(
      { picks: [{ bird: "#1", pick: "a" }], barnPicks: [], offMenu: [] },
      maps
    );
    expect(out.dropped).toBe(0);
    expect(out.actions).toHaveLength(1);
    expect(out.actions[0].do).toBe("enter");
    expect(out.offered.picksTaken).toBe(1);
    expect(out.offered.topPicksTaken).toBe(1); // A is the top row by construction
  });

  test("unknown bird, unknown letter, and a second pick for the same bird all drop with reasons", () => {
    const { view } = translationView();
    const { maps } = digestOptions(view);
    const out = toActionsFromPicks(
      {
        picks: [
          { bird: "#9", pick: "A" },
          { bird: "#1", pick: "Z" },
          { bird: "#2", pick: "A" },
          { bird: "#2", pick: "B" },
        ],
        barnPicks: ["@99"],
        offMenu: [],
      },
      maps
    );
    expect(out.actions).toHaveLength(1); // #2's first pick only
    expect(out.reasons).toEqual([
      "pick: unknown bird #9",
      "pick: #1 has no option Z",
      "pick: #2 already picked",
      "barnPick: no option @99",
    ]);
  });

  test("rest is a legal pick that produces no action and counts", () => {
    const { view } = translationView();
    const { maps } = digestOptions(view);
    const restPick = [...maps.birdPicks.get("#1")!.entries()].find(([, action]) => action === null)![0];
    const out = toActionsFromPicks(
      { picks: [{ bird: "#1", pick: restPick }], barnPicks: [], offMenu: [] },
      maps
    );
    expect(out.actions).toHaveLength(0);
    expect(out.dropped).toBe(0);
    expect(out.offered.rests).toBe(1);
  });

  test("a gacha barn pick spends every free pull; offMenu rides the legacy grammar", () => {
    const { a, view } = translationView();
    const { maps } = digestOptions(view);
    const gachaPick = [...maps.barnPicks.entries()].find(([, act]) => act.do === "roll_gacha")![0];
    const out = toActionsFromPicks(
      {
        picks: [],
        barnPicks: [gachaPick],
        offMenu: [{ do: "retire", bird: "#1" }],
      },
      maps
    );
    expect(out.actions.filter((x) => x.do === "roll_gacha")).toHaveLength(2);
    expect(out.actions.find((x) => x.do === "retire")).toEqual({ do: "retire", birdId: a.id });
    expect(out.offered.offMenuActions).toBe(1);
  });

  test("tie-aware capture: an equal-value non-A pick counts as top-VALUE but not top-PICK", () => {
    const { view } = translationView();
    const { maps } = digestOptions(view);
    // Find a bird whose row B ties row A on value; if the fixture offers
    // none, force one — the metric's contract is what's under test.
    const byValue = maps.values.get("#1")!;
    const topLetter = maps.topPick.get("#1")!;
    const topValue = byValue.get(topLetter)!;
    const rival = [...byValue.entries()].find(([l, v]) => l !== topLetter && v === topValue);
    const rivalLetter = rival ? rival[0] : "B";
    if (!rival) byValue.set("B", topValue); // synthesize the tie
    const out = toActionsFromPicks(
      { picks: [{ bird: "#1", pick: rivalLetter }], barnPicks: [], offMenu: [] },
      maps
    );
    expect(out.offered.topPicksTaken).toBe(0); // not letter A
    expect(out.offered.topValuePicksTaken).toBe(1); // but same value — tie-aware credit
  });

  test("taken picks come back keyed for the menu join; untouched entries stay empty", () => {
    const { view } = translationView();
    const { maps, menu } = digestOptions(view);
    const out = toActionsFromPicks(
      { picks: [{ bird: "#1", pick: "a" }], barnPicks: [], offMenu: [] },
      maps
    );
    expect(out.taken.birds).toEqual({ "#1": "A" }); // uppercased, keyed by handle
    expect(out.taken.barn).toEqual([]);
    // The offered half ships with taken empty — decide() owns the join.
    expect(menu.birds.every((b) => b.taken === null)).toBe(true);
    expect(menu.barn.every((r) => r.taken === false)).toBe(true);
    // And the menu is the shown form: values present, engine actions absent.
    expect(menu.birds[0].rows[0].value).toBeDefined();
    expect(JSON.stringify(menu)).not.toContain('"action"');
  });
});
