import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.course.count();
  console.log("✅ Total courses in database:", count);

  const sample = await prisma.course.findMany({
    take: 10,
    orderBy: {
      code: "asc",
    },
  });

  console.log("\n📚 Sample courses from database:");
  sample.forEach((c) => {
    console.log(
      `  ✓ ${c.code}: ${c.name} (${c.credits} credits, ${c.department})`
    );
  });

  const depts = await prisma.course.groupBy({
    by: ["department"],
    _count: {
      id: true,
    },
  });

  console.log("\n📊 Courses by department:");
  depts.sort((a, b) => (b._count?.id || 0) - (a._count?.id || 0)).forEach((d) => {
    console.log(`  ${d.department}: ${d._count?.id} courses`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
