import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkExtractedCourses() {
  try {
    const codes = ['IC-102P', 'CS-208', 'BE-201', 'DP-399P', 'CS-308P'];

    console.log('🔍 Checking extracted courses:\n');

    for (const code of codes) {
      const course = await prisma.course.findUnique({
        where: { code },
      });

      if (course) {
        console.log(`✅ ${code}`);
        console.log(`   Name: ${course.name}`);
        console.log(`   Credits: ${course.credits}`);
        console.log(`   Level: ${course.level}`);
      } else {
        console.log(`❌ ${code} - NOT FOUND`);
      }
    }

    // Count new courses
    const newCourses = await prisma.course.findMany({
      where: {
        description: {
          contains: 'Extracted from Excel',
        },
      },
    });

    console.log(`\n📊 Courses extracted from Excel: ${newCourses.length}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkExtractedCourses();
