/**
 * Add CL courses that are missing from the Course catalog.
 * Scope: 7 genuinely-missing courses (section-splits like HS-108_1 are skipped
 * because their base code HS-108 already exists in the catalog).
 *
 * Values sourced from the official CL (Odd Sem AY 2026-27). department = code
 * prefix, level = first code digit x100, matching the closest existing rows.
 * Also links any existing sem-7/2026 CourseOffering to the new Course row.
 *
 * Run:  npx tsx scripts/add-missing-cl-courses.ts          (dry run)
 *       npx tsx scripts/add-missing-cl-courses.ts --apply  (write)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type NewCourse = {
  code: string;
  name: string;
  credits: number;
  department: string;
  level: number;
  ltpc: string | null;
  isPassFailEligible: boolean;
};

const COURSES: NewCourse[] = [
  { code: "EE-598", name: "Modelling of Dynamical Systems and Identification", credits: 3, department: "EE", level: 500, ltpc: "3-0-0-3", isPassFailEligible: false },
  { code: "IK-101", name: "Sanskrit Language - Level 1", credits: 3, department: "IK", level: 100, ltpc: null, isPassFailEligible: false },
  { code: "MB-392", name: "Management Workshop IV", credits: 1, department: "MB", level: 300, ltpc: null, isPassFailEligible: true },
  // PG / project courses (P-suffix) — pass/fail, no fixed L-T-P-C
  { code: "MV-498P", name: "Major Technical Project - 1", credits: 3, department: "MV", level: 400, ltpc: null, isPassFailEligible: true },
  { code: "CE-690P", name: "Post Graduate Project - 1", credits: 14, department: "CE", level: 600, ltpc: null, isPassFailEligible: true },
  { code: "EE-624P", name: "Post Graduate Project - 1", credits: 15, department: "EE", level: 600, ltpc: null, isPassFailEligible: true },
  { code: "EE-650P", name: "Post Graduate Project - 1", credits: 17, department: "EE", level: 600, ltpc: null, isPassFailEligible: true },
];

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);
  let added = 0, skipped = 0, linked = 0;

  for (const c of COURSES) {
    const existing = await prisma.course.findFirst({ where: { code: c.code } });
    if (existing) {
      console.log(`SKIP  ${c.code} already in catalog`);
      skipped++;
      continue;
    }

    console.log(`ADD   ${c.code.padEnd(9)} ${c.name}  [${c.credits}cr, ${c.department}, L${c.level}${c.isPassFailEligible ? ", P/F" : ""}]`);
    if (APPLY) {
      const created = await prisma.course.create({
        data: {
          code: c.code,
          name: c.name,
          credits: c.credits,
          department: c.department,
          level: c.level,
          ltpc: c.ltpc,
          isPassFailEligible: c.isPassFailEligible,
          offeredInFall: true,
          isActive: true,
        },
        select: { id: true },
      });
      added++;

      // Link the existing sem-7/2026 offering (if any) to this new Course row.
      const link = await prisma.courseOffering.updateMany({
        where: { courseCode: c.code, offeringSemester: 7, offeringYear: 2026, courseId: null },
        data: { courseId: created.id },
      });
      if (link.count > 0) {
        console.log(`      linked ${link.count} offering(s) -> courseId`);
        linked += link.count;
      }
    }
  }

  console.log("\n── Summary ─────────────────────────");
  console.log(`added:   ${added}`);
  console.log(`skipped: ${skipped}`);
  console.log(`offerings linked: ${linked}`);
  console.log(`\n${APPLY ? "Done — written." : "Dry run. Re-run with --apply to write."}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
