import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function bulkEnrollStudents() {
  console.log("📚 Bulk enrolling all approved students...\n");

  // Get all approved users
  const approvedUsers = await prisma.approvedUser.findMany({
    select: { enrollmentId: true, branch: true },
  });

  console.log(`Total students to enroll: ${approvedUsers.length}\n`);

  let enrolled = 0;
  let skipped = 0;
  let errors = 0;

  for (const approved of approvedUsers) {
    try {
      // Find or create user
      let user = await prisma.user.findFirst({
        where: { enrollmentId: approved.enrollmentId },
        select: { id: true },
      });

      if (!user) {
        skipped++;
        continue;
      }

      // Find program by branch code
      const program = await prisma.program.findUnique({
        where: { code: approved.branch || "" },
      });

      if (!program) {
        errors++;
        continue;
      }

      // Check if already enrolled
      const existing = await prisma.userProgram.findFirst({
        where: { userId: user.id, programId: program.id },
      });

      if (existing) {
        // Already enrolled
        continue;
      }

      // Enroll student
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

      enrolled++;
      if (enrolled % 50 === 0) {
        console.log(`✅ ${enrolled} students enrolled...`);
      }
    } catch (error) {
      console.error(`❌ Error enrolling ${approved.enrollmentId}:`, (error as Error).message);
      errors++;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`✅ Successfully enrolled: ${enrolled}`);
  console.log(`⏭️  Skipped (not in User table yet): ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`\nNote: Students who haven't logged in yet will auto-enroll on first login`);
}

bulkEnrollStudents()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
