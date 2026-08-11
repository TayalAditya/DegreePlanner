// add-cs304-b24-mnc-sem5.ts
// Introduce CS-304 as a compulsory Semester-5 DC for Batch-24 (2024) MNC students.
//
// Context: CS-304 only had an MNC mapping for batch="2023" (DC, sem 4). B24 MNC
// pre-registers for sem 5 and for a B24 student the batch="2023" mapping scores a
// 1000 penalty in pickCategory → CS-304 falls back to FE and never shows as a
// compulsory DC. B24's curriculum places CS-304 in sem 5, so add a B24-specific
// MNC mapping (batch="2024", DC, semester=5). The offering already has
// eligibleSems=[5,7], compulsorySem=5, a slot and instructor, so this makes it
// appear as a compulsory sem-5 DC for B24 MNC without touching the B23 mapping.
import { PrismaClient, CourseCategoryType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const course = await prisma.course.findFirst({
    where: { code: { in: ["CS-304", "CS304"] } },
    select: { id: true, code: true, credits: true },
  });
  if (!course) throw new Error("CS-304 course not found");

  const existingMnc = await prisma.courseBranchMapping.findMany({
    where: { courseId: course.id, branch: "MNC" },
    select: { batch: true, courseCategory: true, semester: true },
    orderBy: { batch: "asc" },
  });
  console.log(`CS-304 (${course.credits}cr) existing MNC mappings:`);
  for (const m of existingMnc)
    console.log(`  batch="${m.batch}" cat=${m.courseCategory} sem=${m.semester}`);

  const result = await prisma.courseBranchMapping.upsert({
    where: { courseId_branch_batch: { courseId: course.id, branch: "MNC", batch: "2024" } },
    create: {
      courseId: course.id,
      branch: "MNC",
      batch: "2024",
      courseCategory: CourseCategoryType.DC,
      semester: 5,
      isRequired: false,
    },
    update: { courseCategory: CourseCategoryType.DC, semester: 5 },
    select: { id: true, branch: true, batch: true, courseCategory: true, semester: true },
  });

  console.log(
    `\nB24 MNC mapping now: cat=${result.courseCategory} sem=${result.semester} (id=${result.id})`
  );
  console.log("Done. CS-304 is now a compulsory sem-5 DC for B24 MNC (B23 mapping untouched).");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
