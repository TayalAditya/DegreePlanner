import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function debug() {
  try {
    const user = await prisma.user.findFirst({
      where: { enrollmentId: { contains: 'B23' } },
      select: { id: true, email: true, batch: true }
    });

    if (!user) {
      console.log('❌ No user');
      return;
    }

    console.log(`📌 User: ${user.email} (Batch ${user.batch})`);

    const enrollments = await prisma.courseEnrollment.findMany({
      where: { userId: user.id },
      include: { course: { select: { code: true, name: true } } },
      orderBy: { semester: 'asc' }
    });

    console.log(`\n📚 Total Enrollments: ${enrollments.length}`);
    
    // Group by semester
    const bySem: Record<number, any[]> = {};
    enrollments.forEach(e => {
      if (!bySem[e.semester]) bySem[e.semester] = [];
      bySem[e.semester].push(e);
    });

    Object.entries(bySem).forEach(([sem, courses]) => {
      console.log(`\n  Semester ${sem}: ${courses.length} courses`);
      courses.slice(0, 3).forEach(c => {
        console.log(`    - ${c.course.code}: ${c.status}`);
      });
      if (courses.length > 3) console.log(`    ... +${courses.length - 3} more`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debug();
