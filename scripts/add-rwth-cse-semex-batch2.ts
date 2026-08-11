/**
 * RWTH Aachen — additional Semester Exchange courses (CSE branch).
 * Adds new courses + CourseBranchMapping for CSE and reconciles a couple of
 * existing courses' names.
 * Run: npx tsx scripts/add-rwth-cse-semex-batch2.ts
 */
import { PrismaClient, CourseCategoryType } from "@prisma/client";

const prisma = new PrismaClient();

const rwthDescription =
  "Available via Semester Exchange (RWTH Aachen) only. Can be taken in Semester 5, 6 or 7.";

// New courses. The 81.0008 Entrepreneurship modules share one base code at RWTH
// but are distinct courses, so we suffix _1.._8 to keep unique course codes.
const rwthCourses: {
  code: string;
  name: string;
  credits: number;
  category: CourseCategoryType;
  level: number;
}[] = [
  { code: "12.01221", name: "Basic Techniques in Computer Graphics", credits: 4.666667, category: CourseCategoryType.DE, level: 300 },
  { code: "40.22",    name: "Quantum Computing for Engineering",     credits: 4,        category: CourseCategoryType.DE, level: 300 },

  { code: "81.0008_1", name: "Entrepreneurship 101 - Getting to Market 1",                          credits: 0.666667, category: CourseCategoryType.HSS, level: 100 },
  { code: "81.0008_2", name: "Entrepreneurship 101 - Getting to Market 2",                          credits: 0.666667, category: CourseCategoryType.HSS, level: 100 },
  { code: "81.0008_3", name: "Entrepreneurship 101 - Start-up CFO 1",                               credits: 0.666667, category: CourseCategoryType.HSS, level: 100 },
  { code: "81.0008_4", name: "Entrepreneurship 101 - Start-up CFO 2",                               credits: 0.666667, category: CourseCategoryType.HSS, level: 100 },
  { code: "81.0008_5", name: "Entrepreneurship 101 - Thinking & Acting Like an Entrepreneur 2",     credits: 0.666667, category: CourseCategoryType.HSS, level: 100 },
  { code: "81.0008_6", name: "Entrepreneurship 101 - Thinking & Acting Like an Entrepreneur 3",     credits: 0.666667, category: CourseCategoryType.HSS, level: 100 },
  { code: "81.0008_7", name: "Entrepreneurship 101 - Thinking & Acting Like an Entrepreneur 4",     credits: 0.666667, category: CourseCategoryType.HSS, level: 100 },
  { code: "81.0008_8", name: "Entrepreneurship 101 - Venture Capital 1",                            credits: 0.666667, category: CourseCategoryType.HSS, level: 100 },
];

async function main() {
  console.log("Adding RWTH Aachen CSE SemEx courses (batch 2)...\n");

  for (const c of rwthCourses) {
    const course = await prisma.course.upsert({
      where: { code: c.code },
      update: { name: c.name, credits: c.credits },
      create: {
        code: c.code,
        name: c.name,
        credits: c.credits,
        department: "RWTH Aachen (Semester Exchange)",
        level: c.level,
        description: rwthDescription,
        offeredInFall: true,
        offeredInSpring: true,
        isActive: true,
      },
    });

    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId: course.id, branch: "CSE", batch: "" } },
      update: { courseCategory: c.category, isRequired: false },
      create: {
        courseId: course.id,
        branch: "CSE",
        courseCategory: c.category,
        isRequired: false,
      },
    });

    console.log(`✓ ${c.code} ${c.name} (${c.credits} cr) → CSE:${c.category}`);
  }

  // Reconcile existing course name (category already DE, unchanged).
  const vr = await prisma.course.findUnique({ where: { code: "12.04574" } });
  if (vr) {
    await prisma.course.update({
      where: { id: vr.id },
      data: { name: "Introduction to Virtual Reality (VR I)" },
    });
    console.log("✓ 12.04574 name → Introduction to Virtual Reality (VR I)");
  }

  console.log("\nDone!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
