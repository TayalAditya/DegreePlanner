/**
 * Fix offeredInFall / offeredInSpring flags in the DB
 * based on the semester-wise xlsx.
 *
 * Run: npx tsx scripts/fix-course-offerings.ts
 */

import * as XLSX from "xlsx";
import path from "path";
import prisma from "../lib/prisma";

const XLSX_PATH = path.join(__dirname, "../docs/Course List semester wise.xlsx");

type CourseRow = Record<string, string | number | undefined>;

async function main() {
  const workbook = XLSX.readFile(XLSX_PATH);

  // Map: courseCode → Set<1 (odd/fall) | 2 (even/spring)>
  const codeToSems: Map<string, Set<number>> = new Map();

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: CourseRow[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const isOddSheet  = /^odd/i.test(sheetName.trim());
    const isEvenSheet = /^even/i.test(sheetName.trim());
    const semNum = isOddSheet ? 1 : isEvenSheet ? 2 : null;
    if (semNum === null) continue;

    for (const row of rows) {
      for (const val of Object.values(row)) {
        if (typeof val === "string") {
          const m = val.trim().match(/^[A-Z]{2,4}-\d{3}[A-Z]?P?$/);
          if (m) {
            const code = m[0];
            if (!codeToSems.has(code)) codeToSems.set(code, new Set());
            codeToSems.get(code)!.add(semNum);
          }
        }
      }
    }
  }

  console.log(`Parsed ${codeToSems.size} course codes from xlsx\n`);

  // Fetch all DB courses
  const dbCourses = await prisma.course.findMany({
    where: { code: { in: [...codeToSems.keys()] } },
    select: { id: true, code: true, offeredInFall: true, offeredInSpring: true },
  });
  const dbMap = new Map(dbCourses.map((c) => [c.code, c]));

  let fixed = 0, skipped = 0;

  for (const [code, sems] of codeToSems) {
    const db = dbMap.get(code);
    if (!db) continue;

    const expFall   = sems.has(1);
    const expSpring = sems.has(2);

    if (db.offeredInFall === expFall && db.offeredInSpring === expSpring) {
      skipped++;
      continue;
    }

    await prisma.course.update({
      where: { id: db.id },
      data: { offeredInFall: expFall, offeredInSpring: expSpring },
    });
    console.log(`  ✅ ${code.padEnd(14)} Fall=${expFall} Spring=${expSpring}`);
    fixed++;
  }

  console.log(`\nDone — ${fixed} updated, ${skipped} already correct`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
