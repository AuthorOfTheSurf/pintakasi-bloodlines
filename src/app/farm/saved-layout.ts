"use client";

import { useCallback, useState } from "react";
import type { ColumnState, FilterModel, GridApi } from "ag-grid-community";

/**
 * A grid's layout (column order, widths, visibility, sort, pins, and its
 * filters) kept per grid in this browser. Community APIs only. Every storage
 * touch is guarded: a private window or a blocked site can throw on access,
 * and a page that cannot remember a layout must still show the grid.
 */
interface SavedLayout {
  columnState: ColumnState[];
  filterModel: FilterModel;
}

const storageKey = (gridId: string) => `pintakasi.farm.layout.${gridId}`;

function read(gridId: string): SavedLayout | null {
  try {
    const raw = window.localStorage.getItem(storageKey(gridId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "columnState" in parsed &&
      Array.isArray(parsed.columnState) &&
      "filterModel" in parsed &&
      typeof parsed.filterModel === "object"
    ) {
      const { columnState, filterModel } = parsed;
      return { columnState, filterModel: filterModel ?? {} };
    }
    return null;
  } catch {
    return null;
  }
}

export function useSavedLayout(gridId: string) {
  const [saved, setSaved] = useState<"none" | "saved" | "failed">("none");

  /** Call from onGridReady: puts the last saved layout back, if there is one. */
  const restore = useCallback(
    (api: GridApi) => {
      const layout = read(gridId);
      if (!layout) return;
      api.applyColumnState({ state: layout.columnState, applyOrder: true });
      api.setFilterModel(layout.filterModel);
      setSaved("saved");
    },
    [gridId]
  );

  const save = useCallback(
    (api: GridApi) => {
      const layout: SavedLayout = {
        columnState: api.getColumnState(),
        filterModel: api.getFilterModel(),
      };
      try {
        window.localStorage.setItem(storageKey(gridId), JSON.stringify(layout));
        setSaved("saved");
      } catch {
        setSaved("failed");
      }
    },
    [gridId]
  );

  /** Forget the saved layout and go back to the page's defaults. */
  const reset = useCallback(
    (api: GridApi) => {
      try {
        window.localStorage.removeItem(storageKey(gridId));
      } catch {
        // Nothing stored or storage blocked: either way the defaults apply below.
      }
      api.resetColumnState();
      api.setFilterModel(null);
      setSaved("none");
    },
    [gridId]
  );

  return { restore, save, reset, saved };
}
