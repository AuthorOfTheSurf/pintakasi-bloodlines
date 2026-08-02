import { NextRequest } from "next/server";
import {
  McpServer,
  WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import { db } from "@/db/client";
import { seedStarterFlock } from "@/db/seed-data";
import { CLAIMER, FARM_COLORS, FORMAT_NAMES, STAT_NAMES } from "@/engine/config";

// Claimers run through their own two-phase flow, not the fight tool.
const FIGHT_LOBBIES = ["open", "maiden", "nw2", "nw3"] as const;
import { Farms } from "@/engine/farms";
import { Game } from "@/engine/game";
import { freshSeed } from "@/engine/rng";

function text(value: string) {
  return { content: [{ type: "text" as const, text: value }] };
}

function json(value: unknown) {
  return text(JSON.stringify(value, null, 2));
}

/** Engine errors are rule violations — return them as readable text, not protocol errors. */
function ruled<T>(fn: () => T) {
  try {
    return json(fn());
  } catch (err) {
    return text(`⛔ ${err instanceof Error ? err.message : String(err)}`);
  }
}

function createServer(farmId: string | null): McpServer {
  const database = db();
  const farmsApi = new Farms(database);

  /** Scoped game — every farm-tool goes through this. */
  const game = (): Game => {
    if (!farmId)
      throw new Error(
        "No farm on this connection — register_farm first, then add ?key=fk_… to the MCP URL"
      );
    return new Game(database, farmId);
  };

  const server = new McpServer(
    { name: "pintakasi-bloodlines", version: "0.3.0" },
    {
      instructions: [
        "Pintakasi: Bloodlines — a digital sabong game. YOU are the game client: narrate fights and hatch days with color, present choices clearly, and let the player decide.",
        "YOUR FARM: every player (human or agent) runs a named farm with a country flag and two colors. No farm on this connection? register_farm, save the key, and reconnect with ?key=… on the MCP URL. (When only one farm exists, the key is optional.)",
        "THE DAILY RITUAL: check_in once per game-day — it pays the GP drip ($10 = 800 GP) and 2 free gacha pulls. Do it first thing.",
        "THE LOOP: breed retired birds → egg hatches next Hatch Friday as an age-1 chick → practice/train through the discovery year → real fights from age 2 → at age 3 the fork opens: hardcore duels AND safe retirement → retire (or lose a hardcore) → the retiree becomes breeding stock → a better bird.",
        "AGE GATES: 0 = egg · 1 = practice + training only · 2+ = real fights · 3+ = hardcore + manual retirement · 9 = force-retired. Ages advance every Hatch Friday (tick_week); one game-week = one bird-year.",
        "THE ECONOMY IS POOLED ($1 = 80 GP): both sides post the entry, winner takes the pot — win +entry, lose −entry. No fight prints GP. The consolation is the flat LAND TOKEN every fight pays, win or lose. Land is also buyable (buy_land, $0.01/LT, capped daily) and NEVER sellable.",
        "ONE FIGHT PER BIRD PER GAME-DAY — a hard count, not a cooldown. A full barn is how you fight more than once a day.",
        "WEAPON FORMATS ARE THE DISTANCE DIAL — the player's core skill is picking the right one: longKnife (the sprint — agility/sight decide it), shortKnife (the hybrid), longGaff (the route — stamina starts to rule), shortGaff (the marathon — gameness dictates the deep rounds). Any bird can enter any format; it's just disadvantaged outside its type.",
        "LOBBIES ARE THE CLASS DIAL: open (field mirrors your bird) · maiden (never-winners only — soft field) · nw2/nw3 (fewer than 2/3 career wins). House-bird quality follows the lobby — maidens are green.",
        "CLAIMERS ARE THE MARKETPLACE — farm-to-farm, escrowed, PRE-FIGHT: enter_claimer puts a bird on today's card at a tag price (" +
          CLAIMER.PRICES.join("/") +
          " GP — the ladder brackets the 160 GP breed floor). Entries are BINDING and use the bird's fight for the day. Other farms read the board (claimer_board — stars and figures are public, stats are NOT) and place_claim with the tag escrowed; claims are SEALED. The fight goes off when the day ticks: the bird fights for its ORIGINAL owner (who keeps the pooled prize), then one claim wins (RNG if several — losers refund in full), the owner banks the tag, and the bird transfers. You cannot claim your own bird. The house never claims. Winning AND getting claimed is an income spike — a legitimate play. Claiming undervalued birds and racing them UP is a full playstyle; the tag ladder self-balances (dear tag = safer bird, stronger field; cheap tag = claimable, quick money).",
        "DISCOVERY: every fight returns a PIT FIGURE — banded, normalized per format. Compare a bird's figures ACROSS formats (get_bird shows the lines) to type it. A high figure in a LOSS means strong bird, wrong format — say so. Figures are deliberately imprecise; never present them as exact truth.",
        "HARDCORE IS THE CHARGED DECISION: bigger pot, but the loser is FORCE-RETIRED on the spot. Open lobby only. Always confirm with the player first — never enter one on your own judgment.",
        "WHEN AN EGG HATCHES, reveal its sex (hidden 50-50 while an egg) and prompt the player to name the chick (name_bird). Mystery Eggs from the gacha hatch the same way.",
        "TWO RECORDS: career (real + hardcore — drives stud value) and amateur (practice). Report them separately.",
        "BREEDING: both parents must be retired, hen × rooster, not close kin. The $2 (160 GP) fee is the FLOOR price — markets come later.",
        "Rule violations come back as ⛔ text — read them to the player as house rules, not errors.",
      ].join("\n"),
    }
  );

  server.registerTool(
    "register_farm",
    {
      title: "Register a Farm",
      description:
        "Create your farm: name (required), country flag (encouraged — pick one!), and two colors from the palette: " +
        FARM_COLORS.join(", ") +
        ". Returns your farm key (fk_…) — SAVE IT and reconnect with ?key=… on the MCP URL. Seeds the 8-bird starter flock and a $100 (8,000 GP) stake.",
      inputSchema: z.object({
        name: z.string().describe("The farm's name"),
        country: z.string().optional().describe("Flag emoji or country name, e.g. 🇵🇭"),
        primaryColor: z.enum(FARM_COLORS),
        secondaryColor: z.enum(FARM_COLORS),
      }),
    },
    async (input) =>
      ruled(() => {
        const { farm, apiKey } = farmsApi.register(input);
        seedStarterFlock(database, farm.id, { seed: freshSeed() });
        return { farm, apiKey, note: "Save the apiKey — it is your login (?key=… on the MCP URL)." };
      })
  );

  server.registerTool(
    "list_farms",
    {
      title: "The Scoreboard",
      description: "Every farm's public identity — name, flag, colors, GP, land. No keys.",
      annotations: { readOnlyHint: true },
    },
    async () => ruled(() => farmsApi.all())
  );

  server.registerTool(
    "check_in",
    {
      title: "Daily Check-In",
      description:
        "The daily ritual, once per game-day: pays the GP drip (800 GP = $10) and grants 2 free gacha pulls. Do this first thing each day.",
    },
    async () => ruled(() => game().farms.checkIn(game().farmId))
  );

  server.registerTool(
    "get_state",
    {
      title: "Game State",
      description:
        "The world calendar (in-game date, whether today is Hatch Friday) plus YOUR farm: GP wallet ($1 = 80 GP), Land Tokens, free pulls, check-in status, barn occupancy. Start here.",
      annotations: { readOnlyHint: true },
    },
    async () => ruled(() => game().state())
  );

  server.registerTool(
    "list_flock",
    {
      title: "List the Flock",
      description:
        "Every bird in YOUR barn with derived age, six stats, element stars (e.g. '2.5★ Fire'), record, and status (egg/active/retired). Retired birds show stud value.",
      annotations: { readOnlyHint: true },
    },
    async () => ruled(() => game().flock.all())
  );

  server.registerTool(
    "get_bird",
    {
      title: "Bird Detail",
      description:
        "One bird in full: stats, lineage tree, and the per-format past-performance lines (record + Pit Figures per weapon format) — the discovery readout.",
      inputSchema: z.object({ id: z.string().describe("Bird id from list_flock") }),
      annotations: { readOnlyHint: true },
    },
    async ({ id }) =>
      ruled(() => {
        const g = game();
        return {
          bird: g.flock.byId(id),
          lineage: g.breeding.lineage(id),
          formatRecords: g.battle.formatRecords(id),
        };
      })
  );

  server.registerTool(
    "name_bird",
    {
      title: "Name a Bird",
      description: "Give a bird a player-chosen name — the ritual for a freshly hatched chick.",
      inputSchema: z.object({
        id: z.string(),
        name: z.string().describe("The new name"),
      }),
    },
    async ({ id, name }) => ruled(() => game().flock.rename(id, name))
  );

  server.registerTool(
    "tick_day",
    {
      title: "Advance One Day",
      description:
        "Move the WORLD calendar one day (all farms share the clock — coordinate in beta; the scheduler owns this later). Landing on a Friday triggers Hatch Friday. THE CLAIMING CARD GOES OFF: every pending claimer fights and its claims settle — narrate the results. Resets daily limits (fights, check-in, land cap).",
    },
    async () => ruled(() => game().tickDay())
  );

  server.registerTool(
    "tick_week",
    {
      title: "Advance to Next Hatch Friday",
      description:
        "Jump the WORLD clock to the next Hatch Friday (the aging tick). Eggs hatch into age-1 chicks — prompt the player to name them. Any pending claimer card goes off too.",
    },
    async () => ruled(() => game().tickWeek())
  );

  server.registerTool(
    "breed",
    {
      title: "Breed",
      description:
        "Breed two RETIRED birds (hen × rooster, not close kin). Costs the 160 GP ($2) floor fee and lays 'Egg of <mother>' — hatches next Hatch Friday.",
      inputSchema: z.object({
        motherId: z.string().describe("A retired hen"),
        fatherId: z.string().describe("A retired rooster"),
      }),
    },
    async ({ motherId, fatherId }) => ruled(() => game().breeding.breed(motherId, fatherId))
  );

  server.registerTool(
    "fight",
    {
      title: "Fight",
      description:
        "Enter a bird against a house bird — fights instantly. Pick the WEAPON FORMAT (distance dial) and LOBBY (class dial) deliberately — that's the game. Pooled pot: win +entry, lose −entry; every fight pays 1 Land Token. Modes: practice (age 1+, amateur record) · real (2+, career record) · hardcore (3+, LOSER FORCE-RETIRED — confirm first, open lobby only). One fight per bird per game-day. Claimers do NOT run here — use enter_claimer.",
      inputSchema: z.object({
        birdId: z.string(),
        mode: z.enum(["practice", "real", "hardcore"]).default("real"),
        format: z
          .enum(FORMAT_NAMES as [string, ...string[]])
          .default("shortKnife")
          .describe("longKnife = sprint · shortKnife = hybrid · longGaff = route · shortGaff = marathon"),
        lobby: z
          .enum(FIGHT_LOBBIES)
          .default("open")
          .describe("open · maiden (never-winners) · nw2/nw3 (win caps)"),
        seed: z.number().int().optional().describe("Replay seed — omit for a fresh fight"),
      }),
    },
    async ({ birdId, mode, format, lobby, seed }) =>
      ruled(() => game().battle.fight(birdId, mode, format as never, seed, lobby as never))
  );

  server.registerTool(
    "enter_claimer",
    {
      title: "Enter a Claimer",
      description:
        "Put a bird (age 2+) on TODAY'S claiming card at a tag price: " +
        CLAIMER.PRICES.join(" / ") +
        " GP. BINDING — the entry fee (40 GP) is escrowed, the bird's daily fight is used, and there is no cancelling. Other farms may claim it (sealed) until the day ticks; then the fight goes off vs a house bird whose strength keys to the TAG. You keep the pooled prize either way; if claimed, you also bank the tag and the bird transfers AFTER the fight. Cheap tag = claimable but quick money; dear tag = safer, stronger field.",
      inputSchema: z.object({
        birdId: z.string(),
        format: z
          .enum(FORMAT_NAMES as [string, ...string[]])
          .default("shortKnife")
          .describe("The weapon format the fight runs at"),
        price: z.number().int().describe("The claiming tag: " + CLAIMER.PRICES.join(" / ") + " GP"),
      }),
    },
    async ({ birdId, format, price }) =>
      ruled(() => game().claimers.enter(birdId, format as never, price))
  );

  server.registerTool(
    "claimer_board",
    {
      title: "The Claiming Board",
      description:
        "Every pending claimer entry, world-wide — the day's card. Public info only: farm, bird name/sex/age/stars, career + amateur records, per-format Pit Figure lines, format, tag. The six stats are HIDDEN (reading figures is the skill) and claims are SEALED. Entries marked mine:true are yours — you cannot claim those.",
      annotations: { readOnlyHint: true },
    },
    async () => ruled(() => game().claimers.board())
  );

  server.registerTool(
    "place_claim",
    {
      title: "Place a Claim",
      description:
        "Sealed claim on a board entry — the tag price is escrowed NOW and settles when the fight goes off at the day tick. If several farms claim, the RNG picks one; losers refund in full. The bird transfers AFTER it fights (the original owner keeps the prize). One claim per farm per entry; not your own bird.",
      inputSchema: z.object({ entryId: z.number().int().describe("From claimer_board") }),
    },
    async ({ entryId }) => ruled(() => game().claimers.claim(entryId))
  );

  server.registerTool(
    "train",
    {
      title: "Train (Discovery Year)",
      description:
        "Train an age-1 chick: a small gain to a chosen stat, limited sessions per day. This is what the discovery year is for — alongside amateur fights across the formats to type the bird.",
      inputSchema: z.object({
        birdId: z.string(),
        stat: z.enum(STAT_NAMES),
      }),
    },
    async ({ birdId, stat }) => ruled(() => game().flock.train(birdId, stat))
  );

  server.registerTool(
    "retire_bird",
    {
      title: "Retire a Bird",
      description:
        "The safe arm of the age-3 fork: end the career at peak stud value and convert the bird to breeding stock. Irreversible — confirm with the player.",
      inputSchema: z.object({ birdId: z.string() }),
    },
    async ({ birdId }) => ruled(() => game().flock.retire(birdId))
  );

  server.registerTool(
    "buy_land",
    {
      title: "Buy Land Tokens",
      description:
        "Buy Land Tokens with GP: 80 GP per 100 LT ($0.01/LT), capped at 1,000 LT per game-day. One-way — land never sells back.",
      inputSchema: z.object({ amount: z.number().int().describe("Whole LT to buy") }),
    },
    async ({ amount }) => ruled(() => game().farms.buyLand(game().farmId, amount))
  );

  server.registerTool(
    "roll_gacha",
    {
      title: "Roll the Gacha",
      description:
        "One roll = 80 GP ($1) — free pulls from check_in spend first. Always pays a rarity token (White/Green/Blue/Purple/Gold — prizes TBD) plus a Land Token. Blue, Purple, and Gold ALSO drop a MYSTERY EGG (random element, hidden sex, hatches next Hatch Friday) — announce it with fanfare.",
    },
    async () => ruled(() => game().gacha.roll())
  );

  return server;
}

async function handleMcp(request: NextRequest): Promise<Response> {
  // Low-security beta auth by design: farm key via ?key= or x-farm-key.
  // Single-farm fallback keeps local dev zero-friction.
  const database = db();
  const farmsApi = new Farms(database);
  const key =
    request.headers.get("x-farm-key") || new URL(request.url).searchParams.get("key") || null;
  let farmId: string | null = null;
  if (key) {
    try {
      farmId = farmsApi.byKey(key).id;
    } catch {
      farmId = null; // bad key → tools will say so via ruled()
    }
  } else {
    farmId = farmsApi.soleFarm()?.id ?? null;
  }

  const server = createServer(farmId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export const GET = handleMcp;
export const POST = handleMcp;
export const DELETE = handleMcp;
