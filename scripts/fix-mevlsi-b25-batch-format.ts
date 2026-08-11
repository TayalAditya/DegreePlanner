// fix-mevlsi-b25-batch-format.ts
// Normalize B25 MEVLSI mappings to batch="2025": EE-311, EE-212 and EE-212P are semester-3 DCs; obsolete VL-201 B25 mappings are removed.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  for (const code of ["EE-311", "EE-212", "EE-212P"]) {
    const course = await prisma.course.findFirst({ where: { code } });
    if (!course) {
      console.log(`SKIP ${code} — not found`);
      continue;
    }

    const oldMapping = await prisma.courseBranchMapping.findUnique({
      where: { courseId_branch_batch: { courseId: course.id, branch: "MEVLSI", batch: "B25" } },
    });
    if (oldMapping) {
      await prisma.courseBranchMapping.delete({
        where: { courseId_branch_batch: { courseId: course.id, branch: "MEVLSI", batch: "B25" } },
      });
      console.log(`DELETED ${code} MEVLSI batch="B25"`);
    }

    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId: course.id, branch: "MEVLSI", batch: "2025" } },
      create: { courseId: course.id, branch: "MEVLSI", batch: "2025", courseCategory: "DC", semester: 3 },
      update: { courseCategory: "DC", semester: 3 },
    });
    console.log(`OK      ${code} MEVLSI batch="2025" DC sem=3`);
  }

  const vl201 = await prisma.course.findFirst({ where: { code: "VL-201" } });
  if (vl201) {
    const removed = await prisma.courseBranchMapping.deleteMany({
      where: { courseId: vl201.id, branch: "MEVLSI", batch: { in: ["B25", "2025"] } },
    });
    console.log(`DELETED ${removed.count} obsolete VL-201 B25 mapping(s)`);
  }

  console.log("\nDone.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
