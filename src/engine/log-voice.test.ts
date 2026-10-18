import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { createDb, type DB } from "@/db/client";
import { seedGame } from "@/db/seed-data";
import { Bots } from "./bots";
import type { EventType } from "./events";
import { farmLogLines } from "./farm-log";
import type { NoteKind } from "./farm-notes";
import { Game } from "./game";
import {
  EVENT_SENTENCES,
  NOTE_SENTENCES,
  gpWords,
  speak,
  voiced,
  type LineFacts,
} from "./log-voice";
import { seedWorld } from "./rng";

/**
 * The farm log's voice is read-time: the engine keeps writing its terse
 * ledger message, and log-voice.ts turns each row into a sentence. These
 * tests pin the sentence for every kind, and pin that a stored message the
 * table cannot read falls back to itself instead of to a wrong sentence.
 *
 * The stored messages below are copied from a 92-day seed-1 sim, so they are
 * the engine's real templates, not shapes written to suit the parser.
 */

type Case = { facts: Partial<LineFacts> & { message: string }; said: string };

const facts = (f: Case["facts"]): LineFacts => ({
  gp: null,
  lt: null,
  bird: null,
  byFarm: null,
  parents: null,
  counterparty: null,
  data: null,
  ...f,
});

// `satisfies` makes this exhaustive at compile time: a new event type does
// not build until it has a case here, as it does not build until it has a
// voice in EVENT_SENTENCES.
const EVENT_CASES = {
  farm_registered: {
    facts: { message: "Bukidnon Farms registered — starting purse 8000 GP", gp: 8000 },
    said: "Your farm opened with 8,000 GP.",
  },
  check_in: {
    facts: { message: "checked in — +800 GP drip, +1 free pulls", gp: 800 },
    said: "Checked in for the day. Got 800 GP and 1 free pull.",
  },
  gacha: {
    facts: {
      message: "rolled the gacha (free pull) — Green token, +1.00 LT — a mystery egg dropped!",
      gp: 0,
      lt: 1,
      bird: "Mystery Egg (Blue) II",
      data: { token: "Green", price: 0, free: true, land: 100, egg: "Mystery Egg (Blue) II" },
    },
    said: "Rolled the gacha with a free pull and got a Green token. Got 1 LT. A mystery egg dropped. It is called Mystery Egg (Blue) II.",
  },
  hatch: {
    facts: { message: "Egg of Red Glory II hatched — a hen, 2.5★ Earth", bird: "Ember Flash" },
    said: "Ember Flash hatched. It is a hen, 2.5★ Earth.",
  },
  retire: {
    facts: {
      message:
        "Dusk Bolt reached the age cap — retired to the barn (7–5). The sheet is public: B overall.",
      bird: "Dusk Bolt",
      data: { by: "age" },
    },
    said: "Dusk Bolt got too old to fight, so it retired. Its record was 7–5. Its stats are public now. Overall grade: B.",
  },
  breed: {
    facts: {
      message:
        "bought a cover: Ash Fowl × Silent Cock (Tondo Tigas Gamefarm's stud, 435 GP) → Egg of Ash Fowl II (lays Friday, hatches the Friday after)",
      gp: -435,
      bird: "Egg of Ash Fowl II",
      parents: { mother: "Ash Fowl", father: "Silent Cock", studFarm: "Tondo Tigas Gamefarm" },
    },
    said: "Bred Ash Fowl to Tondo Tigas Gamefarm's rooster Silent Cock for 435 GP. The new egg is Egg of Ash Fowl II.",
  },
  stud_income: {
    facts: {
      message: "Blessed Flash covered Brass Wing — stud share +292 GP",
      gp: 292,
      bird: "Blessed Flash",
      byFarm: "Tondo Tigas Gamefarm",
    },
    said: "Tondo Tigas Gamefarm bred their hen Brass Wing to your rooster Blessed Flash. You earned 292 GP.",
  },
  stud_listed: {
    facts: {
      message: "Sharp Wind stands at stud — 1300 GP a cover (100 LT paid for the seat)",
      lt: -100,
      bird: "Sharp Wind",
    },
    said: "Put Sharp Wind up at stud for 1,300 GP a cover. The stud seat cost 100 LT.",
  },
  stud_unlisted: {
    facts: { message: "Sharp Wind pulled from the breeding barn", bird: "Sharp Wind" },
    said: "Took Sharp Wind off stud.",
  },
  entry: {
    facts: {
      message:
        "entered Noble Legend — JUVENILE·CLAIMER @ 270 GP tag · B1 (lobby #782, 72 GP escrowed)",
      gp: -72,
      bird: "Noble Legend",
    },
    said: "Entered Noble Legend in tonight's juvenile claimer fights (B1). Another farm can claim it for 270 GP. 72 GP is held until the fights are done.",
  },
  refund: {
    facts: {
      message: "Mighty Wrath drew nobody in CLAIMER @ 180 GP tag · B4 — 96 GP refunded",
      gp: 96,
      bird: "Mighty Wrath",
    },
    said: "Mighty Wrath had nobody to fight tonight. The 96 GP came back to you.",
  },
  card_settled: {
    facts: {
      message:
        "Mighty Crow finished JUVENILE · B3 — 2 of 3 fights, 150 GP risked, +29.10 LT · 50 GP unfought and returned",
      gp: 50,
      lt: 29.1,
      bird: "Mighty Crow",
    },
    said: "Mighty Crow fought 2 of 3 fights tonight. It earned 29.10 LT. 50 GP came back for the fights it did not get.",
  },
  claim: {
    facts: {
      message: "sealed a 90 GP claim on Brass Plume (entry #11477)",
      gp: -90,
      bird: "Brass Plume",
    },
    said: "Put in a sealed claim of 90 GP on Brass Plume. Sealed means no other farm can see it. The GP is held until the fights.",
  },
  claim_won: {
    facts: {
      message:
        "claimed Frost Blow from Sabungero Syndicate for the 90 GP tag (won the draw over 3)",
      bird: "Frost Blow",
      counterparty: "Sabungero Syndicate",
    },
    said: "Frost Blow became yours. You claimed it from Sabungero Syndicate for its 90 GP tag. More than one farm claimed it, and yours won the draw over 3 others.",
  },
  claim_refund: {
    facts: {
      message: "lost the claim draw on Frost Blow — 90 GP refunded",
      gp: 90,
      bird: "Frost Blow",
    },
    said: "Another farm won the draw for Frost Blow, so your claim lost. The 90 GP came back to you.",
  },
  tag_income: {
    facts: {
      message:
        "Savage Strike claimed away by Bukidnon Farms — banked 88.20 GP of the 90 GP tag (1.80 to stakers)",
      gp: 88.2,
      bird: "Savage Strike",
      counterparty: "Bukidnon Farms",
    },
    said: "Bukidnon Farms claimed Savage Strike for its tag, so Savage Strike became theirs. You got 88.20 GP. The other 1.80 GP went to land stakers.",
  },
  staking_payout: {
    facts: { message: "staking yield +75.50 GP on 36737.00 staked LT", gp: 75.5 },
    said: "Your 36,737 staked LT paid you 75.50 GP today.",
  },
  stake: {
    facts: { message: "staked 685 LT (now 36063.00 staked / 0.11 liquid)" },
    said: "Staked 685 LT. Now 36,063 LT is staked and 0.11 LT is free to spend.",
  },
  unstake: {
    facts: { message: "unstaked 98 LT (now 32675.00 staked / 100.48 liquid)" },
    said: "Unstaked 98 LT. Now 32,675 LT is staked and 100.48 LT is free to spend.",
  },
  buy_land: {
    facts: { message: "bought 1000 LT for 800 GP", gp: -800, lt: 1000 },
    said: "Bought 1,000 LT of land for 800 GP.",
  },
  barn_expanded: {
    facts: { message: "barn expanded to 200 slots — 1000 LT paid for expansion #1", lt: -1000 },
    said: "Made the barn bigger. It now holds 200 birds. It cost 1,000 LT.",
  },
  tournament_entry: {
    facts: {
      message:
        "registered Hidden Wing for the B3 Championship (week 13, 160 GP escrowed) — hardcore: lose and the career ends",
      gp: -160,
      bird: "Hidden Wing",
    },
    said: "Signed Hidden Wing up for the B3 Championship in week 13. The 160 GP entry fee is held until the crown. This crown is hardcore. If Hidden Wing loses, its career ends.",
  },
  tournament_bump: {
    facts: {
      message: "Thunder Storm bumped from the B3 Championship by White Kestrel — 160 GP refunded",
      gp: 160,
      bird: "Thunder Storm",
      byFarm: "Sabungero Syndicate",
    },
    said: "Sabungero Syndicate's White Kestrel took Thunder Storm's seat in the B3 Championship. When a crown is full, a stronger bird can push out the weakest one. The 160 GP came back to you.",
  },
  purse_payout: {
    facts: {
      message: "Mad Wrath — B3 Championship purse (semifinal): +1234.50 GP",
      gp: 1234.5,
      bird: "Mad Wrath",
    },
    said: "Mad Wrath went out in the semifinal of the B3 Championship. Its share of the purse was 1,234.50 GP.",
  },
  fight: "stored",
  champion: "stored",
  pool_accrual: "stored",
  crown_land: "stored",
} satisfies Record<EventType, Case | "stored">;

