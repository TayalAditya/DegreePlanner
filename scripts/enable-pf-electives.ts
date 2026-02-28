import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Get all courses without branchMappings that are likely electives
  // Also update courses with specific patterns that are FE
  
  // 1. Update courses starting with common elective prefixes
  const electivePrefixes = ["EN", "HS", "PH", "CH", "BIO", "EE", "ME", "CE"];
  
  for (const prefix of electivePrefixes) {
    const updated = await prisma.course.updateMany({
      where: {
        code: { startsWith: prefix }
      },
      data: { isPassFailEligible: true }
    });
    console.log(`Updated ${updated.count} ${prefix} courses`);
  }

  // 2. Enable for all DS courses (electives/DE)
  const dsUpdated = await prisma.course.updateMany({
    where: { code: { startsWith: "DS" } },
    data: { isPassFailEligible: true }
  });
  console.log(`Updated ${dsUpdated.count} DS courses`);

  // 3. Enable for all CS courses (electives/DE for non-CSE)
  const csUpdated = await prisma.course.updateMany({
    where: { code: { startsWith: "CS" } },
    data: { isPassFailEligible: true }
  });
  console.log(`Updated ${csUpdated.count} CS courses`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
