import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function enrollUser() {
  const user = await prisma.user.findFirst({
    where: { enrollmentId: "B23243" },
  });

  if (!user) {
    console.log("❌ User not found");
    return;
  }

  const program = await prisma.program.findUnique({
    where: { code: "CSE" },
  });

  if (!program) {
    console.log("❌ Program not found");
    return;
  }

  const existing = await prisma.userProgram.findFirst({
    where: { userId: user.id, programId: program.id },
  });

  if (existing) {
    console.log("✅ Already enrolled in CSE");
    return;
  }

  await prisma.userProgram.create({
    data: {
      userId: user.id,
      programId: program.id,
      programType: "MAJOR",
      isPrimary: true,
      startSemester: 1,
      status: "ACTIVE",
    },
  });

  console.log("✅ B23243 enrolled in CSE program");
}

enrollUser()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
