/**
 * ── A LOCAL MODEL AS A BARN'S BRAIN (round 49, phase 1) ────────────────────
 *
 * One `BotDecider` (see bot-brain.ts) backed by a model running on this
 * machine — Ollama on `localhost:11434`, no account, no API key, no bill.
 * The whole world, engine and brains both, runs on one laptop.
 *
 * ⚠ THE PROVIDER IS ONE LINE. Ollama serves an OpenAI-shaped chat endpoint,
 * so pointing this at a hosted model later means changing a URL and adding a
 * header — nothing else in the file, and nothing at all outside it. That is
 * deliberate: the interesting measurement is the same world played by a local
 * 14B and by a frontier model, and a comparison is only honest if the two
 * differ in exactly one place.
 *
 * ── THE THREE PROBLEMS THIS FILE ACTUALLY SOLVES ───────────────────────────
 *
 * A `BotView` is far too big to hand a model. A mid-game barn holds eighty
 * birds and the board posts hundreds of keys; serialized whole it runs to
 * tens of thousands of tokens, most of it irrelevant to the twelve decisions
 * a stable actually makes in a day. So:
 *
 * 1. DIGEST, don't dump. `digest()` builds a purpose-shaped brief — what can
 *    fight today, what can breed, what is worth claiming — rather than a
 *    serialization of the game state. Most of the work in this file is here,
 *    and it is the part that decides whether a small model can play at all.
 *
 * 2. SHORT HANDLES, not UUIDs. Bird ids are `randomUUID()`s: ~9 tokens each,
 *    visually identical to one another, and a model asked to copy fifty of
 *    them exactly WILL eventually transpose one. The prompt uses `#1`, `#2`,
 *    … and the reply is mapped back here. Cheaper, and it converts a whole
 *    class of silent misfires into an impossible input. **See HANDLE_PREFIX
 *    for why the prefix is `#` and not the obvious `b` — that choice cost an
 *    afternoon and is the best field note in this file.**
 *
 * 3. A SCHEMA, not a plea. Ollama takes a JSON schema in `format` and
 *    constrains generation to it, so "reply with JSON" stops being a request
 *    the model may decline. Zod re-checks the result anyway — a schema
 *    guarantees SHAPE, never sense, and `b99` is well-formed nonsense.
 *
 * Anything that survives all three still faces `quietly` at the engine door
 * (see applyProposals). Four layers, and only the last one is trusted.
 */
import { z } from "zod";
import type { BotAction, BotDecider, BotView } from "./bot-brain";
import { FORMATS } from "./config";

export interface OllamaOptions {
  /** Model tag as Ollama knows it, e.g. "qwen3:14b". */
  model: string;
  /** Where the server lives. Override to point at a hosted provider. */
  baseUrl?: string;
  /**
   * How long to wait on one barn. A local 14B answers a prompt this size in
   * a few seconds; a cold model has to be read off disk first, which is the
   * expensive part and why the tick wakes every barn together. Generous on
   * purpose — a timeout costs a barn its whole day (bot-brain sits it out),
   * which is a much worse outcome than waiting.
   */
  timeoutMs?: number;
  /** Log the prompt and reply for each barn — the phase-1 workhorse. */
  verbose?: boolean;
  /**
   * Receives one BrainCallLog per successful call. NOT serialized anywhere —
   * which is why it is a callback and not part of the return value: the
   * direct decider and the actor-routed one both feed the same sink shape,
   * so simulate.ts writes brain_log rows without knowing which brain it has.
   */
  sink?: (log: BrainCallLog) => void;
  /**
   * The owner's standing orders (round 51, phase 3). Appended to the system
   * prompt when present. This is where a barn stops playing the house style:
   * the text lives in the barn ACTOR's durable state, set by `tune`, and
   * arrives here per call — the decider itself stays stateless.
   */
  strategy?: string;
}

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * How many of each list the brief carries.
 *
 * These are the only lossy numbers in the file. A barn with forty fighters
 * does not need all forty in the prompt to have a good day — it needs its
 * best ones — but a cap is still a cap, so it is named here rather than
 * buried, and the digest reports what it dropped (`moreFighters`) so the
 * model is never silently told it owns less than it does.
 */
// fighters 12 → 24 for exp3: exp2's postmortem found the 12-bird window was
// a structural volume ceiling — a barn cannot enter a bird its brief never
// shows, and scripted rosters run 70+ birds deep by late game. 24 costs
// ~400 more prefill tokens (cheap, warm prefill is ~free) and lets "enter
// every healthy bird" mean what it says for any roster the llm side has
// actually grown so far.
const LIMITS = { fighters: 24, hens: 6, studs: 6, claims: 8 } as const;

