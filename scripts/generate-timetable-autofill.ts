import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

type TimetableKind = "IC" | "NON_IC";

type CourseDefault = {
  code: string;
  name: string;
  credit?: number;
  slot?: string;
  classroom?: string;
  campus?: string;
  kind: TimetableKind;
  meetings?: Array<{
    dayOfWeek: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY";
    startTime: string;
    endTime: string;
  }>;
  variants?: Array<{ label: string; slot: string; classroom?: string }>;
};

type LabAllocation = {
  branches?: string[];
  slot: string;
  day: string;
  venue: string;
  time: string;
  classType?: "LAB" | "TUTORIAL";
};

type PcLabRow = {
  kind: TimetableKind;
  code: string;
  name: string;
  instructor?: string;
  slot?: string;
  day?: string;
  venue?: string;
  time?: string;
  allocations?: LabAllocation[];
};

const SOURCE = path.join("docs", "CL 2026-27 Odd", "Final Time Table Aug-Nov 2026.xlsx");

// These PC-lab meetings were published separately from the workbook's Lab Slot
// table. Keep them as explicit source overrides so regenerating the official
// timetable never drops a confirmed meeting.
const PUBLISHED_PC_LAB_OVERRIDES: PcLabRow[] = [
  {
    kind: "NON_IC",
    code: "ME-620",
    name: "Modelling and Simulations",
    instructor: "Dr. Mohammad Talha",
    slot: "PC Lab",
    day: "Wednesday",
    venue: "A5 PC Lab-1",
    time: "02:00-05:00 PM",
  },
];

// Confirmed venue corrections published after the workbook export. The
// first-year IC timetable is a separate published schedule; its rooms take
// precedence for B26's common first-year courses.
const PUBLISHED_CLASSROOM_OVERRIDES: Record<string, string> = {
  "IC-131": "A11-1A",
  "IC-136": "A18-1",
  "IC-230": "A18-2",
  "IC-181": "A18-1",
  "IC-182": "A18-2",
  "IC-272": "Auditorium",
};

// Confirmed additions and corrections from the published Fall 2026 course
// list. Keep this adjacent to the workbook-derived defaults so subsequent
// regenerations retain updates issued after the workbook export.
const PUBLISHED_NON_IC_COURSE_OVERRIDES: Record<string, CourseDefault> = {
  "ME-515": {
    code: "ME-515",
    name: "Carbon Materials and Technology",
    credit: 3,
    slot: "Free Slot",
    kind: "NON_IC",
  },
  "HS-304": {
    code: "HS-304",
    name: "Organizational Management",
    credit: 3,
    slot: "NS",
    kind: "NON_IC",
  },
  "CS-685": {
    code: "CS-685",
    name: "Natural Language Processing",
    credit: 3,
    slot: "D",
    classroom: "A5-3",
    campus: "South Campus",
    kind: "NON_IC",
  },
  "EE-512": {
    code: "EE-512",
    name: "CMOS Analog IC Design",
    credit: 4,
    slot: "D",
    classroom: "A17-2B",
    campus: "North Campus",
    kind: "NON_IC",
  },
  "VL-404": {
    code: "VL-404",
    name: "CMOS Analog IC Design",
    credit: 4,
    slot: "D",
    classroom: "A17-2B",
    campus: "North Campus",
    kind: "NON_IC",
  },
  "BE-303": {
    code: "BE-303",
    name: "Applied Biostatistics",
    credit: 4,
    slot: "F",
    classroom: "A10-1B",
    campus: "North Campus",
    kind: "NON_IC",
  },
  "CE-303": {
    code: "CE-303",
    name: "Water Resources Engineering",
    credit: 3,
    slot: "H",
    classroom: "A10-1B",
    campus: "North Campus",
    kind: "NON_IC",
  },
  "HS-529": {
    code: "HS-529",
    name: "Natural Resource and Development",
    credit: 3,
    slot: "H",
    classroom: "A5-4",
    campus: "South Campus",
    kind: "NON_IC",
  },
  "ME-212": {
    code: "ME-212",
    name: "Product Manufacturing Technology",
    credit: 3,
    slot: "C",
    classroom: "A11-1B",
    campus: "North Campus",
    kind: "NON_IC",
  },
  "ME-530": {
    code: "ME-530",
    name: "Continuum Mechanics",
    credit: 3,
    slot: "H",
    classroom: "A10-3B",
    campus: "North Campus",
    kind: "NON_IC",
  },
  "EE-594": {
    code: "EE-594",
    name: "Modelling of Dynamical Systems and Identification",
    credit: 3,
    slot: "D",
    classroom: "A17-2D",
    campus: "North Campus",
    kind: "NON_IC",
    meetings: [
      { dayOfWeek: "TUESDAY", startTime: "17:00", endTime: "18:30" },
      { dayOfWeek: "THURSDAY", startTime: "12:00", endTime: "12:50" },
    ],
  },
  "EE-595": {
    code: "EE-595",
    name: "Photonics Computing",
    credit: 3,
    slot: "F",
    classroom: "A17-2D",
    campus: "North Campus",
    kind: "NON_IC",
  },
  "BY-538": {
    code: "BY-538",
    name: "Biomedical Instrumentation and Diagnostic Technologies",
    credit: 3,
    slot: "H",
    classroom: "CL-3",
    campus: "South Campus",
    kind: "NON_IC",
  },
};

