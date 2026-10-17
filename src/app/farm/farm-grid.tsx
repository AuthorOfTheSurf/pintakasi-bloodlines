"use client";

import { useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GetRowIdParams, GridApi, RowClickedEvent } from "ag-grid-community";
import { AUTOSIZE, officeTheme } from "../grid-kit";
import { useSavedLayout } from "./saved-layout";
import { matchesSearch, type Searchable } from "./search";

/** Under this width the page is a phone: fewer columns, nothing to drag. */
const NARROW_QUERY = "(max-width: 767px)";

function subscribeNarrow(onChange: () => void) {
  const mq = window.matchMedia(NARROW_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function useNarrow(): boolean {
  return useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false
  );
}

// "Higher is better" (the office's round-15 ruling): numeric columns sort
// descending on the first click, here as there.
const DESC_FIRST: ("desc" | "asc" | null)[] = ["desc", "asc", null];

/**
 * One farm table: a quick search, a column chooser, Save and Reset for the
 * layout, and the grid. Every column sorts and filters from its header menu.
 *
 * On a phone the `secondary` columns start hidden and nothing moves or
 * resizes, because a drag on a touch screen is almost always a scroll. The
 * phone keeps its own saved layout, so tidying the desktop view does not
 * bury the name column on the phone.
 */
export function FarmGrid<T extends object>({
  gridId,
  label,
  rows,
  columns,
  secondary,
  searchOf,
  rowId,
  onRowClicked,
  rowClass,
  selectedId,
  summary,
  context,
  placeholder,
}: {
  gridId: string;
  label: string;
  rows: T[];
  columns: ColDef<T>[];
  secondary: string[];
  searchOf: (row: T) => Searchable;
  rowId: (row: T) => string;
  onRowClicked?: (row: T) => void;
  rowClass?: string;
  selectedId?: string | null;
  summary?: (shown: T[]) => ReactNode;
  context?: unknown;
  placeholder: string;
}) {
  const narrow = useNarrow();
  const grid = useRef<AgGridReact<T>>(null);
  const layout = useSavedLayout(narrow ? `${gridId}:narrow` : gridId);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState<T[]>(rows);
  // Bumped when a column is shown or hidden, so the chooser re-reads the grid.
  const [, setColumnsSeen] = useState(0);

  const filtered = useMemo(
    () => (query.trim() ? rows.filter((r) => matchesSearch(searchOf(r), query)) : rows),
    [rows, query, searchOf]
  );

  const columnDefs = useMemo(
    () =>
      columns.map((c) => ({
        ...c,
        ...(c.type === "rightAligned" ? { sortingOrder: DESC_FIRST } : {}),
        ...(narrow && c.colId && secondary.includes(c.colId) ? { hide: true } : {}),
      })),
    [columns, narrow, secondary]
  );

  const api = (): GridApi<T> | undefined => grid.current?.api;
  const collectShown = () => {
    const out: T[] = [];
    api()?.forEachNodeAfterFilterAndSort((n) => {
      if (n.data) out.push(n.data);
    });
    setShown(out);
  };

  return (
    <section aria-label={label}>
      <div className="toolbar">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={`Search ${label}`}
        />
        <details>
          <summary>Columns</summary>
          <div className="colmenu">
            {columns.map((c) => {
              const id = c.colId ?? "";
              const col = api()?.getColumn(id);
              return (
                <label key={id}>
                  <input
                    type="checkbox"
                    checked={col ? col.isVisible() : true}
                    disabled={c.pinned === "left"}
                    onChange={(e) => {
                      api()?.setColumnsVisible([id], e.target.checked);
                      setColumnsSeen((n) => n + 1);
                    }}
                  />
                  {c.headerName}
                </label>
              );
            })}
          </div>
        </details>
        <button
          type="button"
          className="btn ghost small"
          onClick={() => {
            const a = api();
            if (a) layout.save(a);
          }}
        >
          Save layout
        </button>
        <button
          type="button"
          className="btn ghost small"
          onClick={() => {
            const a = api();
            if (a) layout.reset(a);
            setColumnsSeen((n) => n + 1);
          }}
        >
          Reset
        </button>
        {layout.saved === "failed" ? (
          <span className="dim">This browser would not save it.</span>
        ) : null}
      </div>
      {summary ? <p className="summary">{summary(shown)}</p> : null}
      <div className="gridbox">
        <AgGridReact<T>
          ref={grid}
          theme={officeTheme}
          rowData={filtered}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: !narrow,
            suppressMovable: narrow,
          }}
          autoSizeStrategy={narrow ? undefined : AUTOSIZE}
          getRowId={(p: GetRowIdParams<T>) => rowId(p.data)}
          rowHeight={40}
          rowClass={rowClass}
          context={context}
          getRowStyle={(p) =>
            p.data && selectedId && rowId(p.data) === selectedId
              ? { background: "#33291a" }
              : undefined
          }
          onGridReady={(e) => {
            layout.restore(e.api);
            setColumnsSeen((n) => n + 1);
          }}
          onModelUpdated={collectShown}
          onColumnVisible={() => setColumnsSeen((n) => n + 1)}
          onRowClicked={(e: RowClickedEvent<T>) => {
            // A click on a control inside the row (the Tonight select, a name
            // button) is about that control, not a request to open the bird.
            const target = e.event?.target;
            if (target instanceof Element && target.closest("select, button, input")) return;
            if (e.data && onRowClicked) onRowClicked(e.data);
          }}
          onCellKeyDown={(e) => {
            if (!(e.event instanceof KeyboardEvent) || e.event.key !== "Enter") return;
            // Enter on a cell that holds a control hands focus to it, so the
            // Tonight select and the name button are reachable from the keyboard.
            const cell = e.event.target instanceof HTMLElement ? e.event.target : null;
            const control = cell?.querySelector<HTMLElement>("select, button, input");
            if (control) {
              control.focus();
              return;
            }
            if (e.data && onRowClicked) onRowClicked(e.data);
          }}
        />
      </div>
    </section>
  );
}
