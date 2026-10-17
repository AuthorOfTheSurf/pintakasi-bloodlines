"use client";

import type { ICellRendererParams } from "ag-grid-community";
import { FIGURE } from "@/engine/config";
import { gradeColor, type Grade } from "@/engine/grades";
import { keyId } from "@/engine/card-key";
import { BASE_COAT_HEX, BirdSprite, EggSprite } from "../admin/sprites";
import type { EggRowUI, FightingRowUI } from "./data";

/** What the Tonight column needs from the page, handed to the grid as its context. */
export interface TonightContext {
  labels: Record<string, string>;
  setPick: (birdId: string, pick: string) => void;
  askName: (birdId: string, current: string) => void;
}

/** A Fighting row as the grid holds it: the bird plus the pick on screen right now. */
export type FightingGridRow = FightingRowUI & {
  pick: string; // a keyId, or "" for rest
  tonightText: string; // what the Tonight cell says, so it sorts and filters like text
};

type NameRow = {
  name: string;
  grade: Grade;
  sex: string;
  baseCoat: string;
  trimColor: string;
};

/** The pinned name cell: sprite, name, grade chip. */
export function NameCell(props: ICellRendererParams<NameRow>) {
  const d = props.data;
  if (!d) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: ".4rem" }}>
      <BirdSprite sex={d.sex} baseCoat={d.baseCoat} trimColor={d.trimColor} size={26} />
      <b className="grade" style={{ color: gradeColor(d.grade) }}>
        {d.grade}
      </b>
      <span>{d.name}</span>
    </span>
  );
}

export function EggNameCell(props: ICellRendererParams<EggRowUI>) {
  const d = props.data;
  if (!d) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: ".4rem" }}>
      <EggSprite shell={BASE_COAT_HEX[d.baseCoat] ?? BASE_COAT_HEX.Cream} size={22} />
      <span>{d.name}</span>
    </span>
  );
}

/**
 * The last few Pit Figures as bars, oldest on the left: green a win, red a
 * loss. Plain SVG because the grid's sparkline renderer is an enterprise
 * feature. Scaled to the par figure or the bird's best, whichever is higher,
 * so a bar's height reads against the same yardstick from bird to bird.
 */
export function SparkCell(props: ICellRendererParams<FightingRowUI>) {
  const figs = props.data?.figures ?? [];
  if (figs.length === 0) return <span className="dim">no fights</span>;
  const top = Math.max(FIGURE.PEG_FIGURE, ...figs.map((f) => f.figure));
  const w = 7;
  const h = 22;
  return (
    <svg
      className="spark"
      width={figs.length * w}
      height={h}
      role="img"
      aria-label={`Last figures ${figs.map((f) => `${f.figure} ${f.result}`).join(", ")}`}
    >
      {figs.map((f, i) => {
        const bar = Math.max(2, Math.round((f.figure / top) * h));
        return (
          <rect
            key={i}
            x={i * w}
            y={h - bar}
            width={w - 2}
            height={bar}
            fill={f.result === "win" ? "#7fc97f" : "#e07a6a"}
          />
        );
      })}
    </svg>
  );
}

/** The words the Tonight cell shows for a row, outside React so the grid can sort on them. */
export function tonightText(
  row: FightingRowUI,
  pick: string,
  labels: Record<string, string>
): string {
  const t = row.tonight;
  if (t.entered) return `Entered: ${labels[keyId(t.entered)] ?? keyId(t.entered)}`;
  if (t.blocked) return t.blocked;
  return pick ? (labels[pick] ?? pick) : "Rest";
}

/**
 * Tonight, for one bird: a select of the fights it may legally enter, plus
 * Rest, pre-filled with the house's suggestion. An entered bird is locked
 * (entries are binding); an unnamed bird gets a Name button, because the
 * naming law stands between it and the card.
 */
export function TonightCell(props: ICellRendererParams<FightingGridRow, unknown, TonightContext>) {
  const row = props.data;
  const ctx = props.context;
  if (!row) return null;
  const t = row.tonight;
  if (t.entered)
    return <span className="tonight-cell locked">{tonightText(row, row.pick, ctx.labels)}</span>;
  if (!row.named)
    return (
      <span className="tonight-cell">
        <button
          type="button"
          className="btn small"
          onClick={() => ctx.askName(row.id, row.name)}
          aria-label={`Name ${row.name}`}
        >
          Name it
        </button>
      </span>
    );
  if (t.blocked) return <span className="tonight-cell blocked">{t.blocked}</span>;
  const suggested = t.suggestion ? keyId(t.suggestion) : "";
  return (
    <span className="tonight-cell">
      <select
        value={row.pick}
        onChange={(e) => ctx.setPick(row.id, e.target.value)}
        aria-label={`Tonight for ${row.name}`}
      >
        <option value="">Rest</option>
        {t.options.map((o) => {
          const id = keyId(o.key);
          return (
            <option key={id} value={id}>
              {ctx.labels[id] ?? id} · {o.fee} GP{id === suggested ? " · suggested" : ""}
            </option>
          );
        })}
      </select>
    </span>
  );
}
