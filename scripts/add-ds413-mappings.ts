import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Add DS-413 branchMappings for CSE and DSE as DE
  const course = await prisma.course.findFirst({
    where: { code: "DS-413" }
  });

  if (!course) {
    console.log("DS-413 not found");
    return;
  }

  // Create mappings for CSE and DSE
  const mappings = await prisma.courseBranchMapping.createMany({
    data: [
      {
        courseId: course.id,
        branch: "CS", // CSE maps to CS in database
        courseCategory: "DE"
      },
      {
        courseId: course.id,
        branch: "DSE",
        courseCategory: "DE"
      }
    ]
  });

  console.log(`Added ${mappings.count} mappings for DS-413`);
  console.log("CS → DE");
  console.log("DSE → DE");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
