import { describe, expect, test } from "bun:test";
import { reelOf } from "../admin/fight-reel";
import { EXHIBITION_SEED, exhibitionBout, goodShow } from "./exhibition";

describe("the exhibition bout", () => {
  test("its seed still makes a fight worth showing under today's engine", () => {
    expect(goodShow(exhibitionBout(EXHIBITION_SEED).timeline)).toBe(true);
  });

  test("is the same fight every time it is asked for", () => {
    expect(exhibitionBout()).toEqual(exhibitionBout());
  });

  test("survives the trip to the browser and still makes a reel", () => {
    const bout = exhibitionBout();
    const sent = JSON.parse(JSON.stringify(bout));
    expect(sent).toEqual(bout);
    expect(reelOf(sent.timeline).beats.length).toBeGreaterThan(bout.timeline.turns.length);
  });

  test("goodShow turns down a fight that ends on the bell", () => {
    const t = exhibitionBout().timeline;
    expect(goodShow({ ...t, ending: { kind: "bell", winner: 0, coinFlip: false } })).toBe(false);
  });
});