// HS-108 is offered to B26 in two individually allocated English sections.
// They are not in the general workbook's IC table, so keep the first-year
// schedule's section codes and classrooms as explicit published overrides.
const PUBLISHED_IC_COURSE_OVERRIDES: Record<string, CourseDefault> = {
  "HS-108-1": {
    code: "HS-108-1",
    name: "Basic English for Engineers - Section 1",
    credit: 3,
    slot: "G",
    classroom: "A11-1A",
    campus: "North Campus",
    kind: "IC",
  },
  "HS-108-2": {
    code: "HS-108-2",
    name: "Basic English for Engineers - Section 2",
    credit: 3,
    slot: "G",
    classroom: "A18-1",
    campus: "North Campus",
    kind: "IC",
  },
};

// The same first-year timetable also supersedes the generic IC workbook's
// language-room rows for B26.
const PUBLISHED_IC_CLASSROOM_OVERRIDES: Record<string, string> = {
  "HS-112": "A18-2",
  "HS-342": "A11-1B",
  "IK-101": "A17-2A",
};

// The first-year schedule publishes IC-181 in a single room for every branch;
// it is not split into the Batch-1/Batch-2 lecture groups.
const PUBLISHED_IC_NO_VARIANT_OVERRIDES = new Set(["IC-181"]);

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanVenue(value: unknown): string {
  return String(value ?? "")
    .replace(/\s*\r?\n\s*/g, " + ")
    .replace(/\s+/g, " ")
    .replace(/\bPractum\b/gi, "Practicum")
    .trim();
}

function normalizeCode(value: unknown): string {
  const raw = String(value ?? "")
    .trim()
    .replace(/_new$/i, "")
    .replace(/_/g, "-")
    .toUpperCase();
  const compact = raw.replace(/\s+/g, "");
  const match = compact.match(/^([A-Z]{1,5})-?(\d{2,4}[A-Z]?P?)(-\d+Y?)?$/);
  return match ? `${match[1]}-${match[2]}${match[3] ?? ""}` : compact;
}

function extractCourseCodes(value: unknown): string[] {
  return String(value ?? "")
    .split(/\r?\n/)
    .map(normalizeCode)
    .filter(isCourseCode);
}

function isCourseCode(value: unknown): boolean {
  return /^[A-Z]{1,5}-\d{2,4}[A-Z]?P?(?:-\d+Y?)?$/.test(normalizeCode(value));
}

function normalizeSlot(value: unknown): string | undefined {
  const raw = clean(value).toUpperCase();
  if (!raw || raw === "NO SLOT" || raw === "NS") return undefined;
  const lab = raw.match(/LAB\s*SLOT\s*[- ]?(\d)/);
  if (lab) return `L${lab[1]}`;
  const free = raw.match(/FREE\s*SLOT\s*[- ]?(\d)/);
  if (free) return `FS${free[1]}`;
  const slot = raw.match(/(?:^|\b)SLOT\s*[- ]?([A-H])\b/) ?? raw.match(/^([A-H])$/);
  if (slot) return slot[1];
  return raw;
}

