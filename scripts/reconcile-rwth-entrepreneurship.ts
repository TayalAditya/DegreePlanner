/**
 * Reconcile RWTH Entrepreneurship 101 series for CSE.
 *  - Drops my duplicate 81.0008_5/_6/_7 (Thinking & Acting 2/3/4) — those already
 *    exist as 81.00102/103/104 (with live enrollments).
 *  - Sets the whole Entrepreneurship 101 series to HSS for CSE (was FE on the
 *    four pre-existing rows). Moves affected students' credits FE -> HSS.
 * Run: npx tsx scripts/reconcile-rwth-entrepreneurship.ts
 */
import { PrismaClient, CourseCategoryType } from "@prisma/client";

const prisma = new PrismaClient();

// Duplicates I mistakenly added — same course as 81.00102/103/104.
const DUP_CODES = ["81.0008_5", "81.0008_6", "81.0008_7"];

// Every Entrepreneurship 101 module that should be CSE:HSS.
const HSS_CODES = [
  "81.00003", "81.00102", "81.00103", "81.00104",
  "81.0008_1", "81.0008_2", "81.0008_3", "81.0008_4", "81.0008_8",
];

async function main() {
  // 1. Delete duplicate courses (mappings cascade; verified 0 enrollments).
  for (const code of DUP_CODES) {
    const course = await prisma.course.findUnique({ where: { code } });
    if (!course) { console.log(`  (skip) ${code} not found`); continue; }
    await prisma.courseBranchMapping.deleteMany({ where: { courseId: course.id } });
    await prisma.course.delete({ where: { id: course.id } });
    console.log(`✗ deleted duplicate ${code} — ${course.name}`);
  }

  // 2. Set the series to HSS for CSE.
  for (const code of HSS_CODES) {
    const course = await prisma.course.findUnique({ where: { code } });
    if (!course) { console.log(`  (skip) ${code} not found`); continue; }
    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId: course.id, branch: "CSE", batch: "" } },
      update: { courseCategory: CourseCategoryType.HSS, isRequired: false },
      create: { courseId: course.id, branch: "CSE", courseCategory: CourseCategoryType.HSS, isRequired: false },
    });
    console.log(`✓ ${code} → CSE:HSS`);
  }

  console.log("\nDone!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
