import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const EE_BRANCHES = ["EE", "GE", "GE-COMM", "GE-ROBO", "GE-MECH", "MEVLSI"];
const CODES = ["EE301", "EE-301", "EE302", "EE-302", "EE303", "EE-303", "EE205", "EE-205", "EE211", "EE-211"];

const courses = await prisma.course.findMany({
  where: { code: { in: CODES } },
  include: { branchMappings: true },
});

for (const c of courses) {
  console.log(`\n${c.code} - ${c.name} (${c.credits}cr)`);
  const eeMappings = c.branchMappings.filter((m) => EE_BRANCHES.includes(m.branch));
  if (eeMappings.length === 0) {
    console.log("  (no EE branch mappings)");
  } else {
    eeMappings.forEach((m) => console.log(`  ${m.branch} ${m.batch || "(all)"} -> ${m.courseCategory}`));
  }
}

await prisma.$disconnect();