/**
 * ── THE HANDLE PREFIX, AND THE BUG THAT CHOSE IT ───────────────────────────
 *
 * These were `b1, b2, b3…` for exactly one afternoon. **The five blade
 * formats in this game are named `b1` through `b5`** — so the brief handed
 * the model `"format":"b1"` in `cardTonight` and `"id":"b1"` in `fighters`,
 * two different things wearing the same string, inside one JSON object.
 *
 * The model did the reasonable thing with an ambiguous namespace: on a day
 * when the barn owned no fighters at all (an opening week where every bird
 * is still an egg, so `fighters` was empty), it reached for the only `b`
 * tokens on the page and proposed entering `b1`…`b5` — the FORMATS — as
 * birds. Five actions dropped, and the drop reason said "unknown bird b1"
 * while a `b1` sat right there in the prompt.
 *
 * `#1` cannot collide with anything the game names. The general rule is
 * worth more than the fix: **an identifier invented for a prompt must not
 * share a namespace with any identifier the domain already uses**, because
 * the model has no way to know which one you meant and every way to guess.
 */
const HANDLE_PREFIX = "#";

// ── THE BRIEF ──────────────────────────────────────────────────────────────

interface Digest {
  brief: Record<string, unknown>;
  /** handle → real bird id, for mapping the reply back. */
  birds: Map<string, string>;
}

/**
 * Turn a full view into the brief a stable actually needs this morning.
 *
 * The ordering is the opinionated part: fighters are sorted by the scout's
 * best-blade score so that when the cap bites, it drops the birds least
 * likely to be carded — the same judgement `pickOffering` makes, made once
 * here instead of asked of the model.
 */
export function digest(view: BotView): Digest {
  const birds = new Map<string, string>();
  let n = 0;
  const handle = (id: string): string => {
    const h = `${HANDLE_PREFIX}${++n}`;
    birds.set(h, id);
    return h;
  };

  const active = view.flock.filter((b) => b.status === "active");
  const ranked = [...active].sort((a, b) => {
    const sa = view.scout[a.id]?.blades[view.scout[a.id].bestBlade]?.score ?? 0;
    const sb = view.scout[b.id]?.blades[view.scout[b.id].bestBlade]?.score ?? 0;
    return sb - sa;
  });

  const crownable = new Set(view.crowns.eligibleBirdIds);
  const juvenileCrownable = new Set(view.crowns.juvenileEligibleBirdIds);
  const fighters = ranked.slice(0, LIMITS.fighters).map((b) => {
    const report = view.scout[b.id];
    return {
      id: handle(b.id),
      name: b.name,
      age: b.age,
      stars: b.stars,
      record: `${b.wins}-${b.losses}`,
      // WHERE THE EVIDENCE POINTS, already computed. Handing a model five raw
      // per-blade records and hoping it ranks them is asking it to redo work
      // the scout does better and for free.
      bestBlade: report?.bestBlade ?? null,
      fights: report?.totalFights ?? 0,
      // Only present when true — a token spent on `false` is a token wasted.
      ...(crownable.has(b.id) ? { crownEligible: true } : {}),
      ...(juvenileCrownable.has(b.id) ? { juvenileCrownEligible: true } : {}),
      // Exp6, instrument gap #4 (the mode word): an age-1 bird may ONLY
      // fight mode:"juvenile", and exp5 proved the model cannot infer that —
      // llm chicks logged 0 juvenile fights all season against the scripted
      // side's 6,214, because every enter defaulted to mode:"real" and the
      // engine quietly refused. The flag pairs with the system-prompt law.
      ...(b.age === 1 ? { juvenile: true } : {}),
    };
  });

  // Breeding stock. Retired hens carry; retired roosters can stand at stud.
  const retired = view.flock.filter((b) => b.status === "retired");
  const hens = retired
    .filter((b) => b.sexLabel === "hen")
    .slice(0, LIMITS.hens)
    .map((b) => ({ id: handle(b.id), name: b.name, stars: b.stars }));
  const studs = retired
    .filter((b) => b.sexLabel === "rooster")
    .slice(0, LIMITS.studs)
    .map((b) => ({ id: handle(b.id), name: b.name, stars: b.stars, listed: b.listedStud === 1 }));

  // Claimable birds: other stables' entries in claimer lobbies, which are the
  // one class where the field is public (a claim is placed on a named bird
  // before it fights — that exposure IS the class).
  // The stud MARKET (exp8, gap #7): other farms' listed studs — the fathers
  // scripted bots have shopped all along and this brief never showed.
  const studMarket = view.studMarket.slice(0, LIMITS.studs).map((s) => ({
    id: handle(s.id),
    name: s.name,
    stars: s.stars,
  }));

  const claimable = view.claimerBoard
    .flatMap((lobby) =>
      lobby.entries
        .filter((e) => !e.mine)
        .map((e) => ({
          entryId: e.entryId,
          bird: e.bird.name,
          age: e.bird.age,
          stars: e.bird.stars,
          record: `${e.bird.career.wins}-${e.bird.career.losses}`,
          tag: lobby.price,
        }))
    )
    .slice(0, LIMITS.claims);

  // Tonight's card: the keys that are actually enterable. A model cannot be
  // expected to know a class is closed today — round 31 made a key enterable
  // only if the day posted it, so the openable set IS the card.
  const card = view.card.today.map((k) => ({
    classType: k.classType,
    format: k.format,
    mode: k.mode,
    price: k.price ?? null,
  }));

  return {
    birds,
    brief: {
      day: view.day,
      weather: view.weather,
      farm: {
        name: view.farm.name,
        gp: Math.round(view.farm.gp),
        landTokens: Math.floor(view.farm.landTokensCents / 100),
        stakedTokens: Math.floor(view.farm.stakedLandCents / 100),
        freePulls: view.farm.freePulls,
        checkedInToday: view.farm.checkedInToday,
        barn: `${view.farm.barn.count}/${view.farm.barn.capacity}`,
      },
      cardTonight: card,
      // The day-56 instrument fix: without this line the crown verb went
      // unused for 560 straight calls, coach orders notwithstanding.
      majorsThisWeek: view.crowns.weekFormats,
      // Exp5's instrument fix — the same bug a second time. Four experiments
      // ended 640-0 in scripted juvenile-crown entries because this line was
      // missing: the discovery stage existed and the mail never said so.
      juvenileCrownsThisWeek: view.crowns.juvenileFormats,
      // Exp4's other lesson made visible: fees and purses side by side, so
      // "is fighting paying?" is a fact the model can read, not a vibe.
      weekLedger: view.ledger,
      fighters,
      moreFighters: Math.max(0, active.length - fighters.length),
      hens,
      studs,
      studMarket,
      claimable,
    },
  };
}

