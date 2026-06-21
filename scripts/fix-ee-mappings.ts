import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// EE-302: DE → DC
const r302 = await prisma.courseBranchMapping.updateMany({
  where: { branch: "EE", course: { code: { in: ["EE302", "EE-302"] } } },
  data: { courseCategory: "DC" },
});
console.log(`EE-302 EE mapping → DC: ${r302.count} row(s)`);

// EE-301: DC → DE
const r301 = await prisma.courseBranchMapping.updateMany({
  where: { branch: "EE", course: { code: { in: ["EE301", "EE-301"] } }, courseCategory: "DC" },
  data: { courseCategory: "DE" },
});
console.log(`EE-301 EE mapping DC → DE: ${r301.count} row(s)`);

// EE-552 (Power and Energy Systems): DE → DC
const r552 = await prisma.courseBranchMapping.updateMany({
  where: { branch: "EE", course: { code: { in: ["EE552", "EE-552"] } } },
  data: { courseCategory: "DC" },
});
console.log(`EE-552 EE mapping → DC: ${r552.count} row(s)`);

// EE-205: remove EE DC mapping
const r205 = await prisma.courseBranchMapping.deleteMany({
  where: { branch: "EE", course: { code: { in: ["EE205", "EE-205"] } } },
});
console.log(`EE-205 EE mapping deleted: ${r205.count} row(s)`);

await prisma.$disconnect();
