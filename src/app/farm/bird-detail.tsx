"use client";

import { useEffect, useState } from "react";
import type { BirdFightRowUI } from "../admin/grids";
import { FORMATS, type FightFormat } from "@/engine/config";
import type { LineageNode } from "@/engine/breeding";
import type { FormatRecord, ScoutReport } from "@/engine/lobbies";
import { CHIP } from "../grid-kit";

/** What GET /api/birds/[id] answers, as far as this panel reads it. */
interface BirdSheet {
  lineage: LineageNode | null;
  scoutReport: ScoutReport;
  formatRecords: Partial<Record<FightFormat, FormatRecord>>;
}

type Load<T> =
  { status: "loading" } | { status: "error"; message: string } | { status: "ok"; value: T };

/** One GET, aborted when the bird changes so a slow answer can't land on the wrong bird. */
function useJson<T>(url: string): Load<T> {
  const [state, setState] = useState<Load<T>>({ status: "loading" });
  useEffect(() => {
    setState({ status: "loading" });
    const ac = new AbortController();
    fetch(url, { signal: ac.signal })
      .then(async (res) => {
        const body: unknown = await res.json().catch(() => null);
        if (ac.signal.aborted) return;
        if (!res.ok || body === null) throw new Error(`The server answered ${res.status}.`);
        setState({ status: "ok", value: body as T });
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
      });
    return () => ac.abort();
  }, [url]);
  return state;
}

const TABS = ["Form book", "Per-blade record", "Lineage"] as const;
type Tab = (typeof TABS)[number];

/**
 * The panel under the grid for one selected bird. Asked for when the bird is
 * selected, like the office's history pane, so the page never carries every
 * bird's career up front.
 */
export function BirdDetail({
  birdId,
  title,
  onClose,
  onWatch,
}: {
  birdId: string;
  title: React.ReactNode;
  onClose: () => void;
  onWatch: (fight: BirdFightRowUI) => void;
}) {
  const [tab, setTab] = useState<Tab>("Form book");
  const fights = useJson<BirdFightRowUI[]>(`/api/fight/by-bird/${encodeURIComponent(birdId)}`);
  const sheet = useJson<BirdSheet>(`/api/birds/${encodeURIComponent(birdId)}`);

  return (
    <section className="detail" aria-label="Selected bird">
      <h3>
        {title}
        <button
          type="button"
          onClick={onClose}
          style={{ ...CHIP, marginLeft: "auto", minHeight: 32 }}
        >
          close ✕
        </button>
      </h3>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "Form book" ? <FormBook state={fights} onWatch={onWatch} /> : null}
        {tab === "Per-blade record" ? <Blades state={sheet} /> : null}
        {tab === "Lineage" ? <Lineage state={sheet} /> : null}
      </div>
    </section>
  );
}

function pending<T>(state: Load<T>, what: string): React.ReactNode | null {
  if (state.status === "loading") return <p className="world">Reading {what}…</p>;
  if (state.status === "error")
    return (
      <p className="world">
        Could not read {what}. {state.message}
      </p>
    );
  return null;
}

function FormBook({
  state,
  onWatch,
}: {
  state: Load<BirdFightRowUI[]>;
  onWatch: (fight: BirdFightRowUI) => void;
}) {
  if (state.status !== "ok") return pending(state, "the form book");
  if (state.value.length === 0) return <p className="world">No fights yet.</p>;
  const newestFirst = state.value.slice().reverse();
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th className="num">Day</th>
            <th>Card</th>
            <th>Opponent</th>
            <th>Result</th>
            <th className="num">Figure</th>
            <th className="num">Theirs</th>
            <th className="num">GP</th>
            <th>Replay</th>
          </tr>
        </thead>
        <tbody>
          {newestFirst.map((f) => (
            <tr key={f.logId}>
              <td className="num">{f.day}</td>
              <td>{f.card}</td>
              <td>
                {f.opponent} <span className="dim">{f.opponentFarm}</span>
              </td>
              <td className={f.result === "win" ? "up" : "down"}>{f.result}</td>
              <td className="num">{f.figure}</td>
              <td className="num">{f.opponentFigure ?? ""}</td>
              <td className={`num ${f.gp > 0 ? "up" : ""} ${f.gp < 0 ? "down" : ""}`}>
                {f.gp === 0 ? "" : f.gp.toFixed(2)}
              </td>
              <td>
                <button type="button" className="btn ghost small" onClick={() => onWatch(f)}>
                  Watch replay
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Blades({ state }: { state: Load<BirdSheet> }) {
  if (state.status !== "ok") return pending(state, "the per-blade record");
  const { formatRecords, scoutReport } = state.value;
  const blades = Object.keys(FORMATS).filter((f): f is FightFormat => f in FORMATS);
  return (
    <>
      <p className="dim" style={{ margin: "0 0 .5rem" }}>
        {scoutReport.totalFights > 0
          ? `The scout reads this bird best at ${FORMATS[scoutReport.bestBlade].label}.`
          : "No fights yet, so the scout has nothing to read."}
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Blade</th>
              <th className="num">Fights</th>
              <th className="num">W–L</th>
              <th className="num">Avg figure</th>
              <th className="num">Best</th>
            </tr>
          </thead>
          <tbody>
            {blades.map((b) => {
              const r = formatRecords[b];
              return (
                <tr key={b}>
                  <td>
                    {FORMATS[b].label} <span className="dim">{FORMATS[b].flavor}</span>
                  </td>
                  <td className="num">{r?.fights ?? 0}</td>
                  <td className="num">{r ? `${r.wins}–${r.losses}` : ""}</td>
                  <td className="num">{r ? r.avgFigure.toFixed(1) : ""}</td>
                  <td className="num">{r?.bestFigure ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Lineage({ state }: { state: Load<BirdSheet> }) {
  if (state.status !== "ok") return pending(state, "the lineage");
  const node = state.value.lineage;
  if (!node) return <p className="world">No lineage on record.</p>;
  if (!node.mother && !node.father)
    return <p className="world">Founding stock: no parents on record.</p>;
  return <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>{parents(node)}</ul>;
}

/** Two generations: dam and sire, each with theirs. Deeper reads like noise on a phone. */
function parents(node: LineageNode, depth = 0): React.ReactNode {
  const line = (who: string, p: LineageNode | null) =>
    p ? (
      <li key={who}>
        {who}: <b>{p.name}</b> <span className="dim">{p.stars}</span>
        {depth === 0 && (p.mother || p.father) ? <ul>{parents(p, depth + 1)}</ul> : null}
      </li>
    ) : null;
  return (
    <>
      {line("Mother", node.mother)}
      {line("Father", node.father)}
    </>
  );
}