// ── THE ASK ────────────────────────────────────────────────────────────────

/**
 * Deliberately short. Every sentence here is a rule the model has to hold
 * while reading a page of JSON, and a small model spends its attention on
 * the last thing it read — so the rules are few, concrete, and the ones that
 * matter most sit closest to the data.
 *
 * Notice what is NOT here: no strategy, no "play to win", no personality.
 * Those belong to the barn's own state once it has one (bot-brain's
 * `strategy` and `goals`), and mixing them into the house instructions would
 * make every barn play the same way — which would waste the entire exercise.
 */
const SYSTEM = `You manage a stable in a cockfighting management game.
Each game-day you choose actions. Reply with JSON only.

RULES
- Use only bird ids shown to you (they look like "#3"). Never invent one.
- Bird ids start with #. Blade formats are b1-b5. They are NOT the same thing.
- Only enter a bird in a class+format listed in cardTonight.
- A bird enters at most ONE lobby per day.
- Entering costs a fee. Never spend below 400 GP in reserve.
- Breeding needs a retired hen (hens list) and a stud — YOURS (studs list)
  or anyone's from studMarket (a stud fee applies). Eggs need barn space.
- crown declares a bird for this week's Major championship (fights Thursday).
  Only birds marked crownEligible, only formats listed in majorsThisWeek.
- Majors are HARDCORE: the loser's career ends on the spot. Declare only a
  bird whose loss you can absorb, and breed replacements ahead of it.
- crown with "division":"juvenile" declares an age-1 bird for Wednesday's
  juvenile crowns. Only birds marked juvenileCrownEligible, only formats in
  juvenileCrownsThisWeek. NOT hardcore — a juvenile loser fights on.
- ALWAYS declare a crown at the bird's bestBlade when that format is offered.
  A crown at the wrong blade is a donation to the barn that bred for it.
- Fighters marked "juvenile":true are age-1 birds in their discovery year.
  They may ONLY fight with "mode":"juvenile" — a juvenile entered without
  it is refused silently and wastes its day. Fight every one, every day.
- weekLedger is your last 7 days: cardNetGp (daily-card stakes won minus
  lost), crownFeesGp, crownWinningsGp. A negative cardNetGp means cut your
  clearly-losing matchups — never your card as a whole; an idle bird earns
  nothing and every fight mints land.
- Illegal actions are refused silently, so do not guess.

A GOOD DAY
- check_in first, always.
- FIRST PRIORITY AFTER CHECK-IN: every fighter marked "juvenile":true
  enters tonight's card with "mode":"juvenile" at its bestBlade. Juvenile
  entry fees are deliberately cheap and the discovery year is ONE week —
  a chick that sits idle discovers nothing and forfeits its crown shot.
- SECOND PRIORITY: breed EVERY day a hen in hens and any stud — yours or
  studMarket's — are both free. A barn that skips a breeding day is
  choosing to be outnumbered next month.
- roll_gacha while freePulls > 0.
- crown a crownEligible bird at its bestBlade when majorsThisWeek offers it —
  Majors pay the biggest purses in the game (and retire their losers).
- crown every juvenileCrownEligible bird at its bestBlade — the juvenile
  crowns are the discovery year's main event: purse, land, AND the verdict
  on whether a chick is a b1/b2 bird or a b4/b5 bird, at no career risk.
- Enter EVERY healthy fighter at its bestBlade when the card offers it —
  juveniles with "mode":"juvenile", everyone else real. Rest a bird only
  with a reason.
- After ~5 fights a bird's record IS the verdict: keep campaigning winners,
  drop chronic losers to cheap claimers or retire them (the retire verb,
  age 3+) — a retired hen breeds, a retired rooster stands at stud.
  Never declare a proven loser for a hardcore Major.
- An age-8 veteran retires at 9 no matter what: campaign it EVERY night and
  give a winner its Major shot at bestBlade — the hardcore risk is free.
- When the barn shows full (like "100/100"), expand_barn — it costs land
  tokens and a full barn blocks every egg your pipeline needs.
- list_stud any retired rooster not yet listed.
- Claim a bird only if its record and stars beat its tag.`;

