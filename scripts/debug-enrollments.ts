import prisma from '../lib/prisma';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'b23243@students.iitmandi.ac.in' },
    include: {
      enrollments: {
        include: { course: true },
        where: { status: 'COMPLETED' }
      }
    }
  });

  console.log('\n📊 User:', user?.email);
  console.log('Total COMPLETED enrollments:', user?.enrollments.length);
  
  const totalCredits = user?.enrollments.reduce((sum, e) => {
    if (!e.grade || e.grade !== 'F') {
      return sum + e.course.credits;
    }
    return sum;
  }, 0);

  console.log('Total credits (excluding F):', totalCredits);
  console.log('\nSample enrollments:');
  user?.enrollments.slice(0, 5).forEach(e => {
    console.log({
      code: e.course.code,
      credits: e.course.credits,
      grade: e.grade || '(no grade)',
      courseType: e.courseType,
      status: e.status,
      programId: e.programId ? 'YES' : 'NO'
    });
  });

  await prisma.$disconnect();
}

main();
