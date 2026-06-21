import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const power = await prisma.course.findMany({
  where: { name: { contains: "power", mode: "insensitive" } },
  include: { branchMappings: { where: { branch: "EE" } } },
});
console.log("=== Power courses ===");
power.forEach((c) => {
  console.log(c.code, "-", c.name, "(" + c.credits + "cr)");
  c.branchMappings.forEach((m) => console.log("  EE", m.batch || "(all)", "->", m.courseCategory));
  if (c.branchMappings.length === 0) console.log("  (no EE mapping)");
});

const energy = await prisma.course.findMany({
  where: { name: { contains: "energy", mode: "insensitive" } },
  include: { branchMappings: { where: { branch: "EE" } } },
});
console.log("\n=== Energy courses ===");
energy.forEach((c) => {
  console.log(c.code, "-", c.name, "(" + c.credits + "cr)");
  c.branchMappings.forEach((m) => console.log("  EE", m.batch || "(all)", "->", m.courseCategory));
  if (c.branchMappings.length === 0) console.log("  (no EE mapping)");
});

await prisma.$disconnect();
