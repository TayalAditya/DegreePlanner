import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedPrograms() {
  console.log("🌱 Seeding all IIT Mandi programs...\n");

  // Delete existing user enrollments first
  await prisma.userProgram.deleteMany({});
  // Then delete programs
  await prisma.program.deleteMany({});

  const programs = [
    // School of Computing & Electrical Engineering
    {
      code: "CSE",
      name: "B.Tech in Computer Science & Engineering",
      department: "School of Computing & Electrical Engineering",
      totalCreditsRequired: 160,
      coreCredits: 90,
      deCredits: 24,
      peCredits: 12,
      freeElectiveCredits: 12,
    },
    {
      code: "DSE",
      name: "B.Tech in Data Science & Engineering",
      department: "School of Computing & Electrical Engineering",
      totalCreditsRequired: 160,
      coreCredits: 88,
      deCredits: 24,
      peCredits: 12,
      freeElectiveCredits: 12,
    },
    {
      code: "MEVLSI",
      name: "B.Tech in Microelectronics & VLSI",
      department: "School of Computing & Electrical Engineering",
      totalCreditsRequired: 160,
      coreCredits: 86,
      deCredits: 26,
      peCredits: 12,
      freeElectiveCredits: 12,
    },
    {
      code: "EE",
      name: "B.Tech in Electrical Engineering",
      department: "School of Computing & Electrical Engineering",
      totalCreditsRequired: 160,
      coreCredits: 88,
      deCredits: 24,
      peCredits: 12,
      freeElectiveCredits: 12,
    },
    // School of Mathematics & Statistical Science
    {
      code: "MNC",
      name: "B.Tech in Mathematics & Computing",
      department: "School of Mathematics & Statistical Science",
      totalCreditsRequired: 160,
      coreCredits: 92,
      deCredits: 20,
      peCredits: 12,
      freeElectiveCredits: 12,
    },
    // School of Environmental and Natural Sciences
    {
      code: "CE",
      name: "B.Tech in Civil Engineering",
      department: "School of Environmental and Natural Sciences",
      totalCreditsRequired: 160,
      coreCredits: 88,
      deCredits: 24,
      peCredits: 12,
      freeElectiveCredits: 12,
    },
    // School of Bioengineering
    {
      code: "BE",
      name: "B.Tech in Bioengineering",
      department: "School of Bioengineering",
      totalCreditsRequired: 160,
      coreCredits: 86,
      deCredits: 24,
      peCredits: 14,
      freeElectiveCredits: 12,
    },
    // School of Physical Sciences
    {
      code: "EP",
      name: "B.Tech in Engineering Physics",
      department: "School of Physical Sciences",
      totalCreditsRequired: 160,
      coreCredits: 90,
      deCredits: 22,
      peCredits: 12,
      freeElectiveCredits: 12,
    },
    // School of Mechanical and Materials Engineering
    {
      code: "ME",
      name: "B.Tech in Mechanical Engineering",
      department: "School of Mechanical and Materials Engineering",
      totalCreditsRequired: 160,
      coreCredits: 86,
      deCredits: 24,
      peCredits: 12,
      freeElectiveCredits: 14,
    },
    {
      code: "GE",
      name: "B.Tech in General Engineering",
      department: "School of Mechanical and Materials Engineering",
      totalCreditsRequired: 160,
      coreCredits: 84,
      deCredits: 26,
      peCredits: 12,
      freeElectiveCredits: 14,
    },
    {
      code: "MSE",
      name: "B.Tech in Materials Science & Engineering",
      department: "School of Mechanical and Materials Engineering",
      totalCreditsRequired: 160,
      coreCredits: 88,
      deCredits: 24,
      peCredits: 12,
      freeElectiveCredits: 12,
    },
    // School of Chemical Sciences
    {
      code: "CS",
      name: "BS in Chemical Sciences",
      department: "School of Chemical Sciences",
      totalCreditsRequired: 156,
      coreCredits: 90,
      deCredits: 20,
      peCredits: 12,
      freeElectiveCredits: 12,
    },
  ];

  const created = [];
  for (const prog of programs) {
    const program = await prisma.program.create({
      data: {
        ...prog,
        type: "MAJOR",
        mtpRequired: true,
        mtpCredits: 6,
        istpAllowed: true,
        istpCredits: 6,
        minCreditsForMtp: 90,
        minSemesterForMtp: 6,
      },
    });
    created.push(program);
    console.log(`✅ ${program.code}: ${program.name}`);
  }

  console.log(`\n✅ Created ${created.length} programs`);
}

seedPrograms()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
