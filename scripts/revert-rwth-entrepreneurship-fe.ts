/**
 * Revert Entrepreneurship 101 categories:
 *  - Pre-existing RWTH rows (81.00003/00102/00103/00104) back to CSE:FE.
 *  - Newly-added modules (81.0008_1/_2/_3/_4/_8) stay CSE:HSS.
 * Run: npx tsx scripts/revert-rwth-entrepreneurship-fe.ts
 */
import { PrismaClient, CourseCategoryType } from "@prisma/client";

const prisma = new PrismaClient();

const FE_CODES = ["81.00003", "81.00102", "81.00103", "81.00104"];

async function main() {
  for (const code of FE_CODES) {
    const course = await prisma.course.findUnique({ where: { code } });
    if (!course) { console.log(`  (skip) ${code} not found`); continue; }
    await prisma.courseBranchMapping.updateMany({
      where: { courseId: course.id, branch: "CSE" },
      data: { courseCategory: CourseCategoryType.FE },
    });
    console.log(`✓ ${code} → CSE:FE`);
  }
  console.log("\nDone!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
