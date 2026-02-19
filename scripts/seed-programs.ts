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
    // B.Tech: IC(60) + DC(branch-specific) + DE(branch-specific) + FE(22) + MTP/ISTP(12) = 160
    // BS-CS: IC(52) + DC(82) + DE(24) + FE(15) + Research(14) = 163

    // School of Computing & Electrical Engineering
    {
      code: "CSE",
      name: "B.Tech in Computer Science & Engineering",
      department: "School of Computing & Electrical Engineering",
      totalCreditsRequired: 160,
      icCredits: 60,     // Institute Core (fixed for all BTech)
      dcCredits: 38,     // Discipline Core
      deCredits: 28,     // Discipline Electives
      feCredits: 22,     // Free Electives
      mtpIstpCredits: 12, // MTP(8) + ISTP(4)
    },
    {
      code: "DSE",
      name: "B.Tech in Data Science & Engineering",
      department: "School of Computing & Electrical Engineering",
      totalCreditsRequired: 160,
      icCredits: 60,
      dcCredits: 33,
      deCredits: 33,
      feCredits: 22,
      mtpIstpCredits: 12,
    },
    {
      code: "MEVLSI",
      name: "B.Tech in Microelectronics & VLSI",
      department: "School of Computing & Electrical Engineering",
      totalCreditsRequired: 160,
      icCredits: 60,
      dcCredits: 54,
      deCredits: 12,
      feCredits: 22,
      mtpIstpCredits: 12,
    },
    {
      code: "EE",
      name: "B.Tech in Electrical Engineering",
      department: "School of Computing & Electrical Engineering",
      totalCreditsRequired: 160,
      icCredits: 60,
      dcCredits: 52,
      deCredits: 20,
      feCredits: 17,     // SPECIAL: EE has FE=17 (not 22)
      mtpIstpCredits: 12,
    },
    // School of Mathematics & Statistical Science
    {
      code: "MNC",
      name: "B.Tech in Mathematics & Computing",
      department: "School of Mathematics & Statistical Science",
      totalCreditsRequired: 160,
      icCredits: 60,
      dcCredits: 51,
      deCredits: 15,
      feCredits: 22,
      mtpIstpCredits: 12,
    },
    // School of Environmental and Natural Sciences
    {
      code: "CE",
      name: "B.Tech in Civil Engineering",
      department: "School of Environmental and Natural Sciences",
      totalCreditsRequired: 160,
      icCredits: 60,
      dcCredits: 49,
      deCredits: 17,
      feCredits: 22,
      mtpIstpCredits: 12,
    },
    // School of Bioengineering
    {
      code: "BE",
      name: "B.Tech in Bioengineering",
      department: "School of Bioengineering",
      totalCreditsRequired: 160,
      icCredits: 60,
      dcCredits: 42,
      deCredits: 24,
      feCredits: 22,
      mtpIstpCredits: 12,
    },
    // School of Physical Sciences
    {
      code: "EP",
      name: "B.Tech in Engineering Physics",
      department: "School of Physical Sciences",
      totalCreditsRequired: 160,
      icCredits: 60,
      dcCredits: 37,
      deCredits: 29,
      feCredits: 22,
      mtpIstpCredits: 12,
    },
    // School of Mechanical and Materials Engineering
    {
      code: "GE",
      name: "B.Tech in General Engineering",
      department: "School of Mechanical and Materials Engineering",
      totalCreditsRequired: 160,
      icCredits: 60,
      dcCredits: 36,
      deCredits: 30,
      feCredits: 22,
      mtpIstpCredits: 12,
    },
    {
      code: "ME",
      name: "B.Tech in Mechanical Engineering",
      department: "School of Mechanical and Materials Engineering",
      totalCreditsRequired: 160,
      icCredits: 60,
      dcCredits: 50,
      deCredits: 16,
      feCredits: 22,
      mtpIstpCredits: 12,
    },
    {
      code: "MSE",
      name: "B.Tech in Materials Science & Engineering",
      department: "School of Mechanical and Materials Engineering",
      totalCreditsRequired: 160,
      icCredits: 60,
      dcCredits: 45,
      deCredits: 21,
      feCredits: 22,
      mtpIstpCredits: 12,
    },
    // School of Chemical Sciences
    {
      code: "BSCS",
      name: "B.S. in Chemical Sciences",
      department: "School of Chemical Sciences",
      totalCreditsRequired: 163,  // BS is 163 credits (different from BTech)
      icCredits: 52,     // Institute Core (different from BTech)
      dcCredits: 82,     // Discipline Core (highest of all programs)
      deCredits: 24,     // Discipline Electives
      feCredits: 15,     // Free Electives (lowest of all)
      mtpIstpCredits: 14, // Research Projects (NOT MTP/ISTP)
    },
  ];

  const created = [];
  for (const prog of programs) {
    // BS program has different MTP requirements
    const isBSTech = prog.code === "BSCS";

    const program = await prisma.program.create({
      data: {
        ...prog,
        type: "MAJOR",
        minCreditsForMtp: isBSTech ? 0 : 90,   // BS has no MTP requirement
        minSemesterForMtp: isBSTech ? 0 : 7,   // MTP is in Semester 7 (final year)
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
