import { MINORS } from "@/lib/minors";
import { formatCourseCode } from "@/lib/utils";

export const MANAGEMENT_MINOR_CODES = new Set(["MGMT", "MGMT_B24"]);

const KNOWN_MINOR_CODES = new Set(MINORS.map((m) => m.code));

function normalizeMinorCode(code: unknown): string {
  return String(code ?? "").trim().toUpperCase();
}

export function buildNonMgmtMinorCountedCourseCodeSet(minorCodes: string[]): Set<string> {
  const selected = new Set(minorCodes.map(normalizeMinorCode).filter(Boolean));
  const knownSelected = new Set(Array.from(selected).filter((c) => KNOWN_MINOR_CODES.has(c)));
  knownSelected.delete("MGMT");
  knownSelected.delete("MGMT_B24");

  const courseCodes = new Set<string>();
  if (knownSelected.size === 0) return courseCodes;

  for (const minor of MINORS) {
    if (!knownSelected.has(minor.code)) continue;

    for (const group of minor.groups) {
      if (!group.countsTowardMinor) continue;

      for (const rawCode of group.courseCodes) {
        const formatted = formatCourseCode(rawCode);
        if (formatted) courseCodes.add(formatted);
      }
    }
  }

  return courseCodes;
}
