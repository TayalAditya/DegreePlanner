export type TimetableKind = "NON_IC" | "IC";

export type OfficialSlotSession = {
  dayOfWeek: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY";
  startTime: string;
  endTime: string;
};

export type OfficialCourseDefault = {
  code: string;
  name: string;
  credit?: number;
  slot?: string;
  classroom?: string;
  campus?: string;
  kind?: TimetableKind;
  variants?: Array<{ label: string; slot: string; classroom?: string }>;
};

export type OfficialLabAllocation = {
  branches?: string[];
  slot: string;
  day: string;
  venue: string;
  time: string;
  classType?: "LAB" | "TUTORIAL";
};

export type OfficialPcLab = {
  kind: TimetableKind;
  slot?: string;
  day?: string;
  venue?: string;
  time?: string;
  allocations?: OfficialLabAllocation[];
};

export type OfficialTimetableData = {
  version: string;
  venues: string[];
  defaults: {
    nonIc: Record<string, OfficialCourseDefault>;
    ic: Record<string, OfficialCourseDefault>;
  };
  pcLab: Record<string, OfficialPcLab>;
};

export const NON_IC_SLOTS: Record<string, OfficialSlotSession[]> = {
  A: [
    { dayOfWeek: "MONDAY", startTime: "08:00", endTime: "08:50" },
    { dayOfWeek: "TUESDAY", startTime: "11:00", endTime: "11:50" },
    { dayOfWeek: "THURSDAY", startTime: "09:00", endTime: "09:50" },
  ],
  B: [
    { dayOfWeek: "MONDAY", startTime: "09:00", endTime: "09:50" },
    { dayOfWeek: "TUESDAY", startTime: "12:00", endTime: "12:50" },
    { dayOfWeek: "THURSDAY", startTime: "10:00", endTime: "10:50" },
  ],
  C: [
    { dayOfWeek: "MONDAY", startTime: "10:00", endTime: "10:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "08:00", endTime: "08:50" },
    { dayOfWeek: "THURSDAY", startTime: "11:00", endTime: "11:50" },
  ],
  D: [
    { dayOfWeek: "MONDAY", startTime: "11:00", endTime: "11:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "09:00", endTime: "09:50" },
    { dayOfWeek: "THURSDAY", startTime: "12:00", endTime: "12:50" },
  ],
  E: [
    { dayOfWeek: "MONDAY", startTime: "12:00", endTime: "12:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "11:00", endTime: "11:50" },
    { dayOfWeek: "FRIDAY", startTime: "09:00", endTime: "09:50" },
  ],
  F: [
    { dayOfWeek: "TUESDAY", startTime: "08:00", endTime: "08:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "10:00", endTime: "10:50" },
    { dayOfWeek: "FRIDAY", startTime: "11:00", endTime: "11:50" },
  ],
  G: [
    { dayOfWeek: "TUESDAY", startTime: "09:00", endTime: "09:50" },
    { dayOfWeek: "THURSDAY", startTime: "08:00", endTime: "08:50" },
    { dayOfWeek: "FRIDAY", startTime: "10:00", endTime: "10:50" },
  ],
  H: [
    { dayOfWeek: "TUESDAY", startTime: "10:00", endTime: "10:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "12:00", endTime: "12:50" },
    { dayOfWeek: "FRIDAY", startTime: "08:00", endTime: "08:50" },
  ],
};

export const NON_IC_FOURTH_SESSION: Record<string, OfficialSlotSession> = {
  A: { dayOfWeek: "FRIDAY", startTime: "12:00", endTime: "12:50" },
  B: { dayOfWeek: "WEDNESDAY", startTime: "17:00", endTime: "17:50" },
  C: { dayOfWeek: "TUESDAY", startTime: "17:00", endTime: "17:50" },
  E: { dayOfWeek: "THURSDAY", startTime: "17:00", endTime: "17:50" },
  F: { dayOfWeek: "MONDAY", startTime: "17:00", endTime: "17:50" },
};

/**
 * The fourth Non-IC theory meeting represents the tutorial/theory hour of a
 * 4-credit course. A practical component earns that credit in its lab block,
 * so a generic `credits >= 4` check incorrectly creates an extra 5–6 PM
 * lecture for 3-0-2-4 courses.
 */
export function requiresFourthNonIcTheorySession(ltpc?: string | null): boolean {
  const normalized = String(ltpc ?? "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, "");
  return normalized === "3-1-0-4" || normalized === "4-0-0-4";
}

// IC slots from the official Aug–Dec 2026 IC timetable workbook.
export const IC_SLOTS: Record<string, OfficialSlotSession[]> = {
  A: [
    { dayOfWeek: "MONDAY", startTime: "10:00", endTime: "10:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "10:00", endTime: "10:50" },
    { dayOfWeek: "FRIDAY", startTime: "10:00", endTime: "10:50" },
  ],
  B: [
    { dayOfWeek: "TUESDAY", startTime: "10:00", endTime: "10:50" },
    { dayOfWeek: "THURSDAY", startTime: "10:00", endTime: "10:50" },
  ],
  C: [
    { dayOfWeek: "MONDAY", startTime: "11:00", endTime: "11:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "11:00", endTime: "11:50" },
  ],
  D: [
    { dayOfWeek: "TUESDAY", startTime: "11:00", endTime: "11:50" },
    { dayOfWeek: "THURSDAY", startTime: "11:00", endTime: "11:50" },
  ],
  E: [
    { dayOfWeek: "TUESDAY", startTime: "12:00", endTime: "12:50" },
    { dayOfWeek: "THURSDAY", startTime: "12:00", endTime: "12:50" },
    { dayOfWeek: "FRIDAY", startTime: "11:00", endTime: "11:50" },
  ],
  F: [
    { dayOfWeek: "MONDAY", startTime: "12:00", endTime: "12:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "12:00", endTime: "12:50" },
    { dayOfWeek: "FRIDAY", startTime: "12:00", endTime: "12:50" },
  ],
  G: [
    { dayOfWeek: "MONDAY", startTime: "09:00", endTime: "09:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "09:00", endTime: "09:50" },
    { dayOfWeek: "FRIDAY", startTime: "09:00", endTime: "09:50" },
  ],
};

export const LAB_SLOTS: Record<string, OfficialSlotSession[]> = {
  L1: [{ dayOfWeek: "MONDAY", startTime: "14:00", endTime: "17:00" }],
  L2: [{ dayOfWeek: "TUESDAY", startTime: "14:00", endTime: "17:00" }],
  L3: [{ dayOfWeek: "WEDNESDAY", startTime: "14:00", endTime: "17:00" }],
  L4: [{ dayOfWeek: "THURSDAY", startTime: "14:00", endTime: "17:00" }],
  L5: [{ dayOfWeek: "FRIDAY", startTime: "14:00", endTime: "17:00" }],
};

export function normalizeTimetableCourseCode(value: string): string {
  const raw = String(value || "").replace(/_new$/i, "").replace(/_/g, "-").replace(/\s+/g, "").toUpperCase();
  const match = raw.match(/^([A-Z]{1,5})-?(\d{2,4}[A-Z]?P?)$/);
  return match ? `${match[1]}-${match[2]}` : raw;
}

export function extractOfficialSlotTokens(slotRaw: string): string[] {
  const tokens = Array.from(slotRaw.toUpperCase().matchAll(/\b(L[1-5]|[A-H])\b/g), (match) => match[1]);
  return Array.from(new Set(tokens));
}

export function parseOfficialTimeRange(range: string): { startTime: string; endTime: string } | null {
  const match = range.replace(/\s+/g, " ").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return null;
  const period = match[5].toUpperCase();
  const convert = (hour: number) => period === "PM" ? (hour % 12) + 12 : hour % 12;
  const format = (hour: number, minute: number) => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return {
    startTime: format(convert(Number(match[1])), Number(match[2] || 0)),
    endTime: format(convert(Number(match[3])), Number(match[4] || 0)),
  };
}

const DAY_BY_NAME: Record<string, OfficialSlotSession["dayOfWeek"]> = {
  monday: "MONDAY", tuesday: "TUESDAY", wednesday: "WEDNESDAY",
  thursday: "THURSDAY", friday: "FRIDAY", saturday: "SATURDAY",
};

export function canonicalTimetableBranch(branch?: string | null): string {
  const normalized = String(branch ?? "").trim().toUpperCase();
  if (normalized === "BIOE") return "BE";
  if (normalized === "DSE") return "DSAI";
  if (normalized.startsWith("GE-")) return "GE";
  if (normalized === "CS") return "CSE";
  return normalized;
}

function pickVariant(course: OfficialCourseDefault, branch?: string | null) {
  if (!course.variants?.length) return course;
  const normalizedBranch = canonicalTimetableBranch(branch);
  const firstGroup = new Set(["CSE", "EE", "ME", "BE", "EP", "IMBA"]);
  const thirdGroup = new Set(["CSE", "EE", "ME", "BE", "EP", "CH", "CHE"]);
  const desired = course.variants.some((variant) => /batch\s*[34]/i.test(variant.label))
    ? (thirdGroup.has(normalizedBranch) ? 3 : 4)
    : (firstGroup.has(normalizedBranch) ? 1 : 2);
  const variant = course.variants.find((item) => new RegExp(`batch\\s*${desired}`, "i").test(item.label)) ?? course.variants[0];
  return { ...course, slot: variant.slot || course.slot, classroom: variant.classroom || course.classroom };
}

export type BuiltOfficialMeeting = OfficialSlotSession & {
  slot: string;
  venue?: string;
  classType: "LECTURE" | "LAB" | "TUTORIAL";
};

export const OFFICIAL_CORRECTION_PATTERN =
  /^\[OFFICIAL_CORRECTION:([A-Z]+)\|(\d{2}:\d{2})\|(\d{2}:\d{2})\]\s*/;

export function parseOfficialCorrectionNotes(notes?: string | null): {
  replacesOfficial: {
    dayOfWeek: string;
    startTime: string;
    endTime: string;
  };
  userNotes: string;
} | null {
  const match = notes?.match(OFFICIAL_CORRECTION_PATTERN);
  if (!match) return null;
  return {
    replacesOfficial: {
      dayOfWeek: match[1],
      startTime: match[2],
      endTime: match[3],
    },
    userNotes: notes!.slice(match[0].length).trim(),
  };
}

export function withOfficialCorrectionMarker(
  notes: string | null | undefined,
  replacesOfficial: { dayOfWeek: string; startTime: string; endTime: string },
): string {
  const marker =
    `[OFFICIAL_CORRECTION:${replacesOfficial.dayOfWeek}|${replacesOfficial.startTime}|${replacesOfficial.endTime}]`;
  const userNotes = parseOfficialCorrectionNotes(notes)?.userNotes ?? String(notes ?? "").trim();
  return `${marker}${userNotes ? ` ${userNotes}` : ""}`;
}

export function buildOfficialCourseMeetings(
  data: OfficialTimetableData,
  courseCode: string,
  options: {
    credits?: number;
    ltpc?: string | null;
    branch?: string | null;
    batch?: number | null;
    fallbackSlot?: string | null;
    fallbackVenue?: string | null;
    fallbackKind?: TimetableKind;
  } = {},
): BuiltOfficialMeeting[] {
  const code = normalizeTimetableCourseCode(courseCode);
  const rawBatch = Number(options.batch);
  const batchYear = rawBatch > 0 && rawBatch < 100 ? 2000 + rawBatch : rawBatch;
  // HS-112 and HS-342 also appear in the upper-year Non-IC timetable. B26's
  // first-year choices must resolve to the dedicated IC timetable instead.
  const rawDefault = batchYear === 2026
    ? data.defaults.ic[code] ?? data.defaults.nonIc[code]
    : data.defaults.nonIc[code] ?? data.defaults.ic[code];
  const pcLab = data.pcLab[code];
  if (!rawDefault && !pcLab && !options.fallbackSlot) return [];

  const course = rawDefault ? pickVariant(rawDefault, options.branch) : undefined;
  const kind: TimetableKind = course?.kind ?? (data.defaults.ic[code] ? "IC" : pcLab?.kind ?? options.fallbackKind ?? "NON_IC");
  const venue = course?.classroom ?? options.fallbackVenue ?? undefined;
  const meetings: BuiltOfficialMeeting[] = [];
  const tokens = extractOfficialSlotTokens(course?.slot ?? pcLab?.slot ?? options.fallbackSlot ?? "");

  for (const token of tokens) {
    if (/^[A-H]$/.test(token)) {
      const sessions = kind === "IC" ? IC_SLOTS[token] : NON_IC_SLOTS[token];
      for (const session of sessions ?? []) {
        meetings.push({ ...session, slot: token, venue, classType: "LECTURE" });
      }
      const fourth =
        kind === "NON_IC" && requiresFourthNonIcTheorySession(options.ltpc)
          ? NON_IC_FOURTH_SESSION[token]
          : undefined;
      if (fourth) meetings.push({ ...fourth, slot: token, venue, classType: "LECTURE" });
    } else if (/^L[1-5]$/.test(token)) {
      for (const session of LAB_SLOTS[token] ?? []) {
        meetings.push({ ...session, slot: token, venue, classType: "LAB" });
      }
    }
  }

  const branch = canonicalTimetableBranch(options.branch);
  const supplementalAllocations: OfficialLabAllocation[] = pcLab?.allocations?.length
    ? pcLab.allocations.filter(
        (allocation) =>
          !allocation.branches?.length ||
          Boolean(branch && allocation.branches.map(canonicalTimetableBranch).includes(branch)),
      )
    : pcLab?.day && pcLab.time
      ? [{
          slot: pcLab.slot || "PC Lab",
          day: pcLab.day,
          venue: pcLab.venue || venue || "",
          time: pcLab.time,
          classType: "LAB",
        }]
      : [];

  for (const allocation of supplementalAllocations) {
    const dayOfWeek = DAY_BY_NAME[allocation.day.toLowerCase()];
    const range = parseOfficialTimeRange(allocation.time);
    if (dayOfWeek && range) {
      const pcMeeting: BuiltOfficialMeeting = {
        dayOfWeek,
        ...range,
        slot: allocation.slot || pcLab?.slot || "PC Lab",
        venue: allocation.venue || pcLab?.venue || venue,
        classType: allocation.classType || "LAB",
      };
      const duplicateIndex = meetings.findIndex(
        (meeting) =>
          meeting.dayOfWeek === pcMeeting.dayOfWeek &&
          meeting.startTime === pcMeeting.startTime &&
          meeting.classType === pcMeeting.classType,
      );
      if (duplicateIndex >= 0) meetings[duplicateIndex] = pcMeeting;
      else meetings.push(pcMeeting);
    }
  }

  return meetings.sort(
    (a, b) => Object.values(DAY_BY_NAME).indexOf(a.dayOfWeek) - Object.values(DAY_BY_NAME).indexOf(b.dayOfWeek) || a.startTime.localeCompare(b.startTime)
  );
}
