import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCourses() {
  const totalCourses = await prisma.course.count();
  console.log(`Total courses in database: ${totalCourses}`);
  
  const sampleCourses = await prisma.course.findMany({
    take: 10,
    select: { code: true, name: true }
  });
  
  console.log('\nSample courses:');
  sampleCourses.forEach(c => console.log(`  ${c.code} - ${c.name}`));
  
  await prisma.$disconnect();
}

checkCourses().catch(console.error);
