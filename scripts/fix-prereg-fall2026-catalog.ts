/**
 * Applies confirmed Fall 2026 pre-registration catalogue corrections:
 * - DS-413 is the Sem-5 DC for DSE students in batches 2023 and 2024.
 * - CS-669 remains an optional DE for those batches.
 * - Japanese Language III and IV were withdrawn and must not be offered.
 *
 * Run with: npx tsx scripts/fix-prereg-fall2026-catalog.ts
 */
import { CourseCategoryType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function requireCourse(code: string) {
  const course = await prisma.course.findUnique({ where: { code } });
  if (!course) throw new Error(`Course ${code} was not found.`);
  return course;
}

async function main() {
  const [ds413, cs669] = await Promise.all([
    requireCourse("DS-413"),
    requireCourse("CS-669"),
  ]);

  for (const batch of ["2023", "2024"]) {
    await prisma.courseBranchMapping.upsert({
      where: {
        courseId_branch_batch: {
          courseId: ds413.id,
          branch: "DSE",
          batch,
        },
      },
      create: {
        courseId: ds413.id,
        branch: "DSE",
        batch,
        courseCategory: CourseCategoryType.DC,
        semester: 5,
        isRequired: true,
      },
      update: {
        courseCategory: CourseCategoryType.DC,
        semester: 5,
        isRequired: true,
      },
    });

    await prisma.courseBranchMapping.upsert({
      where: {
        courseId_branch_batch: {
          courseId: cs669.id,
          branch: "DSE",
          batch,
        },
      },
      create: {
        courseId: cs669.id,
        branch: "DSE",
        batch,
        courseCategory: CourseCategoryType.DE,
        semester: null,
        isRequired: false,
      },
      update: {
        courseCategory: CourseCategoryType.DE,
        semester: null,
        isRequired: false,
      },
    });
  }

  const withdrawn = await prisma.courseOffering.updateMany({
    where: {
      courseCode: { in: ["HS-310", "HS-405"] },
      offeringSemester: 7,
      offeringYear: 2026,
      isActive: true,
    },
    data: { isActive: false },
  });

  console.log("Updated DSE mappings for DS-413 and CS-669.");
  console.log(`Withdrew ${withdrawn.count} Japanese III/IV Fall 2026 offering(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
