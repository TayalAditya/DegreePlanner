import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "academic_secretary@students.iitmandi.ac.in";

  await prisma.approvedUser.upsert({
    where: { email },
    update: { name: "Academic Secretary" },
    create: {
      email,
      name: "Academic Secretary",
      enrollmentId: null,
      department: null,
      branch: null,
      batch: null,
      allowedPrograms: [],
    },
  });

  console.log(`✓ ApprovedUser entry created/updated for ${email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
