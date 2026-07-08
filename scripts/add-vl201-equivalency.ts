// add-vl201-equivalency.ts
// 1. Ensure VL-201 exists in DB
// 2. Create bidirectional equivalency: EE-311 ↔ VL-201
// 3. Add DC branch mapping for VL-201 → MEVLSI B25 sem=3
// Run: npx tsx scripts/add-vl201-equivalency.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Upsert VL-201
  let vl201 = await prisma.course.findFirst({ where: { code: "VL-201" } });
  if (!vl201) {
    vl201 = await prisma.course.create({
      data: {
        code: "VL-201",
        name: "Semiconductor Device for ICs",
        credits: 3,
        department: "SCEE",
        level: 200,
        description: "",
        isActive: true,
      },
    });
    console.log("CREATED course VL-201");
  } else {
    console.log("OK      VL-201 already exists");
  }

  const ee311 = await prisma.course.findFirst({ where: { code: "EE-311" } });
  if (!ee311) {
    console.error("ERROR: EE-311 not found in DB");
    process.exit(1);
  }

  // 2. Bidirectional equivalency
  for (const [aId, bId, label] of [
    [ee311.id, vl201.id, "EE-311 → VL-201"],
    [vl201.id, ee311.id, "VL-201 → EE-311"],
  ] as [string, string, string][]) {
    const exists = await prisma.courseEquivalent.findFirst({
      where: { courseId: aId, equivalentId: bId },
    });
    if (!exists) {
      await prisma.courseEquivalent.create({
        data: { courseId: aId, equivalentId: bId },
      });
      console.log(`CREATED equiv ${label}`);
    } else {
      console.log(`OK      equiv ${label} already exists`);
    }
  }

  // 3. DC branch mapping: VL-201 → MEVLSI, B25, sem=3
  const mapping = await prisma.courseBranchMapping.findUnique({
    where: { courseId_branch_batch: { courseId: vl201.id, branch: "MEVLSI", batch: "B25" } },
  });
  if (!mapping) {
    await prisma.courseBranchMapping.create({
      data: {
        courseId: vl201.id,
        branch: "MEVLSI",
        batch: "B25",
        courseCategory: "DC",
        semester: 3,
      },
    });
    console.log("CREATED mapping VL-201 MEVLSI B25 DC sem=3");
  } else {
    console.log(`OK      mapping VL-201 MEVLSI already exists (${mapping.courseCategory} sem=${mapping.semester})`);
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
