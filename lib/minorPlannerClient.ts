"use client";

import { useSyncExternalStore } from "react";
import { MINORS } from "@/lib/minors";

export { MANAGEMENT_MINOR_CODE, buildNonMgmtMinorCountedCourseCodeSet } from "@/lib/minorPlanner";

export const MINOR_PLANNER_STORAGE_KEYS = {
  enabled: "degreePlanner.minorPlanner.enabled",
  minorCodes: "degreePlanner.minorPlanner.codes",
  legacyMinorCode: "degreePlanner.minorPlanner.code",
} as const;

export type MinorPlannerSelection = {
  enabled: boolean;
  codes: string[];
};

const DEFAULT_SELECTION: MinorPlannerSelection = { enabled: false, codes: [] };
const KNOWN_MINOR_CODES = new Set(MINORS.map((m) => m.code));

let cachedSelectionKey = "";
let cachedSelection: MinorPlannerSelection = DEFAULT_SELECTION;

function selectionKey(selection: MinorPlannerSelection): string {
  return `${selection.enabled ? "1" : "0"}|${selection.codes.join(",")}`;
}

function readMinorPlannerSelection(): MinorPlannerSelection {
  if (typeof window === "undefined") return DEFAULT_SELECTION;

  try {
    const enabledRaw = localStorage.getItem(MINOR_PLANNER_STORAGE_KEYS.enabled);
    const storedCodesRaw = localStorage.getItem(MINOR_PLANNER_STORAGE_KEYS.minorCodes);
    const legacyRaw = localStorage.getItem(MINOR_PLANNER_STORAGE_KEYS.legacyMinorCode);

    const enabled = enabledRaw === "true";

    if (storedCodesRaw) {
      const parsed = JSON.parse(storedCodesRaw);
      if (Array.isArray(parsed)) {
        const unique = Array.from(
          new Set(
            parsed
              .map((c) => String(c ?? "").trim().toUpperCase())
              .filter((c) => Boolean(c) && KNOWN_MINOR_CODES.has(c))
          )
        );
        const next = { enabled, codes: unique };
        const nextKey = selectionKey(next);
        if (nextKey === cachedSelectionKey) return cachedSelection;
        cachedSelectionKey = nextKey;
        cachedSelection = next;
        return next;
      }
    }

    const legacyCode = String(legacyRaw ?? "").trim().toUpperCase();
    if (legacyCode && KNOWN_MINOR_CODES.has(legacyCode)) {
      const next = { enabled, codes: [legacyCode] };
      const nextKey = selectionKey(next);
      if (nextKey === cachedSelectionKey) return cachedSelection;
      cachedSelectionKey = nextKey;
      cachedSelection = next;
      return next;
    }

    const next = { enabled, codes: [] };
    const nextKey = selectionKey(next);
    if (nextKey === cachedSelectionKey) return cachedSelection;
    cachedSelectionKey = nextKey;
    cachedSelection = next;
    return next;
  } catch {
    return DEFAULT_SELECTION;
  }
}

function subscribeMinorPlannerSelection(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  const onStorage = (e: StorageEvent) => {
    if (
      e.key === MINOR_PLANNER_STORAGE_KEYS.enabled ||
      e.key === MINOR_PLANNER_STORAGE_KEYS.minorCodes ||
      e.key === MINOR_PLANNER_STORAGE_KEYS.legacyMinorCode
    ) {
      callback();
    }
  };

  const onLocal = () => callback();

  window.addEventListener("storage", onStorage);
  window.addEventListener("degreePlanner:storage", onLocal);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("degreePlanner:storage", onLocal);
  };
}

export function useMinorPlannerSelection(): MinorPlannerSelection {
  return useSyncExternalStore(
    subscribeMinorPlannerSelection,
    readMinorPlannerSelection,
    () => DEFAULT_SELECTION
  );
}
