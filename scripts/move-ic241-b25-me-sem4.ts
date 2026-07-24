// move-ic241-b25-me-sem4.ts
// Move IC-241 from semester 3 to semester 4 for Batch 25 (2025) Mechanical (ME)
// students, ONLY for B25 — leave the shared ME mapping (used by B23/B24) untouched.
//
// Mechanism: pre-reg treats a DC/IC course as compulsory-for-this-semester when the
// branch-specific CourseBranchMapping.semester === offeringSemester. B25 ME pre-registers
// for Fall sem 3, so IC-241 (sem=3 on the shared "ME" mapping) currently shows as a
// compulsory sem-3 course. Creating a B25-specific ME mapping with semester=4 makes the
// per-batch picker (batch="2025" scores 0, beats the shared batch="" at 0.5) resolve
// sem=4 for B25 → an even (Spring) semester → dropped from the odd-only Fall pre-reg.
import { PrismaClient, CourseCategoryType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const course = await prisma.course.findFirst({
    where: { code: { in: ["IC-241", "IC241"] } },
    select: { id: true, code: true },
  });
  if (!course) throw new Error("IC-241 course not found");

  // The shared ME mapping we're mirroring (DC, sem 3) — keep it intact for B23/B24.
  const sharedMe = await prisma.courseBranchMapping.findUnique({
    where: { courseId_branch_batch: { courseId: course.id, branch: "ME", batch: "" } },
    select: { courseCategory: true, semester: true },
  });
  console.log(
    `Shared ME mapping (B23/B24, untouched): cat=${sharedMe?.courseCategory} sem=${sharedMe?.semester}`
  );

  const category = sharedMe?.courseCategory ?? CourseCategoryType.DC;

  const result = await prisma.courseBranchMapping.upsert({
    where: { courseId_branch_batch: { courseId: course.id, branch: "ME", batch: "2025" } },
    create: {
      courseId: course.id,
      branch: "ME",
      batch: "2025",
      courseCategory: category,
      semester: 4,
      isRequired: false,
    },
    update: { courseCategory: category, semester: 4 },
    select: { id: true, branch: true, batch: true, courseCategory: true, semester: true },
  });

  console.log(
    `B25 ME mapping now: cat=${result.courseCategory} sem=${result.semester} (id=${result.id})`
  );
  console.log("\nDone. IC-241 is now sem 4 for B25 ME → removed from B25 sem-3 Fall pre-reg.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
