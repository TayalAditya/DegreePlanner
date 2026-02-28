import fs from "node:fs";
import path from "node:path";

import * as XLSX from "xlsx";

import { getAllDefaultCourses } from "../lib/defaultCurriculum";

type ExcelDCCourse = {
  code: string;
  name: string;
  credits: number;
  semester: number;
};

type CourseRef = {
  code: string;
  semester: number;
  credits: number;
};

function normalizeCourseCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, "");
}

function parseSemester(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (value instanceof Date && Number.isFinite(value.valueOf())) {
    // Semester cells like "5/7" sometimes get interpreted as Excel dates.
    // Use the month field as the semester number.
    return value.getMonth() + 1;
  }

  const text = String(value).trim();
  if (!text) return null;

  // Handle values like "5/7", "6/8", "4/6"
  const fractionMatch = text.match(/^(\d{1,2})(?:\s*\/\s*\d{1,2})?$/);
  if (fractionMatch) return Number(fractionMatch[1]);

  const numberValue = Number(text);
  if (Number.isFinite(numberValue)) return numberValue;

  return null;
}

function assertNonNull<T>(value: T | null | undefined, message: string): T {
  if (value == null) throw new Error(message);
  return value;
}

function extractExcelDCCourses(workbook: XLSX.WorkBook, sheetName: string): ExcelDCCourse[] {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) throw new Error(`Missing sheet: ${sheetName}`);

  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as unknown[][];
  const headerRow = rows[0] as unknown[];

  const toHeader = (v: unknown) => String(v ?? "").trim();
  const headers = headerRow.map(toHeader);

  const codeIndex = headers.indexOf("Course Code");
  const nameIndex = headers.indexOf("Course Name");
  const creditsIndex = headers.indexOf("Credits");
  const semesterIndex = headers.indexOf("Semester");

  if (codeIndex < 0 || nameIndex < 0 || creditsIndex < 0 || semesterIndex < 0) {
    throw new Error(
      `Unexpected header row in "${sheetName}". Found: ${JSON.stringify(headers)}`
    );
  }

  const courses: ExcelDCCourse[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rawCode = String(row[codeIndex] ?? "").trim();
    if (!rawCode) continue;

    const rawName = String(row[nameIndex] ?? "").trim();
    const rawCredits = row[creditsIndex];
    const rawSemester = row[semesterIndex];

    const credits = Number(rawCredits);
    if (!Number.isFinite(credits)) {
      throw new Error(`Invalid credits for ${rawCode} in "${sheetName}": ${String(rawCredits)}`);
    }

    const semester = parseSemester(rawSemester);
    if (!semester || !Number.isFinite(semester)) {
      throw new Error(
        `Invalid semester for ${rawCode} in "${sheetName}": ${String(rawSemester)}`
      );
    }

    courses.push({
      code: rawCode,
      name: rawName,
      credits,
      semester,
    });
  }

  return courses;
}

function getDefaultCurriculumDCCourses(branchCode: string): CourseRef[] {
  return getAllDefaultCourses(branchCode, 8)
    .filter((c) => c.category === "DC")
    .map((c) => ({
      code: c.code,
      semester: c.semester,
      credits: c.credits,
    }));
}

function groupByCode(courses: CourseRef[]): Map<string, CourseRef[]> {
  const map = new Map<string, CourseRef[]>();
  for (const course of courses) {
    const key = normalizeCourseCode(course.code);
    const prev = map.get(key) ?? [];
    prev.push(course);
    map.set(key, prev);
  }
  return map;
}

function sumCredits(courses: CourseRef[]): number {
  return courses.reduce((sum, c) => sum + c.credits, 0);
}

const SHEET_TO_BRANCH: Record<string, string> = {
  CSE: "CSE",
  DSE: "DSE",
  EE: "EE",
  EP: "EP",
  ME: "ME",
  MNC: "MNC",
  MSE: "MSE",
  MEVLSI: "MEVLSI",
  "CE (Civil)": "CE",
  "BE (BioEngg)": "BE",
  "BSCS (Chem Sci)": "BSCS",
  "GE (Robotics&AI)": "GERAI",
  "GE (Comm Engg)": "GECE",
  "GE (Mechatronics)": "GEMECH",
};

async function main() {
  const excelPath = path.join(process.cwd(), "docs", "DC_Courses_Batch_2023_filled.xlsx");
  if (!fs.existsSync(excelPath)) {
    throw new Error(`Missing file: ${excelPath}`);
  }

  const workbook = XLSX.readFile(excelPath, { cellDates: true });

  const errors: string[] = [];

  for (const [sheetName, branchCode] of Object.entries(SHEET_TO_BRANCH)) {
    const excelCourses = extractExcelDCCourses(workbook, sheetName).map((c) => ({
      code: c.code,
      semester: c.semester,
      credits: c.credits,
    }));

    const defaultCourses = getDefaultCurriculumDCCourses(branchCode);

    const excelByCode = groupByCode(excelCourses);
    const defaultByCode = groupByCode(defaultCourses);

    for (const [code, list] of excelByCode.entries()) {
      if (list.length > 1) {
        errors.push(`[${branchCode}] Duplicate in Excel for ${code}: ${JSON.stringify(list)}`);
      }
    }
    for (const [code, list] of defaultByCode.entries()) {
      if (list.length > 1) {
        errors.push(
          `[${branchCode}] Duplicate in default curriculum for ${code}: ${JSON.stringify(list)}`
        );
      }
    }

    // Missing / mismatched
    for (const [codeKey, excelList] of excelByCode.entries()) {
      const excel = assertNonNull(excelList[0], "Excel list was unexpectedly empty");
      const defaultList = defaultByCode.get(codeKey);
      if (!defaultList || defaultList.length === 0) {
        errors.push(`[${branchCode}] Missing DC course: ${excel.code} (sem ${excel.semester})`);
        continue;
      }

      const def = assertNonNull(defaultList[0], "Default list was unexpectedly empty");

      if (def.semester !== excel.semester) {
        errors.push(
          `[${branchCode}] Semester mismatch for ${excel.code}: excel=${excel.semester}, default=${def.semester}`
        );
      }
      if (def.credits !== excel.credits) {
        errors.push(
          `[${branchCode}] Credits mismatch for ${excel.code}: excel=${excel.credits}, default=${def.credits}`
        );
      }
    }

    // Extras
    for (const [codeKey, defaultList] of defaultByCode.entries()) {
      const def = assertNonNull(defaultList[0], "Default list was unexpectedly empty");
      if (!excelByCode.has(codeKey)) {
        errors.push(`[${branchCode}] Extra DC course in default curriculum: ${def.code}`);
      }
    }

    const excelTotal = sumCredits(excelCourses);
    const defaultTotal = sumCredits(defaultCourses);
    if (excelTotal !== defaultTotal) {
      errors.push(`[${branchCode}] Total DC credits mismatch: excel=${excelTotal}, default=${defaultTotal}`);
    }
  }

  if (errors.length > 0) {
    console.error(`❌ Default curriculum DC verification failed (${errors.length} issue(s)):\n`);
    for (const err of errors) console.error(`- ${err}`);
    process.exitCode = 1;
    return;
  }

  console.log("✅ Default curriculum DC verification passed for all branches.");
}

main().catch((error) => {
  console.error("❌ Verification script error:", error);
  process.exitCode = 1;
});

