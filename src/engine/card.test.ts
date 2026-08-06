import { describe, expect, test } from "bun:test";
import {
  CALENDAR,
  CARD,
  CLAIMER,
  FORMAT_NAMES,
  LOBBIES,
  PINTAKASI,
  SCOUT,
  cardOfDay,
  isOnCard,
  type CardKey,
  type FightFormat,
  type Lobby,
} from "./config";
import { entryRefusal } from "./lobbies";

/**
 * THE CARD (round 31) — the daily schedule that replaced conjure-on-demand
 * lobbies.
 *
 * Everything here is a property of a PURE function of the day index, so it can
 * be proved outright rather than sampled: no world, no seeding, no database.
 * That is the whole reason the card is derived rather than stored.
 *
 * The properties fall into two families. The first is "the card is well
 * formed" — right shape, no duplicates, deterministic. The second, and the one
 * that actually protects players, is "nothing is ever stranded": adult open
 * must be posted every single day, because 33 of 181 active birds in a mature
 * world are open-only, and a day without it would leave them with nowhere to
 * card at all.
 */

const key = (k: CardKey) => `${k.mode}/${k.classType}/${k.format}@${k.price ?? "-"}`;
const of = (day: number, mode: string, classType: string) =>
  cardOfDay(day).filter((k) => k.mode === mode && k.classType === classType);

const DAYS = 91; // a full simulation horizon — 13 weeks