const NOTE_CASES = {
  named: {
    facts: {
      message: "Named a bird Copper Comb. It was called Egg of Ash Fowl.",
      data: { from: "Egg of Ash Fowl", to: "Copper Comb" },
    },
    said: "Gave Egg of Ash Fowl a new name, Copper Comb.",
  },
  stud_price: {
    facts: {
      message:
        "Changed Cursed Reaper's stud price from 170 GP to 1650 GP a cover. The new price starts at the next day tick.",
      bird: "Cursed Reaper",
      data: { from: 170, to: 1650, pending: true },
    },
    said: "Changed Cursed Reaper's stud price from 170 GP to 1,650 GP a cover. The new price starts tomorrow.",
  },
  play_my_day: "stored",
  card: "stored",
} satisfies Record<NoteKind, Case | "stored">;

describe("each kind's sentence", () => {
  test.each(Object.entries(EVENT_CASES))("event %s", (kind, c) => {
    if (c === "stored") {
      expect(EVENT_SENTENCES[kind as EventType]).toBe("stored");
      return;
    }
    expect(speak("event", kind, facts(c.facts))).toBe(c.said);
  });

  test.each(Object.entries(NOTE_CASES))("note %s", (kind, c) => {
    if (c === "stored") {
      expect(NOTE_SENTENCES[kind as NoteKind]).toBe("stored");
      return;
    }
    expect(speak("note", kind, facts(c.facts))).toBe(c.said);
  });

  test("the other variants of a kind: a bundle, a paid roll, a manual and a hardcore retire, a crown refund", () => {
    const cases: [EventType, Case][] = [
      [
        "gacha",
        {
          facts: {
            message:
              "bought the 11-roll bundle (1000 GP — 10 rolls, one on the house) — +11.00 LT · no eggs",
            gp: -1000,
            lt: 11,
            data: { bundle: true, rolls: 11, price: 1000, eggs: 0, land: 1100 },
          },
          said: "Bought the 11-roll bundle for 1,000 GP. One roll was free. Got 11 LT. No eggs dropped this time.",
        },
      ],
      [
        "gacha",
        {
          facts: {
            message: "rolled the gacha (100 GP) — White token, +1.00 LT — egg forfeit, barn full",
            gp: -100,
            lt: 1,
            data: { token: "White", price: 100, free: false, land: 100, egg: null },
          },
          said: "Rolled the gacha for 100 GP and got a White token. Got 1 LT. An egg dropped, but the barn was full, so it was lost.",
        },
      ],
      [
        "retire",
        {
          facts: {
            message: "Kidlat retired to the barn at 3 (4–4). The sheet is public: C+ overall.",
            bird: "Kidlat",
            data: { by: "manual" },
          },
          said: "Retired Kidlat to the barn. Its record was 4–4. Its stats are public now. Overall grade: C+.",
        },
      ],
      [
        "retire",
        {
          facts: {
            message: "Kidlat fell in the B4 Championship Quarterfinals — force-retired (6–3)",
            bird: "Kidlat",
            data: { by: "hardcore", tournamentId: 4 },
          },
          said: "Kidlat lost in the B4 Championship Quarterfinals. That crown is hardcore, so its career is over. Its record was 6–3.",
        },
      ],
      [
        "refund",
        {
          facts: {
            message: "Kidlat's Pintakasi entry withdrawn — the field was too small (80 GP home)",
            gp: 80,
            bird: "Kidlat",
          },
          said: "Kidlat left the Pintakasi because too few birds signed up. The 80 GP came back to you.",
        },
      ],
      [
        "breed",
        {
          facts: {
            message:
              "bought a cover: Ash Fowl × Lunar Crow (Bukidnon Farms's stud, 315 GP) → Egg of Ash Fowl (lays Friday, hatches the Friday after)",
            gp: -315,
            bird: "Egg of Ash Fowl",
            parents: { mother: "Ash Fowl", father: "Lunar Crow", studFarm: "Bukidnon Farms" },
          },
          said: "Bred Ash Fowl to Bukidnon Farms' rooster Lunar Crow for 315 GP. The new egg is Egg of Ash Fowl.",
        },
      ],
      [
        "breed",
        {
          facts: {
            message:
              "bought a cover: Ash Fowl × Lunar Crow (own stud, 315 GP) → Egg of Ash Fowl (lays Friday, hatches the Friday after)",
            gp: -315,
            bird: "Egg of Ash Fowl",
            parents: { mother: "Ash Fowl", father: "Lunar Crow", studFarm: null },
          },
          said: "Bred Ash Fowl to your own rooster Lunar Crow for 315 GP. The new egg is Egg of Ash Fowl.",
        },
      ],
      [
        "tag_income",
        {
          facts: {
            message: "Savage Strike claimed away by Bukidnon Farms — banked the 90 GP tag",
            gp: 90,
            bird: "Savage Strike",
            counterparty: "Bukidnon Farms",
          },
          said: "Bukidnon Farms claimed Savage Strike for its tag, so Savage Strike became theirs. You got 90 GP.",
        },
      ],
      [
        "stud_income",
        {
          facts: {
            message: "Blessed Flash covered Brass Wing — stud share +292 GP",
            gp: 292,
            bird: "Blessed Flash",
          },
          said: "Blessed Flash covered Brass Wing. You earned 292 GP as the stud's owner.",
        },
      ],
      [
        "purse_payout",
        {
          facts: {
            message: "Mad Wrath — B3 Championship land pot: +241.93 LT (1 fight)",
            lt: 241.93,
            bird: "Mad Wrath",
          },
          said: "Mad Wrath earned 241.93 LT from the B3 Championship land pot for 1 fight.",
        },
      ],
      [
        "tournament_entry",
        {
          facts: {
            message:
              "registered Sisiw for the B1 Championship (week 2, free to enter) — not hardcore — a beaten chick is out of the bracket, not out of the game",
            gp: 0,
            bird: "Sisiw",
          },
          said: "Signed Sisiw up for the B1 Championship in week 2. It was free to enter. If Sisiw loses, it leaves the crown but keeps fighting.",
        },
      ],
    ];
    for (const [kind, c] of cases) expect(speak("event", kind, facts(c.facts))).toBe(c.said);
  });
});

