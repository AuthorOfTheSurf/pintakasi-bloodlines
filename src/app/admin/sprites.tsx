"use client";

/**
 * Pixel-art sprites (round 14 — appearance v0). Hand-placed pixel maps
 * rendered as SVG rects (crispEdges keeps them sharp at any size), colored
 * by each bird's base coat + element-tinted trim. One rooster map, one hen
 * map (smaller comb, shorter tail), one egg map. Iterate on the maps freely
 * — they're just strings.
 */
import type { ReactElement } from "react";

export const BASE_COAT_HEX: Record<string, string> = {
  Grey: "#8e939c",
  Brown: "#8a5a2b",
  Cream: "#e9dcb8",
};

export const TRIM_HEX: Record<string, string> = {
  Red: "#c93a26",
  Orange: "#e07f2a",
  Blue: "#2f6fd0",
  "Light Blue": "#7ec8e3",
  Chestnut: "#a0522d",
  Green: "#3f9e4d",
  "Dark Brown": "#4a2c17",
  Black: "#23201c",
  Silver: "#c0c4cc",
  Yellow: "#e0b52c",
};

// Gacha token → egg shell color (the "one for each color" icons).
export const TOKEN_EGG_HEX: Record<string, string> = {
  White: "#e8e4da",
  Green: "#6fbf73",
  Blue: "#4f8fd8",
  Purple: "#9a6fd8",
  Gold: "#e8b64c",
};

const COMB = "#c92f1e";
const BEAK = "#d8a23c";
const LEG = "#caa53d";
const EYE = "#1a1512";

// b base coat · t trim · c comb · w wattle · k beak · e eye · l legs
const ROOSTER = [
  "..cc............",
  ".cccc...........",
  ".bebb......ttt..",
  "kbbbb.....ttttt.",
  ".wbbb....tttttt.",
  "..bbbb..tttttt..",
  "...bbbb.ttttt...",
  "....bbbbtttt....",
  "....bbbbbbtt....",
  "....bbtttbbb....",
  ".....bbttbb.....",
  ".....bbbbbb.....",
  "......bbbb......",
  ".......ll.......",
  ".......l.l......",
  "......ll..ll....",
];

const HEN = [
  "................",
  "..c.............",
  ".bebb...........",
  "kbbbb......tt...",
  ".wbbb.....tttt..",
  "..bbbb...ttttt..",
  "...bbbb.ttttt...",
  "....bbbbtttt....",
  "....bbbbbbt.....",
  "....bbtttbbb....",
  ".....bbttbb.....",
  ".....bbbbbb.....",
  "......bbbb......",
  ".......ll.......",
  ".......l.l......",
  "......ll..ll....",
];

// s shell · h highlight
const EGG = [
  "...ss...",
  "..ssss..",
  ".shssss.",
  ".shssss.",
  "ssssssss",
  "ssssssss",
  "ssssssss",
  ".ssssss.",
  ".ssssss.",
  "..ssss..",
];

function lighten(hex: string, amt = 0.35): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => {
    const v = (n >> shift) & 0xff;
    return Math.min(255, Math.round(v + (255 - v) * amt));
  };
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function pixels(map: string[], palette: Record<string, string>): ReactElement[] {
  const rects: ReactElement[] = [];
  map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (color) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} />);
    }
  });
  return rects;
}

export function BirdSprite({
  sex,
  baseCoat,
  trimColor,
  size = 32,
}: {
  sex: string; // "male" | "female" | "hidden"
  baseCoat: string;
  trimColor: string;
  size?: number;
}) {
  const map = sex === "female" ? HEN : ROOSTER;
  const palette = {
    b: BASE_COAT_HEX[baseCoat] ?? BASE_COAT_HEX.Brown,
    t: TRIM_HEX[trimColor] ?? TRIM_HEX.Red,
    c: COMB,
    w: COMB,
    k: BEAK,
    e: EYE,
    l: LEG,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      style={{ imageRendering: "pixelated", shapeRendering: "crispEdges", verticalAlign: "middle" }}
      aria-hidden
    >
      {pixels(map, palette)}
    </svg>
  );
}

export function EggSprite({ shell, size = 22 }: { shell: string; size?: number }) {
  const palette = { s: shell, h: lighten(shell) };
  return (
    <svg
      width={Math.round((size * 8) / 10)}
      height={size}
      viewBox="0 0 8 10"
      style={{ imageRendering: "pixelated", shapeRendering: "crispEdges", verticalAlign: "middle" }}
      aria-hidden
    >
      {pixels(EGG, palette)}
    </svg>
  );
}
