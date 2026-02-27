import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedPrograms() {
  const programs = [
    { code: "CSE", name: "Computer Science and Engineering", department: "CSE", type: "MAJOR" as const, totalCreditsRequired: 160 },
    { code: "DSE", name: "Data Science and Engineering", department: "CSE", type: "MAJOR" as const, totalCreditsRequired: 160 },
    { code: "EE", name: "Electrical Engineering", department: "EE", type: "MAJOR" as const, totalCreditsRequired: 160 },
    { code: "MEVLSI", name: "Microelectronics & VLSI", department: "EE", type: "MAJOR" as const, totalCreditsRequired: 160 },
    { code: "MNC", name: "Mathematics and Computing", department: "CSE", type: "MAJOR" as const, totalCreditsRequired: 160 },
    { code: "CE", name: "Civil Engineering", department: "CE", type: "MAJOR" as const, totalCreditsRequired: 160 },
    { code: "BE", name: "Bio Engineering", department: "BE", type: "MAJOR" as const, totalCreditsRequired: 160 },
    { code: "EP", name: "Engineering Physics", department: "PHYS", type: "MAJOR" as const, totalCreditsRequired: 160 },
    { code: "GE", name: "General Engineering", department: "GE", type: "MAJOR" as const, totalCreditsRequired: 160 },
    { code: "ME", name: "Mechanical Engineering", department: "ME", type: "MAJOR" as const, totalCreditsRequired: 160 },
    { code: "MSE", name: "Materials Science and Engineering", department: "CHEM", type: "MAJOR" as const, totalCreditsRequired: 160 },
    { code: "BSCS", name: "BS in Chemical Sciences", department: "CHEM", type: "MAJOR" as const, totalCreditsRequired: 160 },
  ];

  let created = 0;
  for (const prog of programs) {
    const existing = await prisma.program.findUnique({
      where: { code: prog.code },
    });
    if (!existing) {
      await prisma.program.create({ data: prog });
      created++;
      console.log(`✅ Created: ${prog.code} - ${prog.name}`);
    } else {
      console.log(`⏭️  Already exists: ${prog.code}`);
    }
  }

  console.log(`\n✅ Done: ${created} programs created`);
}

seedPrograms()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