/**
 * The JSON schema Ollama constrains generation to.
 *
 * PER-VERB BRANCHES, not one flat shape (round 51). The flat schema could
 * not say "`bird` is required when `do` is `enter`", and the cost was
 * measured before it was fixed: in the 14-day run, all 22 dropped actions —
 * 100% of the quality loss — were birdless `enter`s the flat schema had
 * happily permitted. An `anyOf` per verb makes each verb's required fields
 * REQUIRED, so that entire failure class becomes unrepresentable at
 * generation time instead of dropped at translation time.
 */
const verb = (
  verbs: string[],
  required: Record<string, unknown>,
  optional: Record<string, unknown> = {}
) => ({
  type: "object",
  properties: { do: { type: "string", enum: verbs }, ...required, ...optional },
  required: ["do", ...Object.keys(required)],
});

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    actions: {
      type: "array",
      items: {
        anyOf: [
          verb(["check_in", "roll_gacha", "buy_bundle", "expand_barn"], {}),
          verb(["buy_land", "stake", "unstake"], { tokens: { type: "number" } }),
          verb(["list_stud", "retire"], { bird: { type: "string" } }),
          verb(["breed"], { mother: { type: "string" }, father: { type: "string" } }),
          verb(
            ["enter"],
            {
              bird: { type: "string" },
              classType: { type: "string", enum: ["maiden", "nw3", "open", "claimer"] },
              format: { type: "string", enum: Object.keys(FORMATS) },
            },
            // "juvenile" joined this enum in round 59, closing instrument gap
            // #5 — exp6's mode law ordered chicks entered with mode:"juvenile"
            // while THIS enum made the word unrepresentable at generation
            // time: 125 juvenile proposals in exp6's brain_log, zero of them
            // able to carry the one field that would have made them legal.
            // A schema is part of the instrument too.
            {
              mode: { type: "string", enum: ["juvenile", "real", "hardcore"] },
              price: { type: "number" },
            }
          ),
          verb(["claim"], { entryId: { type: "number" } }),
          verb(
            ["crown"],
            {
              bird: { type: "string" },
              format: { type: "string", enum: Object.keys(FORMATS) },
            },
            { division: { type: "string", enum: ["major", "juvenile"] } }
          ),
        ],
      },
    },
  },
  required: ["actions"],
} as const;

