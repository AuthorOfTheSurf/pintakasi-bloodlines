import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db/client";
import { lobbies, lobbyEntries } from "@/db/schema";
import { AUTO_PLAY_STYLE, AUTO_RESERVE } from "./auto-play";
import { pickOffering, weatherOrder } from "./bots";
import { cardOfDay, feeFor, type CardKey } from "./config";
import { readFarm, readWorldState } from "./farms";
import { Flock } from "./flock";
import { Lobbies, entryRefusal } from "./lobbies";
import { mulberry32 } from "./rng";
import { sameKey } from "./card-key";

/**
 * ── TONIGHT, BIRD BY BIRD — what each fighting bird may do on today's card ──
 *
 * The farm page's Tonight column, and the shape a future MCP tool reads, so a
 * person clicking and a Claude typing are told the same thing. Pure reads: it
 * enters nothing.
 *
 * Every rule here is borrowed, never restated. The options are the posted keys
 * `entryRefusal` lets through (the predicate `Lobbies.enter` throws on), the
 * day bar is `Lobbies.dayRefusal` (one card a day, brackets, crown day), and
 * the suggestion is `pickOffering` under auto-play's own style. A copy of any
 * of them would drift, and the first sign would be a page offering a fight the
 * door refuses.
 */
export interface TonightChoice {
  birdId: string;
  /** Already on tonight's card. Entries are binding, so the page shows it locked. */
  entered: CardKey | null;
  /** What the honest day would enter, or null when it would rest the bird. Always one of `options`. */
  suggestion: CardKey | null;
  /** Every posted key this bird may legally enter tonight, with what the night costs. */
  options: { key: CardKey; fee: number }[];
  /** Why the bird cannot card tonight at all (needs a name, crown day, already fought), or null. */
  blocked: string | null;
}

/**
 * Seeded per (day, bird) rather than drawn from one stream down the barn, so
 * a reload shows the same suggestions and one bird's pick does not move when
 * another bird is named or enters.
 */
function suggestionRng(day: number, birdId: string) {
  let h = day >>> 0;
  for (let i = 0; i < birdId.length; i++) h = Math.imul(h ^ birdId.charCodeAt(i), 0x01000193);
  return mulberry32(h >>> 0);
}

export function tonightFor(db: DB, farmId: string): TonightChoice[] {
  const day = readWorldState(db).dayIndex;
  const card = cardOfDay(day);
  const lobbiesApi = new Lobbies(db, farmId);
  // weatherOrder because the honest day cards in that order, and the budget
  // below is spent in it: a bird whose element is ascendant tonight gets the
  // money first.
  const active = weatherOrder(
    new Flock(db, farmId).all().filter((b) => b.status === "active"),
    day
  );

  const enteredRows = active.length
    ? db
        .select({
          birdId: lobbyEntries.birdId,
          mode: lobbies.mode,
          classType: lobbies.classType,
          format: lobbies.format,
          price: lobbies.price,
        })
        .from(lobbyEntries)
        .innerJoin(lobbies, eq(lobbies.id, lobbyEntries.lobbyId))
        .where(
          and(
            eq(lobbyEntries.dayEntered, day),
            inArray(
              lobbyEntries.birdId,
              active.map((b) => b.id)
            )
          )
        )
        .all()
    : [];
  const entered = new Map<string, CardKey>(
    enteredRows.map((r) => [
      r.birdId,
      {
        mode: r.mode,
        classType: r.classType,
        format: r.format,
        ...(r.price ? { price: r.price } : {}),
      },
    ])
  );

  const reports = lobbiesApi.scoutReports(active.map((b) => b.id));
  // The reserve is auto-play's, so "suggested" means what the house would do.
  // Spent down the barn, so the suggestions together are a card the wallet
  // can actually pay for, not one each bird could afford on its own.
  let budget = readFarm(db, farmId).gp - AUTO_RESERVE;

  return active.map((bird): TonightChoice => {
    const options = card
      .filter((k) => entryRefusal(bird, k) === null)
      .map((key) => ({ key, fee: feeFor(key.mode, key.classType, key.price) }));
    const mine = entered.get(bird.id) ?? null;
    const base = { birdId: bird.id, entered: mine, options };
    if (mine) return { ...base, suggestion: null, blocked: null };

    // The naming law (round 14) is enforced at the door; said here so the
    // page can put a name box where the select would be.
    const blocked = bird.named
      ? lobbiesApi.dayRefusal(bird.id, bird.name, day)
      : `${bird.name} needs a real name before its first fight`;
    if (blocked) return { ...base, suggestion: null, blocked };

    const spec = pickOffering(
      db,
      AUTO_PLAY_STYLE,
      bird,
      suggestionRng(day, bird.id),
      day,
      "current",
      budget,
      reports.get(bird.id)
    );
    const picked = spec ? (options.find((o) => sameKey(o.key, spec)) ?? null) : null;
    if (picked) budget -= picked.fee;
    return { ...base, suggestion: picked?.key ?? null, blocked: null };
  });
}
