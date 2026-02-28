import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // IC Basket courses: 136, 131, 230, 241, 240, 253, 121
  const icCodes = ['IC-131', 'IC-136', 'IC-121', 'IC-230', 'IC-240', 'IC-241', 'IC-253'];
  
  const courses = await prisma.course.findMany({
    where: {
      code: {
        in: icCodes,
      },
    },
    select: {
      code: true,
      name: true,
      credits: true,
      department: true,
    },
    orderBy: { code: 'asc' },
  });

  console.log('\n📚 Correct IC Basket Courses:');
  console.log('='.repeat(60));
  let totalCredits = 0;
  courses.forEach((c) => {
    console.log(`${c.code.padEnd(10)} | ${c.name.padEnd(35)} | ${c.credits} cr`);
    totalCredits += c.credits;
  });
  console.log('='.repeat(60));
  console.log(`Total: ${courses.length} courses, ${totalCredits} credits\n`);

  process.exit(0);
}

main().catch(console.error);