/**
 * What the model is allowed to have said.
 *
 * Loose on purpose — every field optional, unknown keys tolerated — because
 * this layer's job is only to establish that a reply is JSON of roughly the
 * right shape. Deciding whether an action makes SENSE is the next function's
 * job, and deciding whether it is LEGAL is the engine's. Rejecting the whole
 * reply here because one action of twelve lacked a `format` would throw away
 * eleven good decisions.
 */
const ReplySchema = z.object({
  actions: z
    .array(
      z
        .object({
          do: z.string(),
          bird: z.string().optional(),
          mother: z.string().optional(),
          father: z.string().optional(),
          classType: z.string().optional(),
          format: z.string().optional(),
          mode: z.string().optional(),
          division: z.string().optional(),
          price: z.number().optional(),
          tokens: z.number().optional(),
          entryId: z.number().optional(),
        })
        .loose()
    )
    .default([]),
});

type RawAction = z.infer<typeof ReplySchema>["actions"][number];

/**
 * Map a validated reply back into engine actions, dropping anything that
 * cannot be honestly translated.
 *
 * ⚠ DROP, DO NOT REPAIR. A `breed` missing its mother could be "fixed" by
 * picking a hen — and then the measurement is of this function's taste, not
 * the model's. An action that does not survive translation is a data point,
 * so it is counted and reported rather than quietly patched.
 */
export function toActions(
  raw: RawAction[],
  birds: Map<string, string>
): { actions: BotAction[]; dropped: number; reasons: string[] } {
  const actions: BotAction[] = [];
  const reasons: string[] = [];
  // WHY a translation failed, not just that it did. Counting drops tells you
  // the model is struggling; naming them tells you whether the fix is a
  // clearer prompt, a richer brief, or a bigger model — which is the entire
  // question phase 1 exists to answer.
  const drop = (reason: string) => reasons.push(reason);
  const real = (handle?: string): string | null =>
    handle && birds.has(handle) ? birds.get(handle)! : null;

  for (const a of raw) {
    switch (a.do) {
      case "check_in":
      case "roll_gacha":
      case "buy_bundle":
      case "expand_barn":
        actions.push({ do: a.do });
        break;
      case "buy_land":
      case "stake":
      case "unstake":
        if (typeof a.tokens === "number" && a.tokens > 0)
          actions.push({ do: a.do, tokens: Math.floor(a.tokens) });
        else drop(`${a.do}: no tokens`);
        break;
      case "list_stud": {
        const id = real(a.bird);
        if (id) actions.push({ do: "list_stud", birdId: id });
        else drop(`list_stud: unknown bird ${a.bird ?? "(none)"}`);
        break;
      }
      case "retire": {
        const id = real(a.bird);
        if (id) actions.push({ do: "retire", birdId: id });
        else drop(`retire: unknown bird ${a.bird ?? "(none)"}`);
        break;
      }
      case "breed": {
        const mother = real(a.mother);
        const father = real(a.father);
        if (mother && father) actions.push({ do: "breed", motherId: mother, fatherId: father });
        else drop(`breed: unknown ${!mother ? `mother ${a.mother ?? "(none)"}` : `father ${a.father ?? "(none)"}`}`);
        break;
      }
      case "enter": {
        const id = real(a.bird);
        if (id && a.classType && a.format) {
          actions.push({
            do: "enter",
            birdId: id,
            mode: (a.mode ?? "real") as BotAction extends { do: "enter"; mode: infer M } ? M : never,
            classType: a.classType as never,
            format: a.format as never,
            ...(typeof a.price === "number" ? { price: a.price } : {}),
          });
        } else
          drop(
            !id
              ? `enter: unknown bird ${a.bird ?? "(none)"}`
              : `enter: missing ${!a.classType ? "classType" : "format"}`
          );
        break;
      }
      case "crown": {
        const id = real(a.bird);
        if (id && a.format)
          actions.push({
            do: "crown",
            birdId: id,
            format: a.format as never,
            // "major" and "juvenile" pass through; anything else falls back to
            // the default the engine has always applied to a bare crown.
            ...(a.division === "juvenile" || a.division === "major"
              ? { division: a.division }
              : {}),
          });
        else drop(!id ? `crown: unknown bird ${a.bird ?? "(none)"}` : "crown: missing format");
        break;
      }
      case "claim":
        if (typeof a.entryId === "number") actions.push({ do: "claim", entryId: a.entryId });
        else drop("claim: no entryId");
        break;
      default:
        drop(`unknown verb "${a.do}"`);
    }
  }
  return { actions, dropped: reasons.length, reasons };
}

