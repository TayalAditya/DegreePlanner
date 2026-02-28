import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Get your user's enrollments
  const user = await prisma.user.findFirst({
    where: { 
      email: "b23243@students.iitmandi.ac.in"
    }
  });

  if (!user) {
    console.log("User not found");
    return;
  }

  console.log("User:", user.id, user.email);
  
  const enrollments = await prisma.courseEnrollment.findMany({
    where: {
      userId: user.id,
      status: "COMPLETED"
    },
    include: {
      course: {
        include: {
          branchMappings: true
        }
      }
    },
    orderBy: {
      semester: "asc"
    }
  });

  console.log("\n=== ALL COMPLETED COURSES ===");
  for (const e of enrollments) {
    const code = e.course.code.toUpperCase();
    const normalizedCode = code.replace(/[^A-Z0-9]/g, "");
    
    // Find branch mapping for CS (since CSE maps to CS)
    const mapping = e.course.branchMappings.find(m => m.branch === "CS" || m.branch === "COMMON");
    
    console.log(`\nSem ${e.semester}: ${e.course.code} (${e.course.credits}cr)`);
    console.log(`  Title: ${e.course.name}`);
    console.log(`  Normalized: ${normalizedCode}`);
    console.log(`  courseType: ${e.courseType || "NULL"}`);
    console.log(`  Branch mappings: ${e.course.branchMappings.length}`);
    
    if (mapping) {
      console.log(`  CS/COMMON Mapping: ${mapping.branch} -> ${mapping.courseCategory}`);
    } else {
      console.log(`  CS/COMMON Mapping: NONE`);
      if (e.course.branchMappings.length > 0) {
        console.log(`  Available mappings:`);
        e.course.branchMappings.forEach(m => {
          console.log(`    - ${m.branch}: ${m.courseCategory}`);
        });
      }
    }
    
    // Determine category using same logic as ProgressChart
    let category = "UNKNOWN";
    
    if (mapping && ["IC", "IC_BASKET", "DC", "DE", "FE", "HSS", "IKS", "MTP", "ISTP"].includes(mapping.courseCategory)) {
      category = mapping.courseCategory;
    } else if (normalizedCode.startsWith("IC")) {
      category = "IC";
    } else if (normalizedCode.startsWith("HS")) {
      category = "HSS";
    } else if (e.courseType === "DE") {
      category = "DE (from courseType)";
    } else if (e.courseType === "FREE_ELECTIVE" || e.courseType === "PE") {
      category = "FE (from courseType)";
    } else {
      category = "DC (fallback)";
    }
    
    console.log(`  ➜ CATEGORY: ${category}`);
  }

  // Count by category
  console.log("\n=== CATEGORY TOTALS ===");
  const categoryTotals: Record<string, number> = {};
  
  for (const e of enrollments) {
    const code = e.course.code.toUpperCase();
    const normalizedCode = code.replace(/[^A-Z0-9]/g, "");
    const mapping = e.course.branchMappings.find(m => m.branch === "CS" || m.branch === "COMMON");
    
    let category = "UNKNOWN";
    if (mapping && ["IC", "IC_BASKET", "DC", "DE", "FE", "HSS", "IKS", "MTP", "ISTP"].includes(mapping.courseCategory)) {
      category = mapping.courseCategory;
    } else if (normalizedCode.startsWith("IC")) {
      category = "IC";
    } else if (normalizedCode.startsWith("HS")) {
      category = "HSS";
    } else if (e.courseType === "DE") {
      category = "DE";
    } else if (e.courseType === "FREE_ELECTIVE" || e.courseType === "PE") {
      category = "FE";
    } else {
      category = "DC";
    }
    
    categoryTotals[category] = (categoryTotals[category] || 0) + (e.course.credits || 0);
  }
  
  Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .forEach(([cat, credits]) => {
      console.log(`${cat}: ${credits} credits`);
    });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
