import { NextRequest } from "next/server";
import {
  McpServer,
  WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import { db } from "@/db/client";
import { FORMAT_NAMES, STAT_NAMES } from "@/engine/config";
import { Game } from "@/engine/game";

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

function createServer(): McpServer {
  const game = new Game(db());

  const server = new McpServer(
    { name: "pintakasi-bloodlines", version: "0.1.0" },
    {
      instructions: [
        "Pintakasi: Bloodlines — a digital sabong game. YOU are the game client: narrate fights and hatch days with color, present choices clearly, and let the player decide.",
        "THE LOOP: breed retired birds → egg hatches next Hatch Friday as an age-1 chick → practice/train through the discovery year → real fights from age 2 → at age 3 the fork opens: hardcore duels AND safe retirement → retire (or lose a hardcore) → the retiree becomes breeding stock → a better bird.",
        "AGE GATES: 0 = egg · 1 = practice + training only · 2+ = real fights · 3+ = hardcore + manual retirement · 9 = force-retired. Ages advance every Hatch Friday (tick_week); one game-week = one bird-year.",
        "WEAPON FORMATS ARE THE DISTANCE DIAL — the player's core skill is picking the right one: longKnife (the sprint — decided by agility/sight in the opening frames), shortKnife (the hybrid), longGaff (the route — stamina starts to rule), shortGaff (the marathon — gameness dictates the deep rounds). Any bird can enter any format; it's just disadvantaged outside its type.",
        "DISCOVERY: every fight returns a PIT FIGURE — a banded performance rating, normalized per format. Compare a bird's figures ACROSS formats (get_bird shows the per-format lines) to type it. A high figure in a LOSS means strong bird, wrong format — say so. Figures are deliberately imprecise; never present them as exact truth.",
        "HARDCORE IS THE CHARGED DECISION: bigger prize, but the loser is FORCE-RETIRED on the spot. Always confirm with the player before a hardcore fight — never enter one on your own judgment.",
        "WHEN AN EGG HATCHES, reveal its sex (hidden 50-50 while an egg — hatch day is the reveal) and prompt the player to name the chick (name_bird). Eggs are auto-named 'Egg of <mother>'.",
        "TWO RECORDS: the career record (real + hardcore — drives stud value) and the amateur record (practice fights, small stakes). Report them separately.",
        "BREEDING: both parents must be retired, hen × rooster, and not close kin (no siblings, parents, grandparents, great-grandparents). The game enforces this — surface the reason if it refuses.",
        "Rule violations come back as ⛔ text — read them to the player as house rules, not errors.",
      ].join("\n"),
    }
  );

  server.registerTool(
    "get_state",
    {
      title: "Game State",
      description:
        "The calendar (in-game date, whether today is Hatch Friday), GP wallet ($1 = 8,000 GP), Land Tokens, and barn occupancy. Start here.",
      annotations: { readOnlyHint: true },
    },
    async () => ruled(() => game.state())
  );

  server.registerTool(
    "list_flock",
    {
      title: "List the Flock",
      description:
        "Every bird with derived age, six stats, element stars (e.g. '2.5★ Fire'), record, and status (egg/active/retired). Retired birds show stud value.",
      annotations: { readOnlyHint: true },
    },
    async () => ruled(() => game.flock.all())
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
      ruled(() => ({
        bird: game.flock.byId(id),
        lineage: game.breeding.lineage(id),
        formatRecords: game.battle.formatRecords(id),
      }))
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
    async ({ id, name }) => ruled(() => game.flock.rename(id, name))
  );

  server.registerTool(
    "tick_day",
    {
      title: "Advance One Day",
      description:
        "Move the calendar one day. Landing on a Friday triggers Hatch Friday: eggs hatch, everyone ages a year, cap-age birds force-retire. Returns any events.",
    },
    async () => ruled(() => game.tickDay())
  );

  server.registerTool(
    "tick_week",
    {
      title: "Advance to Next Hatch Friday",
      description:
        "Jump to the next Hatch Friday (the aging tick). Eggs hatch into age-1 chicks — prompt the player to name them.",
    },
    async () => ruled(() => game.tickWeek())
  );

  server.registerTool(
    "breed",
    {
      title: "Breed",
      description:
        "Breed two RETIRED birds (hen × rooster, not close kin). Costs GP and lays 'Egg of <mother>' — it hatches next Hatch Friday, so breeding late in the week still pays off fast.",
      inputSchema: z.object({
        motherId: z.string().describe("A retired hen"),
        fatherId: z.string().describe("A retired rooster"),
      }),
    },
    async ({ motherId, fatherId }) => ruled(() => game.breeding.breed(motherId, fatherId))
  );

  server.registerTool(
    "fight",
    {
      title: "Fight",
      description:
        "Enter a bird against a house bird at a chosen WEAPON FORMAT (the distance dial — pick it deliberately, that's the game). Modes: 'practice' (age 1+, small entry/prize, builds the separate AMATEUR record), 'real' (age 2+, entry fee, prize, builds the CAREER record), 'hardcore' (age 3+, big prize, LOSER IS FORCE-RETIRED — confirm with the player first). Returns a play-by-play and a Pit Figure; narrate the fight and read the figure.",
      inputSchema: z.object({
        birdId: z.string(),
        mode: z.enum(["practice", "real", "hardcore"]).default("real"),
        format: z
          .enum(FORMAT_NAMES as [string, ...string[]])
          .default("shortKnife")
          .describe(
            "Weapon format: longKnife = sprint · shortKnife = hybrid · longGaff = route · shortGaff = marathon"
          ),
        seed: z.number().int().optional().describe("Replay seed — omit for a fresh fight"),
      }),
    },
    async ({ birdId, mode, format, seed }) =>
      ruled(() => game.battle.fight(birdId, mode, format as never, seed))
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
    async ({ birdId, stat }) => ruled(() => game.flock.train(birdId, stat))
  );

  server.registerTool(
    "retire_bird",
    {
      title: "Retire a Bird",
      description:
        "The safe arm of the age-3 fork: end the career at peak stud value and convert the bird to breeding stock. Irreversible — confirm with the player.",
      inputSchema: z.object({ birdId: z.string() }),
    },
    async ({ birdId }) => ruled(() => game.flock.retire(birdId))
  );

  server.registerTool(
    "roll_gacha",
    {
      title: "Roll the Gacha",
      description:
        "Spend GP on a roll. Always pays a rarity token (White/Green/Blue/Purple/Gold — prizes TBD) plus a Land Token. Blue, Purple, and Gold rolls ALSO drop a MYSTERY EGG (random element, hidden sex, hatches next Hatch Friday) — announce it with fanfare.",
    },
    async () => ruled(() => game.gacha.roll())
  );

  return server;
}

async function handleMcp(request: NextRequest): Promise<Response> {
  // Single-player local MVP: no auth (API-key gate arrives with multi-user, ledger item 24).
  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export const GET = handleMcp;
export const POST = handleMcp;
export const DELETE = handleMcp;
