/**
 * One-time script: rename EE-202 and add/rename EE-581 in the DB.
 * Run: npx ts-node -P tsconfig.json scripts/rename-courses.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Rename EE-202 variants
  const ee202 = await prisma.course.updateMany({
    where: { code: { in: ["EE202", "EE-202"] } },
    data: { name: "Electromagnetics & Wave Propagation" },
  });
  console.log(`EE-202: updated ${ee202.count} row(s)`);

  // Rename / upsert EE-581
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
