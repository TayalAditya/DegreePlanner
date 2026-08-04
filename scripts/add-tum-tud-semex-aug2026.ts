/**
 * Adds the verified August 2026 TUM and TU Darmstadt Semester Exchange catalog
 * updates received from the partner-course list.
 *
 * Run: npx tsx scripts/add-tum-tud-semex-aug2026.ts
 */
import { CourseCategoryType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const tumDescription =
  "Available via Semester Exchange (TU Munich) only. Can be taken in Semester 5, 6, or 7.";
const tuDarmstadtDescription =
  "Available via Semester Exchange (TU Darmstadt) only. Can be taken in Semester 5, 6, or 7.";

const tumCseDisciplineElectives = [
  { code: "CIT423004", name: "Robust Machine Learning", credits: 2 },
  {
    code: "CITHN2014",
    name: "Foundations and Application of Generative AI - Campus Heilbronn",
    credits: 4,
  },
  { code: "MGT001299", name: "Introduction to Deep Reinforcement Learning", credits: 4 },
];

async function main() {
  console.log("Adding verified TUM and TU Darmstadt SemEx catalog updates...\n");

  for (const courseData of tumCseDisciplineElectives) {
    const course = await prisma.course.upsert({
      where: { code: courseData.code },
      update: {
        name: courseData.name,
        credits: courseData.credits,
        department: "TU Munich (Semester Exchange)",
        level: 300,
        description: tumDescription,
        offeredInFall: true,
        offeredInSpring: true,
        isActive: true,
      },
      create: {
        ...courseData,
        department: "TU Munich (Semester Exchange)",
        level: 300,
        description: tumDescription,
        offeredInFall: true,
        offeredInSpring: true,
        isActive: true,
      },
    });

    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId: course.id, branch: "CSE", batch: "" } },
      update: { courseCategory: CourseCategoryType.DE, isRequired: false, semester: null },
      create: {
        courseId: course.id,
        branch: "CSE",
        batch: "",
        courseCategory: CourseCategoryType.DE,
        isRequired: false,
      },
    });

    console.log(`Added ${course.code} -> CSE:DE`);
  }

  const visualComputingLab = await prisma.course.upsert({
    where: { code: "20-00-0418" },
    update: {
      name: "Visual Computing Lab",
      credits: 4,
      department: "TU Darmstadt (Semester Exchange)",
      level: 300,
      description: tuDarmstadtDescription,
      offeredInFall: true,
      offeredInSpring: true,
      isActive: true,
    },
    create: {
      code: "20-00-0418",
      name: "Visual Computing Lab",
      credits: 4,
      department: "TU Darmstadt (Semester Exchange)",
      level: 300,
      description: tuDarmstadtDescription,
      offeredInFall: true,
      offeredInSpring: true,
      isActive: true,
    },
  });

  await prisma.courseBranchMapping.upsert({
    where: {
      courseId_branch_batch: { courseId: visualComputingLab.id, branch: "DSE", batch: "" },
    },
    update: { courseCategory: CourseCategoryType.DE, isRequired: false, semester: null },
    create: {
      courseId: visualComputingLab.id,
      branch: "DSE",
      batch: "",
      courseCategory: CourseCategoryType.DE,
      isRequired: false,
    },
  });

  console.log(`Added ${visualComputingLab.code} -> DSE:DE`);
  console.log("\nDone.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
