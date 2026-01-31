import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function enrollUser() {
  const email = "b23243@students.iitmandi.ac.in";
  
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.log("❌ User not found");
    return;
  }

  const cseProgram = await prisma.program.findUnique({
    where: { code: "CSE" },
  });

  if (!cseProgram) {
    console.log("❌ CSE Program not found. Run: npx tsx scripts/seed-programs.ts");
    return;
  }

  // Enroll in CSE as primary program
  const enrollment = await prisma.userProgram.upsert({
    where: {
      userId_programId: {
        userId: user.id,
        programId: cseProgram.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      programId: cseProgram.id,
      programType: "MAJOR",
      isPrimary: true,
      startSemester: 1,
      status: "ACTIVE",
    },
  });

  console.log("✅ Enrolled in B.Tech CSE");
  console.log(JSON.stringify(enrollment, null, 2));
}

enrollUser()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
