import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type CourseDefault = {
  code: string;
  name: string;
  credit?: number;
  slot?: string;
  classroom?: string;
  campus?: string;
};

type PcLabRow = {
  kind: "IC" | "NON_IC";
  code: string;
  name: string;
  instructor?: string;
  slot: string;
  venue: string;
  time: string;
};

function runPdftotextLayout(pdfPath: string): string {
  return execFileSync("pdftotext", ["-layout", pdfPath, "-"], {
    encoding: "utf8",
  });
}

function splitColumns(line: string): string[] {
  return line.trim().split(/\s{2,}/).filter(Boolean);
}

function isCourseCode(maybe: string): boolean {
  return /^[A-Z]{1,4}-\d{2,4}[A-Z]?(?:P)?$/.test(maybe);
}

function parseCourseTablesFromLayout(text: string): Record<string, CourseDefault> {
  const pages = text.split("\f");
  const results: Record<string, CourseDefault> = {};

  for (const page of pages) {
    const lines = page.split(/\r?\n/);
    const headerIndex = lines.findIndex(
      (l) =>
        l.includes("Sr.") &&
        l.includes("Course Code") &&
        l.includes("Course Name") &&
        l.includes("Credit") &&
        l.includes("Slot")
    );
    if (headerIndex === -1) continue;

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const raw = lines[i];
      if (!raw.trim()) continue;
      if (!/^\s*\d+/.test(raw)) continue;

      const cols = splitColumns(raw);
      if (cols.length < 4) continue;

      const srNo = cols[0];
      const code = cols[1];
      if (!isCourseCode(code)) continue;

      const name = cols[2] || "";
      const credit = Number(cols[3]);

      const slot = cols[4];
      const classroom = cols[5];
      const campus = cols[6];

      const entry: CourseDefault = {
        code,
        name,
        ...(Number.isFinite(credit) ? { credit } : {}),
        ...(slot ? { slot: slot.trim() } : {}),
        ...(classroom && classroom !== "-" ? { classroom: classroom.trim() } : {}),
        ...(campus && campus !== "-" ? { campus: campus.trim() } : {}),
      };

      // If slot is just a note, keep it as slot (UI can decide what to do), but
      // also preserve credit/name in any case.
      if (!results[code]) {
        results[code] = entry;
      } else {
        results[code] = { ...results[code], ...entry };
      }

      void srNo;
    }
  }

  return results;
}

function parsePcLabAllocationFromLayout(text: string): Record<string, PcLabRow> {
  const lines = text.split(/\r?\n/);
  const results: Record<string, PcLabRow> = {};

  const timeRegex =
    /(\d{1,2}(?::\d{2})?\s*-\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*$/i;

  let kind: PcLabRow["kind"] | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line === "IC Courses") {
      kind = "IC";
      continue;
    }
    if (line === "Non-IC Courses") {
      kind = "NON_IC";
      continue;
    }
    if (!kind) continue;
    if (line.startsWith("Sr.")) continue;
    if (!/^\d+/.test(line)) continue;

    const prefix = raw.match(/^\s*(\d+)\s+([A-Z]{1,4}-\d{2,4}[A-Z]?(?:P)?)\s+(.*)$/);
    if (!prefix) continue;
    const code = prefix[2];
    if (!isCourseCode(code)) continue;

    const remainder = prefix[3] || "";
    const timeMatch = remainder.match(timeRegex);
    const time = timeMatch ? timeMatch[1].replace(/\s+/g, " ").trim() : "";
    const withoutTime = timeMatch
      ? remainder.slice(0, (timeMatch.index ?? remainder.length)).trim()
      : remainder.trim();

    const parts = withoutTime.split(/\s{2,}/).filter(Boolean);
    if (parts.length < 2) continue;

    const name = parts[0] || "";
    const instructor = parts[1];

    let slot = "";
    let venue = "";
    if (parts.length >= 4) {
      slot = parts[2] || "";
      venue = parts[3] || "";
    } else if (parts.length === 3) {
      const combined = parts[2] || "";
      const slotVenue = combined.match(/^(L\d(?:\s*,\s*L\d)*)\s+(.*)$/i);
      if (slotVenue) {
        slot = slotVenue[1] || "";
        venue = slotVenue[2] || "";
      } else {
        slot = combined;
      }
    }

    results[code] = {
      kind,
      code,
      name,
      ...(instructor ? { instructor } : {}),
      slot: slot.trim(),
      venue: venue.trim(),
      time: time.trim(),
    };
  }

  return results;
}

function normalizeVenue(v: string): string {
  return v.trim().replace(/\s+/g, " ");
}

function main() {
  const root = process.cwd();
  const docsDir = path.join(root, "docs");

  const allCoursesPdf = path.join(docsDir, "Timetable_all_Courses_2026.pdf");
  const icPdf = path.join(docsDir, "Timetable_of_IC_Course_2026.pdf");
  const pcLabPdf = path.join(docsDir, "PC_Lab_Allocation_2026.pdf");

  for (const p of [allCoursesPdf, icPdf, pcLabPdf]) {
    if (!fs.existsSync(p)) {
      throw new Error(`Missing PDF: ${p}`);
    }
  }

  const nonIcText = runPdftotextLayout(allCoursesPdf);
  const icText = runPdftotextLayout(icPdf);
  const pcLabText = runPdftotextLayout(pcLabPdf);

  const nonIcDefaults = parseCourseTablesFromLayout(nonIcText);
  const icDefaults = parseCourseTablesFromLayout(icText);
  const pcLab = parsePcLabAllocationFromLayout(pcLabText);

  const venues = new Map<string, string>();
  const addVenue = (v?: string) => {
    if (!v) return;
    const normalized = normalizeVenue(v);
    if (!normalized || normalized === "-") return;
    const key = normalized.toLowerCase();
    if (!venues.has(key)) venues.set(key, normalized);
  };

  for (const c of Object.values(nonIcDefaults)) addVenue(c.classroom);
  for (const c of Object.values(icDefaults)) addVenue(c.classroom);
  for (const c of Object.values(pcLab)) addVenue(c.venue);

  const output = {
    version: "2025-2026-even",
    generatedAt: new Date().toISOString(),
    sourcePdfs: {
      nonIc: "docs/Timetable_all_Courses_2026.pdf",
      ic: "docs/Timetable_of_IC_Course_2026.pdf",
      pcLab: "docs/PC_Lab_Allocation_2026.pdf",
    },
    venues: Array.from(venues.values()).sort((a, b) => a.localeCompare(b)),
    defaults: {
      nonIc: nonIcDefaults,
      ic: icDefaults,
    },
    pcLab,
  };

  const outPath = path.join(root, "lib", "timetable-autofill-data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(
    `nonIc courses: ${Object.keys(nonIcDefaults).length}, ic courses: ${Object.keys(icDefaults).length}, pcLab: ${Object.keys(pcLab).length}`
  );
  console.log(`venues: ${output.venues.length}`);
}

main();
