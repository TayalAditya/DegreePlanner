import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPlaceholderCodes() {
  try {
    console.log('🔧 FIXING PLACEHOLDER COURSE CODES\n');
    console.log('═══════════════════════════════════\n');

    // Map of placeholder codes to actual codes
    const fixes = [
      {
        placeholder: 'ME-2000',
        actualCode: 'ME-308',
        reason: 'Manufacturing Engineering (level 300)',
        courseName: 'Product Manufacturing Technology',
      },
      {
        placeholder: 'EE-3000',
        actualCode: 'CS-309',
        reason: 'Computer Science (level 300) - Computer Organization',
        courseName: 'Computer Organization and Processor Architecture Design',
      },
    ];

    for (const fix of fixes) {
      console.log(`Fixing: ${fix.placeholder} → ${fix.actualCode}`);
      console.log(`  Name: ${fix.courseName}`);
      console.log(`  Reason: ${fix.reason}\n`);

      // Check if target code already exists
      const existing = await prisma.course.findUnique({
        where: { code: fix.actualCode },
      });

      if (existing) {
        console.log(`  ⚠️  Warning: ${fix.actualCode} already exists`);
        console.log(`      Current: ${existing.name}`);
        console.log(`      → Skipping to avoid conflicts\n`);
        continue;
      }

      // Get the placeholder course
      const placeholderCourse = await prisma.course.findUnique({
        where: { code: fix.placeholder },
      });

      if (!placeholderCourse) {
        console.log(`  ❌ Placeholder course not found\n`);
        continue;
      }

      // Delete the placeholder course
      await prisma.course.delete({
        where: { code: fix.placeholder },
      });

      // Create with actual code
      const updated = await prisma.course.create({
        data: {
          code: fix.actualCode,
          name: placeholderCourse.name,
          credits: placeholderCourse.credits,
          department: fix.actualCode.substring(0, 2),
          level: parseInt(fix.actualCode.charAt(3)) * 100,
          description: placeholderCourse.description || '',
          isPassFailEligible: placeholderCourse.isPassFailEligible,
          offeredInFall: placeholderCourse.offeredInFall,
          offeredInSpring: placeholderCourse.offeredInSpring,
          offeredInSummer: placeholderCourse.offeredInSummer,
        },
      });

      console.log(`  ✅ Fixed: ${fix.placeholder} → ${fix.actualCode}`);
      console.log(`     Created course: ${updated.code}\n`);
    }

    console.log('═══════════════════════════════════');
    console.log('✅ Placeholder fixes complete!\n');
  } catch (error) {
    console.error('❌ Error fixing placeholders:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixPlaceholderCodes();
