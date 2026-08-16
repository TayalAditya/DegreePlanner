/**
 * One-shot script: add Program DB records for the two new VLSI minors (B25+).
 * Run with: npx tsx scripts/seed-vlsi-minors.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const minors = [
    {
      code: "VLSI_DESIGN",
      name: "Minor in VLSI Design",
      department: "School of Computing & Electrical Engineering",
      totalCreditsRequired: 9,
      description: "VL-404 CMOS Analog IC Design + EE-524 Digital MOS LSI Circuits + EE-519P Digital IC Design Practicum. B25 onwards.",
    },
    {
      code: "VLSI_TECH",
      name: "Minor in VLSI Technology",
      department: "School of Computing & Electrical Engineering",
      totalCreditsRequired: 10,
      description: "VL-311 CMOS Processing and Practicum + VL-312 Electronic System Packaging + EE-615 Nanoelectronics and Nano-Microfabrication. B25 onwards.",
    },
  ];

  for (const m of minors) {
    const existing = await prisma.program.findUnique({ where: { code: m.code } });
    if (existing) {
      console.log(`⏭  ${m.code} already exists — skipping`);
      continue;
    }
    const created = await prisma.program.create({
      data: {
        code: m.code,
        name: m.name,
        department: m.department,
        type: "MINOR",
        totalCreditsRequired: m.totalCreditsRequired,
        description: m.description,
        icCredits: 0,
        dcCredits: 0,
        deCredits: 0,
        feCredits: 0,
        mtpIstpCredits: 0,
      },
    });
    console.log(`✅ Created: ${created.code} — ${created.name}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
