import prisma from '../lib/prisma';

async function main() {
  console.log('\n🔍 Checking recent enrollments...\n');
  
  const enrollments = await prisma.courseEnrollment.findMany({
    take: 20,
    include: { 
      course: true,
      user: { select: { email: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Total enrollments found: ${enrollments.length}\n`);
  
  enrollments.forEach(e => {
    console.log({
      user: e.user.email,
      course: e.course.code,
      status: e.status,
      grade: e.grade || '(no grade)',
      credits: e.course.credits,
      programId: e.programId || '(no program)',
      semester: e.semester
    });
  });

  // Check COMPLETED without programId
  const completedNoProgramId = await prisma.courseEnrollment.count({
    where: {
      status: 'COMPLETED',
      programId: null
    }
  });

  console.log(`\n⚠️  Completed enrollments without programId: ${completedNoProgramId}`);

  await prisma.$disconnect();
}

main();
