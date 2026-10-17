"use client";

import { BASE_COAT_HEX, EggSprite } from "../admin/sprites";

// A client module because BASE_COAT_HEX lives in one: a server component that
// imports a plain value from a "use client" file gets a reference, not the map.
// Takes the coat alone, so an egg's hidden sex never reaches the browser.
export function CoatEgg({ baseCoat, size }: { baseCoat: string; size: number }) {
  return <EggSprite shell={BASE_COAT_HEX[baseCoat] ?? BASE_COAT_HEX.Cream} size={size} />;
}
