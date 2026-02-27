import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const courseCount = await prisma.course.count();
  const uniqueCodes = await prisma.course.groupBy({
    by: ['code'],
  });

  console.log(`\n📊 Database Course Statistics`);
  console.log(`\n  Total Courses: ${courseCount}`);
  console.log(`  Unique Course Codes: ${uniqueCodes.length}`);

  // Show sample courses
  const sampleCourses = await prisma.course.findMany({
    take: 5,
  });

  console.log(`\n  Sample Courses:`);
  sampleCourses.forEach(c => {
    console.log(`    - ${c.code}: ${c.name} (${c.credits} cr)`);
  });

  await prisma.$disconnect();
}

main();
