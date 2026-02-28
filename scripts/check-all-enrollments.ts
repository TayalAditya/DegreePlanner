import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: "b23243@students.iitmandi.ac.in" }
  });

  if (!user) {
    console.log("User not found");
    return;
  }

  console.log("=== ALL ENROLLMENTS BY SEMESTER ===\n");
  
  const enrollments = await prisma.courseEnrollment.findMany({
    where: { userId: user.id },
    include: {
      course: {
        include: {
          branchMappings: true
        }
      }
    },
    orderBy: [
      { semester: "asc" },
      { status: "desc" }
    ]
  });

  let currentSem = 0;
  for (const e of enrollments) {
    if (e.semester !== currentSem) {
      currentSem = e.semester;
      console.log(`\n======= SEMESTER ${currentSem} =======`);
    }
    
    const mapping = e.course.branchMappings.find(m => m.branch === "CS" || m.branch === "COMMON");
    const category = mapping?.courseCategory || "NO_MAPPING";
    
    console.log(`${e.status.padEnd(12)} ${e.course.code.padEnd(10)} ${e.course.credits}cr  courseType:${(e.courseType || "NULL").padEnd(15)} mapping:${category}`);
    console.log(`             ${e.course.name}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
