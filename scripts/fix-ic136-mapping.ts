import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const course = await prisma.course.findFirst({
    where: { code: "IC-136" },
    include: { branchMappings: true }
  });

  if (!course) {
    console.log("IC-136 not found");
    return;
  }

  console.log("IC-136 branchMappings:");
  course.branchMappings.forEach(m => {
    console.log(`  ${m.branch}: ${m.courseCategory}`);
  });

  // Fix CS branch mapping from FE to IC_BASKET
  const updated = await prisma.courseBranchMapping.updateMany({
    where: {
      courseId: course.id,
      branch: "CS",
      courseCategory: "FE"
    },
    data: {
      courseCategory: "IC_BASKET"
    }
  });

  console.log(`\nUpdated ${updated.count} mappings from FE to IC_BASKET for CS branch`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
