import type { CardKey } from "./config";

/**
 * Two small pure helpers over a card key, in their own module so the farm
 * page's client bundle can use them without pulling in the database layer
 * that tonight.ts needs.
 */

/** The same key, compared on all four axes the card is matched on (see `isOnCard`). */
export const sameKey = (a: CardKey, b: CardKey): boolean =>
  a.mode === b.mode &&
  a.classType === b.classType &&
  a.format === b.format &&
  (a.price ?? null) === (b.price ?? null);

/** A stable string for one key: select values, React keys, label lookups. */
export const keyId = (k: CardKey): string =>
  `${k.mode}|${k.classType}|${k.format}|${k.price ?? ""}`;
