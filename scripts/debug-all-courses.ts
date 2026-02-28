import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { enrollmentId: "B23243" }
  });

  if (!user) {
    console.log("User not found");
    return;
  }

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
    }
  });

  console.log("\n=== ALL COMPLETED COURSES ===");
  
  const ICB1_CODES = new Set(["IC131", "IC136", "IC230"]);
  const ICB2_CODES = new Set(["IC121", "IC240", "IC241", "IC253"]);
  const branch = user.branch;
  const mappingBranch = branch === "CSE" ? "CS" : branch;

  let totalCredits = { IC: 0, IC_BASKET: 0, DC: 0, DE: 0, FE: 0, HSS: 0, IKS: 0, MTP: 0, ISTP: 0 };

  enrollments.forEach((e) => {
    if (e.grade === "F") return;

    const code = e.course.code.toUpperCase();
    const normalizedCode = code.replace(/[^A-Z0-9]/g, "");
    const isICB1 = ICB1_CODES.has(normalizedCode);
    const isICB2 = ICB2_CODES.has(normalizedCode);

    const mapping = e.course.branchMappings?.find(
      (m: any) => m.branch === mappingBranch || m.branch === "COMMON"
    );

    let category = "DC";

    if (mapping && ["IC", "IC_BASKET", "DC", "DE", "FE", "HSS", "IKS", "MTP", "ISTP"].includes(mapping.courseCategory)) {
      category = mapping.courseCategory;
    } else if (isICB1 || isICB2) {
      category = "IC_BASKET";
    } else if (normalizedCode === "IC181") {
      category = "IKS";
    } else if (normalizedCode.startsWith("IC")) {
      category = "IC";
    } else if (normalizedCode.startsWith("HS")) {
      category = "HSS";
    } else if (normalizedCode.startsWith("IKS") || normalizedCode.startsWith("IK")) {
      category = "IKS";
    } else if (normalizedCode.includes("MTP")) {
      category = "MTP";
    } else if (normalizedCode.includes("ISTP")) {
      category = "ISTP";
    } else if (e.courseType === "DE") {
      category = "DE";
    } else if (e.courseType === "FREE_ELECTIVE" || e.courseType === "PE") {
      category = "FE";
    } else if (branch === "CSE" && normalizedCode.startsWith("DS")) {
      category = "DE";
    } else if (branch === "DSE" && normalizedCode.startsWith("CS")) {
      category = "DE";
    }

    totalCredits[category as keyof typeof totalCredits] += e.course.credits;
    console.log(`${e.course.code} (${e.course.credits}cr) - ${category} [courseType: ${e.courseType}, mapping: ${mapping?.courseCategory || "none"}]`);
  });

  console.log("\n=== TOTALS ===");
  Object.entries(totalCredits).forEach(([cat, cr]) => {
    if (cr > 0) console.log(`${cat}: ${cr}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
