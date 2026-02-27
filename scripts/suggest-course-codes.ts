import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findAvailableCourseCode(prefix: string, startLevel: number, endLevel: number) {
  // Try to find an available code in the given range
  for (let level = startLevel; level <= endLevel; level++) {
    for (let num = 1; num <= 20; num++) {
      const code = `${prefix}-${level}${num}`;
      const exists = await prisma.course.findUnique({
        where: { code },
      });
      if (!exists) {
        return code;
      }
    }
  }
  return null;
}

async function suggestCourseCodeFixes() {
  try {
    console.log('🔍 ANALYZING PLACEHOLDER CODES\n');
    console.log('═══════════════════════════════════════════════════════\n');

    // Get the placeholder courses
    const placeholders = await prisma.course.findMany({
      where: {
        OR: [{ code: 'ME-2000' }, { code: 'EE-3000' }],
      },
    });

    console.log(`Found ${placeholders.length} placeholder courses:\n`);

    for (const course of placeholders) {
      console.log(`📌 ${course.code}`);
      console.log(`   Name: ${course.name}`);
      console.log(`   Credits: ${course.credits}`);
      console.log(`   Offered: Fall=${course.offeredInFall}, Spring=${course.offeredInSpring}\n`);

      // Suggest alternatives based on name
      if (course.code === 'ME-2000') {
        console.log('   💡 Suggestions for ME-2000:');
        console.log('      Option 1: ME-301 (Production/Manufacturing level 300)');
        console.log('      Option 2: ME-402 (Advanced Manufacturing level 400)');
        console.log('      Option 3: Keep as is but rename to "ME-MFG" or "ME-MANF"');
        const available = await findAvailableCourseCode('ME', 2, 6);
        console.log(`      First available: ${available}\n`);
      } else if (course.code === 'EE-3000') {
        console.log('   💡 Suggestions for EE-3000:');
        console.log('      Option 1: CS-305 (Computer Architecture level 300)');
        console.log('      Option 2: EE-365 (Digital Systems level 300)');
        console.log('      Option 3: Keep as is but rename to "EE-CMP" or "EE-ARCH"');
        const available = await findAvailableCourseCode('CS', 3, 5);
        const eeAvailable = await findAvailableCourseCode('EE', 3, 5);
        console.log(`      First available CS: ${available}`);
        console.log(`      First available EE: ${eeAvailable}\n`);
      }
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('\n✅ Analysis complete. Please review suggestions above.');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

suggestCourseCodeFixes();
