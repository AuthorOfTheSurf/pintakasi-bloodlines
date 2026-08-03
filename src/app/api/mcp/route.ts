import { NextRequest } from "next/server";
import {
  McpServer,
  WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import { db } from "@/db/client";
import { seedStarterFlock } from "@/db/seed-data";
import { CLAIMER, FARM_COLORS, FORMAT_NAMES, STAT_NAMES } from "@/engine/config";

// Claimers run through enter_claimer (they carry a tag + take claims).
const ENTRY_CLASSES = ["open", "maiden", "nw2", "nw3"] as const;
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
        "THE LOOP: breed retired birds → the hen is pregnant NOW, the egg is LAID next Friday and HATCHES the Friday after as an age-1 chick → juvenile through the discovery year → real fights from age 2 → at age 3 the fork opens: hardcore duels AND safe retirement → retire (or lose a hardcore) → the retiree becomes breeding stock → a better bird.",
        "AGE GATES: 0 = egg · 1 = juvenile only · 2+ = real fights · 3+ = hardcore + manual retirement · 9 = force-retired. Ages advance every Hatch Friday (tick_week); one game-week = one bird-year.",
        "STATS ARE FIXED AT BIRTH — there is NO training. The skill is DISCOVERY: fight the juvenile year across formats, read the pit figures, and learn what the bird already is. Use it well.",
        "EVERY FIGHT IS PvP — PURE, BETWEEN BARNS. The house supplies nobody. The rhythm: during the game-day you ENTER birds into lobbies (enter_lobby / enter_claimer); at the day tick every lobby GOES OFF — its birds are randomly paired and fight each other. Matchmaking NEVER pairs two birds from the same barn: enter several birds in one lobby freely, they will only ever draw other farms (birds left with only barn-mates go unmatched and refund). Entries are BINDING (fee escrowed, the bird's daily fight spent). Lobbies lock at 8 (even — a full lobby guarantees everyone a fight); a lobby that goes off odd strands one bird, whose fee refunds. There is a real risk a lobby doesn't fill — that's the game: judge your birds' strength and pick where they should be fighting.",
        "THE ECONOMY IS POOLED ($1 = 80 GP): both sides post the entry, winner takes the pot — win +entry, lose −entry. No fight prints GP. The subsidy is LAND: both fighters earn Land Tokens scaled to the entry fee and slightly MORE than linearly (juvenile 1 LT · real 7 LT · hardcore 23 LT) — fighting UP into dearer company pays extra land. Unmatched birds earn none. Land is also buyable (buy_land, $0.01/LT, capped daily) and NEVER sellable.",
        "ONE FIGHT PER BIRD PER GAME-DAY — a hard count, not a cooldown. A full barn is how you fight more than once a day.",
        "WEAPON FORMATS ARE THE DISTANCE DIAL — the player's core skill is picking the right one: longKnife (the sprint — agility/sight decide it), shortKnife (the hybrid), longGaff (the route — stamina starts to rule), shortGaff (the marathon — gameness dictates the deep rounds). Any bird can enter any format; it's just disadvantaged outside its type.",
        "CLASSES ARE THE LADDER: open · maiden (never-winners only) · nw2/nw3 (fewer than 2/3 career wins) · claimer (priced). The field is WHOEVER ENTERS — but the board is FOGGED while a lobby is OPEN: lobby_board shows every lobby and its fill count, NEVER whose birds are inside (no dodging — predicting a lobby's strength from its mode, class, and tag is the skill). The one exception: CLAIMER fields are fully visible (stars, records, figures — never stats), because claims are placed on specific birds. Fighting for a tag is choosing to be seen.",
        "CARDS RUN THREE STATES (PFL-style): OPEN (taking entries, fogged) → CLOSED (entries locked, matchups DRAWN AND REVEALED — the fog lifts and you see who your bird fights) → COMPLETED (fights concluded, refunds paid, claims settled). On manual ticks close and post happen together; on the real-time clock claimers close at 6 PM PH for an evening claiming window, everything else minutes before the 11:55 PM post. Claims flow until the lobby completes — a last-second claim either makes it or it's too late.",
        "CLAIMERS ARE THE MARKETPLACE — farm-to-farm, escrowed, PRE-FIGHT: enter_claimer cards a bird at a tag price (" +
          CLAIMER.PRICES.join("/") +
          " GP — the ladder brackets the 160 GP breed floor). Other farms place_claim with the tag escrowed; claims are SEALED. At post time the bird fights for its ORIGINAL owner (who keeps the pooled prize), then one claim wins (RNG if several — losers refund in full), the owner banks the tag, and the bird transfers — even if the bird went unmatched (the sale doesn't need the fight). You cannot claim your own bird. The house never claims. Winning AND getting claimed is an income spike — a legitimate play. Claiming undervalued birds and racing them UP is a full playstyle.",
        "DISCOVERY: every fight returns a PIT FIGURE — banded, normalized per format. Compare a bird's figures ACROSS formats (get_bird shows the lines) to type it. A high figure in a LOSS means strong bird, wrong format — say so. Figures are deliberately imprecise; never present them as exact truth.",
        "HARDCORE IS THE CHARGED DECISION: bigger pot, but the LOSER of the pair is FORCE-RETIRED on the spot — both owners signed up for that by entering. Open class only. Always confirm with the player first — never enter one on your own judgment.",
        "THE PINTAKASI — THE WEEKLY MAJORS (round 18): every WEDNESDAY, three blade championships crown specialists (Long Knife and Short Gaff always run; the middle blade rotates Short Knife / Long Gaff weekly). Single elimination in ONE day, winners healing to full between rounds; HARDCORE THROUGHOUT — every loser force-retires. Age 3+, 200 GP entry, one bird per week (enter_pintakasi any day; Thursday entries roll to next week). The purse = entries + the WHOLE week's juice pool, paid to the top (champion ~half; first-round losers zero GP) — but LAND pays the fallen hardest (elimination grants grow the earlier you fall, plus every tournament fight mints land on a steeper curve). The bracket is committee-seeded by career earnings → wins → average figure, byes to the top seeds, and the field is PUBLIC all week (pintakasi_board). At 64 the committee bumps the weakest for a stronger newcomer. This is where champions — and breeding legends — are made: pitch it to the player when a bird hits age 3 strong.",
        "WHEN AN EGG HATCHES, reveal its sex (hidden 50-50 while an egg) and prompt the player to name the chick (name_bird). Mystery Eggs from the gacha hatch the same way. THE NAMING LAW: a bird CANNOT fight while still wearing its auto-name ('Egg of …', 'Mystery Egg (…)') — entering is refused until name_bird is called. Make naming part of the hatch-day ritual, BEFORE the first card.",
        "ONE LIFETIME RECORD (ruled round 15): juvenile, real, and hardcore fights ALL count toward the same wins-losses line, for birds and farms alike. NOTE: the record does NOT set stud prices — stud pricing is player speculation and supply/demand (flat 160 GP for now).",
        "BREEDING IS PvP TOO — THE BARN: both parents retired, hen × rooster, not close kin. list_stud stands your retired roosters (14 covers/week public + 2 owner-reserved); browse_studs shows a hen every stud she can take, with kin exclusions NAMED. A cover costs 160 GP flat (min AND max for now — player pricing later) and SPLITS 2.5% to land stakers / 48.75% fight juice / 48.75% to the stud's owner. Hens pay, hens keep the egg. Selling covers is income; top studs capping out is by design.",
        "STAKE YOUR LAND — ALWAYS. stake_land every LT as soon as you earn it (one pool for now): staked land collects the breeding fees' staker cut daily, pro-rata. Land never sells, so idle liquid LT earns nothing — staked LT compounds your GP. Tell the player to DESIRE land and stack it: it may be worth real money someday ($1/LT is the dream). Fight-entry fees don't feed the pool yet; breeding does.",
        "SIX BOT STABLES play every game-day (they card birds, breed, and shop the claimer fields just before post time). They are RIVALS, not the house — same rules, own wallets. Their day shows up in the tick result; narrate notable bot moves (a claim on the player's bird!) with color.",
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
        "Every bird in YOUR barn with derived age, six stats, element stars (e.g. '2.5★ Fire'), record, and status (egg/active/retired). Retired roosters show whether they're standing at stud (listedStud).",
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
          formatRecords: g.lobbies.formatRecords(id),
        };
      })
  );

  server.registerTool(
    "name_bird",
    {
      title: "Name a Bird",
      description:
        "Give a bird a player-chosen name — the ritual for a freshly hatched chick, and REQUIRED before its first fight (the naming law: auto-named birds are refused at the lobby door). Names are world-unique.",
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
        "Move the WORLD calendar one day (all farms share the clock — coordinate in beta; the scheduler owns this later). Landing on a Friday triggers Hatch Friday. TONIGHT'S CARD GOES OFF: every open lobby pairs its birds and fights, claims settle — narrate the results with color. Resets daily limits (fights, check-in, land cap).",
    },
    async () => ruled(() => game().tickDay())
  );

  server.registerTool(
    "tick_week",
    {
      title: "Advance to Next Hatch Friday",
      description:
        "Jump the WORLD clock to the next Hatch Friday (the aging tick). Eggs hatch into age-1 chicks — prompt the player to name them. Tonight's card goes off too.",
    },
    async () => ruled(() => game().tickWeek())
  );

  server.registerTool(
    "breed",
    {
      title: "Breed (Buy a Cover)",
      description:
        "Buy a cover: YOUR retired hen × a retired rooster — your own, or ANY farm's listed stud (browse_studs first). Costs 160 GP ($2, min AND max for now), which SPLITS: 4.00 GP to the land-staking pool, 78.00 to the fight-juice pool, 78.00 to the stud's owner. The hen's farm keeps the egg ('Egg of <mother>' — hatches next Hatch Friday). Covers are capped per rooster per week (14 public + 2 owner-reserved).",
      inputSchema: z.object({
        motherId: z.string().describe("A retired hen of YOURS — hens keep the egg"),
        fatherId: z.string().describe("A retired rooster: yours, or a stud id from browse_studs"),
      }),
    },
    async ({ motherId, fatherId }) => ruled(() => game().breeding.breed(motherId, fatherId))
  );

  server.registerTool(
    "browse_studs",
    {
      title: "Browse the Breeding Barn",
      description:
        "The barn from one hen's point of view: every stud she CAN breed with (name, farm, stars, age, record, covers left — 160 GP each) plus the excluded ones WITH the reason (kin overlap named explicitly, or covered out this week). Candidates = every farm's listed studs + your own retired roosters.",
      inputSchema: z.object({ henId: z.string().describe("A retired hen of yours") }),
      annotations: { readOnlyHint: true },
    },
    async ({ henId }) => ruled(() => game().breeding.browseStuds(henId))
  );

  server.registerTool(
    "list_stud",
    {
      title: "Stand a Stud",
      description:
        "List a retired rooster of yours in the breeding barn — any farm's hens can then buy covers at 160 GP, of which 78.00 GP lands in YOUR wallet per cover. 14 public covers/week plus 2 reserved for your own hens. Selling covers is real income — list your good retirees.",
      inputSchema: z.object({ birdId: z.string().describe("A retired rooster of yours") }),
    },
    async ({ birdId }) => ruled(() => game().breeding.listStud(birdId))
  );

  server.registerTool(
    "unlist_stud",
    {
      title: "Pull a Stud",
      description: "Remove your rooster from the breeding barn. Covers already bought this week stand.",
      inputSchema: z.object({ birdId: z.string() }),
    },
    async ({ birdId }) => ruled(() => game().breeding.unlistStud(birdId))
  );

  server.registerTool(
    "stake_land",
    {
      title: "Stake Land",
      description:
        "Stake Land Tokens into THE pool (single pool for now). Staked land earns a pro-rata share of the breeding fees' staker cut, paid every day at the tick — this is where GP goes decimal. Stake as soon as you earn; unstake any time. STACK LAND: it may be worth real money one day ($1/LT is the dream), and it is never sellable either way.",
      inputSchema: z.object({ amount: z.number().int().positive().describe("Liquid LT to stake") }),
    },
    async ({ amount }) => ruled(() => { const g = game(); return g.farms.stake(g.farmId, amount); })
  );

  server.registerTool(
    "unstake_land",
    {
      title: "Unstake Land",
      description: "Pull Land Tokens out of the staking pool — back to liquid (still never sellable).",
      inputSchema: z.object({ amount: z.number().int().positive() }),
    },
    async ({ amount }) => ruled(() => { const g = game(); return g.farms.unstake(g.farmId, amount); })
  );

  server.registerTool(
    "enter_lobby",
    {
      title: "Enter a Lobby (Tonight's Card)",
      description:
        "Put a bird on tonight's card — PURE PvP: at the day tick the lobby's birds are randomly paired and fight EACH OTHER (never two of your own — enter several birds freely, matchmaking keeps barn-mates apart). BINDING: the fee escrows and the bird's daily fight is spent. Lobbies lock at 8; birds without an opponent refund. Pick the WEAPON FORMAT (distance dial) and CLASS (ladder dial) deliberately — lobby_board shows fill counts, not fields (fogged), so judge where your bird belongs. Modes: juvenile (age 1+, 8 GP) · real (2+, 40 GP) — all modes feed the ONE lifetime record · hardcore (3+, 120 GP, LOSER FORCE-RETIRED — confirm first, open class only). Land pays both fighters, scaled up with the fee. Claimers run through enter_claimer.",
      inputSchema: z.object({
        birdId: z.string(),
        mode: z.enum(["juvenile", "real", "hardcore"]).default("real"),
        format: z
          .enum(FORMAT_NAMES as [string, ...string[]])
          .default("shortKnife")
          .describe("longKnife = sprint · shortKnife = hybrid · longGaff = route · shortGaff = marathon"),
        classType: z
          .enum(ENTRY_CLASSES)
          .default("open")
          .describe("open · maiden (never-winners) · nw2/nw3 (win caps)"),
      }),
    },
    async ({ birdId, mode, format, classType }) =>
      ruled(() =>
        game().lobbies.enter(birdId, { mode, classType: classType as never, format: format as never })
      )
  );

  server.registerTool(
    "lobby_board",
    {
      title: "The Board (Tonight's Card)",
      description:
        "Tonight's card, in both live states. OPEN lobbies are FOGGED: you see each lobby's mode/class/format/tag and its fill count, plus YOUR OWN entries, never other barns' birds (no dodging) — except CLAIMER lobbies, whose fields are fully visible so claims can be placed. CLOSED lobbies are the REVEAL: entries locked, full field shown, and each entry's `drew` says who it fights tonight (drew: null = no opponent, refunds at post). The six stats are ALWAYS hidden (reading figures is the skill) and claims already placed are SEALED. Scout fill counts before entering; scout closed claimer draws before claiming.",
      annotations: { readOnlyHint: true },
    },
    async () => ruled(() => game().lobbies.board())
  );

  server.registerTool(
    "enter_claimer",
    {
      title: "Enter a Claimer",
      description:
        "Card a bird (age 2+) in a claimer lobby at a tag price: " +
        CLAIMER.PRICES.join(" / ") +
        " GP. Same PvP card rules as enter_lobby (binding, 40 GP fee, random pairing at the tick) — PLUS the bird's card is publicly visible (claimers are the one un-fogged class) and other farms may claim it (sealed) until post time. You keep the pooled prize either way; if claimed, you also bank the tag and the bird transfers AFTER the fight — even if it went unmatched. Cheap tag = claimable but quick money; dear tag = safer, dearer company.",
      inputSchema: z.object({
        birdId: z.string(),
        format: z
          .enum(FORMAT_NAMES as [string, ...string[]])
          .default("shortKnife")
          .describe("The weapon format the lobby runs at"),
        price: z.number().int().describe("The claiming tag: " + CLAIMER.PRICES.join(" / ") + " GP"),
      }),
    },
    async ({ birdId, format, price }) =>
      ruled(() =>
        game().lobbies.enter(birdId, { mode: "real", classType: "claimer", format: format as never, price })
      )
  );

  server.registerTool(
    "place_claim",
    {
      title: "Place a Claim",
      description:
        "Sealed claim on a claimer entry from lobby_board — the tag escrows NOW and settles at post time (the day tick). If several farms claim, the RNG picks one; losers refund in full. The bird transfers AFTER it fights (the original owner keeps the prize). One claim per farm per entry; not your own bird.",
      inputSchema: z.object({ entryId: z.number().int().describe("From lobby_board") }),
    },
    async ({ entryId }) => ruled(() => game().lobbies.claim(entryId))
  );

  server.registerTool(
    "enter_pintakasi",
    {
      title: "Register for the Pintakasi",
      description:
        "Register an age-3+ bird for one of THIS WEEK's three blade championships (the weekly Majors — crowns every Wednesday). HARDCORE THROUGHOUT: every loser in the bracket is FORCE-RETIRED, so always confirm with the player first. 200 GP entry (escrowed, binding); the purse = all entries + the week's whole juice pool, weighted to the TOP (first-round losers take zero GP) while LAND is weighted to the FALLEN (the earlier a bird goes out, the bigger its land grant — a first-round death is never a pure loss). Committee-seeded bracket by career earnings → wins → average figure; at 64 entrants a stronger newcomer BUMPS the weakest (refunded). One bird per week; the field is PUBLIC — check pintakasi_board. Registrants fight normal cards all week except Wednesday.",
      inputSchema: z.object({
        birdId: z.string(),
        format: z
          .enum(FORMAT_NAMES as [string, ...string[]])
          .describe("This week's blades only — pintakasi_board lists them (the middle blade rotates weekly)"),
      }),
    },
    async ({ birdId, format }) => ruled(() => game().tournaments.enter(birdId, format as never))
  );

  server.registerTool(
    "pintakasi_board",
    {
      title: "The Pintakasi Board",
      description:
        "This week's three blade championships: each field ranked as the Selection Committee sees it TODAY (rank 1 = top seed; the bottom of a full field is the bump line), the entry fee, and the projected purse (entries so far + the juice-pool share). Fields are PUBLIC — the Pintakasi is the one un-fogged stage in the game.",
    },
    async () => ruled(() => game().tournaments.board())
  );

  // (No train tool — stats are fixed at birth, ruled 2026-08-03 round 13.)

  server.registerTool(
    "retire_bird",
    {
      title: "Retire a Bird",
      description:
        "The safe arm of the age-3 fork: end the career and convert the bird to breeding stock (roosters can then stand at stud via list_stud). Irreversible — confirm with the player.",
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
