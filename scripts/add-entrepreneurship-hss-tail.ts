/**
 * Re-add the HSS versions of Entrepreneurship 101 "Thinking & Acting 2/3/4"
 * as 81.0008_5/_6/_7 (CSE:HSS). These intentionally coexist with the pre-existing
 * FE rows 81.00102/103/104 — the FE rows preserve existing enrollments (b23166),
 * while the HSS set is the categorization for future students.
 * Run: npx tsx scripts/add-entrepreneurship-hss-tail.ts
 */
import { PrismaClient, CourseCategoryType } from "@prisma/client";

const prisma = new PrismaClient();

const rwthDescription =
  "Available via Semester Exchange (RWTH Aachen) only. Can be taken in Semester 5, 6 or 7.";

const courses = [
  { code: "81.0008_5", name: "Entrepreneurship 101 - Thinking & Acting Like an Entrepreneur 2" },
  { code: "81.0008_6", name: "Entrepreneurship 101 - Thinking & Acting Like an Entrepreneur 3" },
  { code: "81.0008_7", name: "Entrepreneurship 101 - Thinking & Acting Like an Entrepreneur 4" },
];

async function main() {
  for (const c of courses) {
    const course = await prisma.course.upsert({
      where: { code: c.code },
      update: { name: c.name, credits: 0.666667 },
      create: {
        code: c.code,
        name: c.name,
        credits: 0.666667,
        department: "RWTH Aachen (Semester Exchange)",
        level: 100,
        description: rwthDescription,
        offeredInFall: true,
        offeredInSpring: true,
        isActive: true,
      },
    });

    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId: course.id, branch: "CSE", batch: "" } },
      update: { courseCategory: CourseCategoryType.HSS, isRequired: false },
      create: { courseId: course.id, branch: "CSE", courseCategory: CourseCategoryType.HSS, isRequired: false },
    });

    console.log(`✓ ${c.code} ${c.name} (0.666667 cr) → CSE:HSS`);
  }
  console.log("\nDone!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
