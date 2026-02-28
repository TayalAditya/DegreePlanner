import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Get B23243 user
  const user = await prisma.user.findFirst({
    where: { enrollmentId: "B23243" }
  });

  if (!user) {
    console.log("User not found");
    return;
  }

  console.log("User:", user.enrollmentId, "Branch:", user.branch);

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

  console.log("\n=== Checking FE courses ===");

  const ICB1_CODES = new Set(["IC131", "IC136", "IC230"]);
  const ICB2_CODES = new Set(["IC121", "IC240", "IC241", "IC253"]);

  enrollments.forEach((e) => {
    const code = e.course.code.toUpperCase();
    const normalizedCode = code.replace(/[^A-Z0-9]/g, "");
    const isICB1 = ICB1_CODES.has(normalizedCode);
    const isICB2 = ICB2_CODES.has(normalizedCode);
    const branch = user.branch;
    const mappingBranch = branch === "CSE" ? "CS" : branch;

    // Check branchMapping
    const mapping = e.course.branchMappings?.find(
      (m: any) => m.branch === mappingBranch || m.branch === "COMMON"
    );

    let category = "UNKNOWN";

    if (mapping) {
      category = mapping.courseCategory;
    } else if (isICB1 || isICB2) {
      category = "IC_BASKET";
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
    } else {
      category = "DC";
    }

    if (category === "FE" || e.courseType === "FREE_ELECTIVE") {
      console.log(`${e.course.code} (${e.course.credits}cr) - courseType: ${e.courseType}, mapping: ${mapping?.courseCategory || "none"}, computed: ${category}`);
    }
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
