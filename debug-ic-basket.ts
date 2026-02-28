import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get your enrollments
  const user = await prisma.user.findUnique({
    where: { enrollmentId: "B23243" }, // Your enrollment ID
    select: {
      id: true,
      name: true,
      branch: true,
      enrollments: {
        where: {
          course: {
            code: {
              in: ['IC-131', 'IC-136', 'IC-230', 'IC-121', 'IC-240', 'IC-241', 'IC-253']
            }
          }
        },
        include: {
          course: {
            select: {
              code: true,
              name: true,
              credits: true,
            }
          }
        }
      }
    }
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  console.log(`\n👤 User: ${user.name}`);
  console.log(`🎓 Branch: ${user.branch}`);
  console.log(`\n📚 IC Basket Courses Enrolled:`);
  console.log('='.repeat(70));
  
  const IC_BASKET_COMPULSIONS: Record<string, { ic1?: string; ic2?: string }> = {
    CSE: { ic2: "IC253" },
  };

  const branchCompulsion = IC_BASKET_COMPULSIONS[user.branch || ''];
  
  user.enrollments.forEach((e) => {
    const normalizedCode = e.course.code.replace(/[^A-Z0-9]/g, "");
    let category = "FE";
    
    if (branchCompulsion) {
      if (branchCompulsion.ic1 && normalizedCode === branchCompulsion.ic1.replace(/[^A-Z0-9]/g, "")) {
        category = "IC_BASKET";
      }
      if (branchCompulsion.ic2 && normalizedCode === branchCompulsion.ic2.replace(/[^A-Z0-9]/g, "")) {
        category = "IC_BASKET";
      }
    }
    
    console.log(`${e.course.code.padEnd(10)} | ${e.course.name.padEnd(35)} | ${e.course.credits} cr | ${category}`);
  });
  
  console.log('='.repeat(70));
  console.log(`\nCompulsions for ${user.branch}:`);
  if (branchCompulsion?.ic1) console.log(`  IC-I: ${branchCompulsion.ic1}`);
  if (branchCompulsion?.ic2) console.log(`  IC-II: ${branchCompulsion.ic2}`);
  console.log();

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(console.error);
