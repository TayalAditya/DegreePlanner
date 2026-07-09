// fix-mevlsi-b25-batch-format.ts
// Fix batch format from "B25" to "2025" for VL-201, EE-212, EE-212P MEVLSI mappings
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  for (const code of ["VL-201", "EE-212", "EE-212P"]) {
    const course = await prisma.course.findFirst({ where: { code } });
    if (!course) {
      console.log(`SKIP ${code} — not found`);
      continue;
    }

    // Delete old B25 mapping
    const oldMapping = await prisma.courseBranchMapping.findUnique({
      where: { courseId_branch_batch: { courseId: course.id, branch: "MEVLSI", batch: "B25" } },
    });
    if (oldMapping) {
      await prisma.courseBranchMapping.delete({
        where: { courseId_branch_batch: { courseId: course.id, branch: "MEVLSI", batch: "B25" } },
      });
      console.log(`DELETED ${code} MEVLSI batch="B25"`);
    }

    // Create new 2025 mapping
    const newMapping = await prisma.courseBranchMapping.findUnique({
      where: { courseId_branch_batch: { courseId: course.id, branch: "MEVLSI", batch: "2025" } },
    });
    if (!newMapping) {
      await prisma.courseBranchMapping.create({
        data: { courseId: course.id, branch: "MEVLSI", batch: "2025", courseCategory: "DC", semester: 3 },
      });
      console.log(`CREATED ${code} MEVLSI batch="2025" DC sem=3`);
    } else {
      console.log(`OK      ${code} MEVLSI batch="2025" already exists`);
    }
  }

  // EE-311: replaced by VL-201 for B25 MEVLSI → reclassify to FE so it drops out of DC list
  const ee311 = await prisma.course.findFirst({ where: { code: "EE-311" } });
  if (ee311) {
    const where = { courseId_branch_batch: { courseId: ee311.id, branch: "MEVLSI", batch: "2025" } };
    const existing = await prisma.courseBranchMapping.findUnique({ where });
    if (existing) {
      await prisma.courseBranchMapping.update({ where, data: { courseCategory: "FE", semester: null } });
      console.log(`UPDATED EE-311 MEVLSI batch="2025" → FE`);
    } else {
      await prisma.courseBranchMapping.create({
        data: { courseId: ee311.id, branch: "MEVLSI", batch: "2025", courseCategory: "FE", semester: null },
      });
      console.log(`CREATED EE-311 MEVLSI batch="2025" FE (replaced by VL-201)`);
    }
  }

  console.log("\nDone.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
