import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// EE-303: rename "Power Systems" → "Power and Energy Systems"
const r303 = await prisma.course.updateMany({
  where: { code: { in: ["EE303", "EE-303"] } },
  data: { name: "Power and Energy Systems" },
});
console.log(`EE-303 renamed: ${r303.count} row(s)`);

// Revert EE-552: DC → DE (was incorrectly changed earlier)
const r552 = await prisma.courseBranchMapping.updateMany({
  where: { branch: "EE", course: { code: { in: ["EE552", "EE-552"] } } },
  data: { courseCategory: "DE" },
});
console.log(`EE-552 EE mapping reverted → DE: ${r552.count} row(s)`);

await prisma.$disconnect();
