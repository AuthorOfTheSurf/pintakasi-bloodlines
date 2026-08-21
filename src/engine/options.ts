/**
 * ── THE OPTIONS BRIEF (round 63 — see runs/options-brief-spec.md) ──────────
 *
 * Eight experiments produced two laws. The PIPE LAW: seven regressions, each
 * a fact the model needed and the mail didn't carry, each fixed by a data
 * field and never once by prompt tuning. The FIRST-LINK LAW: the model never
 * originates a chain-starting action (retire) from standing prose — three
 * demonstrations — it only acts when a coach names the first link as a dated
 * imperative. Both are symptoms of one design: the legacy brief asks a small
 * model to SYNTHESIZE (join cardTonight × fighters × ~20 prose rules) when
 * small models are only reliable at SELECTION.
 *
 * This module pre-computes the join. Every fighter arrives with its legal,
 * pre-valued options attached; the barn arrives with its own option list;
 * the model's reply collapses to picks. The rules the legacy SYSTEM prompt
 * carried as prose become properties of WHICH ROWS APPEAR:
 *
 *   - eligibility, mode law, blade law → a row exists or it doesn't
 *   - affordability (the 400 GP reserve)  → priced-out rows never render
 *   - "rest is a choice"                  → an explicit value-0 row, always
 *     last, so doing nothing is read past, never defaulted into
 *
 * ⚠ THE SCORE IS AN OPINION, NOT AN ORDER. A 0–9 integer with ties and a
 * one-line `why` — deliberately coarse. Too good a score and ten personas
 * collapse into one argmax follower, which wastes the entire experiment.
 * `hardcore` rides BESIDE the value, never inside it: risk appetite belongs
 * to the persona.
 *
 * ⚠ PURE FUNCTION OF THE VIEW. No db handle, no RNG, no clock — the same
 * BotView must always produce the same plan (tested), because the EV-capture
 * metric ("did the barn take the top row?") is only meaningful if the rows
 * themselves are reproducible. Everything here is read off BotView, which
 * bot-brain.ts builds from the same public engine methods a player uses.
 */
import {
  BARN,
  COVERS,
  ECONOMY,
  JUVENILE_MAJOR,
  LT_CENTS,
  PINTAKASI,
  feeFor,
  type FightFormat,
} from "./config";
import { canHardcore } from "./lifecycle";
import { entryRefusal } from "./lobbies";
import type { BotAction, BotView } from "./bot-brain";

/** Spec decisions #3/#4 (Zane, 2026-08-16): 4 rows/bird (top 3 + rest), 2–3 breed pairings. */
export const OPTION_ROWS_PER_BIRD = 4;
export const BREED_PAIRINGS_OFFERED = 3;
/** Same floor the legacy SYSTEM prompt taught: never spend below this. */
export const GP_RESERVE = 400;
const CLAIM_ROWS_OFFERED = 4;

/**
 * One row the model can pick. `action` is the exact engine action the pick
 * translates to — engine-side only, stripped before the brief is serialized,
 * so translation is a LOOKUP, never an interpretation. `action: null` is
 * rest: a legal pick that does nothing, on purpose.
 */
export interface OptionRow {
  pick: string;
  do: string;
  fee?: number;
  cost?: string;
  value: number; // 0–9, coarse on purpose
  hardcore?: true;
  why: string;
  action: BotAction | null;
}

export interface BirdOptionCard {
  birdId: string;
  name: string;
  age: number;
  stars: string;
  record: string;
  bestBlade: FightFormat | null;
  options: OptionRow[]; // sorted by value desc, rest always last
}

export interface OptionsPlan {
  /** Ranked like the legacy digest: scout's best-blade score, descending. */
  birds: BirdOptionCard[];
  barn: OptionRow[]; // picks "@1", "@2", …
}

const clamp9 = (n: number): number => Math.max(0, Math.min(9, Math.round(n)));

