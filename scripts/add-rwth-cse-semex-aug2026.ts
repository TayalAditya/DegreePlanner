/**
 * RWTH Aachen — August 2026 CSE Semester Exchange catalog update.
 *
 * Adds partner-university catalog rows and their generic CSE mappings. SemEx
 * courses are not local CourseOfferings: they appear in the catalog/mappings
 * and are used for approved transfer-credit history rather than local pre-reg.
 *
 * Run: npx tsx scripts/add-rwth-cse-semex-aug2026.ts
 */
import { CourseCategoryType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const rwthDescription =
  "Available via Semester Exchange (RWTH Aachen) only. Can be taken in Semester 5, 6, or 7.";

const courses: Array<{
  code: string;
  name: string;
  credits: number;
  category: CourseCategoryType;
}> = [
  {
    code: "12PV00016",
    name: "Machine Learning with Graphs: Foundations and Applications",
    credits: 4,
    category: CourseCategoryType.DE,
  },
  {
    code: "41PV56365",
    name: "Robotic Systems",
    credits: 3.33,
    category: CourseCategoryType.FE,
  },
];

async function main() {
  for (const courseData of courses) {
    const course = await prisma.course.upsert({
      where: { code: courseData.code },
      update: {
        name: courseData.name,
        credits: courseData.credits,
        department: "RWTH Aachen (Semester Exchange)",
        level: 300,
        description: rwthDescription,
        offeredInFall: true,
        offeredInSpring: true,
        isActive: true,
      },
      create: {
        code: courseData.code,
        name: courseData.name,
        credits: courseData.credits,
        department: "RWTH Aachen (Semester Exchange)",
        level: 300,
        description: rwthDescription,
        offeredInFall: true,
        offeredInSpring: true,
        isActive: true,
      },
    });

    await prisma.courseBranchMapping.upsert({
      where: {
        courseId_branch_batch: { courseId: course.id, branch: "CSE", batch: "" },
      },
      update: {
        courseCategory: courseData.category,
        isRequired: false,
        semester: null,
        splitCategory: null,
        splitAmount: null,
      },
      create: {
        courseId: course.id,
        branch: "CSE",
        batch: "",
        courseCategory: courseData.category,
        isRequired: false,
      },
    });

    console.log(`${course.code} → CSE:${courseData.category}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
