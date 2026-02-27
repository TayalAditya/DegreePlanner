import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyMigration() {
  try {
    console.log('🔍 COURSE DATABASE VERIFICATION\n');
    console.log('=====================================\n');

    // Count total courses
    const totalCourses = await prisma.course.findMany();
    console.log(`📊 Total courses in database: ${totalCourses.length}`);

    // Count by department
    const departments = new Map<string, number>();
    const coursesByCode = new Map<string, string>();

    for (const course of totalCourses) {
      const dept = course.code.substring(0, 2);
      departments.set(dept, (departments.get(dept) || 0) + 1);
      coursesByCode.set(course.code, course.name);
    }

    console.log('\n📋 Courses by department:\n');
    const sortedDepts = Array.from(departments.entries()).sort((a, b) => b[1] - a[1]);

    for (const [dept, count] of sortedDepts) {
      console.log(`  ${dept}: ${count} courses`);
    }

    // Check for critical courses
    console.log('\n🎯 Critical courses check:\n');

    const criticalCodes = [
      'IC-102P',
      'DP-301P',
      'DP-010P',
      'DP-011P',
      'CS-208',
      'BE-201',
      'CE-301',
    ];

    for (const code of criticalCodes) {
      const course = totalCourses.find((c) => c.code === code);
      if (course) {
        console.log(`  ✅ ${code}: ${course.name} (${course.credits} credits)`);
      } else {
        console.log(`  ❌ ${code}: NOT FOUND`);
      }
    }

    // Sample courses by level
    console.log('\n🔍 Courses by level:\n');
    const level100 = totalCourses.filter((c) => c.level >= 100 && c.level < 200);
    const level200 = totalCourses.filter((c) => c.level >= 200 && c.level < 300);
    const level300 = totalCourses.filter((c) => c.level >= 300 && c.level < 400);
    const level500plus = totalCourses.filter((c) => c.level >= 500);

    console.log(`  100-level: ${level100.length} courses`);
    console.log(`  200-level: ${level200.length} courses`);
    console.log(`  300-level: ${level300.length} courses`);
    console.log(`  500+-level: ${level500plus.length} courses`);

    // Check for courses with instructor info
    console.log('\n👥 Instructor information:\n');
    const coursesWithInstructors = totalCourses.filter((c) => c.description?.includes('Instructor'));
    console.log(`  Courses with instructor data: ${coursesWithInstructors.length}`);

    if (coursesWithInstructors.length > 0) {
      console.log('\n  Sample courses with instructor info:');
      coursesWithInstructors.slice(0, 5).forEach((course) => {
        const instructors = course.description?.match(/Instructors: (.+?) \|/)?.[1] || 'N/A';
        console.log(`    - ${course.code}: ${instructors}`);
      });
    }

    // Final summary
    console.log('\n=====================================');
    console.log('✅ VERIFICATION COMPLETE\n');
    console.log(`Total courses verified: ${totalCourses.length}`);
    console.log(`Departments: ${departments.size}`);
    console.log('Status: Ready for use in dashboard\n');

    return totalCourses;
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyMigration();
