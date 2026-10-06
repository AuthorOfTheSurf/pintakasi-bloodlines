import { describe, expect, test } from "bun:test";
import { shaped } from "@/engine/balance/lab";
import { FORMATS, type FightFormat } from "@/engine/config";
import { simulatePair } from "@/engine/fight-sim";
import { mulberry32 } from "@/engine/rng";
import { PACING, reelOf } from "./fight-reel";

const FORMAT_IDS = Object.keys(FORMATS) as FightFormat[];
// Quitters with small tanks: one sweep reaches runs, emptied pools, bells and
// blown tanks, and fights of every length from one turn to the blade's cap.
const a = shaped({ gameness: 60, stamina: 20 }, { name: "Uno", base: 400 });
const b = shaped({ gameness: 900, stamina: 20 }, { name: "Dos", base: 420 });

function* fights(seeds = 60) {
  for (const format of FORMAT_IDS)
    for (let seed = 1; seed <= seeds; seed++)
      yield { format, sim: simulatePair(a, b, format, mulberry32(seed), "TEST") };
}

describe("the reel paces a fight", () => {
  test("no fight runs past the ceiling, and a full-length gaff fight sits on it", () => {
    let longest = 0;
    for (const { sim } of fights()) {
      const reel = reelOf(sim.timeline);
      expect(reel.totalMs).toBeLessThanOrEqual(PACING.MAX_MS);
      expect(reel.beats.reduce((ms, beat) => ms + beat.ms, 0)).toBeCloseTo(reel.totalMs, 6);
      longest = Math.max(longest, reel.totalMs);
    }
    expect(longest).toBeCloseTo(PACING.MAX_MS, 6);
  });

  test("a short fight is not stretched: each exchange gets its full beat and no more", () => {
    for (const { sim } of fights()) {
      const reel = reelOf(sim.timeline);
      const turnBeats = reel.beats.filter((beat) => beat.kind === "turn");
      const uncompressed =
        PACING.INTRO_MS + PACING.OUTRO_MS + turnBeats.length * PACING.TURN_MS <= PACING.MAX_MS;
      for (const beat of turnBeats)
        if (uncompressed) expect(beat.ms).toBe(PACING.TURN_MS);
        else expect(beat.ms).toBeLessThan(PACING.TURN_MS);
    }
  });

  test("a knife fight is watchable, not a blink: a full B1 runs past ten seconds", () => {
    const full = [...fights()].find(
      ({ format, sim }) => format === "b1" && sim.timeline.turns.length === FORMATS.b1.maxTurns
    );
    if (!full) throw new Error("no B1 fight in the sweep went the distance");
    expect(reelOf(full.sim.timeline).totalMs).toBeGreaterThanOrEqual(10_000);
  });
});

describe("the reel carries what a viewer draws", () => {
  test("it is an intro, one beat per fought turn, and an outro", () => {
    for (const { sim } of fights(10)) {
      const { beats } = reelOf(sim.timeline);
      expect(beats.map((beat) => beat.kind)).toEqual([
        "intro",
        ...sim.timeline.turns.map(() => "turn" as const),
        "outro",
      ]);
    }
  });

  test("every beat's captions, in order, are the play-by-play", () => {
    for (const { sim } of fights(10)) {
      const lines = reelOf(sim.timeline).beats.flatMap((beat) => beat.lines);
      expect(lines.join("\n")).toBe(sim.playByPlay);
    }
  });

  test("wind bars start full, follow each hit, and end where the fight ended", () => {
    for (const { sim } of fights(20)) {
      const { beats } = reelOf(sim.timeline);
      const { corners } = sim.timeline;
      expect(beats[0].after.wind).toEqual([corners[0].wind, corners[1].wind]);
      let before = beats[0].after;
      for (const beat of beats) {
        if (beat.kind === "turn" && beat.exchange.kind === "hit") {
          const struck = beat.exchange.by === 0 ? 1 : 0;
          expect(beat.after.wind[struck]).toBe(
            Math.max(0, before.wind[struck] - beat.exchange.damage)
          );
          expect(beat.after.wind[beat.exchange.by]).toBe(before.wind[beat.exchange.by]);
        } else expect(beat.after.wind).toEqual(before.wind);
        before = beat.after;
      }
      // An emptied pool ends on an empty bar for the bird it happened to.
      if (sim.timeline.ending.kind === "windOut")
        expect(before.wind[sim.timeline.ending.side]).toBe(0);
    }
  });

  test("a tank flashes once, on the turn it blew, and stays blown", () => {
    let flashes = 0;
    for (const { sim } of fights(20)) {
      const { beats } = reelOf(sim.timeline);
      for (const side of [0, 1] as const) {
        const blew = beats.filter((beat) => beat.kind === "turn" && beat.blewNow[side]);
        flashes += blew.length;
        expect(blew.length).toBe(sim.timeline.corners[side].blownOn === null ? 0 : 1);
        const firstBlown = beats.findIndex((beat) => beat.after.blown[side]);
        if (firstBlown === -1) continue;
        expect(beats[firstBlown]).toBe(blew[0]);
        expect(beats.slice(firstBlown).every((beat) => beat.after.blown[side])).toBe(true);
      }
    }
    expect(flashes).toBeGreaterThan(0);
  });

  test("nothing before the outro says who won", () => {
    for (const { sim } of fights(10)) {
      const { beats } = reelOf(sim.timeline);
      const outro = beats[beats.length - 1];
      if (outro.kind !== "outro") throw new Error("the last beat is not the outro");
      expect(outro.winner).toBe(sim.winner);
      for (const beat of beats.slice(0, -1)) {
        expect("winner" in beat).toBe(false);
        expect(beat.lines.join("\n")).not.toContain("WINS");
      }
    }
  });
});
