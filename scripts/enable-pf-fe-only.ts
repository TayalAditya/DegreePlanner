import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // First, disable P/F for all courses except those we explicitly want
  const disableAll = await prisma.course.updateMany({
    data: { isPassFailEligible: false }
  });
  console.log(`Disabled P/F for all courses: ${disableAll.count}`);

  // Get all courses that have FE branchMappings and enable only those
  const feCourses = await prisma.course.findMany({
    where: {
      branchMappings: {
        some: {
          courseCategory: "FE"
        }
      }
    },
    select: { id: true, code: true }
  });

  console.log(`Found ${feCourses.length} courses with FE mappings`);

  if (feCourses.length > 0) {
    const updated = await prisma.course.updateMany({
      where: {
        id: { in: feCourses.map(c => c.id) }
      },
      data: { isPassFailEligible: true }
    });
    console.log(`Enabled P/F for ${updated.count} FE courses`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
