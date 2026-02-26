import prisma from "../lib/prisma";

async function main() {
  const courseCount = await prisma.course.count();
  console.log("Total courses in DB:", courseCount);

  const userCount = await prisma.user.count();
  console.log("Total users in DB:", userCount);

  const userProgramCount = await prisma.userProgram.count();
  console.log("Total userPrograms in DB:", userProgramCount);

  const enrollmentCount = await prisma.courseEnrollment.count();
  console.log("Total enrollments in DB:", enrollmentCount);

  if (courseCount > 0) {
    const sample = await prisma.course.findMany({ take: 3 });
    console.log("Sample courses:", sample.map((c) => c.code));
  }

  // Check if IC112 exists (a defaultCurriculum code)
  const ic112 = await prisma.course.findUnique({ where: { code: "IC112" } });
  console.log("IC112 in DB:", ic112 ? "YES" : "NO");

  // Check users
  const users = await prisma.user.findMany({
    select: { email: true, enrollmentId: true, branch: true, isApproved: true },
  });
  console.log("Users:", JSON.stringify(users));

  // Check userPrograms
  const programs = await prisma.userProgram.findMany({
    include: { program: { select: { code: true, name: true } } },
  });
  console.log("UserPrograms:", JSON.stringify(programs));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
