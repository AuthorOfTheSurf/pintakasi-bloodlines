import type { EventType } from "./events";
import type { NoteKind } from "./farm-notes";

/**
 * THE FARM LOG'S VOICE (2026-10): the sentence a player reads for each line,
 * worked out when the line is READ, not when it was written.
 *
 * The ledger's stored messages are terse on purpose. They were written for
 * stewards and for the admin view ("entered X — JUVENILE·CLAIMER @ 270 GP tag
 * · B1 (lobby #782, 72 GP escrowed)"), and they are the input to the
 * conservation proof and to worldhash. So the engine keeps writing them as
 * they are, and this table turns each row into the Handbook's voice at read
 * time. That has two payoffs: alpha-1's old rows read in the new voice too,
 * and the 92-day world stays identical to the cent.
 *
 * WHERE A SENTENCE GETS ITS FACTS, in order of trust:
 *   1. the row's own columns (the signed GP and LT deltas),
 *   2. its `data` JSON, where the emit site wrote one,
 *   3. the bird's CURRENT name (the name a player knows it by now),
 *   4. a named piece read out of the stored message, for facts the emit site
 *      only ever put there (a card's class, a crown's week, a W–L record).
 * Every speaker returns null when a fact it needs is missing or does not
 * parse, and the reader then shows the stored message as it always did. So a
 * template change in the engine degrades a line to the old voice, never to a
 * wrong sentence.
 *
 * THE FOG. A sentence may only say what the stored message already said, plus
 * a bird's public name and, on another farm's move, that farm's public name.
 * `data` holds things the message never showed (a breed's fee split, a roll's
 * pull bookkeeping), so each field read here was checked against what the
 * owner may see. Nothing here reads a stat.
 *
 * THE SUBJECT. A line's chip says who made the move, so a sentence names the
 * move and not the mover ("Entered Kidlat…", not "You entered Kidlat…"). The
 * same move can be the player's, Play my day's or a house barn's, and the
 * sentence must be true for all three.
 */

/** What a speaker can know about one line. Money is in GP and LT, not cents. */
export interface LineFacts {
  /** The stored sentence, exactly as the engine wrote it. */
  message: string;
  gp: number | null;
  lt: number | null;
  /** The line's bird by its current name, or null for a line with no bird. */
  bird: string | null;
  /** The other farm that made this move, only on an "another farm" line. */
  byFarm: string | null;
  /** The row's parsed `data` JSON; unknown until a speaker checks a field. */
  data: unknown;
}

type Speaker = (f: LineFacts) => string | null;

/**
 * "stored" is a decision, not a gap: the line keeps the engine's sentence.
 * Used for the types no farm log ever shows (a world event has no farm, a pool
 * accrual is hidden) and for a run's summary, which is already written in
 * this voice when the run ends.
 */
type Voice = Speaker | "stored";

