import { ELEMENTS } from "@/engine/config";
import { GRADES } from "@/engine/grades";

/**
 * The quick search above each farm grid. It filters the rows BEFORE they
 * reach the grid, so it stacks with the column filters instead of fighting
 * them, and a phone user gets one box instead of a header menu.
 *
 * Every word must match. A word that names a sex, a grade or an element is
 * matched exactly against that field (so "a" finds A birds, not every name
 * with an a in it); anything else is a piece of the name.
 */
export interface Searchable {
  text: string; // what a plain word is looked for in, lower-cased by the matcher
  sexLabel?: "rooster" | "hen" | null;
  grade?: string;
  element?: string;
}

const SEXES: Record<string, "rooster" | "hen"> = {
  rooster: "rooster",
  roosters: "rooster",
  hen: "hen",
  hens: "hen",
};

export function matchesSearch(row: Searchable, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const text = row.text.toLowerCase();
  return words.every((w) => {
    const sex = SEXES[w];
    if (sex) return row.sexLabel === sex;
    const grade = GRADES.find((g) => g.toLowerCase() === w);
    if (grade && row.grade !== undefined) return row.grade === grade;
    const element = ELEMENTS.find((e) => e.toLowerCase() === w);
    if (element && row.element !== undefined) return row.element === element;
    return text.includes(w);
  });
}
