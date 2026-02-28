import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const courses = await prisma.course.findMany({
    where: {
      code: {
        contains: "ISTP",
      },
    },
    include: {
      branchMappings: true,
    },
  });

  console.log(`Found ${courses.length} ISTP courses:`);
  courses.forEach((course) => {
    console.log(`\n${course.code} - ${course.name}`);
    console.log(`Credits: ${course.credits}`);
    console.log(`Branch Mappings:`);
    course.branchMappings.forEach((m) => {
      console.log(`  ${m.branch}: ${m.courseCategory}`);
    });
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
