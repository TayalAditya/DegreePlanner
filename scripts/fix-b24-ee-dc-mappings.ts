import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// B24 EE: these split-lab / recoded core courses were wrongly mapped as DE.
// They are part of the EE discipline core, so flip them to DC.
const CODES = ["EE-201P", "EE-205", "EE-210P", "EE-261P", "EE-316"];

async function main() {
  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const code of CODES) {
    const course = await prisma.course.findUnique({ where: { code } });
    if (!course) {
      console.log(`⚠️  Missing course: ${code}`);
      missing++;
      continue;
    }

    const mapping = await prisma.courseBranchMapping.findFirst({
      where: { branch: "EE", courseId: course.id },
    });

    if (!mapping) {
      console.log(`⚠️  No EE mapping for: ${code}`);
      missing++;
      continue;
    }

    if (mapping.courseCategory === "DC") {
      console.log(`⏭️  Already DC: ${code}`);
      skipped++;
      continue;
    }

    await prisma.courseBranchMapping.update({
      where: { id: mapping.id },
      data: { courseCategory: "DC" },
    });
    console.log(`✅ ${code}: ${mapping.courseCategory} → DC`);
    updated++;
  }

  console.log(`\nSummary: ${updated} updated, ${skipped} already DC, ${missing} missing.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
