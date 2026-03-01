/**
 * Verify that courses in the DB have correct offeredInFall/offeredInSpring flags
 * by comparing against the semester-wise course list xlsx.
 *
 * Rules:
 *   Odd semesters (1,3,5,7)  → Fall
 *   Even semesters (2,4,6,8) → Spring
 *
 * A course that appears only in odd sems  → should have offeredInFall=true,  offeredInSpring=false
 * A course that appears only in even sems → should have offeredInFall=false, offeredInSpring=true
 * A course that appears in both           → should have offeredInFall=true,  offeredInSpring=true
 *
 * Run: npx tsx scripts/verify-course-offerings.ts
 */

import * as XLSX from "xlsx";
import path from "path";
import prisma from "../lib/prisma";

const XLSX_PATH = path.join(__dirname, "../docs/Course List semester wise.xlsx");

type CourseRow = Record<string, string | number | undefined>;

async function main() {
  // ── 1. Parse xlsx ─────────────────────────────────────────────────────────
  const workbook = XLSX.readFile(XLSX_PATH);
  console.log("Sheets:", workbook.SheetNames);

  // Map: courseCode → Set of semester numbers
  const codeToSems: Map<string, Set<number>> = new Map();

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: CourseRow[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    // Detect fall/spring from sheet name prefix "Odd ..." / "Even ..."
    const isOddSheet  = /^odd/i.test(sheetName.trim());
    const isEvenSheet = /^even/i.test(sheetName.trim());
    // Use a representative semester number for the parity type
    const semNum = isOddSheet ? 1 : isEvenSheet ? 2 : null;

    for (const row of rows) {
      // Find course code in any column — typically looks like "CS-101", "EE-201"
      for (const val of Object.values(row)) {
        if (typeof val === "string") {
          const codeMatch = val.trim().match(/^[A-Z]{2,4}-\d{3}[A-Z]?P?$/);
          if (codeMatch) {
            const code = codeMatch[0];
            if (!codeToSems.has(code)) codeToSems.set(code, new Set());
            if (semNum !== null) {
              codeToSems.get(code)!.add(semNum);
            }
          }
        }
      }
    }
  }

  console.log(`\nFound ${codeToSems.size} unique course codes in xlsx\n`);

  if (codeToSems.size === 0) {
    console.log("⚠️  Could not extract any course codes. Check the xlsx structure.");
    console.log("   Showing first sheet column headers:");
    const first = workbook.Sheets[workbook.SheetNames[0]];
    const rows: CourseRow[] = XLSX.utils.sheet_to_json(first, { defval: "" });
    if (rows[0]) console.log("  ", Object.keys(rows[0]));
    if (rows[1]) console.log("  Sample row:", rows[1]);
    await prisma.$disconnect();
    return;
  }

  // ── 2. Determine expected flags from xlsx ──────────────────────────────────
  const expected: Map<string, { fall: boolean; spring: boolean }> = new Map();

  for (const [code, sems] of codeToSems) {
    const hasOdd  = [...sems].some((s) => s % 2 === 1);
    const hasEven = [...sems].some((s) => s % 2 === 0);
    expected.set(code, { fall: hasOdd, spring: hasEven });
  }

  // ── 3. Fetch actual flags from DB ──────────────────────────────────────────
  const codes = [...codeToSems.keys()];
  const dbCourses = await prisma.course.findMany({
    where: { code: { in: codes } },
    select: { code: true, name: true, offeredInFall: true, offeredInSpring: true },
  });

  const dbMap = new Map(dbCourses.map((c) => [c.code, c]));

  // ── 4. Report ──────────────────────────────────────────────────────────────
  const mismatches: { code: string; name: string; xlsxSems: string; expected: string; actual: string }[] = [];
  const notInDb: string[] = [];

  for (const [code, exp] of expected) {
    const db = dbMap.get(code);
    if (!db) {
      notInDb.push(code);
      continue;
    }
    if (db.offeredInFall !== exp.fall || db.offeredInSpring !== exp.spring) {
      const sems = [...(codeToSems.get(code) || [])].sort((a, b) => a - b);
      mismatches.push({
        code,
        name: db.name,
        xlsxSems: sems.join(", "),
        expected: `Fall=${exp.fall} Spring=${exp.spring}`,
        actual:   `Fall=${db.offeredInFall} Spring=${db.offeredInSpring}`,
      });
    }
  }

  if (mismatches.length === 0 && notInDb.length === 0) {
    console.log("✅ All courses match! No mismatches found.");
  } else {
    if (mismatches.length > 0) {
      console.log(`⚠️  ${mismatches.length} mismatched courses:\n`);
      console.log(`${"Code".padEnd(14)} ${"Xlsx Sems".padEnd(12)} ${"Expected".padEnd(26)} ${"Actual".padEnd(26)} Name`);
      console.log("─".repeat(110));
      for (const m of mismatches) {
        console.log(`${m.code.padEnd(14)} ${m.xlsxSems.padEnd(12)} ${m.expected.padEnd(26)} ${m.actual.padEnd(26)} ${m.name}`);
      }
    }
    if (notInDb.length > 0) {
      console.log(`\n⚠️  ${notInDb.length} course codes in xlsx but NOT in DB:\n  ${notInDb.join(", ")}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
