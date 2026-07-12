/**
 * Adds a new course: CD-591 — Special Topics in Disaster Resilient Hill Roads.
 *
 *   - Offered in ODD semesters only  → offeredInFall = true, offeredInSpring = false
 *     (IIT Mandi convention: Fall = odd semester)
 *   - Discipline Elective (DE) for Civil Engineering (branch "CE")
 *   - Free Elective for everyone else — achieved implicitly: the credit calculator
 *     sends any course that HAS branch mappings but matches none of the student's
 *     branch to Free Elective (creditCalculator.ts). So a single CE→DE mapping
 *     gives "DE for CE, FE for all others" without redundant FE rows.
 *
 * Idempotent: re-running updates the existing row instead of duplicating.
 * Run: npx tsx scripts/add-cd591-course.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const code = "CD-591";

  const course = await prisma.course.upsert({
    where: { code },
    update: {
      name: "Special Topics in Disaster Resilient Hill Roads",
      credits: 1,
      offeredInFall: true,
      offeredInSpring: false,
      isActive: true,
    },
    create: {
      code,
      name: "Special Topics in Disaster Resilient Hill Roads",
      credits: 1,
      department: "Civil Engineering",
      level: 500,
      offeredInFall: true,   // odd semester
      offeredInSpring: false,
      isActive: true,
    },
  });

  console.log(`Course ${course.code} (${course.id}) ready — odd-sem only (Fall).`);

  await prisma.courseBranchMapping.upsert({
    where: { courseId_branch_batch: { courseId: course.id, branch: "CE", batch: "" } },
    update: { courseCategory: "DE" },
    create: { courseId: course.id, branch: "CE", batch: "", courseCategory: "DE" },
  });

  console.log("  DE ✓ for CE (Civil Engineering); Free Elective for all other branches.");
  console.log("\n✅ Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
