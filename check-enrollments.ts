import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkEnrollments() {
  try {
    // Find B23243 user
    const user = await prisma.user.findUnique({
      where: { email: 'b23243@students.iitmandi.ac.in' },
      select: { 
        id: true, 
        email: true,
        enrollmentId: true,
        batch: true,
        enrollments: {
          select: {
            id: true,
            semester: true,
            academicYear: true,
            status: true,
            course: {
              select: { code: true, name: true }
            }
          }
        }
      }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log(`✅ User: ${user.email}`);
    console.log(`📋 Total enrollments: ${user.enrollments.length}`);
    console.log(`🎓 Batch: ${user.batch}`);
    console.log(`📝 EnrollmentId: ${user.enrollmentId}`);

    // Group by semester
    const bySem = new Map<number, number>();
    user.enrollments.forEach(e => {
      const count = bySem.get(e.semester) || 0;
      bySem.set(e.semester, count + 1);
    });

    console.log('\n📊 Courses by semester:');
    Array.from(bySem.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([sem, count]) => {
        console.log(`  Sem ${sem}: ${count} courses`);
      });

    // Show first 5 courses
    console.log('\n📚 Sample courses:');
    user.enrollments.slice(0, 5).forEach(e => {
      console.log(`  ${e.course.code} (Sem ${e.semester}, ${e.academicYear}, ${e.status})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkEnrollments();
