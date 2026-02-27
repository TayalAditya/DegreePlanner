import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testBulkEnrollment() {
  // Get a user first
  const user = await prisma.user.findFirst({
    where: { enrollmentId: "B23243" },
    select: { id: true, branch: true, enrollmentId: true },
  });

  if (!user) {
    console.log("❌ User B23243 not found");
    return;
  }

  console.log(`✅ Found user: ${user.enrollmentId}\n`);

  // Get primary program
  const program = await prisma.userProgram.findFirst({
    where: { userId: user.id, isPrimary: true },
    select: { programId: true, program: { select: { code: true } } },
  });

  console.log(`✅ Primary program: ${program?.program.code || "NONE"}\n`);

  // Try to find some courses
  const testCourses = await prisma.course.findMany({
    where: { department: "CSE" },
    take: 5,
    select: { id: true, code: true, name: true },
  });

  console.log(`📚 Sample CSE courses:\n`);
  testCourses.forEach(c => console.log(`  ${c.code} - ${c.name}`));

  // Try to enroll user in first course
  if (testCourses.length > 0) {
    const course = testCourses[0];
    console.log(`\n📝 Attempting to enroll in ${course.code}...`);
    
    try {
      const enrollment = await prisma.courseEnrollment.create({
        data: {
          userId: user.id,
          courseId: course.id,
          semester: 1,
          year: 2023,
          term: "FALL",
          courseType: "CORE",
          programId: program?.programId || undefined,
          status: "IN_PROGRESS",
        },
      });
      console.log(`✅ Enrollment created successfully!`);
      console.log(`   Course: ${course.code}`);
      console.log(`   Semester: 1`);
    } catch (error) {
      console.log(`❌ Enrollment failed:`, (error as Error).message);
    }
  }
}

testBulkEnrollment()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
