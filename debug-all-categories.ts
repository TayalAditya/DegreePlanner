import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get all enrollments for B23243
  const user = await prisma.user.findUnique({
    where: { enrollmentId: "B23243" },
    select: {
      id: true,
      name: true,
      branch: true,
      enrollments: {
        where: {
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
        },
        orderBy: {
          semester: 'asc'
        }
      }
    }
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  console.log(`\n👤 User: ${user.name}`);
  console.log(`🎓 Branch: ${user.branch}\n`);

  const IC_BASKET_COMPULSIONS: Record<string, { ic1?: string; ic2?: string }> = {
    BIO: { ic1: "IC136", ic2: "IC240" },
    CE: { ic1: "IC230", ic2: "IC240" },
    CS: { ic2: "IC253" },
    CSE: { ic2: "IC253" },
    DSE: { ic2: "IC253" },
    EP: { ic1: "IC230", ic2: "IC121" },
    ME: { ic2: "IC240" },
    CH: { ic1: "IC131", ic2: "IC121" },
    MNC: { ic1: "IC136", ic2: "IC253" },
    MS: { ic1: "IC131", ic2: "IC240" },
    GE: { ic1: "IC230", ic2: "IC240" },
  };

  const ICB1_CODES = new Set(["IC131", "IC136", "IC230"]);
  const ICB2_CODES = new Set(["IC121", "IC240", "IC241", "IC253"]);

  const getCourseCategory = (enrollment: any): string => {
    const code = enrollment.course.code.toUpperCase();
    const normalizedCode = code.replace(/[^A-Z0-9]/g, "");
    const isICB1 = ICB1_CODES.has(normalizedCode);
    const isICB2 = ICB2_CODES.has(normalizedCode);

    // IC Basket compulsion logic
    if ((isICB1 || isICB2) && user.branch) {
      const branchCompulsion = IC_BASKET_COMPULSIONS[user.branch];
      
      if (branchCompulsion) {
        // Check if this course matches branch's IC-I compulsion
        if (isICB1 && branchCompulsion.ic1 && normalizedCode === branchCompulsion.ic1.replace(/[^A-Z0-9]/g, "")) {
          return "IC_BASKET";
        }
        
        // Check if this course matches branch's IC-II compulsion
        if (isICB2 && branchCompulsion.ic2 && normalizedCode === branchCompulsion.ic2.replace(/[^A-Z0-9]/g, "")) {
          return "IC_BASKET";
        }
        
        // Non-compulsory IC basket course → FE
        return "FE";
      }
    }

    if (isICB1 || isICB2) return "IC_BASKET";

    // Check branchMappings
    if (enrollment.course.branchMappings && enrollment.course.branchMappings.length > 0 && user.branch) {
      const mappingBranch = user.branch === "CSE" ? "CS" : user.branch;
      const mapping = enrollment.course.branchMappings.find(
        (m: any) => m.branch === mappingBranch || m.branch === "COMMON"
      );

      if (mapping) {
        return mapping.courseCategory;
      }
    }

    if (normalizedCode === "IC181") return "IKS";
    if (normalizedCode.startsWith("IC")) return "IC";
    if (normalizedCode.startsWith("HS")) return "HSS";
    if (normalizedCode.startsWith("IK")) return "IKS";
    if (normalizedCode.includes("MTP")) return "MTP";
    if (normalizedCode.includes("ISTP")) return "ISTP";

    return "FE";
  };

  const categoryCredits: Record<string, number> = {
    IC: 0,
    IC_BASKET: 0,
    DC: 0,
    DE: 0,
    FE: 0,
    HSS: 0,
    IKS: 0,
    MTP: 0,
    ISTP: 0,
  };

  console.log('📚 All Completed Courses:');
  console.log('='.repeat(90));
  console.log('Sem | Code       | Name                                     | Credits | Category');
  console.log('='.repeat(90));

  user.enrollments.forEach((e) => {
    const category = getCourseCategory(e);
    categoryCredits[category] += e.course.credits;
    
    console.log(
      `${String(e.semester).padStart(3)} | ${e.course.code.padEnd(10)} | ${e.course.name.padEnd(40)} | ${String(e.course.credits).padStart(7)} | ${category}`
    );
  });

  console.log('='.repeat(90));
  console.log('\n📊 Credits by Category:');
  console.log('='.repeat(40));
  Object.entries(categoryCredits).forEach(([cat, credits]) => {
    if (credits > 0) {
      console.log(`${cat.padEnd(15)} | ${credits} credits`);
    }
  });
  console.log('='.repeat(40));
  console.log(`TOTAL: ${Object.values(categoryCredits).reduce((a, b) => a + b, 0)} credits\n`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(console.error);