/** GP with en-US separators: whole amounts stay whole, fractions show cents. */
export function gpWords(n: number): string {
  const whole = Number.isInteger(n);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** LT the same way. Land mints in hundredths, so 0.35 LT is a real amount. */
const ltWords = gpWords;

/** An amount read out of a stored message ("36063.00"), in the same format. */
const amount = (raw: string) => gpWords(Number(raw.replace(/,/g, "")));

/** "Bukidnon Farms'" and "Kidlat's": a name that ends in s takes the bare apostrophe. */
const whose = (name: string) => (name.endsWith("s") ? `${name}'` : `${name}'s`);

const plural = (n: number, word: string) => `${gpWords(n)} ${word}${n === 1 ? "" : "s"}`;

/** The named groups of `re` in the stored message, or null if it does not match. */
function read(message: string, re: RegExp): Record<string, string> | null {
  return re.exec(message)?.groups ?? null;
}

function field(data: unknown, key: string): unknown {
  return typeof data === "object" && data !== null && key in data
    ? (data as Record<string, unknown>)[key]
    : undefined;
}
const numberField = (data: unknown, key: string) => {
  const v = field(data, key);
  return typeof v === "number" ? v : null;
};
const stringField = (data: unknown, key: string) => {
  const v = field(data, key);
  return typeof v === "string" ? v : null;
};

/**
 * A card's ledger label ("JUVENILE·CLAIMER @ 270 GP tag · B1") as words: the
 * kind of fights, the format, and the claim tag if it has one. The label is
 * built by labelOf in lobbies.ts; this reads its three parts back.
 */
function cardWords(label: string): { kind: string; format: string; tag: string | null } | null {
  const parts = read(
    label,
    /^(?<classes>[A-Z0-9·]+)(?: @ (?<tag>[\d.,]+) GP tag)? · (?<format>\S+)$/
  );
  if (!parts) return null;
  const kind = parts.classes
    .split("·")
    .map((c) => (c === "NW3" ? "NW3" : c.toLowerCase()))
    .join(" ");
  return { kind, format: parts.format, tag: parts.tag ?? null };
}

/** The record a retire line carries as "(5–3)". */
const RECORD = /\((?<w>\d+)–(?<l>\d+)\)/;

/** Why a crown entry was withdrawn, as the reason reads after "because". */
const WITHDRAWN_WHY: Record<string, string> = {
  "no longer stands": "it can no longer fight",
  "the field was too small": "too few birds signed up",
};

/** Why a standing claim was called off (Lobbies.refundClaims), after "because". */
const CALLED_OFF_WHY: Record<string, string> = {
  "the bird drew no opponent": "the bird had nobody to fight",
};

const backHome = (gp: number | null) =>
  gp !== null && gp > 0 ? ` The ${gpWords(gp)} GP came back to you.` : "";

export const EVENT_SENTENCES: Record<EventType, Voice> = {
  farm_registered: ({ gp }) => (gp === null ? null : `Your farm opened with ${gpWords(gp)} GP.`),

  check_in: ({ gp, message }) => {
    if (gp === null) return null;
    const pulls = read(message, /\+(?<n>\d+) free pulls?/);
    const extra = pulls ? ` and ${plural(Number(pulls.n), "free pull")}` : "";
    return `Checked in for the day. Got ${gpWords(gp)} GP${extra}.`;
  },

  gacha: ({ gp, lt, bird, data, message }) => {
    const land = lt === null ? "" : ` Got ${ltWords(lt)} LT.`;
    if (field(data, "bundle") === true) {
      const rolls = numberField(data, "rolls");
      const eggs = numberField(data, "eggs");
      if (rolls === null || eggs === null || gp === null) return null;
      const eggLine =
        eggs > 0 ? ` ${plural(eggs, "mystery egg")} dropped!` : " No eggs dropped this time.";
      return `Bought the ${rolls}-roll bundle for ${gpWords(-gp)} GP. One roll was free.${land}${eggLine}`;
    }
    const token = stringField(data, "token");
    if (token === null || gp === null) return null;
    // A bundle's own rolls are silent and reach the ledger only when one
    // drops an egg (gacha.ts, round 37): price 0 and no free pull.
    let paid = "as part of the bundle";
    if (field(data, "free") === true) paid = "with a free pull";
    else if (gp < 0) paid = `for ${gpWords(-gp)} GP`;
    // data.egg is the name the egg dropped with; the row's bird is the same
    // egg by the name it carries now, like every other line.
    const dropped = stringField(data, "egg");
    const egg = dropped === null ? null : (bird ?? dropped);
    let eggLine = "";
    if (egg) eggLine = ` A mystery egg dropped. It is called ${egg}.`;
    else if (message.includes("egg forfeit"))
      eggLine = " An egg dropped, but the barn was full, so it was lost.";
    return `Rolled the gacha ${paid} and got a ${token} token.${land}${eggLine}`;
  },

  hatch: ({ bird, message }) => {
    const p = read(message, /— a (?<sex>rooster|hen), (?<stars>[\d.]+)★ (?<element>\w+)$/);
    if (!bird || !p) return null;
    return `${bird} hatched. It is a ${p.sex}, ${p.stars}★ ${p.element}.`;
  },

  retire: ({ bird, data, message }) => {
    const rec = read(message, RECORD);
    if (!bird || !rec) return null;
    const record = ` Its record was ${rec.w}–${rec.l}.`;
    // Retirement is the reveal (round 28): the sheet goes public, and the
    // stored line already printed the grade.
    const grade = read(message, /public: (?<g>\S+) overall/);
    const sheet = grade ? ` Its stats are public now. Overall grade: ${grade.g}.` : "";
    const by = field(data, "by");
    if (by === "manual") return `Retired ${bird} to the barn.${record}${sheet}`;
    if (by === "age") return `${bird} got too old to fight, so it retired.${record}${sheet}`;
    if (by === "hardcore") {
      const lost = read(message, /fell in the (?<crown>.+?) — force-retired/);
      if (!lost) return null;
      return `${bird} lost in the ${lost.crown}. That crown is hardcore, so its career is over.${record}`;
    }
    return null;
  },

  breed: ({ bird, gp, message }) => {
    const p = read(
      message,
      /^bought a cover: (?<mother>.+?) × (?<father>.+?) \((?:own stud|(?<stud>.+)'s stud), [\d.,]+ GP\) →/
    );
    if (!bird || !p || gp === null) return null;
    const rooster = p.stud
      ? `${whose(p.stud)} rooster ${p.father}`
      : `your own rooster ${p.father}`;
    return `Bred ${p.mother} to ${rooster} for ${gpWords(-gp)} GP. The new egg is ${bird}.`;
  },

  stud_income: ({ bird, gp, byFarm, message }) => {
    const p = read(message, /^.+? covered (?<mother>.+?) — stud share/);
    if (!bird || !p || gp === null) return null;
    if (byFarm)
      return `${byFarm} bred their hen ${p.mother} to your rooster ${bird}. You earned ${gpWords(gp)} GP.`;
    return `${bird} covered ${p.mother}. You earned ${gpWords(gp)} GP as the stud's owner.`;
  },

  stud_listed: ({ bird, lt, message }) => {
    const p = read(message, /— (?<price>[\d.,]+) GP a cover/);
    if (!bird || !p) return null;
    const seat = lt === null ? "" : ` The stud seat cost ${ltWords(-lt)} LT.`;
    return `Put ${bird} up at stud for ${amount(p.price)} GP a cover.${seat}`;
  },

  stud_unlisted: ({ bird }) => (bird ? `Took ${bird} off stud.` : null),

  entry: ({ bird, gp, message }) => {
    const p = read(message, /^entered .+? — (?<label>.+) \(lobby #\d+/);
    const card = p && cardWords(p.label);
    if (!bird || !card || gp === null) return null;
    const tag = card.tag ? ` Another farm can claim it for ${amount(card.tag)} GP.` : "";
    return (
      `Entered ${bird} in tonight's ${card.kind} fights (${card.format}).${tag} ` +
      `${gpWords(-gp)} GP is held until the fights are done.`
    );
  },

  refund: ({ bird, gp, message }) => {
    if (!bird) return null;
    if (message.includes("drew nobody"))
      return `${bird} had nobody to fight tonight.${backHome(gp)}`;
    const p = read(message, /Pintakasi entry withdrawn — (?<why>.+?)(?: \([\d.,]+ GP home\))?$/);
    if (!p) return null;
    // An unknown reason keeps the stored line: the engine's wording reads
    // badly after "because", and guessing would be worse.
    const why = WITHDRAWN_WHY[p.why];
    if (!why) return null;
    return `${bird} left the Pintakasi because ${why}.${backHome(gp)}`;
  },

  card_settled: ({ bird, gp, lt, message }) => {
    const p = read(message, /— (?<fought>\d+) of (?<of>\d+) fights/);
    if (!bird || !p) return null;
    const land = lt !== null && lt > 0 ? ` It earned ${ltWords(lt)} LT.` : "";
    const unfought =
      gp !== null && gp > 0 ? ` ${gpWords(gp)} GP came back for the fights it did not get.` : "";
    return `${bird} fought ${p.fought} of ${p.of} fights tonight.${land}${unfought}`;
  },

  // The claimant's line only. It sits under the claimant's farm, so the
  // seller's log never sees it (farm-log.ts selects by farm, not by bird).
  claim: ({ bird, gp }) => {
    if (!bird || gp === null) return null;
    return (
      `Put in a sealed claim of ${gpWords(-gp)} GP on ${bird}. ` +
      "Sealed means no other farm can see it. The GP is held until the fights."
    );
  },

  claim_won: ({ bird, message }) => {
    const p = read(
      message,
      /from (?<owner>.+) for the (?<price>[\d.,]+) GP tag(?: \(won the draw over (?<over>\d+)\))?$/
    );
    if (!bird || !p) return null;
    const draw = p.over
      ? ` More than one farm claimed it, and yours won the draw over ${plural(Number(p.over), "other")}.`
      : "";
    return `${bird} is yours now. You claimed it from ${p.owner} for its ${amount(p.price)} GP tag.${draw}`;
  },

  claim_refund: ({ bird, gp, message }) => {
    if (!bird) return null;
    if (message.startsWith("lost the claim draw"))
      return `Another farm won the draw for ${bird}, so your claim lost.${backHome(gp)}`;
    const p = read(message, /called off — (?<why>.+), [\d.,]+ GP refunded$/);
    const why = p && CALLED_OFF_WHY[p.why];
    if (!why) return null;
    return `Your claim on ${bird} was called off because ${why}.${backHome(gp)}`;
  },

  tag_income: ({ bird, gp, message }) => {
    const p = read(message, /claimed away by (?<to>.+?) — banked/);
    if (!bird || !p || gp === null) return null;
    return `${p.to} claimed ${bird} for its tag, so ${bird} is theirs now. You got ${gpWords(gp)} GP.`;
  },

  staking_payout: ({ gp, message }) => {
    const p = read(message, /on (?<staked>[\d.,]+) staked LT/);
    if (gp === null || !p) return null;
    return `Your ${amount(p.staked)} staked LT paid you ${gpWords(gp)} GP today.`;
  },

  stake: ({ message }) => {
    const p = read(
      message,
      /^staked (?<n>[\d.,]+) LT \(now (?<staked>[\d.,]+) staked \/ (?<free>[\d.,]+) liquid\)$/
    );
    if (!p) return null;
    return `Staked ${amount(p.n)} LT. Now ${amount(p.staked)} LT is staked and ${amount(p.free)} LT is free to spend.`;
  },

  unstake: ({ message }) => {
    const p = read(
      message,
      /^unstaked (?<n>[\d.,]+) LT \(now (?<staked>[\d.,]+) staked \/ (?<free>[\d.,]+) liquid\)$/
    );
    if (!p) return null;
    return `Unstaked ${amount(p.n)} LT. Now ${amount(p.staked)} LT is staked and ${amount(p.free)} LT is free to spend.`;
  },

  buy_land: ({ gp, lt }) =>
    gp === null || lt === null ? null : `Bought ${ltWords(lt)} LT of land for ${gpWords(-gp)} GP.`,

  barn_expanded: ({ lt, message }) => {
    const p = read(message, /^barn expanded to (?<slots>\d+) slots/);
    if (!p || lt === null) return null;
    return `Made the barn bigger. It now holds ${p.slots} birds. It cost ${ltWords(-lt)} LT.`;
  },

  tournament_entry: ({ bird, gp, message }) => {
    const p = read(message, /for the (?<crown>.+?) \(week (?<week>\d+), /);
    if (!bird || !p) return null;
    const fee =
      gp !== null && gp < 0
        ? ` The ${gpWords(-gp)} GP entry fee is held until the crown.`
        : " It was free to enter.";
    // The stored line ends with the crown's risk: "hardcore: lose and the
    // career ends", or "not hardcore — …".
    const risk = message.includes("— hardcore")
      ? ` This crown is hardcore. If ${bird} loses, its career ends.`
      : ` If ${bird} loses, it leaves the crown but keeps fighting.`;
    return `Signed ${bird} up for the ${p.crown} in week ${p.week}.${fee}${risk}`;
  },

  tournament_bump: ({ bird, gp, byFarm, message }) => {
    const p = read(message, /bumped from the (?<crown>.+) by (?<by>.+) — [\d.,]+ GP refunded$/);
    if (!bird || !p) return null;
    const taker = byFarm ? `${whose(byFarm)} ${p.by}` : p.by;
    return (
      `${taker} took ${whose(bird)} seat in the ${p.crown}. ` +
      `When a crown is full, a stronger bird can push out the weakest one.${backHome(gp)}`
    );
  },

  purse_payout: ({ bird, gp, lt, message }) => {
    if (!bird) return null;
    if (lt !== null) {
      const p = read(message, /— (?<crown>.+) land pot: .+\((?<n>\d+) fights?\)$/);
      if (!p) return null;
      return `${bird} earned ${ltWords(lt)} LT from the ${p.crown} land pot for ${plural(Number(p.n), "fight")}.`;
    }
    const p = read(message, /— (?<crown>.+) purse \((?<stage>.+)\): /);
    if (!p || gp === null) return null;
    const share = ` Its share of the purse was ${gpWords(gp)} GP.`;
    if (p.stage === "champion") return `${bird} won the ${p.crown}!${share}`;
    if (p.stage === "runner-up") return `${bird} came second in the ${p.crown}.${share}`;
    return `${bird} went out in the ${p.stage} of the ${p.crown}.${share}`;
  },

  // A world event: no farm_id, so no farm log ever selects it. A world reader
  // later would want its own voice, not this owner's one.
  fight: "stored",
  champion: "stored",
  // Hidden from every farm log (EVENT_VISIBILITY).
  pool_accrual: "stored",
  // Retired in round 42 and only in old sims, whose message is the record.
  crown_land: "stored",
};

export const NOTE_SENTENCES: Record<NoteKind, Voice> = {
  named: ({ data }) => {
    const from = stringField(data, "from");
    const to = stringField(data, "to");
    if (!from || !to) return null;
    return `Gave ${from} a new name, ${to}.`;
  },

  stud_price: ({ bird, data }) => {
    const to = numberField(data, "to");
    if (!bird || to === null) return null;
    const from = numberField(data, "from");
    const head =
      from === null
        ? `Set ${whose(bird)} first stud price. A cover costs ${gpWords(to)} GP.`
        : `Changed ${whose(bird)} stud price from ${gpWords(from)} GP to ${gpWords(to)} GP a cover.`;
    // A listed stud's price posts at the tick, so a buyer never sees a price
    // move under him mid-day (Breeding.setStudPrice).
    return field(data, "pending") === true ? `${head} The new price starts tomorrow.` : head;
  },

  // A press's summary is built in this voice when it ends (day-summary.ts,
  // the card route), from facts the run had and the row does not keep whole.
  play_my_day: "stored",
  card: "stored",
};

/** A stored ledger line as a sentence: capital first, full stop last. */
function asSentence(message: string): string {
  const trimmed = message.trim();
  const capped = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?)]$/.test(capped) ? capped : `${capped}.`;
}

/**
 * The line in the new voice, or null where it keeps its stored message: a
 * "stored" kind, a kind an older build wrote, or a fact that did not parse.
 * `kind` is an event type for a ledger row and a note kind for a note.
 */
export function voiced(source: "event" | "note", kind: string, facts: LineFacts): string | null {
  const table: Record<string, Voice> = source === "event" ? EVENT_SENTENCES : NOTE_SENTENCES;
  const voice = Object.hasOwn(table, kind) ? table[kind] : "stored";
  return voice === "stored" ? null : voice(facts);
}

/** The sentence a reader shows for one line. */
export function speak(source: "event" | "note", kind: string, facts: LineFacts): string {
  const said = voiced(source, kind, facts);
  if (said !== null) return said;
  // A note is already a sentence; a ledger message needs its capital and stop.
  return source === "event" ? asSentence(facts.message) : facts.message;
}
