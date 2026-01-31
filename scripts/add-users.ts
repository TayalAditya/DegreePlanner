import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Adding approved users...");

  const approvedUsers = [
    {
      email: "student1@university.edu",
      enrollmentId: "CS2024001",
      name: "John Doe",
      department: "Computer Science",
      batch: 2024,
      allowedPrograms: ["CS-MAJOR", "MATH-MINOR"],
    },
    {
      email: "student2@university.edu",
      enrollmentId: "CS2024002",
      name: "Jane Smith",
      department: "Computer Science",
      batch: 2024,
      allowedPrograms: ["CS-MAJOR"],
    },
  ];

  for (const userData of approvedUsers) {
    await prisma.approvedUser.upsert({
      where: { email: userData.email },
      update: {},
      create: userData,
    });
    console.log(`✅ Added: ${userData.email}`);
  }

  console.log("\n✅ Approved users added successfully!");
  console.log("\nYou can now sign in with these emails (or add your own):");
  approvedUsers.forEach(user => console.log(`  - ${user.email}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