describe("when a line cannot be read", () => {
  test("every speaker falls back to the stored message, never a half sentence", () => {
    // A message no template wrote and none of the facts a speaker needs: the
    // shape an old build's row, or a template changed in the engine, presents.
    const garbled = facts({ message: "something the engine once said" });
    for (const kind of Object.keys(EVENT_SENTENCES))
      expect(speak("event", kind, garbled)).toBe("Something the engine once said.");
    for (const kind of Object.keys(NOTE_SENTENCES))
      expect(speak("note", kind, garbled)).toBe("something the engine once said");
  });

  test("a line that is nearly a known template keeps its stored message", () => {
    // Each of these differs from what its speaker reads in one piece, the
    // way an engine change to one clause would.
    const nearMisses: [EventType, Case["facts"]][] = [
      // A crown withdrawal for a reason the table has no words for.
      [
        "refund",
        {
          message: "Kidlat's Pintakasi entry withdrawn — the steward said so (80 GP home)",
          gp: 80,
          bird: "Kidlat",
        },
      ],
      // A claim called off for a new reason.
      [
        "claim_refund",
        {
          message: "claim on Kidlat called off — the card was cancelled, 90 GP refunded",
          gp: 90,
          bird: "Kidlat",
        },
      ],
      // A card label with a part labelOf never writes.
      [
        "entry",
        {
          message: "entered Kidlat — OPEN · B3 · night (lobby #4, 40 GP escrowed)",
          gp: -40,
          bird: "Kidlat",
        },
      ],
      // A retire for a reason the table does not know.
      ["retire", { message: "Kidlat retired (2–1).", bird: "Kidlat", data: { by: "injury" } }],
    ];
    for (const [kind, f] of nearMisses) expect(voiced("event", kind, facts(f))).toBeNull();
  });

  /*
   * A name is a player's free text, so it can hold any word a template uses.
   * Each case below names its birds and farms with the delimiters of the
   * pattern it targets (by, from, for, covered, ×, —, ·, @, an apostrophe, a
   * W–L in brackets), and requires the sentence a correct reading gives, or
   * the stored message. A wrong sentence fails it.
   */
  test("a name that holds a template's own words never steers the reading", () => {
    const cases: [EventType, Case["facts"], string | null][] = [
      [
        "tournament_bump",
        {
          // The reviewer's reproduction, verbatim.
          message: "Solar King bumped from the B5 Championship by Stand by Me — 160 GP refunded",
          gp: 160,
          bird: "Solar King",
          byFarm: "Pulang Bagwis",
        },
        "Pulang Bagwis' Stand by Me took Solar King's seat in the B5 Championship. When a crown is full, a stronger bird can push out the weakest one. The 160 GP came back to you.",
      ],
      [
        "tournament_bump",
        {
          message:
            "King bumped from the B1 Championship by Ghost bumped from the B5 Championship by Stand by Me — 9 GP refunded — 160 GP refunded",
          gp: 160,
          bird: "King bumped from the B1 Championship by Ghost",
        },
        "Stand by Me — 9 GP refunded took King bumped from the B1 Championship by Ghost's seat in the B5 Championship. When a crown is full, a stronger bird can push out the weakest one. The 160 GP came back to you.",
      ],
      // The bumped bird was renamed after the bump: no anchor, so the stored line.
      [
        "tournament_bump",
        {
          message: "Solar King bumped from the B5 Championship by Stand by Me — 160 GP refunded",
          gp: 160,
          bird: "Sun Lord",
        },
        null,
      ],
      [
        "claim_won",
        {
          message:
            "claimed Stand from Me from Man from Manila for the 5 GP tag for the 90 GP tag (won the draw over 3)",
          bird: "Stand from Me",
          counterparty: "Man from Manila for the 5 GP tag",
        },
        "Stand from Me became yours. You claimed it from Man from Manila for the 5 GP tag for its 90 GP tag. More than one farm claimed it, and yours won the draw over 3 others.",
      ],
      // No claimed card to name the seller (a row older than its card): the stored line.
      [
        "claim_won",
        {
          message: "claimed Frost Blow from Sabungero Syndicate for the 90 GP tag",
          bird: "Frost Blow",
        },
        null,
      ],
      [
        "tag_income",
        {
          message:
            "Savage claimed away by Stand by Me — banked the 5 GP tag claimed away by Stand by Me — banked 88.20 GP of the 90 GP tag (1.80 to stakers)",
          gp: 88.2,
          bird: "Savage claimed away by Stand by Me — banked the 5 GP tag",
          counterparty: "Stand by Me",
        },
        "Stand by Me claimed Savage claimed away by Stand by Me — banked the 5 GP tag for its tag, so Savage claimed away by Stand by Me — banked the 5 GP tag became theirs. You got 88.20 GP. The other 1.80 GP went to land stakers.",
      ],
      [
        "breed",
        {
          // The message would split at the wrong ×; the names come from the egg's row.
          message:
            "bought a cover: Ash × Fowl × Silent (Cock's stud, 1 GP) (Tondo's stud, 435 GP) → Egg of Ash × Fowl (lays Friday, hatches the Friday after)",
          gp: -435,
          bird: "Egg of Ash × Fowl",
          parents: {
            mother: "Ash × Fowl",
            father: "Silent (Cock's stud, 1 GP)",
            studFarm: "Tondo",
          },
        },
        "Bred Ash × Fowl to Tondo's rooster Silent (Cock's stud, 1 GP) for 435 GP. The new egg is Egg of Ash × Fowl.",
      ],
      [
        "stud_income",
        {
          message:
            "Man covered by Night covered Hen — stud share +5 GP covered Two — stud share +292 GP",
          gp: 292,
          bird: "Man covered by Night",
          byFarm: "Tondo Tigas Gamefarm",
        },
        "Tondo Tigas Gamefarm bred their hen Hen — stud share +5 GP covered Two to your rooster Man covered by Night. You earned 292 GP.",
      ],
      // The rooster was renamed after the cover: no anchor, so the stored line.
      [
        "stud_income",
        {
          message: "Blessed Flash covered Brass Wing — stud share +292 GP",
          gp: 292,
          bird: "Holy Flash",
        },
        null,
      ],
      [
        "hatch",
        {
          message: "Ash — a hen, 5★ Fire hatched — a rooster, 2.5★ Earth",
          bird: "Ash — a hen, 5★ Fire",
        },
        "Ash — a hen, 5★ Fire hatched. It is a rooster, 2.5★ Earth.",
      ],
      [
        "retire",
        {
          message:
            "Stand (9–0) by Me reached the age cap — retired to the barn (7–5). The sheet is public: B overall.",
          bird: "Stand (9–0) by Me",
          data: { by: "age" },
        },
        "Stand (9–0) by Me got too old to fight, so it retired. Its record was 7–5. Its stats are public now. Overall grade: B.",
      ],
      [
        "retire",
        {
          message:
            "Kid (3–3) retired to the barn at 9 (0–0) retired to the barn at 3 (4–4). The sheet is public: C+ overall.",
          bird: "Kid (3–3) retired to the barn at 9 (0–0)",
          data: { by: "manual" },
        },
        "Retired Kid (3–3) retired to the barn at 9 (0–0) to the barn. Its record was 4–4. Its stats are public now. Overall grade: C+.",
      ],
      [
        "retire",
        {
          message:
            "Kid fell in the B1 Championship Final — force-retired (0–9) fell in the B4 Championship Quarterfinals — force-retired (6–3)",
          bird: "Kid fell in the B1 Championship Final — force-retired (0–9)",
          data: { by: "hardcore" },
        },
        "Kid fell in the B1 Championship Final — force-retired (0–9) lost in the B4 Championship Quarterfinals. That crown is hardcore, so its career is over. Its record was 6–3.",
      ],
      [
        "stud_listed",
        {
          message:
            "Wind — 9 GP a cover (1 LT paid for the seat) stands at stud — 1300 GP a cover (100 LT paid for the seat)",
          lt: -100,
          bird: "Wind — 9 GP a cover (1 LT paid for the seat)",
        },
        "Put Wind — 9 GP a cover (1 LT paid for the seat) up at stud for 1,300 GP a cover. The stud seat cost 100 LT.",
      ],
      [
        "entry",
        {
          message:
            "entered A @ 5 GP tag · B2 — OPEN · B5 (lobby #1, 1 GP escrowed) — JUVENILE·CLAIMER @ 270 GP tag · B1 (lobby #782, 72 GP escrowed)",
          gp: -72,
          bird: "A @ 5 GP tag · B2 — OPEN · B5 (lobby #1, 1 GP escrowed)",
        },
        "Entered A @ 5 GP tag · B2 — OPEN · B5 (lobby #1, 1 GP escrowed) in tonight's juvenile claimer fights (B1). Another farm can claim it for 270 GP. 72 GP is held until the fights are done.",
      ],
      [
        "refund",
        {
          message:
            "Kid's Pintakasi entry withdrawn — no longer stands drew nobody in CLAIMER @ 180 GP tag · B4 — 96 GP refunded",
          gp: 96,
          bird: "Kid's Pintakasi entry withdrawn — no longer stands",
        },
        "Kid's Pintakasi entry withdrawn — no longer stands had nobody to fight tonight. The 96 GP came back to you.",
      ],
      [
        "refund",
        {
          message:
            "Kid drew nobody in OPEN · B1 — 5 GP refunded's Pintakasi entry withdrawn — the field was too small (80 GP home)",
          gp: 80,
          bird: "Kid drew nobody in OPEN · B1 — 5 GP refunded",
        },
        "Kid drew nobody in OPEN · B1 — 5 GP refunded left the Pintakasi because too few birds signed up. The 80 GP came back to you.",
      ],
      [
        "card_settled",
        {
          message:
            "Crow — 3 of 3 fights finished JUVENILE · B3 — 2 of 3 fights, 150 GP risked, +29.10 LT · 50 GP unfought and returned",
          gp: 50,
          lt: 29.1,
          bird: "Crow — 3 of 3 fights",
        },
        "Crow — 3 of 3 fights fought 2 of 3 fights tonight. It earned 29.10 LT. 50 GP came back for the fights it did not get.",
      ],
      [
        "claim_refund",
        {
          message:
            "lost the claim draw on X called off — the bird drew no opponent, 5 GP refunded — 90 GP refunded",
          gp: 90,
          bird: "X called off — the bird drew no opponent, 5 GP refunded",
        },
        "Another farm won the draw for X called off — the bird drew no opponent, 5 GP refunded, so your claim lost. The 90 GP came back to you.",
      ],
      [
        "claim_refund",
        {
          message:
            "claim on lost the claim draw on Y — 5 GP refunded called off — the bird drew no opponent, 90 GP refunded",
          gp: 90,
          bird: "lost the claim draw on Y — 5 GP refunded",
        },
        "Your claim on lost the claim draw on Y — 5 GP refunded was called off because the bird had nobody to fight. The 90 GP came back to you.",
      ],
      [
        "tournament_entry",
        {
          message:
            "registered Wing for the B1 Championship (week 9, free to enter) — hardcore: lose and the career ends for the B3 Championship (week 13, 160 GP escrowed) — hardcore: lose and the career ends",
          gp: -160,
          bird: "Wing for the B1 Championship (week 9, free to enter) — hardcore: lose and the career ends",
        },
        "Signed Wing for the B1 Championship (week 9, free to enter) — hardcore: lose and the career ends up for the B3 Championship in week 13. The 160 GP entry fee is held until the crown. This crown is hardcore. If Wing for the B1 Championship (week 9, free to enter) — hardcore: lose and the career ends loses, its career ends.",
      ],
      [
        "purse_payout",
        {
          message:
            "Mad — B1 Championship land pot: +1 LT (9 fights) — B3 Championship land pot: +241.93 LT (1 fight)",
          lt: 241.93,
          bird: "Mad — B1 Championship land pot: +1 LT (9 fights)",
        },
        "Mad — B1 Championship land pot: +1 LT (9 fights) earned 241.93 LT from the B3 Championship land pot for 1 fight.",
      ],
      [
        "purse_payout",
        {
          message:
            "Mad — B1 Championship purse (champion): +1 GP — B3 Championship purse (semifinal): +1234.50 GP",
          gp: 1234.5,
          bird: "Mad — B1 Championship purse (champion): +1 GP",
        },
        "Mad — B1 Championship purse (champion): +1 GP went out in the semifinal of the B3 Championship. Its share of the purse was 1,234.50 GP.",
      ],
    ];
    for (const [kind, f, said] of cases) expect(voiced("event", kind, facts(f))).toBe(said);
  });

  test("a gacha egg reads by the name it carries now, not the name it dropped with", () => {
    const line = speak(
      "event",
      "gacha",
      facts({
        message: "rolled the gacha (free pull) — Blue token, +1.00 LT — a mystery egg dropped!",
        gp: 0,
        lt: 1,
        bird: "Kidlat",
        data: { token: "Blue", price: 0, free: true, land: 100, egg: "Mystery Egg (Blue) II" },
      })
    );
    expect(line).toEndWith("A mystery egg dropped. It is called Kidlat.");
  });

  test("a kind the table does not know reads as its stored message", () => {
    expect(speak("event", "a_type_from_the_future", facts({ message: "it happened" }))).toBe(
      "It happened."
    );
  });

  test("money keeps en-US separators whatever the server's locale", () => {
    expect([gpWords(117206.03), gpWords(8000), gpWords(0.1)]).toEqual([
      "117,206.03",
      "8,000",
      "0.10",
    ]);
  });
});

