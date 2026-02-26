import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, branch: true, isApproved: true },
  });
  console.log("Users:", JSON.stringify(users, null, 2));

  const programs = await prisma.userProgram.findMany({
    select: { userId: true, programId: true, status: true },
  });
  console.log("UserPrograms:", JSON.stringify(programs, null, 2));

  const enrollments = await prisma.courseEnrollment.findMany({ take: 5 });
  console.log("Enrollments count:", enrollments.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
