import { describe, expect, test } from "bun:test";
import { AUTO_RESERVE } from "./auto-play";
import { keyId, sameKey } from "./card-key";
import { cardOfDay } from "./config";
import { readFarm, readWorldState } from "./farms";
import { entryRefusal } from "./lobbies";
import { makeBird, world } from "./testkit";
import { tonightFor } from "./tonight";

/**
 * Tonight's choices are what the farm page offers a player before Enter card.
 * The promise under test: the page never offers a fight the door refuses, it
 * never offers a second fight to a bird already carded, and its suggestions
 * are fights the bird could actually enter.
 */
describe("tonight's choices", () => {
  test("a bird's options are exactly the posted keys it may legally enter", () => {
    const w = world();
    const day = readWorldState(w.db).dayIndex;
    const choices = tonightFor(w.db, w.devId);
    expect(choices.length).toBeGreaterThan(0);
    for (const c of choices) {
      const bird = w.dev.flock.byId(c.birdId);
      const legal = cardOfDay(day)
        .filter((k) => entryRefusal(bird, k) === null)
        .map(keyId);
      expect(c.options.map((o) => keyId(o.key)).sort()).toEqual(legal.sort());
    }
  });

  test("a suggestion is one of the bird's options, and together they fit the wallet", () => {
    const w = world();
    const choices = tonightFor(w.db, w.devId);
    let fees = 0;
    for (const c of choices) {
      if (c.suggestion === null) continue;
      const suggestion = c.suggestion;
      const option = c.options.find((o) => sameKey(o.key, suggestion));
      expect(option).toBeDefined();
      fees += option?.fee ?? 0;
    }
    expect(choices.some((c) => c.suggestion !== null)).toBe(true);
    expect(fees).toBeLessThanOrEqual(readFarm(w.db, w.devId).gp - AUTO_RESERVE);
  });

  test("an entered bird is locked on the fight it entered", () => {
    const w = world();
    const [first] = tonightFor(w.db, w.devId).filter((c) => c.suggestion);
    if (!first?.suggestion) throw new Error("the fixture barn should have a suggested fight");
    w.dev.lobbies.enter(first.birdId, first.suggestion);

    const after = tonightFor(w.db, w.devId).find((c) => c.birdId === first.birdId);
    expect(after?.entered).toEqual(first.suggestion);
    expect(after?.suggestion).toBeNull();
  });

  test("an unnamed bird is blocked, with nothing suggested", () => {
    const w = world();
    const chick = makeBird(w.db, { named: 0, name: "Egg of Somebody", age: 2 });
    const c = tonightFor(w.db, w.devId).find((x) => x.birdId === chick.id);
    expect(c?.blocked).toContain("name");
    expect(c?.suggestion).toBeNull();
    expect(c?.entered).toBeNull();
  });
});
