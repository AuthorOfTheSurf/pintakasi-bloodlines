import type { FarmColor } from "@/engine/config";

/**
 * What each palette color looks like on screen. Keyed by FarmColor, so a
 * color added to config's FARM_COLORS fails to compile here until it has one.
 */
export const SWATCH: Record<FarmColor, string> = {
  red: "#c8402f",
  orange: "#e07a2c",
  yellow: "#e8d14c",
  green: "#4f9a4a",
  teal: "#2f9a92",
  blue: "#3a6fc8",
  purple: "#7e4fb3",
  pink: "#e07aa8",
  brown: "#7a5232",
  black: "#151515",
  white: "#f2efe8",
  gold: "#e8b64c",
};
