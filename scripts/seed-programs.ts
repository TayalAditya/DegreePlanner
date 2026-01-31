import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedPrograms() {
  console.log("🌱 Seeding all IIT Mandi programs...\n");

  // Delete existing user enrollments first
  await prisma.userProgram.deleteMany({});
  // Then delete programs
  await prisma.program.deleteMany({});

  // IC credits for all B.Tech: 39 (IC Compulsory) + 6 (IC Basket) + 12 (HSS) + 3 (IKS) = 60
  // MTP/ISTP: 12 credits
  // Total: 160 for B.Tech, 163 for BS-CS
  
  const programs = [
    // School of Computing & Electrical Engineering
    {
      code: "CSE",
      name: "B.Tech in Computer Science & Engineering",
      department: "School of Computing & Electrical Engineering",
      totalCreditsRequired: 160,
      coreCredits: 38,  // DC only (from PDF page 18)
      deCredits: 28,     // DE only
      peCredits: 0,      // Not separately listed
      freeElectiveCredits: 22,  // FE for all B.Tech except EE
    },
    {
      code: "DSE",
      name: "B.Tech in Data Science & Engineering",
      department: "School of Computing & Electrical Engineering",
      totalCreditsRequired: 160,
      coreCredits: 33,  // DC from PDF
      deCredits: 33,     // DE from PDF
      peCredits: 0,
      freeElectiveCredits: 22,
    },
    {
      code: "MEVLSI",
      name: "B.Tech in Microelectronics & VLSI",
      department: "School of Computing & Electrical Engineering",
      totalCreditsRequired: 160,
      coreCredits: 54,  // DC from PDF
      deCredits: 12,     // DE from PDF
      peCredits: 0,
      freeElectiveCredits: 22,
    },
    {
      code: "EE",
      name: "B.Tech in Electrical Engineering",
      department: "School of Computing & Electrical Engineering",
      totalCreditsRequired: 160,
      coreCredits: 52,  // DC from PDF
      deCredits: 20,     // DE from PDF
      peCredits: 0,
      freeElectiveCredits: 17,  // FE for EE is different (from page 5 note)
    },
    // School of Mathematics & Statistical Science
    {
      code: "MNC",
      name: "B.Tech in Mathematics & Computing",
      department: "School of Mathematics & Statistical Science",
      totalCreditsRequired: 160,
      coreCredits: 51,  // DC from PDF
      deCredits: 15,     // DE from PDF
      peCredits: 0,
      freeElectiveCredits: 22,
    },
    // School of Environmental and Natural Sciences
    {
      code: "CE",
      name: "B.Tech in Civil Engineering",
      department: "School of Environmental and Natural Sciences",
      totalCreditsRequired: 160,
      coreCredits: 49,  // DC from PDF
      deCredits: 17,     // DE from PDF
      peCredits: 0,
      freeElectiveCredits: 22,
    },
    // School of Bioengineering
    {
      code: "BE",
      name: "B.Tech in Bioengineering",
      department: "School of Bioengineering",
      totalCreditsRequired: 160,
      coreCredits: 42,  // DC from PDF
      deCredits: 24,     // DE from PDF
      peCredits: 0,
      freeElectiveCredits: 22,
    },
    // School of Physical Sciences
    {
      code: "EP",
      name: "B.Tech in Engineering Physics",
      department: "School of Physical Sciences",
      totalCreditsRequired: 160,
      coreCredits: 37,  // DC from PDF
      deCredits: 29,     // DE from PDF
      peCredits: 0,
      freeElectiveCredits: 22,
    },
    // School of Mechanical and Materials Engineering
    {
      code: "ME",
      name: "B.Tech in Mechanical Engineering",
      department: "School of Mechanical and Materials Engineering",
      totalCreditsRequired: 160,
      coreCredits: 50,  // DC from PDF
      deCredits: 16,     // DE from PDF
      peCredits: 0,
      freeElectiveCredits: 22,
    },
    {
      code: "GE",
      name: "B.Tech in General Engineering",
      department: "School of Mechanical and Materials Engineering",
      totalCreditsRequired: 160,
      coreCredits: 36,  // DC from PDF
      deCredits: 30,     // DE from PDF
      peCredits: 0,
      freeElectiveCredits: 22,
    },
    {
      code: "MSE",
      name: "B.Tech in Materials Science & Engineering",
      department: "School of Mechanical and Materials Engineering",
      totalCreditsRequired: 160,
      coreCredits: 45,  // DC from PDF
      deCredits: 21,     // DE from PDF
      peCredits: 0,
      freeElectiveCredits: 22,
    },
    // School of Chemical Sciences
    {
      code: "CS",
      name: "BS in Chemical Sciences",
      department: "School of Chemical Sciences",
      totalCreditsRequired: 163,  // BS is 163 credits
      coreCredits: 59,  // DC from PDF (page 18: BS CS = 59)
      deCredits: 23,     // DE from PDF
      peCredits: 0,
      freeElectiveCredits: 15,  // FE for BS-CS (from page 5)
    },
  ];

  const created = [];
  for (const prog of programs) {
    const program = await prisma.program.create({
      data: {
        ...prog,
        type: "MAJOR",
        mtpRequired: true,
        mtpCredits: 8,  // MTP-1 (3 credits) + MTP-2 (5 credits)
        istpAllowed: true,
        istpCredits: 4,  // ISTP is 4 credits (6th semester)
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