function cellValue(sheet: XLSX.WorkSheet, row: number, column: number): unknown {
  const address = XLSX.utils.encode_cell({ r: row - 1, c: column - 1 });
  const direct = sheet[address]?.v;
  if (direct !== undefined && direct !== null && direct !== "") return direct;

  const merges = (sheet["!merges"] ?? []) as XLSX.Range[];
  const target = { r: row - 1, c: column - 1 };
  const merge = merges.find(
    (range) =>
      target.r >= range.s.r && target.r <= range.e.r &&
      target.c >= range.s.c && target.c <= range.e.c
  );
  if (!merge) return direct;
  return sheet[XLSX.utils.encode_cell(merge.s)]?.v;
}

function canonicalSourceBranch(value: unknown): string | undefined {
  const branch = clean(value).toUpperCase();
  if (!branch) return undefined;
  if (/COMPUTER SCIENCE/.test(branch)) return "CSE";
  if (/DATA SCIENCE/.test(branch)) return "DSAI";
  if (/MATHEMATICS.*COMPUTING/.test(branch)) return "MNC";
  if (/MICROELECTRONICS|VLSI/.test(branch)) return "MEVLSI";
  if (/MATERIALS SCIENCE/.test(branch)) return "MSE";
  if (/BS CHEMICAL|CHEMICAL SCIENCES/.test(branch)) return "BSCS";
  if (/CHEMICAL ENG/.test(branch)) return "CHE";
  if (/BIO/.test(branch)) return "BE";
  if (/ELECTRICAL/.test(branch)) return "EE";
  if (/CIVIL/.test(branch)) return "CE";
  if (/ENGINEERING PHYSICS|ENGG PHYSICS/.test(branch)) return "EP";
  if (/MECHANICAL|MECH ENG/.test(branch)) return "ME";
  if (/GENERAL ENG/.test(branch)) return "GE";
  if (/QUANTUM/.test(branch)) return "QS";
  if (/AGRICULTURAL/.test(branch)) return "AG";
  if (/IMBA/.test(branch)) return "IMBA";
  return undefined;
}

function branchList(value: unknown): string[] {
  return Array.from(
    new Set(
      String(value ?? "")
        .split("+")
        .map(canonicalSourceBranch)
        .filter((branch): branch is string => Boolean(branch)),
    ),
  );
}

