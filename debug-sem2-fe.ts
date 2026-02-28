import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { enrollmentId: "B23243" },
    select: {
      branch: true,
      enrollments: {
        where: {
          semester: 2,
          status: "COMPLETED"
        },
        include: {
          course: {
            select: {
              code: true,
              name: true,
              credits: true,
              branchMappings: true,
            }
          }
        }
      }
    }
  });

  console.log('\n📚 Semester 2 Courses:\n');
  console.log('='.repeat(90));
  
  let totalFE = 0;
  
  user?.enrollments.forEach((e) => {
    const code = e.course.code.toUpperCase();
    const normalizedCode = code.replace(/[^A-Z0-9]/g, "");
    
    // Check what category this would be
    let category = "?";
    let reason = "";
    
    const ICB1_CODES = new Set(["IC131", "IC136", "IC230"]);
    const ICB2_CODES = new Set(["IC121", "IC240", "IC241", "IC253"]);
    
    const isICB1 = ICB1_CODES.has(normalizedCode);
    const isICB2 = ICB2_CODES.has(normalizedCode);
    
    if (isICB1 || isICB2) {
      if (normalizedCode === "IC253") {
        category = "IC_BASKET";
        reason = "CSE compulsory IC-II";
      } else {
        category = "FE";
        reason = "Non-compulsory IC basket";
      }
    } else if (normalizedCode === "IC181") {
      // Check branchMappings first
      const mapping = e.course.branchMappings?.find((m: any) => m.branch === "CS" || m.branch === "COMMON");
      if (mapping) {
        category = mapping.courseCategory;
        reason = `branchMapping: ${mapping.courseCategory}`;
      } else {
        category = "IKS";
        reason = "IC181 → IKS";
      }
    } else if (normalizedCode.startsWith("IC")) {
      category = "IC";
      reason = "Starts with IC";
    }
    
    if (category === "FE") {
      totalFE += e.course.credits;
    }
    
    console.log(`${e.course.code.padEnd(12)} | ${e.course.name.padEnd(40)} | ${String(e.course.credits).padStart(2)} cr | ${category.padEnd(10)} | ${reason}`);
  });
  
  console.log('='.repeat(90));
  console.log(`\nTotal FE credits in Sem 2: ${totalFE}\n`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(console.error);
