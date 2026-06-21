import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // EE-302: DE → DC
  const r302 = await prisma.courseBranchMapping.updateMany({
    where: { branch: "EE", course: { code: { in: ["EE302", "EE-302"] } } },
    data: { courseCategory: "DC" },
  });
  console.log(`EE-302 EE mapping → DC: ${r302.count} row(s)`);

  // EE-303: → DC
  const r303 = await prisma.courseBranchMapping.updateMany({
    where: { branch: "EE", course: { code: { in: ["EE303", "EE-303"] } } },
    data: { courseCategory: "DC" },
  });
  console.log(`EE-303 EE mapping → DC: ${r303.count} row(s)`);

  // EE-301: DC → DE
  const r301 = await prisma.courseBranchMapping.updateMany({
    where: { branch: "EE", course: { code: { in: ["EE301", "EE-301"] } }, courseCategory: "DC" },
    data: { courseCategory: "DE" },
  });
  console.log(`EE-301 EE mapping DC → DE: ${r301.count} row(s)`);

  // EE-205: remove EE DC mapping (doesn't exist — EE-202 is the correct code)
  const r205 = await prisma.courseBranchMapping.deleteMany({
    where: { branch: "EE", course: { code: { in: ["EE205", "EE-205"] } } },
  });
  console.log(`EE-205 EE mapping deleted: ${r205.count} row(s)`);

  // EE-581: ensure DE mapping exists for EE branch
  const ee581Course = await prisma.course.findFirst({
    where: { code: { in: ["EE581", "EE-581"] } },
  });
  if (ee581Course) {
    await prisma.courseBranchMapping.upsert({
      where: { branch_courseId: { branch: "EE", courseId: ee581Course.id } },
      update: { courseCategory: "DE" },
      create: { branch: "EE", courseId: ee581Course.id, courseCategory: "DE" },
    });
    console.log(`EE-581 DE mapping for EE: upserted`);
  } else {
    console.log(`EE-581 not found in courses table — run rename-courses.ts first`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