describe("the card is well formed", () => {
  test("deterministic, and tomorrow is free", () => {
    // The weatherOfDay sibling property: same day in, same card out, forever.
    for (const day of [0, 1, 7, 42, 90, 365]) {
      expect(cardOfDay(day).map(key)).toEqual(cardOfDay(day).map(key));
    }
    // Forward-readable with no state — this is what lets a stable plan, and
    // what get_state.card.tomorrow is built on.
    expect(cardOfDay(41).map(key)).not.toEqual(cardOfDay(42).map(key));
    expect(() => cardOfDay(10_000)).not.toThrow();
  });

  test("the slot counts match CARD, every day", () => {
    for (let day = 0; day < DAYS; day++) {
      const crownDay = day % 7 === PINTAKASI.DAY_OF_WEEK;
      expect(of(day, "real", "open").length).toBe(
        crownDay ? CARD.CROWN_DAY_OPEN_BLADES : CARD.real.open
      );
      expect(of(day, "real", "maiden").length).toBe(CARD.real.maiden);
      expect(of(day, "real", "nw3").length).toBe(CARD.real.nw3);
      expect(of(day, "real", "claimer").length).toBe(CARD.real.claimer);
      expect(of(day, "juvenile", "open").length).toBe(CARD.juvenile.open);
      expect(of(day, "juvenile", "maiden").length).toBe(CARD.juvenile.maiden);
      expect(of(day, "juvenile", "claimer").length).toBe(CARD.juvenile.claimer);
    }
  });

  test("no duplicate keys — a deck boundary must not post the same lobby twice", () => {
    // The bug this pins: a slot group straddling a deck boundary draws from two
    // independently shuffled decks, so without a skip it can pick one blade
    // twice and quietly cost that day a lobby.
    for (let day = 0; day < DAYS * 4; day++) {
      const keys = cardOfDay(day).map(key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  test("hardcore is not on the card, and neither is nw2", () => {
    for (let day = 0; day < DAYS; day++) {
      for (const k of cardOfDay(day)) {
        expect(k.mode === "juvenile" || k.mode === "real").toBe(true);
        expect(LOBBIES).toContain(k.classType);
      }
    }
    expect(LOBBIES as readonly string[]).not.toContain("nw2");
    expect(LOBBIES as readonly string[]).not.toContain("hardcore");
  });

  test("only claimers carry a tag, and it is always a real rung", () => {
    for (let day = 0; day < DAYS; day++) {
      for (const k of cardOfDay(day)) {
        if (k.classType !== "claimer") {
          expect(k.price).toBeUndefined();
          continue;
        }
        const ladder: readonly number[] =
          k.mode === "juvenile" ? CLAIMER.JUVENILE_PRICES : CLAIMER.PRICES;
        expect(ladder).toContain(k.price!);
      }
    }
  });
});

describe("nothing is ever stranded", () => {
  test("every class appears every day, in both divisions", () => {
    // The load-bearing guarantee. Classes NEST (maiden ⊂ nw3 ⊂ open), so the
    // scarcity is allowed to fall on the blade axis only — never on the class
    // axis, which is what decides whether a bird can card at all.
    const adult: Lobby[] = ["open", "maiden", "nw3", "claimer"];
    const juvenile: Lobby[] = ["open", "maiden", "claimer"];
    for (let day = 0; day < DAYS; day++) {
      for (const c of adult) expect(of(day, "real", c).length).toBeGreaterThan(0);
      for (const c of juvenile) expect(of(day, "juvenile", c).length).toBeGreaterThan(0);
    }
  });

  test("adult open posts multiple DISTINCT blades every day — the open-only birds", () => {
    // A bird past three stakes wins can enter open and nothing else. In a
    // mature world that is 33 of 181 active birds. A day without adult open
    // would idle every one of them.
    for (let day = 0; day < DAYS; day++) {
      const blades = of(day, "real", "open").map((k) => k.format);
      expect(blades.length).toBeGreaterThanOrEqual(CARD.CROWN_DAY_OPEN_BLADES);
      expect(new Set(blades).size).toBe(blades.length);
    }
  });

  test("the claimer card is always one CHEAP tag and one dear one", () => {
    // Drawn deliberately rather than as two free draws: a day posting only the
    // 600 rung puts the bots' claim gate at tag + reserve = 1000 GP and prices
    // half the field out of the marketplace, and a day of only cheap tags
    // wastes the ladder.
    for (let day = 0; day < DAYS; day++) {
      const tags = of(day, "real", "claimer").map((k) => k.price!);
      expect(tags).toContain(CLAIMER.PRICES[0]);
      expect(tags.some((t) => t > CLAIMER.PRICES[0])).toBe(true);
    }
  });
});

describe("blade coverage — the discovery year is only seven days long", () => {
  /** The longest run of days on which this (mode, class) never posted `blade`. */
  const worstGap = (mode: string, classType: string, blade: FightFormat) => {
    let gap = 0;
    let worst = 0;
    for (let day = 0; day < DAYS * 4; day++) {
      const has = of(day, mode, classType).some((k) => k.format === blade);
      gap = has ? 0 : gap + 1;
      worst = Math.max(worst, gap);
    }
    return worst;
  };

  test("every blade comes round for every class, and the gaps are bounded", () => {
    // MEASURED, and pinned so a slot-count change fails loudly rather than
    // quietly starving a blade. The k=1 classes are the slow ones by
    // construction — one slot walking a five-blade deck — which is exactly why
    // the chooser falls back UP the nesting chain rather than making a bird
    // wait for its class and blade to coincide.
    for (const blade of FORMAT_NAMES) {
      // MEASURED: k=3 and k=2 slots reach every blade within 4 days; a k=1
      // class walks a five-blade deck one step a day and takes up to 8.
      expect(worstGap("real", "open", blade)).toBeLessThanOrEqual(4);
      expect(worstGap("real", "claimer", blade)).toBeLessThanOrEqual(4);
      expect(worstGap("juvenile", "open", blade)).toBeLessThanOrEqual(4);
      for (const [mode, cls] of [
        ["real", "maiden"],
        ["real", "nw3"],
        ["juvenile", "maiden"],
        ["juvenile", "claimer"],
      ] as const) {
        expect(worstGap(mode, cls, blade)).toBeLessThanOrEqual(8);
      }
    }
  });

  test("across the whole juvenile card, every blade lands inside a discovery year", () => {
    // THE property the chooser's fallback depends on. A juvenile lives seven
    // days as a juvenile; it does not need its own CLASS to offer its blade,
    // because it can always drop to juvenile open. So what must hold is that
    // the juvenile card as a WHOLE reaches every blade well inside the year.
    for (const blade of FORMAT_NAMES) {
      let gap = 0;
      let worst = 0;
      for (let day = 0; day < DAYS * 4; day++) {
        const has = cardOfDay(day).some((k) => k.mode === "juvenile" && k.format === blade);
        gap = has ? 0 : gap + 1;
        worst = Math.max(worst, gap);
      }
      // MEASURED at 3 — so a juvenile that cards daily meets every blade at
      // least twice inside its seven-day year.
      expect(worst).toBeLessThanOrEqual(3);
    }
  });

  test("juvenile OPEN reaches every blade inside one deck's worth of days (round 32)", () => {
    // ROUND 32 widened CARD.juvenile.open from two blades to three, and this
    // is the claim that bought it — the whole-card test above is not enough on
    // its own. The juvenile card as a whole reaches a blade every 3 days, but
    // most of that reach lives in maiden and claimer, which a chick may not be
    // eligible for (maiden closes the moment it wins) or may not want. Open is
    // the class every juvenile can always enter, so OPEN's own rotation is
    // what a discovery year actually gets to sample.
    //
    // The bound is derived, never typed: `bladeDeck` walks decks of
    // FORMAT_NAMES.length blades CARD.juvenile.open at a time and guarantees
    // every blade once per deck, so a deck lasts ceil(n / k) days and that is
    // also the worst gap. At the old k = 2 it was 4 days (measured, and named
    // in CARD's own comment) against a bound of 3 — this test fails there,
    // which is the point. A SIXTH blade must widen the slot count rather than
    // quietly stretching the discovery year.
    const deckDays = Math.ceil(FORMAT_NAMES.length / CARD.juvenile.open);
    // A juvenile is age 1 for exactly one game-week (canJuvenile is age === 1),
    // so this is the window everything about the discovery year has to fit in.
    expect(deckDays).toBeLessThan(CALENDAR.DAYS_PER_WEEK);
    for (const blade of FORMAT_NAMES) {
      expect(worstGap("juvenile", "open", blade)).toBeLessThanOrEqual(deckDays);
    }
  });

  test("…so a chick gets enough cracks at every blade to actually READ one", () => {
    // Why the gap above is the number that matters. One outing at a blade is
    // not a read — SCOUT.MIN_READS is the number of figures a blade needs
    // before the scout stops calling it unread, and an unread blade scores at
    // the prior no matter how good the bird was. So the card must offer every
    // blade at least that many times inside the seven days a bird is a
    // juvenile, or the discovery year cannot finish its job for that blade.
    //
    // MEASURED at exactly SCOUT.MIN_READS in the worst window, which is also
    // why this is stated as a floor rather than a comfortable margin.
    for (const blade of FORMAT_NAMES) {
      let worstWindow = Infinity;
      for (let start = 0; start < DAYS * 4; start++) {
        let seen = 0;
        for (let day = start; day < start + CALENDAR.DAYS_PER_WEEK; day++)
          if (of(day, "juvenile", "open").some((k) => k.format === blade)) seen++;
        worstWindow = Math.min(worstWindow, seen);
      }
      expect(worstWindow).toBeGreaterThanOrEqual(SCOUT.MIN_READS);
    }
  });

  test("and the same for the adult card", () => {
    for (const blade of FORMAT_NAMES) {
      let gap = 0;
      let worst = 0;
      for (let day = 0; day < DAYS * 4; day++) {
        const has = cardOfDay(day).some((k) => k.mode === "real" && k.format === blade);
        gap = has ? 0 : gap + 1;
        worst = Math.max(worst, gap);
      }
      expect(worst).toBeLessThanOrEqual(3);
    }
  });
});

describe("isOnCard", () => {
  test("accepts exactly what cardOfDay posted, tag included", () => {
    for (let day = 0; day < DAYS; day++) {
      for (const k of cardOfDay(day)) expect(isOnCard(day, k)).toBe(true);
    }
  });

  test("rejects the right blade at the wrong class, and the right tag on the wrong day", () => {
    const day = 12;
    const posted = cardOfDay(day);
    const offCard = FORMAT_NAMES.map((format) => ({
      mode: "real" as const,
      classType: "open" as const,
      format,
    })).filter((k) => !posted.some((p) => p.classType === "open" && p.format === k.format));
    expect(offCard.length).toBeGreaterThan(0); // the card is a FRACTION of the space
    for (const k of offCard) expect(isOnCard(day, k)).toBe(false);

    // A claimer key is only itself at its own tag.
    const claimer = posted.find((k) => k.classType === "claimer" && k.mode === "real")!;
    const wrongTag = CLAIMER.PRICES.find((p) => p !== claimer.price)!;
    expect(isOnCard(day, { ...claimer, price: wrongTag })).toBe(false);
    // …and a tag on a non-claimer is not the same key either.
    expect(isOnCard(day, { mode: "real", classType: "open", format: "b1", price: 50 })).toBe(false);
  });

  test("the card really is a small slice of the possible space", () => {
    // 50 keys survive the round-31 axis cuts; the card posts ~11. If this ever
    // creeps back up, the fill rate the round bought goes with it.
    expect(cardOfDay(0).length).toBeLessThanOrEqual(12);
    expect(cardOfDay(0).length).toBeGreaterThanOrEqual(9);
  });
});

describe("every bird has somewhere to go, every single day", () => {
  test("no shape of bird is ever left with nothing on the card", () => {
    // THE PROOF behind `pickOffering` returning null only in theory. The
    // chooser filters today's card by `entryRefusal` — the same predicate the
    // door throws on — and gives up if nothing survives. If any real bird shape
    // could hit that, the bots would silently stop carding it and the only
    // symptom would be a fill rate that quietly sagged.
    //
    // Enumerated rather than sampled: age × stakes record × juvenile record
    // covers every bird the game can produce. The guarantee comes from the
    // classes NESTING — a bird that has outgrown maiden still fits nw3, and a
    // bird that has outgrown nw3 still fits open, which is posted daily.
    const shapes: { name: string; age: number; wins: number; stakesWins: number }[] = [];
    for (const age of [1, 2, 3, 5, 8]) {
      for (const stakesWins of [0, 1, 2, 3, 9]) {
        for (const wins of [0, 1, 7]) {
          if (age === 1 && stakesWins > 0) continue; // a juvenile has no stakes record
          shapes.push({ name: `age${age}/sw${stakesWins}/w${wins}`, age, wins, stakesWins });
        }
      }
    }
    expect(shapes.length).toBeGreaterThan(20);
    for (let day = 0; day < DAYS; day++) {
      for (const bird of shapes) {
        const options = cardOfDay(day).filter((k) => entryRefusal(bird, k) === null);
        // Named in the assertion so a failure says WHICH bird on WHICH day,
        // rather than "expected 0 to be greater than 0" 2,000 times over.
        expect(`day ${day} ${bird.name}: ${options.length} options`).not.toContain(": 0 options");
      }
    }
  });

  test("…and an egg or a retired bird correctly has nothing", () => {
    // The other side of the same coin: the guarantee is for birds that can
    // fight. An age-0 egg and a bird past the fighting cap must be refused
    // everywhere, or the age gate has stopped working.
    for (const age of [0, 9, 12]) {
      const bird = { name: `age${age}`, age, wins: 0, stakesWins: 0 };
      expect(cardOfDay(3).filter((k) => entryRefusal(bird, k) === null)).toEqual([]);
    }
  });
});