// ── THE DECIDER ────────────────────────────────────────────────────────────

/** Counters worth reading after a run — the phase-1 measurement. */
export interface DeciderStats {
  calls: number;
  failures: number;
  droppedActions: number;
  proposedActions: number;
  totalMs: number;
}

/**
 * One barn-day's paper trail (round 50) — what was sent, what came back,
 * what fell at translation. The sim writes these to the `brain_log` table so
 * a long run can be studied afterward instead of scraped from scrollback.
 */
export interface BrainCallLog {
  farmId: string;
  day: number;
  model: string;
  briefTokens: number;
  proposed: BotAction[];
  dropped: string[];
  ms: number;
}

export function ollamaDecider(opts: OllamaOptions): BotDecider & { stats: DeciderStats } {
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const stats: DeciderStats = {
    calls: 0,
    failures: 0,
    droppedActions: 0,
    proposedActions: 0,
    totalMs: 0,
  };

  const decide = async (view: BotView): Promise<BotAction[]> => {
    const { brief, birds } = digest(view);
    const briefJson = JSON.stringify(brief);
    const started = Date.now();
    stats.calls++;

    // AbortController, not a Promise.race — a race leaves the request running
    // and the model still occupying the GPU behind a result nobody will read,
    // which on a single local machine slows down every barn that comes after.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.signal,
        body: JSON.stringify({
          model: opts.model,
          stream: false,
          format: RESPONSE_SCHEMA,
          // think:false — qwen3 reasons aloud by default, which triples the
          // latency and buys nothing here: the decision is a lookup against a
          // brief, not a puzzle. Harmless on models without a thinking mode.
          think: false,
          // num_predict CAPS THE REPLY. Without it one call ran for nearly
          // nine minutes: a day's decisions are at most a few hundred tokens,
          // and a generation longer than that is a model looping, not a model
          // thinking harder. Bounding it turns the worst case from "the run
          // stalls" into "this barn proposes a bit less".
          //
          // 700 → 1400 for exp3: with the fighter window at 24, a full-card
          // day is legitimately ~25 actions, and 700 sized the reply to ~10 —
          // the cap was quietly the volume ceiling the coach kept ordering
          // the barns through. Still a loop-stopper, just no longer a lid.
          options: { temperature: 0.7, num_predict: 1400 },
          messages: [
            {
              role: "system",
              // Standing orders come LAST — a small model weights the most
              // recent instruction heaviest, and the owner's word should
              // outrank the house defaults when they disagree.
              content: opts.strategy
                ? `${SYSTEM}\n\nOWNER'S STANDING ORDERS (these outrank A GOOD DAY)\n${opts.strategy}`
                : SYSTEM,
            },
            { role: "user", content: briefJson },
          ],
        }),
      });
      if (!res.ok) throw new Error(`ollama ${res.status}: ${await res.text()}`);
      const body = (await res.json()) as { message?: { content?: string } };
      const content = body.message?.content ?? "";
      const parsed = ReplySchema.parse(JSON.parse(content));
      const { actions, dropped, reasons } = toActions(parsed.actions, birds);

      stats.droppedActions += dropped;
      stats.proposedActions += actions.length;
      stats.totalMs += Date.now() - started;
      opts.sink?.({
        farmId: view.farm.id,
        day: view.day,
        model: opts.model,
        briefTokens: Math.round(briefJson.length / 3.5),
        proposed: actions,
        dropped: reasons,
        ms: Date.now() - started,
      });
      if (opts.verbose)
        console.log(
          `  [brain] ${view.farm.name}: ${actions.length} actions` +
            (dropped ? `, ${dropped} dropped` : "") +
            ` (${((Date.now() - started) / 1000).toFixed(1)}s)`
        );
      // Every distinct drop reason, with a count — the one line that turns a
      // bad run into a diagnosis.
      if (opts.verbose && reasons.length > 0) {
        const tally = new Map<string, number>();
        for (const r of reasons) tally.set(r, (tally.get(r) ?? 0) + 1);
        for (const [reason, n] of [...tally].sort((a, b) => b[1] - a[1]))
          console.log(`          ✗ ${n}× ${reason}`);
      }
      return actions;
    } catch (err) {
      stats.failures++;
      stats.totalMs += Date.now() - started;
      // Rethrow: collectProposals turns this into "this barn sits the day
      // out", which is the honest outcome. Returning [] here would look
      // identical to a model that thoughtfully chose to do nothing.
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  return Object.assign(decide, { stats });
}
