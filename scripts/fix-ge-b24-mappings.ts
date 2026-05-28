import { PrismaClient, CourseCategoryType } from "@prisma/client";

const prisma = new PrismaClient();

// B24 GE: these codes are DC in at least one sub-branch curriculum (per official PDF)
// but were missing from CourseBranchMapping for branch="GE". Add as DC so "Counts As"
// shows Discipline Core for B24 GE students.
const DC_CODES = [
  "EE-203",  // Network Theory (DC for Mechatronics & Communication Technology)
  "EE-205",  // Electromagnetics & Wave Propagation (DC for Communication Technology)
  "AR-519",  // Robot Manipulators (DC for AI & Robotics)
  "AR-520",  // Design Practicum of Mechatronic Systems (DC for AI & Robotics, Mechatronics)
  "AR-521",  // Control of Robotic Systems (DC for AI & Robotics)
  "HS-307",  // Macroeconomics (DC for GE Only)
  "HS-541",  // Technical Communication (DC for GE Only)
];

async function main() {
  let added = 0;
  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const code of DC_CODES) {
    const course = await prisma.course.findUnique({ where: { code } });
    if (!course) {
      console.log(`⚠️  Course missing in DB: ${code}`);
      missing++;
      continue;
    }

    const existing = await prisma.courseBranchMapping.findFirst({
      where: { branch: "GE", courseId: course.id },
    });

    if (existing && existing.courseCategory === "DC") {
      console.log(`⏭️  Already GE/DC: ${code}`);
      skipped++;
      continue;
    }

    if (existing) {
      await prisma.courseBranchMapping.update({
        where: { id: existing.id },
        data: { courseCategory: "DC" as CourseCategoryType },
      });
      console.log(`✅ Updated to DC: ${code} (was ${existing.courseCategory})`);
      updated++;
    } else {
      await prisma.courseBranchMapping.create({
        data: {
          branch: "GE",
          courseId: course.id,
          courseCategory: "DC" as CourseCategoryType,
        },
      });
      console.log(`✅ Added GE/DC mapping: ${code}`);
      added++;
    }
  }

  console.log(`\nSummary: ${added} added, ${updated} updated, ${skipped} already DC, ${missing} missing.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
