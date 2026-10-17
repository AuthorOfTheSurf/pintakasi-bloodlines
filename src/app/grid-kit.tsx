"use client";

import { useEffect, useRef, useState } from "react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type SizeColumnsToContentStrategy,
} from "ag-grid-community";
// Type-only, so nothing from the engine (or drizzle) is pulled into the client
// bundle — the replay itself happens on the server, behind /api/fight/[id].
import type { FightReplay } from "@/engine/replay";
import { gradeColor, gradeOf } from "@/engine/grades";
import { ElementSprite } from "./admin/sprites";
import { FightViewer } from "./admin/fight-viewer";

ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * ── THE GRID KIT — what the Stewards' Office and the farm page share ───────
 *
 * Lifted out of admin/grids.tsx when the farm page arrived, so a player's
 * tables and the office's look and behave as one house: the same dark-and-gold
 * theme, the same autosize rule, the same fight replay. One copy, two pages.
 */

export const officeTheme = themeQuartz.withParams({
  backgroundColor: "#1c1914",
  foregroundColor: "#e8e0d0",
  headerBackgroundColor: "#171410",
  headerTextColor: "#9a8f78",
  accentColor: "#e8b64c",
  borderColor: "#3a342a",
  rowHoverColor: "#242019",
  oddRowBackgroundColor: "#1a1712",
  fontFamily: "ui-monospace, Menlo, monospace",
  fontSize: 12.5,
});

/**
 * Every grid sizes itself to its contents on first render (round 37) — the
 * hand-tuned pixel widths below are only a starting guess, and the office was
 * being read with half the headers and half the farm names clipped, which meant
 * dragging columns wider by hand on every visit.
 *
 * `skipHeader: false` is the point of the exercise: measure the HEADER as well
 * as the cells, so "GP per staked LT" gets its own column back. The scale-up
 * pass then spends whatever width is left over on the columns that can take it,
 * which is what `flex` used to be doing for one column per grid.
 *
 * Two things are deliberately NOT here. There is no `defaultMaxWidth` /
 * `defaultMinWidth`: those OVERRIDE a column's own min/max, which would unlock
 * the six stat columns from their identical width (see `statCol`) and let them
 * go ragged again — the exact complaint round 19 fixed. Instead the one column
 * that can genuinely run away, the ledger's free-text message, is capped by
 * name; it has `tooltipField` for the overflow. And nothing here is sticky: the
 * grid stays `resizable`, so a drag afterwards still wins.
 */
export const AUTOSIZE: SizeColumnsToContentStrategy = {
  type: "fitCellContents",
  skipHeader: false,
  scaleUpToFitGridWidth: true,
  columnLimits: [{ colId: "message", maxWidth: 620 }],
};

/**
 * Grade prominent — colored per family (round 15: C blue · B orange ·
 * A green · S purple · O amber) — raw number in secondary grey.
 */
export function GradeCell(props: { value?: number }) {
  if (props.value == null) return <span className="statnum">?</span>;
  const grade = gradeOf(props.value);
  return (
    <span>
      <b className="grade" style={{ color: gradeColor(grade) }}>
        {grade}
      </b>{" "}
      <span className="statnum">{props.value}</span>
    </span>
  );
}

/** Element with its pixel icon. */
export function ElementCell(props: { value?: string }) {
  if (!props.value) return null;
  return (
    <span>
      <ElementSprite element={props.value} size={14} /> {props.value}
    </span>
  );
}

/** The small outline button: the office's Birds pane, the replay modal's arrows, the farm page. */
export const CHIP: React.CSSProperties = {
  font: "inherit",
  fontSize: ".8em",
  cursor: "pointer",
  color: "#9a8f78",
  background: "transparent",
  border: "1px solid #3a342a",
  borderRadius: 4,
  padding: ".1rem .5rem",
  marginLeft: ".4rem",
};

/** What the replay panel is currently showing. */
export type ReplayState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; replay: FightReplay };

/**
 * What sits under the header of a FightReplayModal — a function rather than a
 * nested ternary so each of the three states reads on its own.
 */
function replayBody(state: ReplayState, logId: number) {
  if (state.status === "loading") {
    // Worth saying WHY it takes a moment: this is a fight being fought
    // again, not a row being fetched.
    return <p className="world">Replaying fight #{logId} from its seed…</p>;
  }
  if (state.status === "error") {
    return (
      <p className="world" style={{ color: "#c86a5a" }}>
        {state.message}
      </p>
    );
  }
  return (
    <>
      {state.replay.drifted ? (
        // NEVER hidden and never shown as if it were fine. The engine has
        // changed since this fight was fought, so the text below is a
        // fight between these two birds under TODAY's rules — the archive
        // is what actually happened, and it wins.
        <div
          style={{
            border: "1px solid #7a5a1a",
            background: "#2a2110",
            borderRadius: 4,
            padding: ".5rem .7rem",
            margin: "0 0 .5rem",
            fontSize: ".8rem",
            color: "#e8b64c",
          }}
        >
          <b>⚠ This transcript is no longer trustworthy.</b> The fight engine has changed since this
          fight was fought, so replaying its seed no longer reproduces the result stored beside it.
          The archive is the true record:{" "}
          <b>
            Pit Figures {state.replay.archivedFigures[0]} / {state.replay.archivedFigures[1]}
          </b>
          . The replay below says {state.replay.figures[0]} / {state.replay.figures[1]} —{" "}
          {state.replay.driftDetail}.
        </div>
      ) : (
        // Keyed by the fight, so opening another one starts a fresh reel from
        // its intro instead of carrying the last fight's cursor into it. A
        // drifted replay has no timeline to hand over, so it gets no picture.
        <FightViewer
          key={logId}
          timeline={state.replay.timeline}
          looks={state.replay.looks}
          stables={state.replay.stables}
        />
      )}
      <pre
        style={{
          height: 300,
          overflow: "auto",
          margin: 0,
          padding: ".6rem .8rem",
          background: "#1c1914",
          color: "#e8e0d0",
          border: "1px solid #3a342a",
          borderRadius: 4,
          fontFamily: "ui-monospace, Menlo, monospace",
          fontSize: 12.5,
          lineHeight: 1.5,
          // The narration is laid out with its own newlines but has no
          // fixed width, so it wraps rather than growing a horizontal bar.
          whiteSpace: "pre-wrap",
          // Drifted text stays legible but visibly demoted, so a screenshot
          // of it can't be mistaken for the real record.
          opacity: state.replay.drifted ? 0.65 : 1,
        }}
      >
        {state.replay.playByPlay}
      </pre>
    </>
  );
}

