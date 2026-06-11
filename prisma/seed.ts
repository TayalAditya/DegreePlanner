import { PrismaClient, ProgramType } from "@prisma/client";

const prisma = new PrismaClient();

async function seedPrograms() {
  console.log("ðŸŒ± Seeding all IIT Mandi programs...\n");

  // Delete programs only â€” NOT UserProgram records (those are user data).
  // UserProgram records point to programs by ID; after recreating programs
  // with new IDs the sync-user route will re-assign students on next login.
  // We skip deleting UserPrograms to avoid wiping student program history.
  await prisma.program.deleteMany({});

  // IC credits for all B.Tech: 39 (IC Compulsory) + 6 (IC Basket) + 12 (HSS) + 3 (IKS) = 60
  // MTP/ISTP: 12 credits
  // Total: 160 for B.Tech, 163 for BS-CS

  const programs = [
    // B.Tech: IC(60) + DC(branch-specific) + DE(branch-specific) + FE(22) + MTP/ISTP(12) = 160
    // BS-CS: IC(52) + DC(59) + DE(23) + FE(15) + MTP(8) + Research(6) = 163

    // School of Computing & Electrical Engineering
    {
      code: "CSE",
      name: "B.Tech in Computer Science & Engineering",
      department: "School of Computing & Electrical Engineering",
      totalCreditsRequired: 160,
      icCredits: 60,
      dcCredits: 38,
      deCredits: 28,
      feCredits: 22,
      mtpIstpCredits: 12,
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
      code: "DSAI",
      name: "B.Tech in Data Science & Artificial Intelligence",
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
      totalCreditsRequired: 161, // EE is special: DC+DE=72, FE=17
      icCredits: 60,
      dcCredits: 52,
      deCredits: 20,
      feCredits: 17,
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
    // IC136 (Biotechnology, 3cr) is DC for BSCS; IKS waived â†’ HSS+IKS=12 (icCredits = IC+ICB+12).
    {
      code: "BSCS",
      name: "B.S. in Chemical Sciences",
      department: "School of Chemical Sciences",
      totalCreditsRequired: 163,
      icCredits: 49,   // IC_comp(31)+ICB(6)+HSS+IKS(12)
      dcCredits: 62,   // 59 base + IC136(3)
      deCredits: 23,
      feCredits: 15,
      mtpIstpCredits: 14,
    },

    // â”€â”€ Batch 2024 variants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // CE/BE/EP B24: FDP(4cr) + DP(3cr) dropped from IC compulsory â†’ icCredits 60â†’53.
    //   DP is optional for B24 (counts as FE if taken) â†’ feCredits 22â†’25, deCredits adjust.
    // MNC B24: FDP(4cr) dropped but replaced by MA120(4cr DC) + CS304 stays â†’ icCredits 60â†’56, dcCredits 51â†’55.
    // BSCS B24: FDP(4cr)+DP(3cr) dropped, IC272 dropped, no project â†’ icCredits 52â†’48, dcCredits 59â†’62.
    {
      code: "CE_B24",
      name: "B.Tech in Civil Engineering (B24)",
      department: "School of Environmental and Natural Sciences",
      totalCreditsRequired: 160,
      icCredits: 53,   // IC_comp(32)+ICB(6)+IKS(3)+HSS(12)
      dcCredits: 49,
      deCredits: 21,
      feCredits: 25,   // 22 regular + 3 optional DP (counted as FE if taken)
      mtpIstpCredits: 12,
    },
    {
      code: "BE_B24",
      name: "B.Tech in Bioengineering (B24)",
      department: "School of Bioengineering",
      totalCreditsRequired: 160,
      icCredits: 53,
      dcCredits: 42,
      deCredits: 28,
      feCredits: 25,
      mtpIstpCredits: 12,
    },
    {
      code: "EP_B24",
      name: "B.Tech in Engineering Physics (B24)",
      department: "School of Physical Sciences",
      totalCreditsRequired: 160,
      icCredits: 53,
      dcCredits: 37,
      deCredits: 33,
      feCredits: 25,
      mtpIstpCredits: 12,
    },
    {
      code: "MNC_B24",
      name: "B.Tech in Mathematics & Computing (B24)",
      department: "School of Mathematics & Statistical Science",
      totalCreditsRequired: 160,
      icCredits: 56,   // IC_comp(35)+ICB(6)+IKS(3)+HSS(12)
      dcCredits: 55,   // +MA120(4); CS304 stays; CS214â†’CS201+CS201P (same 4cr)
      deCredits: 15,
      feCredits: 22,
      mtpIstpCredits: 12,
    },
    {
      code: "BSCS_B24",
      name: "B.S. in Chemical Sciences (B24)",
      department: "School of Chemical Sciences",
      totalCreditsRequired: 163,
      icCredits: 45,   // IC_comp(27)+ICB(6)+HSS+IKS(12); FDP dropped
      dcCredits: 65,   // 59 base + IC136(3) + CY200(3); FDP(4) replaced by CY200(3)+1DE
      deCredits: 24,   // +1 from FDP replacement
      feCredits: 15,
      mtpIstpCredits: 14,
    },

    // â”€â”€ Batch 2025 variants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // CE/BE/EP B25: FDP(IC102P) back in Sem-2, but DP(IC202P) still optional â†’ feCredits 25.
    //   IC_comp = 36 (39 âˆ’ 3 for IC202P); IC_TOT = 57.
    {
      code: "CE_B25",
      name: "B.Tech in Civil Engineering (B25)",
      department: "School of Environmental and Natural Sciences",
      totalCreditsRequired: 160,
      icCredits: 57,   // IC_comp(36)+ICB(6)+IKS(3)+HSS(12)
      dcCredits: 49,
      deCredits: 17,
      feCredits: 25,   // 22 regular + 3 optional DP (counted as FE if taken)
      mtpIstpCredits: 12,
    },
    {
      code: "BE_B25",
      name: "B.Tech in Bioengineering (B25)",
      department: "School of Bioengineering",
      totalCreditsRequired: 160,
      icCredits: 57,
      dcCredits: 42,
      deCredits: 24,
      feCredits: 25,
      mtpIstpCredits: 12,
    },
    {
      code: "EP_B25",
      name: "B.Tech in Engineering Physics (B25)",
      department: "School of Physical Sciences",
      totalCreditsRequired: 160,
      icCredits: 57,
      dcCredits: 37,
      deCredits: 29,
      feCredits: 25,
      mtpIstpCredits: 12,
    },
  ];

  const created = [];
  for (const prog of programs) {
    const program = await prisma.program.create({
      data: {
        ...prog,
        type: "MAJOR",
        minCreditsForMtp: 90,
        minSemesterForMtp: 7,
      },
    });
    created.push(program);
    console.log(`âœ… ${program.code}: ${program.name}`);
  }

  console.log(`\nâœ… Created ${created.length} programs`);
  return created;
}

async function main() {
  console.log("ðŸŒ± Starting database seeding...\n");

  // Seed programs first
  await seedPrograms();

  console.log("âœ… Database seeded successfully!\nCreated: " + (await prisma.program.count()) + " programs");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

// â”€â”€ Intentionally empty below â€” sample programs removed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