/**
 * THE DRIFT CHECK. The cases above pin today's templates; this pins that the
 * table still reads what the engine writes, through the real reader and its
 * joins. It plays a full bot world for five weeks, long enough for the crowns
 * to fill and bump (the first bump lands on day 32), and requires every line
 * of every farm's log to come out in the new voice. A template change in the
 * engine that the table does not follow fails here, by name.
 *
 * The kinds it sees are pinned exactly, so a kind that silently falls out of
 * the world (and so out of this check) fails too. stud_unlisted and
 * barn_expanded are not in it: no bot unlists, and the first barn expansion
 * lands on day 40. Their templates are pinned by the cases above.
 */
describe("the engine's own rows", () => {
  const DAYS = 33;

  function playWorld(): DB {
    seedWorld(7);
    try {
      const db = createDb(":memory:");
      const dev = seedGame(db, { flock: "legacy" });
      Bots.seed(db, { flock: "legacy" });
      const game = new Game(db, dev.farmId);
      for (let i = 0; i < DAYS; i++) game.tickDay();
      return db;
    } finally {
      seedWorld(null);
    }
  }

  test(
    "every line of every farm's log reads in the new voice",
    () => {
      const db = playWorld();
      const unread = new Map<string, string>();
      const seen = new Set<string>();
      const byAnotherFarm = new Set<string>();
      for (const { id } of db.all<{ id: string }>(sql`SELECT id FROM farms`)) {
        let before: string | undefined;
        for (;;) {
          const { lines, more } = farmLogLines(db, id, { limit: 200, before });
          for (const { source, facts: f, entry } of lines) {
            const table: Record<string, unknown> =
              source === "event" ? EVENT_SENTENCES : NOTE_SENTENCES;
            if (table[entry.kind] === "stored") continue;
            const key = `${source}:${entry.kind}`;
            seen.add(key);
            const said = voiced(source, entry.kind, f);
            if (said === null) {
              unread.set(key, f.message);
              continue;
            }
            // No internal ids reach a player: lobby and entry numbers stay stored.
            expect(said).not.toMatch(/#\d/);
            if (entry.who === "another_farm") {
              byAnotherFarm.add(entry.kind);
              expect(entry.farm).not.toBeNull();
              expect(said).toContain(String(entry.farm));
            }
            // The joined names agree with what the engine wrote at the time.
            if (entry.kind === "claim_won")
              expect(f.message).toContain(` from ${f.counterparty} for the `);
            if (entry.kind === "tag_income")
              expect(f.message).toContain(` claimed away by ${f.counterparty} — banked `);
            if (entry.kind === "breed") {
              expect(f.parents).not.toBeNull();
              const own = (f.data as { ownStud?: boolean }).ownStud === true;
              if (own) expect(f.parents?.studFarm).toBeNull();
              else expect(f.message).toContain(`(${f.parents?.studFarm}'s stud, `);
            }
          }
          if (!more) break;
          before = lines[lines.length - 1].entry.cursor;
        }
      }
      expect(Object.fromEntries(unread)).toEqual({});
      expect([...seen].sort()).toEqual([
        "event:breed",
        "event:buy_land",
        "event:card_settled",
        "event:check_in",
        "event:claim",
        "event:claim_refund",
        "event:claim_won",
        "event:entry",
        "event:farm_registered",
        "event:gacha",
        "event:hatch",
        "event:purse_payout",
        "event:refund",
        "event:retire",
        "event:stake",
        "event:staking_payout",
        "event:stud_income",
        "event:stud_listed",
        "event:tag_income",
        "event:tournament_bump",
        "event:tournament_entry",
        "event:unstake",
        "note:named",
        "note:stud_price",
      ]);
      // Claims settle at the tick, so they read as the game; these two are
      // the moves another farm makes on yours.
      expect([...byAnotherFarm].sort()).toEqual(["stud_income", "tournament_bump"]);
    },
    { timeout: 120_000 }
  );
});
