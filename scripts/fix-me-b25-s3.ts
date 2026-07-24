// fix-me-b25-s3.ts — ME B25 S3 curriculum fix
// 1. Remove EE-261 from ME B25 (add NA override so it doesn't inherit default DC)
// 2. Move IC-241 from sem4 to sem3 for ME B25
// Run: npx tsx scripts/fix-me-b25-s3.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // ── 1. EE-261: create batch="2025" NA override for ME ──
  const ee261 = await prisma.course.findFirstOrThrow({ where: { code: "EE-261" }, select: { id: true } });
  const ee261Key = { courseId: ee261.id, branch: "ME", batch: "2025" };
  const existing261 = await prisma.courseBranchMapping.findUnique({ where: { courseId_branch_batch: ee261Key } });

  if (existing261) {
    await prisma.courseBranchMapping.update({
      where: { courseId_branch_batch: ee261Key },
      data: { courseCategory: "NA", semester: null },
    });
    console.log("UPDATED EE-261 ME B25 → NA (was", existing261.courseCategory, ")");
  } else {
    await prisma.courseBranchMapping.create({
      data: { courseId: ee261.id, branch: "ME", batch: "2025", courseCategory: "NA", semester: null },
    });
    console.log("CREATED EE-261 ME B25 → NA (overrides default DC)");
  }

  // ── 2. IC-241: update B25 override from sem4 → sem3 ──
  const ic241 = await prisma.course.findFirstOrThrow({ where: { code: "IC-241" }, select: { id: true } });
  const ic241Key = { courseId: ic241.id, branch: "ME", batch: "2025" };
  const existing241 = await prisma.courseBranchMapping.findUnique({ where: { courseId_branch_batch: ic241Key } });

  if (existing241) {
    await prisma.courseBranchMapping.update({
      where: { courseId_branch_batch: ic241Key },
      data: { courseCategory: "DC", semester: 3 },
    });
    console.log("UPDATED IC-241 ME B25 → DC sem3 (was", existing241.courseCategory, "sem" + existing241.semester, ")");
  } else {
    await prisma.courseBranchMapping.create({
      data: { courseId: ic241.id, branch: "ME", batch: "2025", courseCategory: "DC", semester: 3 },
    });
    console.log("CREATED IC-241 ME B25 → DC sem3");
  }

  await prisma.$disconnect();
  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });
