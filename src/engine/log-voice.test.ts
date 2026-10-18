import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { createDb, type DB } from "@/db/client";
import { seedGame } from "@/db/seed-data";
import { Bots } from "./bots";
import type { EventType } from "./events";
import { EVENT_VISIBILITY } from "./farm-log";
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
    },
    said: "Frost Blow is yours now. You claimed it from Sabungero Syndicate for its 90 GP tag. More than one farm claimed it, and yours won the draw over 3 others.",
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
    },
    said: "Bukidnon Farms claimed Savage Strike for its tag, so Savage Strike is theirs now. You got 88.20 GP.",
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
          },
          said: "Bred Ash Fowl to Bukidnon Farms' rooster Lunar Crow for 315 GP. The new egg is Egg of Ash Fowl.",
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
 * table still reads what the engine writes. It plays a real world for two
 * weeks (both crown days, Hatch Friday, the stud market, claims) and requires
 * every row any farm can see to come out in the new voice. A template change
 * in the engine that the table does not follow fails here, by name.
 */
describe("the engine's own rows", () => {
  function playWorld(): DB {
    seedWorld(7);
    try {
      const db = createDb(":memory:");
      const dev = seedGame(db, { flock: "legacy" });
      Bots.seed(db, {
        flock: "legacy",
        only: ["scripted-1", "scripted-3", "scripted-5", "scripted-7"],
      });
      const game = new Game(db, dev.farmId);
      for (let i = 0; i < 15; i++) game.tickDay();
      return db;
    } finally {
      seedWorld(null);
    }
  }

  test("every row a farm log shows reads in the new voice", () => {
    const db = playWorld();
    const rows = db.all<{
      src: "event" | "note";
      kind: string;
      message: string;
      data: string | null;
      bird: string | null;
      gp: number | null;
      lt: number | null;
    }>(sql`
      SELECT 'event' AS src, e.type AS kind, e.message, e.data, b.name AS bird,
             e.gp_cents / 100.0 AS gp, e.lt / 100.0 AS lt
        FROM events e LEFT JOIN birds b ON b.id = e.bird_id
       WHERE e.farm_id IS NOT NULL
      UNION ALL
      SELECT 'note', n.kind, n.message, n.data, b.name, NULL, NULL
        FROM farm_notes n LEFT JOIN birds b ON b.id = n.bird_id
       WHERE n.message <> ''`);
    const shown = rows.filter(
      (r) => r.src === "note" || EVENT_VISIBILITY[r.kind as EventType] !== "hidden"
    );
    const unread = new Map<string, string>();
    const seen = new Set<string>();
    for (const r of shown) {
      const table: Record<string, unknown> = r.src === "event" ? EVENT_SENTENCES : NOTE_SENTENCES;
      if (table[r.kind] === "stored") continue;
      seen.add(r.kind);
      const said = voiced(r.src, r.kind, {
        message: r.message,
        gp: r.gp,
        lt: r.lt,
        bird: r.bird,
        byFarm: null,
        data: r.data === null ? null : JSON.parse(r.data),
      });
      if (said === null) unread.set(r.kind, r.message);
      // No internal ids reach a player: lobby and entry numbers stay stored.
      else expect(said).not.toMatch(/#\d/);
    }
    expect(Object.fromEntries(unread)).toEqual({});
    // A world busy enough to have written most kinds, not an empty pass.
    expect(seen.size).toBeGreaterThan(15);
  });
});
