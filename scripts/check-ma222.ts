import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const course = await prisma.course.findFirst({
    where: {
      code: "MA-222"
    }
  });

  if (course) {
    console.log("Course:", course.code, course.name);
    console.log("isPassFailEligible:", course.isPassFailEligible);
  } else {
    console.log("MA-222 not found");
  }

  // Check all MA courses
  const maCourses = await prisma.course.findMany({
    where: {
      code: { startsWith: "MA" }
    },
    select: {
      code: true,
      name: true,
      isPassFailEligible: true
    }
  });

  console.log("\n=== MA COURSES ===");
  maCourses.forEach(c => {
    console.log(`${c.code}: isPassFailEligible=${c.isPassFailEligible}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
