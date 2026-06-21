/**
 * One-time script: fix EE course names in the DB.
 * Run: npx tsx scripts/rename-courses.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // EE-202: correct name
  const ee202 = await prisma.course.updateMany({
    where: { code: { in: ["EE202", "EE-202"] } },
    data: { name: "Electromagnetics & Wave Propagation" },
  });
  console.log(`EE-202: updated ${ee202.count} row(s)`);

  // EE-302: correct name
  const ee302 = await prisma.course.updateMany({
    where: { code: { in: ["EE302", "EE-302"] } },
    data: { name: "Control Systems" },
  });
  console.log(`EE-302: updated ${ee302.count} row(s)`);

  // EE-303: correct name
  const ee303 = await prisma.course.updateMany({
    where: { code: { in: ["EE303", "EE-303"] } },
    data: { name: "Power Systems" },
  });
  console.log(`EE-303: updated ${ee303.count} row(s)`);

  // EE-581: upsert
  const ee581 = await prisma.course.upsert({
    where: { code: "EE581" },
    update: { name: "Foundation of Intelligent Communication Systems-2" },
    create: {
      code: "EE581",
      name: "Foundation of Intelligent Communication Systems-2",
      credits: 4,
      level: 500,
      department: "School of Computing & Electrical Engineering",
      offeredInFall: true,
      offeredInSpring: false,
    },
  });
  console.log(`EE-581: upserted → "${ee581.name}"`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
