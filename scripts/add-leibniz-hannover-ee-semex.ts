/**
 * Leibniz University Hannover — Semester Exchange courses (EE branch).
 * Adds courses + CourseBranchMapping for EE.
 * Run: npx tsx scripts/add-leibniz-hannover-ee-semex.ts
 */
import { PrismaClient, CourseCategoryType } from "@prisma/client";

const prisma = new PrismaClient();

const hannoverDescription =
  "Available via Semester Exchange (Leibniz University Hannover) only. Can be taken in Semester 5, 6, or 7.";

const hannoverEECourses: {
  code: string;
  name: string;
  credits: number;
  category: CourseCategoryType;
}[] = [
  { code: "1402",   name: "Foundations of Information Retrieval",    credits: 3.33, category: CourseCategoryType.DE },
  { code: "2622",   name: "Statistical Natural Language Processing", credits: 3.33, category: CourseCategoryType.DE },
  { code: "2774",   name: "Deep Learning Foundations",              credits: 3.33, category: CourseCategoryType.DE },
  { code: "3235",   name: "Multi-Agent Interactions and Games",     credits: 3.33, category: CourseCategoryType.DE },
  { code: "394569", name: "Insurance Risk Management",              credits: 3.33, category: CourseCategoryType.FE },
];

async function main() {
  console.log("Adding Leibniz University Hannover EE SemEx courses...\n");

  for (const c of hannoverEECourses) {
    const course = await prisma.course.upsert({
      where: { code: c.code },
      update: { name: c.name, credits: c.credits },
      create: {
        code: c.code,
        name: c.name,
        credits: c.credits,
        department: "Leibniz University Hannover (Semester Exchange)",
        level: 300,
        description: hannoverDescription,
        offeredInFall: true,
        offeredInSpring: true,
        isActive: true,
      },
    });

    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId: course.id, branch: "EE", batch: "" } },
      update: { courseCategory: c.category, isRequired: false },
      create: {
        courseId: course.id,
        branch: "EE",
        courseCategory: c.category,
        isRequired: false,
      },
    });

    console.log(`✓ ${c.code} ${c.name} (${c.credits} cr) → EE:${c.category}`);
  }

  console.log("\nDone!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
