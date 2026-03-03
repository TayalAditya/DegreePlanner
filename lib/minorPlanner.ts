import { MINORS } from "@/lib/minors";
import { formatCourseCode } from "@/lib/utils";

export const MANAGEMENT_MINOR_CODE = "MGMT";

const KNOWN_MINOR_CODES = new Set(MINORS.map((m) => m.code));

export function buildNonMgmtMinorCountedCourseCodeSet(minorCodes: string[]): Set<string> {
  const selected = new Set(minorCodes.filter((c) => KNOWN_MINOR_CODES.has(c)));
  selected.delete(MANAGEMENT_MINOR_CODE);

  const courseCodes = new Set<string>();
  if (selected.size === 0) return courseCodes;

  for (const minor of MINORS) {
    if (!selected.has(minor.code)) continue;

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