export function buildOptions(view: BotView): OptionsPlan {
  const gp = view.farm.gp;
  const spendable = gp - GP_RESERVE;

  const active = view.flock.filter((b) => b.status === "active");
  const ranked = [...active].sort((a, b) => {
    const sa = view.scout[a.id]?.blades[view.scout[a.id].bestBlade]?.score ?? 0;
    const sb = view.scout[b.id]?.blades[view.scout[b.id].bestBlade]?.score ?? 0;
    return sb - sa;
  });

  const retired = view.flock.filter((b) => b.status === "retired");
  // One pregnancy per hen (Breeding.breed's refusal): a gestating egg in the
  // flock names its mother, and offering her again is a row the engine will
  // only bounce — the model reads a legal menu, so keep it legal.
  const pregnant = new Set(
    view.flock
      .filter((b) => b.status === "egg" && b.eggStage === "gestating" && b.motherId)
      .map((b) => b.motherId)
  );
  const hens = retired
    .filter((b) => b.sexLabel === "hen" && !pregnant.has(b.id))
    .sort((a, b) => b.halfStars - a.halfStars);
  const ownStuds = retired
    .filter((b) => b.sexLabel === "rooster")
    .sort((a, b) => b.halfStars - a.halfStars);

  const crownable = new Set(view.crowns.eligibleBirdIds);
  const juvenileCrownable = new Set(view.crowns.juvenileEligibleBirdIds);

  // Which offered format suits a bird best: its bestBlade when posted,
  // otherwise the posted format its blade scores like most. The "ALWAYS at
  // bestBlade" prose rule, made structural.
  const bestOffered = (
    birdId: string,
    offered: readonly FightFormat[]
  ): { format: FightFormat; atBest: boolean } | null => {
    if (offered.length === 0) return null;
    const report = view.scout[birdId];
    if (!report) return { format: offered[0], atBest: false };
    if (offered.includes(report.bestBlade)) return { format: report.bestBlade, atBest: true };
    const scoredBest = [...offered].sort(
      (a, b) => (report.blades[b]?.score ?? 0) - (report.blades[a]?.score ?? 0)
    )[0];
    return { format: scoredBest, atBest: false };
  };

  const birds: BirdOptionCard[] = ranked.map((b) => {
    const report = view.scout[b.id];
    const bestBlade = report?.bestBlade ?? null;
    const fights = report?.totalFights ?? 0;
    const candidates: Omit<OptionRow, "pick">[] = [];

    // Juvenile crown — the discovery year's main event (exp5's find).
    if (juvenileCrownable.has(b.id)) {
      const slot = bestOffered(b.id, view.crowns.juvenileFormats);
      if (slot && JUVENILE_MAJOR.ENTRY_FEE <= spendable)
        candidates.push({
          do: `crown juvenile ${slot.format}`,
          fee: JUVENILE_MAJOR.ENTRY_FEE,
          value: slot.atBest ? 9 : 8,
          why: slot.atBest
            ? "discovery main event at its proven blade: purse + land + the verdict, no career risk"
            : `discovery main event — ${slot.format} is the best blade on offer this week`,
          action: { do: "crown", birdId: b.id, format: slot.format, division: "juvenile" },
        });
    }

    // Major crown — hardcore, flagged beside the value, never inside it.
    if (crownable.has(b.id)) {
      const slot = bestOffered(b.id, view.crowns.weekFormats);
      if (slot && PINTAKASI.ENTRY_FEE <= spendable) {
        const freeShot = b.age >= 8; // retires at 9 regardless — the risk is free
        candidates.push({
          do: `crown major ${slot.format}`,
          fee: PINTAKASI.ENTRY_FEE,
          value: freeShot ? 9 : slot.atBest ? 8 : 6,
          hardcore: true,
          why: freeShot
            ? "age-8 veteran: forced retirement at 9 makes the hardcore risk free — biggest purse in the game"
            : slot.atBest
              ? "the game's biggest purse, at its proven blade"
              : `Major offered at ${slot.format}, not its proven blade — a crown off-blade is a donation`,
          action: { do: "crown", birdId: b.id, format: slot.format, division: "major" },
        });
      }
    }

    // Tonight's card — one row per key the engine would actually accept.
    for (const key of view.card.today) {
      if (entryRefusal(b, key) !== null) continue;
      const fee = feeFor(key.mode, key.classType, key.price ?? undefined);
      if (fee > spendable) continue;
      const atBest = key.format === bestBlade;
      const discovery = b.age === 1 ? (fights >= 5 ? 0 : fights >= 3 ? 1 : 2) : 0;
      const softness = key.classType === "maiden" ? 1 : key.classType === "claimer" ? 1 : 0;
      const sharpRead = b.age === 1 && key.classType === "open" ? 1 : 0;
      const value = clamp9(3 + (atBest ? 2 : 0) + discovery + softness + sharpRead);
      const label =
        key.classType === "claimer"
          ? `enter ${key.mode} claimer(${key.price}) ${key.format}`
          : `enter ${key.mode} ${key.classType} ${key.format}`;
      const whyBits = [
        atBest ? "its proven blade" : `off its proven blade (${bestBlade ?? "unknown"})`,
        discovery > 0 ? "cheap discovery" : null,
        key.classType === "maiden" ? "soft field" : null,
        sharpRead ? "the sharpest read in the game if it can win here" : null,
      ].filter(Boolean);
      candidates.push({
        do: label,
        fee,
        value,
        why: whyBits.join(", "),
        action: {
          do: "enter",
          birdId: b.id,
          mode: key.mode,
          classType: key.classType,
          format: key.format,
          ...(key.price == null ? {} : { price: key.price }),
        },
      });
    }

    // Retire — the first-link law's test: chain initiation offered as a row.
    // Never on a roster already at fighting-strength minimum.
    if (canHardcore(b.age) && active.length > 3) {
      const isHen = b.sexLabel === "hen";
      const shedNeed = isHen ? (hens.length === 0 ? 4 : hens.length < 2 ? 2 : 0) : 0;
      const studNeed = !isHen ? (ownStuds.length === 0 ? 2 : 1) : 0;
      const loser = b.losses > b.wins ? 3 : b.losses === b.wins ? 1 : 0;
      const value = clamp9(1 + shedNeed + studNeed + loser);
      if (value >= 3)
        candidates.push({
          do: "retire to the breeding shed",
          value,
          why: isHen
            ? hens.length === 0
              ? "the shed is EMPTY — no hen, no eggs, no next season"
              : `${b.wins}-${b.losses} record; a retired hen breeds weekly`
            : "a retired rooster stands at stud and earns fees",
          action: { do: "retire", birdId: b.id },
        });
    }

    const sorted = candidates.sort((x, y) => y.value - x.value).slice(0, OPTION_ROWS_PER_BIRD - 1);
    const rows: OptionRow[] = [
      ...sorted,
      { do: "rest", value: 0, why: "earns nothing, discovers nothing", action: null },
    ].map((row, i) => ({ ...row, pick: String.fromCharCode(65 + i) })); // A, B, C…

    return {
      birdId: b.id,
      name: b.name,
      age: b.age,
      stars: b.stars,
      record: `${b.wins}-${b.losses}`,
      bestBlade,
      options: rows,
    };
  });

  // ── Barn-level rows ────────────────────────────────────────────────────
  const barn: Omit<OptionRow, "pick">[] = [];
  const barnSpace = view.farm.barn.capacity - view.farm.barn.count;

  // Breed — pre-paired, so "unknown mother #1" is unrepresentable. Own studs
  // first (no cross-farm fee narrative needed), then the market's best.
  if (hens.length > 0 && barnSpace > 0 && ECONOMY.BREED_FEE <= spendable) {
    const sires: { id: string; name: string; label: string; halfStars: number }[] = [
      ...ownStuds.map((s) => ({ id: s.id, name: s.name, label: "your stud", halfStars: s.halfStars })),
      ...view.studMarket.map((s) => ({
        id: s.id,
        name: s.name,
        label: `stud of ${s.farm}`,
        halfStars: s.stars * 2,
      })),
    ].sort((a, b) => b.halfStars - a.halfStars);
    const pairs: [typeof hens[number], (typeof sires)[number]][] = [];
    for (const hen of hens.slice(0, 2))
      for (const sire of sires.slice(0, 2)) {
        if (pairs.length >= BREED_PAIRINGS_OFFERED) break;
        pairs.push([hen, sire]);
      }
    for (const [i, [hen, sire]] of pairs.entries())
      barn.push({
        do: `breed ${hen.name} × ${sire.name} (${sire.label})`,
        fee: ECONOMY.BREED_FEE,
        value: i === 0 ? 8 : 7,
        why:
          i === 0
            ? "the best pairing tonight — chicks fight in weeks, and the pipeline IS the season"
            : "a strong alternative pairing",
        action: { do: "breed", motherId: hen.id, fatherId: sire.id },
      });
  }

  // Expand — only when the wall is actually close.
  if (barnSpace <= 2) {
    const expansions = Math.max(
      0,
      Math.round((view.farm.barn.capacity - BARN.CAPACITY) / BARN.EXPANSION_SLOTS)
    );
    const costCents = (expansions + 1) * BARN.EXPANSION_BASE_LT;
    // No afford-gate here: the wall is worth SEEING even when the land is
    // short — the engine still holds the door, as it does for everyone.
    barn.push({
      do: "expand_barn",
      cost: `${Math.round(costCents / LT_CENTS)} LT`,
      value: barnSpace <= 0 ? 8 : 6,
      why: "a full barn blocks every egg your pipeline needs",
      action: { do: "expand_barn" },
    });
  }

  // Free pulls — free scouting; one pick spends them all (translation expands).
  if (view.farm.freePulls > 0)
    barn.push({
      do: `roll_gacha × ${view.farm.freePulls} (all free pulls)`,
      fee: 0,
      value: 6,
      why: "free scouting — a prospect costs nothing today",
      action: { do: "roll_gacha" },
    });

  // List any unlisted retired rooster (cap 2). The seat costs liquid land
  // (Breeding.listStud refuses without it), so rows render only up to what
  // the land actually covers — same legality rule as the fee-gated rows.
  const listable = Math.min(2, Math.floor(view.farm.landTokensCents / COVERS.STUD_LISTING_LT));
  for (const stud of ownStuds.filter((s) => s.listedStud !== 1).slice(0, listable))
    barn.push({
      do: `list_stud ${stud.name}`,
      cost: `${COVERS.STUD_LISTING_LT / LT_CENTS} LT`,
      value: 5,
      why: "a listed stud earns cover fees for one land payment up front",
      action: { do: "list_stud", birdId: stud.id },
    });

  // Claims — mostly empty until the claim window ships (spec §10, gap #8),
  // but the rows fire whenever the board is visible at collect time.
  const claimCandidates = view.claimerBoard
    .flatMap((lobby) =>
      lobby.entries
        .filter((e) => !e.mine)
        .map((e) => ({ entry: e, tag: lobby.price ?? 0 }))
    )
    .filter(({ tag }) => tag > 0 && tag <= spendable)
    .map(({ entry, tag }) => {
      const { wins, losses } = entry.bird.career;
      const stars = parseFloat(entry.bird.stars) || 0;
      return {
        do: `claim ${entry.bird.name} (${wins}-${losses}, ${entry.bird.stars}) at ${tag} GP`,
        fee: tag,
        value: clamp9(4 + (wins > losses ? 1 : 0) + (stars >= 3 ? 1 : 0)),
        why: wins > losses ? "a proven record priced below it" : "roster depth at the tag price",
        action: { do: "claim" as const, entryId: entry.entryId },
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, CLAIM_ROWS_OFFERED);
  barn.push(...claimCandidates);

  return {
    birds,
    barn: barn.map((row, i) => ({ ...row, pick: `@${i + 1}` })),
  };
}
