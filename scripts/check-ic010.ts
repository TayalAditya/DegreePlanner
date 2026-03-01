import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking for IC-010 related data...\n");

  // Check courses
  const courses = await prisma.course.findMany({
    where: {
      OR: [
        { code: { contains: "010" } },
        { code: { contains: "IC" } },
      ],
    },
    orderBy: { code: "asc" },
  });
  console.log(`Found ${courses.length} courses with IC or 010:`);
  courses.forEach(c => console.log(`  - ${c.code}: ${c.name}`));

  // Check enrollments with these courses
  const enrollments = await prisma.courseEnrollment.findMany({
    where: {
      courseId: { in: courses.map(c => c.id) },
    },
    include: {
      course: true,
      user: { select: { enrollmentId: true, name: true } },
    },
  });
  console.log(`\nFound ${enrollments.length} enrollments for IC/010 courses:`);
  enrollments.forEach(e => {
    console.log(`  - ${e.user.enrollmentId}: ${e.course.code} (Sem ${e.semester}, ${e.status})`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
