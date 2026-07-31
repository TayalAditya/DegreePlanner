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
