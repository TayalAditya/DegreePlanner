import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const courses = await prisma.course.findMany({
    where: {
      code: { startsWith: 'IC-' },
      credits: 2,
    },
    select: {
      code: true,
      name: true,
      credits: true,
    },
    orderBy: { code: 'asc' },
  });

  console.log('\n📚 2-Credit IC Courses:');
  console.log('='.repeat(60));
  courses.forEach((c) => {
    console.log(`${c.code.padEnd(10)} | ${c.name.padEnd(35)} | ${c.credits} cr`);
  });
  console.log('='.repeat(60));
  console.log(`Total: ${courses.length} courses\n`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(console.error);
