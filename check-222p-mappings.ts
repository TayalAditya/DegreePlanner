import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const course = await prisma.course.findUnique({
    where: { code: "IC-222P" },
    select: {
      code: true,
      name: true,
      branchMappings: true,
    }
  });

  console.log(JSON.stringify(course, null, 2));

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(console.error);
