import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: "b23243@students.iitmandi.ac.in" }
  });

  if (!user) {
    console.log("User not found");
    return;
  }

  console.log("User:", user.id, user.branch, "\n");

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
    orderBy: { semester: "asc" }
  });

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

  const icBasketUsed = { ic1: false, ic2: false };

  const getCourseCategory = (enrollment: any): string => {
    const code = enrollment.course?.code?.toUpperCase() || "";
    const normalizedCode = code.replace(/[^A-Z0-9]/g, "");
    const isICB1 = ICB1_CODES.has(normalizedCode);
    const isICB2 = ICB2_CODES.has(normalizedCode);

    // IC Basket compulsion logic - check BEFORE branchMappings
    if ((isICB1 || isICB2) && user.branch) {
      const branchCompulsion = IC_BASKET_COMPULSIONS[user.branch] || {};
      
      // Check if this course matches branch's IC-I compulsion
      if (isICB1 && branchCompulsion.ic1 && normalizedCode === branchCompulsion.ic1.replace(/[^A-Z0-9]/g, "")) {
        icBasketUsed.ic1 = true;
        console.log(`  ✓ ${code}: Matches IC-I compulsion (${branchCompulsion.ic1}) → IC_BASKET`);
        return "IC_BASKET";
      }
      
      // Check if this course matches branch's IC-II compulsion
      if (isICB2 && branchCompulsion.ic2 && normalizedCode === branchCompulsion.ic2.replace(/[^A-Z0-9]/g, "")) {
        icBasketUsed.ic2 = true;
        console.log(`  ✓ ${code}: Matches IC-II compulsion (${branchCompulsion.ic2}) → IC_BASKET`);
        return "IC_BASKET";
      }
      
      // No compulsion for this basket type - first course counts as IC_BASKET
      if (isICB1 && !branchCompulsion.ic1 && !icBasketUsed.ic1) {
        icBasketUsed.ic1 = true;
        console.log(`  ✓ ${code}: First IC-I (no compulsion) → IC_BASKET`);
        return "IC_BASKET";
      }
      
      if (isICB2 && !branchCompulsion.ic2 && !icBasketUsed.ic2) {
        icBasketUsed.ic2 = true;
        console.log(`  ✓ ${code}: First IC-II (no compulsion) → IC_BASKET`);
        return "IC_BASKET";
      }
      
      // Additional IC basket courses → FE
      console.log(`  ✗ ${code}: Extra IC basket course → FE`);
      return "FE";
    }

    const mappings = enrollment.course?.branchMappings || [];
    if (mappings.length > 0) {
      const mappingBranch = user.branch === "CSE" ? "CS" : user.branch;
      const mapping = mappings.find(
        (m: any) => m.branch === mappingBranch || m.branch === "COMMON"
      ) || (user.branch === "GE"
        ? mappings.find((m: any) => m.branch.startsWith("GE"))
        : undefined) || (mappings.length === 1 ? mappings[0] : undefined);

      if (mapping) {
        console.log(`  → ${code}: Branch mapping (${mapping.branch}) → ${mapping.courseCategory}`);
        return mapping.courseCategory;
      }
    }

    if (isICB1 || isICB2) {
      console.log(`  → ${code}: IC basket (no mapping) → IC_BASKET`);
      return "IC_BASKET";
    }

    console.log(`  → ${code}: Other → DC`);
    return "DC";
  };

  const branch = user.branch ?? "";

  console.log("=== IC BASKET LOGIC TRACE ===\n");
  console.log(`Branch: ${user.branch ?? "UNKNOWN"}`);
  console.log(`IC-I Compulsion: ${(branch && IC_BASKET_COMPULSIONS[branch]?.ic1) || "NONE (first counts)"}`);
  console.log(`IC-II Compulsion: ${(branch && IC_BASKET_COMPULSIONS[branch]?.ic2) || "NONE (first counts)"}`);
  console.log("\n=== ENROLLMENT PROCESSING ORDER ===\n");

  const results: Record<string, { semester: number; category: string }> = {};

  for (const e of enrollments) {
    const code = e.course.code.toUpperCase();
    const normalizedCode = code.replace(/[^A-Z0-9]/g, "");
    const isICB = ICB1_CODES.has(normalizedCode) || ICB2_CODES.has(normalizedCode);
    
    if (isICB || code.startsWith("IC")) {
      console.log(`Sem ${e.semester}: ${code}`);
      const category = getCourseCategory(e);
      results[code] = { semester: e.semester, category };
    }
  }

  console.log("\n=== FINAL IC BASKET RESULTS ===");
  console.log(`IC-I used: ${icBasketUsed.ic1}`);
  console.log(`IC-II used: ${icBasketUsed.ic2}`);
  
  Object.entries(results)
    .sort(([, a], [, b]) => a.semester - b.semester)
    .forEach(([code, { semester, category }]) => {
      console.log(`Sem ${semester}: ${code.padEnd(10)} → ${category}`);
    });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