/**
 * ── READING A FIGHT (round 38) ─────────────────────────────────────────────
 *
 * The narration is not in the database any more — it is rebuilt from the
 * fight's seed on request — so a fight, like the career it belongs to, is
 * asked of the server after the page loads.
 *
 * It opens OVER the office as a modal (round 65), and the fight list stays
 * where it was underneath. It used to replace the list, which was right while
 * a fight was a hundred lines of text that wanted the room — but a fight is
 * now something you watch, and watching a bird's career means one fight after
 * another. Replacing the list made every next fight a trip back through
 * "← back". Now closing the modal lands on the list, and the two arrows step
 * through the career without closing it at all.
 */
export function FightReplayModal({
  fight,
  state,
  onClose,
  onEarlier,
  onLater,
}: {
  fight: { logId: number; title: string };
  state: ReplayState;
  onClose: () => void;
  /** Undefined at either end of the list, which is what disables the arrow. */
  onEarlier: (() => void) | undefined;
  onLater: (() => void) | undefined;
}) {
  // A native <dialog>, opened with showModal(). That is what makes it a modal
  // in fact and not only in looks: the browser traps Tab inside it, makes the
  // office behind it inert, puts it in the top layer and closes it on Escape.
  // A positioned <div> with role="dialog" promised all of that to a screen
  // reader and delivered none of it — Tab walked out into the tab bar
  // underneath, where Enter switched tabs with the fight still open.
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  // The arrow keys step through the career, because a hand that has just
  // watched a fight should not have to find the button for the next one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The scrubber takes the arrows for itself when it has focus.
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowLeft") onEarlier?.();
      if (e.key === "ArrowRight") onLater?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEarlier, onLater]);

  return (
    <dialog
      ref={dialog}
      className="fight-modal"
      aria-label={`Fight ${fight.title}`}
      // Escape and any other browser-initiated close arrive here.
      onClose={onClose}
      // The dialog element itself is only ever the click target on its
      // backdrop; a click inside lands on the panel or something in it.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{ padding: ".7rem .9rem .9rem" }}>
        <p style={{ margin: "0 0 .6rem", fontSize: ".85rem", display: "flex", gap: ".3rem" }}>
          <button onClick={onEarlier} disabled={!onEarlier} style={{ ...CHIP, marginLeft: 0 }}>
            ← earlier
          </button>
          <button onClick={onLater} disabled={!onLater} style={{ ...CHIP, marginLeft: 0 }}>
            later →
          </button>
          <span className="world" style={{ alignSelf: "center", marginLeft: ".4rem" }}>
            {fight.title}
          </span>
          <button onClick={onClose} style={{ ...CHIP, marginLeft: "auto" }}>
            close ✕
          </button>
        </p>
        {replayBody(state, fight.logId)}
      </div>
    </dialog>
  );
}

/**
 * The replay for one fight, asked of the server when `logId` changes. Null
 * means no fight is open, and nothing is fetched.
 */
export function useFightReplay(logId: number | null): ReplayState {
  // The office's other fetch. The abort matters more than it looks: clicking
  // down a bird's history faster than the server replays means several fights
  // in flight at once, and without it the LAST response to land wins rather
  // than the last one asked for.
  const [replay, setReplay] = useState<ReplayState>({ status: "loading" });
  useEffect(() => {
    if (logId === null) return;
    setReplay({ status: "loading" });
    const ac = new AbortController();
    fetch(`/api/fight/${logId}`, { signal: ac.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        // An abort that lands AFTER the headers fails the body read, not the
        // fetch, and the catch above turns that into a null body on a 200.
        // Without this check the fight that was clicked away from wrote
        // `replay: null` over the one that was asked for, and the panel
        // crashed reading it.
        if (ac.signal.aborted) return;
        // A 404 here is the replay's "unavailable" — the fight cannot be
        // reconstructed at all — and the route sends the reason with it.
        if (!res.ok)
          throw new Error(body?.error ?? `The archive answered ${res.status} for fight #${logId}.`);
        if (body === null)
          throw new Error(`The archive sent no readable replay for fight #${logId}.`);
        setReplay({ status: "ok", replay: body as FightReplay });
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        setReplay({
          status: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      });
    return () => ac.abort();
  }, [logId]);
  return replay;
}
