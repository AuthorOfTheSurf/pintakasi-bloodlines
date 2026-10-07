import { describe, expect, test } from "bun:test";
import { shaped } from "@/engine/balance/lab";
import { FORMATS, type FightFormat } from "@/engine/config";
import { simulatePair } from "@/engine/fight-sim";
import { mulberry32 } from "@/engine/rng";
import { transcriptOf } from "@/engine/fight-timeline";
import { PACING, reelOf } from "./fight-reel";

const FORMAT_IDS = Object.keys(FORMATS) as FightFormat[];
// Quitters with small tanks: one sweep reaches runs, emptied pools, bells and
// blown tanks, and fights of every length from one turn to the blade's cap.
const a = shaped({ gameness: 60, stamina: 20 }, { name: "Uno", base: 400 });
const b = shaped({ gameness: 900, stamina: 20 }, { name: "Dos", base: 420 });
const BOOKENDS_MS = PACING.TITLE_MS + PACING.INTRO_MS + PACING.OUTRO_MS + PACING.SUMMARY_MS;

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

  test("a gaff fight that goes all 45 turns still fits, bookends and all", () => {
    // The quitters above never see turn 45: one of them always runs first. Two
    // birds that will not run are what it takes to reach the gaff's bell.
    const stayers = [
      shaped({ gameness: 900, stamina: 20 }, { name: "Tres", base: 400 }),
      shaped({ gameness: 900, stamina: 20 }, { name: "Cuatro", base: 400 }),
    ] as const;
    const full = Array.from({ length: 60 }, (_, i) =>
      simulatePair(stayers[0], stayers[1], "b5", mulberry32(i + 1), "TEST")
    ).find((sim) => sim.timeline.turns.length === FORMATS.b5.maxTurns);
    if (!full) throw new Error("no B5 fight between the stayers went the distance");
    const reel = reelOf(full.timeline);
    expect(reel.beats).toHaveLength(FORMATS.b5.maxTurns + 4);
    expect(reel.beats.reduce((ms, beat) => ms + beat.ms, 0)).toBeCloseTo(reel.totalMs, 6);
    expect(reel.totalMs).toBeLessThanOrEqual(PACING.MAX_MS);
  });

  test("a short fight is not stretched: each exchange gets its full beat and no more", () => {
    for (const { sim } of fights()) {
      const reel = reelOf(sim.timeline);
      const turnBeats = reel.beats.filter((beat) => beat.kind === "turn");
      const uncompressed = BOOKENDS_MS + turnBeats.length * PACING.TURN_MS <= PACING.MAX_MS;
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
  test("it is a title, an intro, one beat per fought turn, an outro and a summary", () => {
    for (const { sim } of fights(10)) {
      const { beats } = reelOf(sim.timeline);
      expect(beats.map((beat) => beat.kind)).toEqual([
        "title",
        "intro",
        ...sim.timeline.turns.map(() => "turn" as const),
        "outro",
        "summary",
      ]);
    }
  });

  test("every beat's captions, in order, are the play-by-play", () => {
    for (const { sim } of fights(10)) {
      const lines = reelOf(sim.timeline).beats.flatMap((beat) => beat.lines);
      expect(lines.join("\n")).toBe(sim.playByPlay);
    }
  });

  test("the bookends caption nothing, and the summary's headline is the narrator's", () => {
    for (const { sim } of fights(10)) {
      const { beats } = reelOf(sim.timeline);
      const summary = beats[beats.length - 1];
      if (summary.kind !== "summary") throw new Error("the last beat is not the summary");
      expect(beats[0].lines).toEqual([]);
      expect(summary.lines).toEqual([]);
      expect(summary.headline).toBe(transcriptOf(sim.timeline).close[0]);
      expect(summary.figures).toEqual(sim.timeline.figures);
    }
  });

  test("the tally is the fight, counted", () => {
    let overshoots = 0;
    let taris = 0;
    for (const { sim } of fights(20)) {
      const { turns, corners } = sim.timeline;
      const { beats } = reelOf(sim.timeline);
      const summary = beats[beats.length - 1];
      if (summary.kind !== "summary") throw new Error("the last beat is not the summary");
      const ties = turns.filter((turn) => turn.exchange.kind === "tie").length;
      expect(summary.tally[0].hits + summary.tally[1].hits + ties).toBe(turns.length);
      for (const side of [0, 1] as const) {
        const tally = summary.tally[side];
        const struck = side === 0 ? 1 : 0;
        const lost = corners[struck].health - summary.after.health[struck];
        // A bar that reached 0 may have been floored there, so the blade can
        // have dealt more than the bar lost. Any bar still showing health lost
        // exactly what was dealt.
        if (summary.after.health[struck] > 0) expect(tally.damage).toBe(lost);
        else expect(tally.damage).toBeGreaterThanOrEqual(lost);
        if (tally.damage > lost) overshoots++;
        const hits = turns.flatMap(({ exchange }) =>
          exchange.kind === "hit" && exchange.by === side ? [exchange] : []
        );
        expect(tally.hits).toBe(hits.length);
        expect(tally.tari).toBe(hits.filter((hit) => hit.crit).length);
        expect(tally.biggest).toBe(Math.max(0, ...hits.map((hit) => hit.damage)));
        taris += tally.tari;
      }
    }
    // The sweep has to reach the cases the branches above are for.
    expect(overshoots).toBeGreaterThan(0);
    expect(taris).toBeGreaterThan(0);
  });

  test("health bars start full, follow each hit, and end where the fight ended", () => {
    for (const { sim } of fights(20)) {
      const { beats } = reelOf(sim.timeline);
      const { corners } = sim.timeline;
      expect(beats[0].after.health).toEqual([corners[0].health, corners[1].health]);
      let before = beats[0].after;
      for (const beat of beats) {
        if (beat.kind === "turn" && beat.exchange.kind === "hit") {
          const struck = beat.exchange.by === 0 ? 1 : 0;
          expect(beat.after.health[struck]).toBe(
            Math.max(0, before.health[struck] - beat.exchange.damage)
          );
          expect(beat.after.health[beat.exchange.by]).toBe(before.health[beat.exchange.by]);
        } else expect(beat.after.health).toEqual(before.health);
        before = beat.after;
      }
      // An emptied pool ends on an empty bar for the bird it happened to.
      if (sim.timeline.ending.kind === "healthOut")
        expect(before.health[sim.timeline.ending.side]).toBe(0);
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
      const [outro, summary] = beats.slice(-2);
      if (outro.kind !== "outro") throw new Error("the second-last beat is not the outro");
      if (summary.kind !== "summary") throw new Error("the last beat is not the summary");
      for (const result of [outro, summary]) {
        expect(result.winner).toBe(sim.winner);
        expect(result.ending).toEqual(sim.timeline.ending);
      }
      for (const beat of beats.slice(0, -2)) {
        expect("winner" in beat).toBe(false);
        expect("ending" in beat).toBe(false);
        expect("headline" in beat).toBe(false);
        expect(beat.lines.join("\n")).not.toContain("WINS");
      }
    }
  });
});
