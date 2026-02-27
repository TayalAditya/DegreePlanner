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
  let autoEnrolled = 0;
  
  for (const user of users) {
    let primaryProgram = user.programs[0];
    
    // Auto-enroll if no primary program but has branch
    if (!primaryProgram && user.branch) {
      console.log(`⚙️  ${user.email}: No program, auto-enrolling in ${user.branch}...`);
      
      const program = await prisma.program.findUnique({
        where: { code: user.branch },
      });

      if (program) {
        const userProgram = await prisma.userProgram.create({
          data: {
            userId: user.id,
            programId: program.id,
            programType: "MAJOR",
            isPrimary: true,
            startSemester: 1,
            status: "ACTIVE",
          },
        });
        primaryProgram = { 
          programId: userProgram.programId, 
          program: program 
        } as any;
        autoEnrolled++;
        console.log(`   ✅ Auto-enrolled in ${user.branch}`);
      }
    }
    
    if (!primaryProgram) {
      console.log(`⚠️  ${user.email}: No primary program and no branch, skipping`);
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
  if (autoEnrolled > 0) {
    console.log(`🎓 Users auto-enrolled: ${autoEnrolled}`);
  }
  await prisma.$disconnect();
}

main();
