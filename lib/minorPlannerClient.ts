"use client";

import { useSyncExternalStore } from "react";
import { MINORS } from "@/lib/minors";
import { buildNonMgmtMinorCountedCourseCodeSet } from "@/lib/minorPlanner";

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

let lastEnabledRaw: string | null = null;
let lastCodesRaw: string | null = null;
let lastLegacyRaw: string | null = null;
let lastSelection: MinorPlannerSelection = DEFAULT_SELECTION;

function readMinorPlannerSelection(): MinorPlannerSelection {
  if (typeof window === "undefined") return DEFAULT_SELECTION;

  try {
    const enabledRaw = localStorage.getItem(MINOR_PLANNER_STORAGE_KEYS.enabled);
    const storedCodesRaw = localStorage.getItem(MINOR_PLANNER_STORAGE_KEYS.minorCodes);
    const legacyRaw = localStorage.getItem(MINOR_PLANNER_STORAGE_KEYS.legacyMinorCode);

    if (enabledRaw === lastEnabledRaw && storedCodesRaw === lastCodesRaw && legacyRaw === lastLegacyRaw) {
      return lastSelection;
    }

    lastEnabledRaw = enabledRaw;
    lastCodesRaw = storedCodesRaw;
    lastLegacyRaw = legacyRaw;

    const enabled = enabledRaw === "true";

    if (storedCodesRaw) {
      const parsed = JSON.parse(storedCodesRaw);
      if (Array.isArray(parsed)) {
        const unique = Array.from(
          new Set(
            parsed
              .map((c) => String(c))
              .filter((c) => KNOWN_MINOR_CODES.has(c))
          )
        );
        lastSelection = { enabled, codes: unique };
        return lastSelection;
      }
    }

    if (legacyRaw && KNOWN_MINOR_CODES.has(legacyRaw)) {
      lastSelection = { enabled, codes: [legacyRaw] };
      return lastSelection;
    }

    lastSelection = { enabled, codes: [] };
    return lastSelection;
  } catch {
    lastEnabledRaw = null;
    lastCodesRaw = null;
    lastLegacyRaw = null;
    lastSelection = DEFAULT_SELECTION;
  }

  return lastSelection;
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

// Ensure buildNonMgmtMinorCountedCourseCodeSet stays tree-shakeable for components importing from this module.
void buildNonMgmtMinorCountedCourseCodeSet;

