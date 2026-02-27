import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testEnrollment() {
  // Get first user
  const user = await prisma.user.findFirst();
  
  if (!user) {
    console.log('❌ No users found');
    await prisma.$disconnect();
    return;
  }
  
  console.log(`👤 Testing with user: ${user.email} (${user.id})`);
  console.log(`   Branch: ${user.branch}, Batch: ${user.batch}`);
  
  // Check if user is enrolled in program
  const userProgram = await prisma.userProgram.findFirst({
    where: { userId: user.id }
  });
  
  console.log(`\n📚 Program Enrollment: ${userProgram ? '✅ YES' : '❌ NO'}`);
  if (userProgram) {
    const program = await prisma.program.findUnique({
      where: { id: userProgram.programId }
    });
    console.log(`   Program: ${program?.code} (${program?.name})`);
  }
  
  // Check existing enrollments
  const enrollments = await prisma.courseEnrollment.findMany({
    where: { userId: user.id },
    include: { course: { select: { code: true, name: true } } }
  });
  
  console.log(`\n📖 Course Enrollments: ${enrollments.length} courses`);
  enrollments.forEach(e => {
    console.log(`   ${e.course.code} - Status: ${e.status}`);
  });
  
  // Try to create a test enrollment
  console.log(`\n🧪 Testing enrollment creation...`);
  const testCourse = await prisma.course.findFirst();
  
  if (!testCourse) {
    console.log('❌ No courses found in database');
    await prisma.$disconnect();
    return;
  }
  
  console.log(`   Attempting to enroll in: ${testCourse.code}`);
  
  try {
    const newEnrollment = await prisma.courseEnrollment.create({
      data: {
        userId: user.id,
        courseId: testCourse.id,
        semester: 1,
        year: 2023,
        term: 'FALL',
        courseType: 'CORE',
        status: 'IN_PROGRESS',
        programId: userProgram?.programId || '',
      }
    });
    console.log(`✅ Enrollment created successfully!`);
    console.log(`   ID: ${newEnrollment.id}`);
  } catch (error: any) {
    console.log(`❌ Enrollment failed!`);
    console.log(`   Error: ${error.message}`);
  }
  
  await prisma.$disconnect();
}

testEnrollment().catch(console.error);