function main() {
  const root = process.cwd();
  const sourcePath = path.join(root, SOURCE);
  if (!fs.existsSync(sourcePath)) throw new Error(`Missing workbook: ${sourcePath}`);

  const workbook = XLSX.readFile(sourcePath);
  const nonIcSheet = workbook.Sheets["Non IC Course Time Table"];
  const icSheet = workbook.Sheets["IC Course Time Table"];
  const labSheet = workbook.Sheets["Lab Slot"];
  if (!nonIcSheet || !icSheet || !labSheet) throw new Error("Expected timetable sheets were not found");

  const nonIc: Record<string, CourseDefault> = {};
  const ic: Record<string, CourseDefault> = {};
  const pcLab: Record<string, PcLabRow> = {};
  const venues = new Map<string, string>();
  const addVenue = (value: unknown) => {
    const venue = cleanVenue(value);
    if (!venue || venue === "-") return;
    if (!venues.has(venue.toLowerCase())) venues.set(venue.toLowerCase(), venue);
  };

  const nonIcRange = XLSX.utils.decode_range(nonIcSheet["!ref"] ?? "A1:A1");
  for (let row = 12; row <= nonIcRange.e.r + 1; row++) {
    const codes = extractCourseCodes(cellValue(nonIcSheet, row, 1));
    if (codes.length === 0) continue;
    const name = clean(cellValue(nonIcSheet, row, 2));
    const credit = Number(cellValue(nonIcSheet, row, 3));
    const slot = normalizeSlot(cellValue(nonIcSheet, row, 5));
    const classroom = clean(cellValue(nonIcSheet, row, 6));
    const campus = clean(cellValue(nonIcSheet, row, 7));
    if (classroom) addVenue(classroom);
    for (const code of codes) {
      nonIc[code] = {
        code,
        name,
        ...(Number.isFinite(credit) ? { credit } : {}),
        ...(slot ? { slot } : {}),
        ...(classroom ? { classroom } : {}),
        ...(campus ? { campus } : {}),
        kind: "NON_IC",
      };
    }
  }

  const icRange = XLSX.utils.decode_range(icSheet["!ref"] ?? "A1:A1");
  for (let row = 11; row <= icRange.e.r + 1; row++) {
    const rawCode = cellValue(icSheet, row, 2);
    const code = clean(rawCode).toUpperCase() === "CED" ? "CED-201" : normalizeCode(rawCode);
    if (!isCourseCode(code)) continue;
    const name = clean(cellValue(icSheet, row, 3));
    const credit = Number(cellValue(icSheet, row, 4));
    const rawSlot = clean(icSheet[XLSX.utils.encode_cell({ r: row - 1, c: 4 })]?.v ?? cellValue(icSheet, row, 5));
    const slot = normalizeSlot(rawSlot) ?? (row >= 27 && row <= 29 ? "G" : undefined);
    const classroom = clean(icSheet[XLSX.utils.encode_cell({ r: row - 1, c: 5 })]?.v ?? cellValue(icSheet, row, 6));
    const campus = clean(cellValue(icSheet, row, 7));
    const usesNonIc = /non-ic course time table/i.test(rawSlot);
    const target = usesNonIc ? nonIc : ic;
    const kind: TimetableKind = usesNonIc ? "NON_IC" : "IC";
    if (classroom) addVenue(classroom);

    const current: CourseDefault = target[code] ?? {
      code,
      name,
      ...(Number.isFinite(credit) ? { credit } : {}),
      ...(slot ? { slot } : {}),
      ...(classroom ? { classroom } : {}),
      ...(campus ? { campus } : {}),
      kind,
    };

    const directSlot = clean(icSheet[XLSX.utils.encode_cell({ r: row - 1, c: 4 })]?.v);
    if (/batch\s*\d/i.test(directSlot)) {
      const variantSlot = normalizeSlot(directSlot);
      current.variants = current.variants ?? [];
      current.variants.push({
        label: directSlot.match(/batch\s*\d/i)?.[0] ?? directSlot,
        slot: variantSlot ?? current.slot ?? "",
        ...(classroom ? { classroom } : {}),
      });
    }
    target[code] = current;
  }

  // The workbook uses section/year suffixes (for example HS-202_2_New),
  // while CourseOffering often stores the base code (HS-202). Add a base-code
  // alias only when it cannot shadow a distinct plain IC/non-IC course.
  for (const [code, course] of Object.entries({ ...nonIc })) {
    const sectionMatch = code.match(/^([A-Z]{1,5}-\d{2,4}[A-Z]?P?)-\d+Y?$/);
    const baseCode = sectionMatch?.[1];
    if (!baseCode || nonIc[baseCode] || ic[baseCode]) continue;
    nonIc[baseCode] = { ...course, code: baseCode };
  }

  // Non-IC PC labs have explicit day/time/venue and supplement lecture slots.
  const labRange = XLSX.utils.decode_range(labSheet["!ref"] ?? "A1:A1");
  for (let row = 14; row <= labRange.e.r + 1; row++) {
    const code = normalizeCode(cellValue(labSheet, row, 2));
    if (!isCourseCode(code)) continue;
    const day = clean(cellValue(labSheet, row, 4));
    const time = clean(cellValue(labSheet, row, 5));
    const venue = cleanVenue(cellValue(labSheet, row, 7));
    const slot = nonIc[code]?.slot?.match(/^L[1-5]$/) ? nonIc[code].slot! : "";
    addVenue(venue);
    pcLab[code] = {
      kind: "NON_IC",
      code,
      name: clean(cellValue(labSheet, row, 3)),
      instructor: clean(cellValue(labSheet, row, 6)) || undefined,
      slot,
      day,
      venue,
      time,
    };
  }

  // IC labs/tutorials are allocated by branch group in the workbook rather
  // than by ordinary L1-L5 tokens. Preserve the branch allocation so each
  // student sees only their own published meeting.
  const branchesByGroup = new Map<string, string[]>();
  const addGroupBranch = (groupValue: unknown, branchValue: unknown) => {
    const group = clean(groupValue).toUpperCase().replace(/[\s-]+/g, "");
    const branch = canonicalSourceBranch(branchValue);
    if (!group || !branch) return;
    branchesByGroup.set(group, Array.from(new Set([...(branchesByGroup.get(group) ?? []), branch])));
  };

  for (let row = 22; row <= 37; row++) {
    addGroupBranch(cellValue(labSheet, row, 4), cellValue(labSheet, row, 1));
    addGroupBranch(cellValue(labSheet, row, 9), cellValue(labSheet, row, 6));
  }
  for (let row = 3; row <= 6; row++) {
    const group = clean(cellValue(icSheet, row, 10)).toUpperCase().replace(/[\s-]+/g, "");
    const branches = branchList(cellValue(icSheet, row, 11));
    if (group && branches.length > 0) branchesByGroup.set(group, branches);
  }

  const icLabNames: Record<string, string> = {
    "IC-140": "Graphics for Design",
    "IC-152": "Introduction to Python and Data Science",
    "IC-202P": "Design Practicum",
    "IC-222P": "Physics Practicum/Practicals",
  };
  for (const courseColumn of [2, 4, 6, 8]) {
    const header = clean(cellValue(labSheet, 2, courseColumn));
    const code = normalizeCode(header.match(/[A-Z]{1,5}-\d{2,4}[A-Z]?P?/i)?.[0] ?? header);
    if (!isCourseCode(code)) continue;
    const time = clean(cellValue(labSheet, 3, courseColumn));
    const allocations: LabAllocation[] = [];

    for (let row = 4; row <= 9; row++) {
      const slot = clean(
        labSheet[XLSX.utils.encode_cell({ r: row - 1, c: courseColumn - 1 })]?.v,
      );
      if (!slot || /^none$/i.test(slot)) continue;
      const day = clean(cellValue(labSheet, row, 1));
      const venue = cleanVenue(
        labSheet[XLSX.utils.encode_cell({ r: row - 1, c: courseColumn })]?.v,
      );
      if (!day || !time) continue;
      const groupKey = slot.toUpperCase().replace(/[\s-]+/g, "");
      const branches = branchesByGroup.get(groupKey);
      allocations.push({
        ...(branches?.length ? { branches } : {}),
        slot,
        day,
        venue,
        time,
        ...(code === "IC-140" ? { classType: "TUTORIAL" as const } : {}),
      });
      addVenue(venue);
    }

    if (allocations.length === 0) continue;
    const uniqueVenues = Array.from(new Set(allocations.map((allocation) => allocation.venue).filter(Boolean)));
    pcLab[code] = {
      kind: "IC",
      code,
      name: ic[code]?.name || icLabNames[code] || code,
      slot: allocations.map((allocation) => allocation.slot).join(", "),
      ...(uniqueVenues.length === 1 ? { venue: uniqueVenues[0] } : {}),
      time,
      allocations,
    };
  }

  for (const override of PUBLISHED_PC_LAB_OVERRIDES) {
    pcLab[override.code] = override;
    if (override.venue) addVenue(override.venue);
  }

  for (const [code, course] of Object.entries(PUBLISHED_NON_IC_COURSE_OVERRIDES)) {
    nonIc[code] = course;
    if (course.classroom) addVenue(course.classroom);
  }

  for (const [code, classroom] of Object.entries(PUBLISHED_CLASSROOM_OVERRIDES)) {
    const course = nonIc[code] ?? ic[code];
    if (!course) throw new Error(`Missing timetable course for published venue correction: ${code}`);
    course.classroom = classroom;
    addVenue(classroom);
  }
  for (const [code, course] of Object.entries(PUBLISHED_IC_COURSE_OVERRIDES)) {
    ic[code] = course;
    if (course.classroom) addVenue(course.classroom);
  }
  for (const [code, classroom] of Object.entries(PUBLISHED_IC_CLASSROOM_OVERRIDES)) {
    const course = ic[code];
    if (!course) throw new Error(`Missing IC timetable course for published venue correction: ${code}`);
    course.classroom = classroom;
    addVenue(classroom);
  }
  for (const code of PUBLISHED_IC_NO_VARIANT_OVERRIDES) {
    const course = ic[code];
    if (!course) throw new Error(`Missing timetable course for published variant correction: ${code}`);
    delete course.variants;
  }

  const output = {
    version: "2026-2027-odd",
    generatedAt: new Date().toISOString(),
    sourceWorkbook: SOURCE.replace(/\\/g, "/"),
    venues: Array.from(venues.values()).sort((a, b) => a.localeCompare(b)),
    defaults: { nonIc, ic },
    pcLab,
  };

  const outPath = path.join(root, "lib", "timetable-autofill-data.json");
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(`non-IC: ${Object.keys(nonIc).length}, IC: ${Object.keys(ic).length}, PC labs: ${Object.keys(pcLab).length}`);
  console.log(`venues: ${output.venues.length}`);
}

main();
