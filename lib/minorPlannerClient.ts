"use client";

import { useSyncExternalStore } from "react";
import { MINORS } from "@/lib/minors";
import { formatCourseCode } from "@/lib/utils";

export { MANAGEMENT_MINOR_CODE, buildNonMgmtMinorCountedCourseCodeSet } from "@/lib/minorPlanner";

export const MINOR_PLANNER_STORAGE_KEYS = {
  enabled: "degreePlanner.minorPlanner.enabled",
  minorCodes: "degreePlanner.minorPlanner.codes",
  countedCourseCodesByMinor: "degreePlanner.minorPlanner.countedCourseCodesByMinor",
  legacyMinorCode: "degreePlanner.minorPlanner.code",
} as const;

export type MinorPlannerSelection = {
  enabled: boolean;
  codes: string[];
  countedCourseCodes: string[];
  countedCourseCodesConfigured: boolean;
};

const DEFAULT_SELECTION: MinorPlannerSelection = {
  enabled: false,
  codes: [],
  countedCourseCodes: [],
  countedCourseCodesConfigured: false,
};
const KNOWN_MINOR_CODES = new Set(MINORS.map((m) => m.code));

let cachedSelectionKey = "";
let cachedSelection: MinorPlannerSelection = DEFAULT_SELECTION;

function selectionKey(selection: MinorPlannerSelection): string {
  const codesKey = [...selection.codes].sort().join(",");
  const countedKey = [...selection.countedCourseCodes].sort().join(",");
  const configuredKey = selection.countedCourseCodesConfigured ? "1" : "0";
  return `${selection.enabled ? "1" : "0"}|${codesKey}|${countedKey}|${configuredKey}`;
}

function readMinorPlannerSelection(): MinorPlannerSelection {
  if (typeof window === "undefined") return DEFAULT_SELECTION;

  try {
    const enabledRaw = localStorage.getItem(MINOR_PLANNER_STORAGE_KEYS.enabled);
    const storedCodesRaw = localStorage.getItem(MINOR_PLANNER_STORAGE_KEYS.minorCodes);
    const countedByMinorRaw = localStorage.getItem(
      MINOR_PLANNER_STORAGE_KEYS.countedCourseCodesByMinor
    );
    const legacyRaw = localStorage.getItem(MINOR_PLANNER_STORAGE_KEYS.legacyMinorCode);

    const enabled = enabledRaw === "true";
    const countedCourseCodesConfigured = countedByMinorRaw !== null;

    const readCountedCourseCodes = (selectedMinorCodes: string[]): string[] => {
      if (!countedByMinorRaw) return [];

      try {
        const parsed = JSON.parse(countedByMinorRaw);
        if (!parsed || typeof parsed !== "object") return [];

        const out = new Set<string>();
        for (const minorCode of selectedMinorCodes) {
          const rawList = (parsed as Record<string, unknown>)[minorCode];
          if (!Array.isArray(rawList)) continue;
          for (const item of rawList) {
            const formatted = formatCourseCode(String(item ?? ""));
            if (formatted) out.add(formatted);
          }
        }
        return Array.from(out);
      } catch {
        return [];
      }
    };

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
        const countedCourseCodes = readCountedCourseCodes(unique);
        const next = { enabled, codes: unique, countedCourseCodes, countedCourseCodesConfigured };
        const nextKey = selectionKey(next);
        if (nextKey === cachedSelectionKey) return cachedSelection;
        cachedSelectionKey = nextKey;
        cachedSelection = next;
        return next;
      }
    }

    const legacyCode = String(legacyRaw ?? "").trim().toUpperCase();
    if (legacyCode && KNOWN_MINOR_CODES.has(legacyCode)) {
      const countedCourseCodes = readCountedCourseCodes([legacyCode]);
      const next = { enabled, codes: [legacyCode], countedCourseCodes, countedCourseCodesConfigured };
      const nextKey = selectionKey(next);
      if (nextKey === cachedSelectionKey) return cachedSelection;
      cachedSelectionKey = nextKey;
      cachedSelection = next;
      return next;
    }

    const next = { enabled, codes: [], countedCourseCodes: [], countedCourseCodesConfigured };
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
      e.key === MINOR_PLANNER_STORAGE_KEYS.countedCourseCodesByMinor ||
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
