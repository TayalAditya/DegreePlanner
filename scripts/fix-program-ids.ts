import prisma from '../lib/prisma';

async function main() {
  console.log('\n🔧 Fixing missing programIds on enrollments...\n');

  // Get all users with their primary program
  const users = await prisma.user.findMany({
    include: {
      programs: {
        where: { isPrimary: true },
        include: { program: true }
      }
    }
  });

  let fixed = 0;
  
  for (const user of users) {
    const primaryProgram = user.programs[0];
    
    if (!primaryProgram) {
      console.log(`⚠️  ${user.email}: No primary program found, skipping`);
      continue;
    }

    // Update all enrollments without programId
    const result = await prisma.courseEnrollment.updateMany({
      where: {
        userId: user.id,
        programId: null
      },
      data: {
        programId: primaryProgram.programId
      }
    });

    if (result.count > 0) {
      console.log(`✅ ${user.email}: Fixed ${result.count} enrollments → ${primaryProgram.program.code}`);
      fixed += result.count;
    }
  }

  console.log(`\n🎉 Total enrollments fixed: ${fixed}`);
  await prisma.$disconnect();
}

main();
