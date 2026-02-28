import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Update MA-222 to be P/F eligible
  const updated = await prisma.course.update({
    where: { id: (await prisma.course.findFirst({ where: { code: "MA-222" } }))?.id },
    data: { isPassFailEligible: true }
  });

  console.log(`Updated MA-222: isPassFailEligible = true`);

  // Also update other common elective/MA courses that should be P/F eligible
  const maUpdate = await prisma.course.updateMany({
    where: {
      code: { startsWith: "MA" },
      NOT: {
        code: { in: ["MA-112", "MA-113", "MA-114", "MA-115"] } // Exclude IC prefix courses if any
      }
    },
    data: { isPassFailEligible: true }
  });

  console.log(`Updated ${maUpdate.count} MA courses to be P/F eligible`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
