import { PrismaClient, CourseCategoryType } from "@prisma/client";

const prisma = new PrismaClient();

// DC / DE course lists per GE specialisation, from the official curriculum doc
// docs/Btech_Gen_Engg.pdf. Codes are hyphenated to match the Course.code format in DB.
// IC / ICB / HSS / IKS / ISTP / MTP rows are left untouched (shared + already correct);
// this script only re-seeds the DC and DE rows for each GE-family branch.
const SPECS: Record<string, { dc: string[]; de: string[] }> = {
  // AI & Robotics
  "GE-ROBO": {
    dc: ["EE-201", "ME-206", "DS-201", "ME-309", "AR-520", "ME-305", "EE-261", "IC-253", "EE-301", "AR-523", "AR-521", "ME-100"],
    de: ["AR-511", "CS-212", "IC-241", "ME-210", "EE-203", "AR-522", "EE-260", "ME-212", "ME-213", "GE-303",
         "EE-201P", "AR-508", "AR-525", "CE-251", "EE-604", "DS-313", "AR-524", "AR-526", "EE-211", "AR-513", "AR-509"],
  },
  // Mechatronics & AI
  "GE-MECH": {
    dc: ["EE-261", "EE-260", "EE-201", "EE-211", "ME-305", "AR-520", "ME-206", "ME-309", "EE-301", "EE-203", "EE-231", "ME-100"],
    de: ["AR-521", "EE-210", "EE-311", "EE-326", "ME-210", "ME-213", "CS-212", "GE-303", "CS-313", "EE-210P", "EE-314",
         "IC-241", "ME-212", "ME-315", "CS-305", "AR-523", "EE-529", "ME-215", "ME-527", "AR-509", "EE-201P", "IC-121", "ME-513", "AR-526"],
  },
  // Communications Technology
  "GE-COMM": {
    dc: ["ME-100", "EE-261", "EE-231", "EE-304", "EE-201", "DS-404", "EE-203", "IC-253", "EE-260", "CS-313", "EE-314", "EE-202", "EE-316"],
    de: ["EE-517", "EE-503", "IC-241", "VL-402", "EE-553", "DS-201", "GE-303", "EE-608", "EE-536", "CS-549", "EE-541",
         "EE-533", "EE-607", "EE-581", "EE-574", "EE-641", "DS-313", "EE-518", "EE-211", "EE-530", "EE-201P"],
  },
  // Open Specialisation (plain "GE"): DC 36 only; DE pool merges into FE (no DE rows).
  "GE": {
    dc: ["ME-100", "EE-261", "EE-231", "ME-213", "EE-201", "EE-211", "ME-212", "IC-241", "IC-253", "DS-201", "HS-307", "HS-541", "ME-305"],
    de: [],
  },
  // Fintech (under development — best-effort DC from the working curriculum).
  "GE-FIN": {
    dc: ["EE-261", "DS-201", "ME-206", "IC-253", "DS-313", "DS-412", "MA-546", "CS-671", "MA-653P", "ME-212", "EE-203"],
    de: [],
  },
};

async function findCourseId(code: string): Promise<string | null> {
  const course = await prisma.course.findFirst({
    where: { code: { in: [code, code.replace(/-/g, "")], mode: "insensitive" } },
    select: { id: true },
  });
  return course?.id ?? null;
}

async function seedBranch(branch: string, dc: string[], de: string[]) {
  // Remove existing DC/DE rows for this branch (keep IC/ICB/HSS/IKS/ISTP/MTP).
  await prisma.courseBranchMapping.deleteMany({
    where: { branch, courseCategory: { in: ["DC", "DE"] as CourseCategoryType[] } },
  });

  const insert = async (codes: string[], category: CourseCategoryType) => {
    let ok = 0;
    const missing: string[] = [];
    for (const code of codes) {
      const courseId = await findCourseId(code);
      if (!courseId) {
        missing.push(code);
        continue;
      }
      // A course may already have a non-DC/DE row for this branch (shouldn't for DC/DE,
      // but guard against unique (courseId,branch) collisions by upserting).
      const existing = await prisma.courseBranchMapping.findFirst({ where: { branch, courseId } });
      if (existing) {
        await prisma.courseBranchMapping.update({ where: { id: existing.id }, data: { courseCategory: category } });
      } else {
        await prisma.courseBranchMapping.create({ data: { branch, courseId, courseCategory: category } });
      }
      ok++;
    }
    return { ok, missing };
  };

  const dcRes = await insert(dc, "DC" as CourseCategoryType);
  const deRes = await insert(de, "DE" as CourseCategoryType);
  console.log(`\n=== ${branch} ===`);
  console.log(`  DC: ${dcRes.ok}/${dc.length}` + (dcRes.missing.length ? `  missing: ${dcRes.missing.join(", ")}` : ""));
  console.log(`  DE: ${deRes.ok}/${de.length}` + (deRes.missing.length ? `  missing: ${deRes.missing.join(", ")}` : ""));
}

async function main() {
  for (const [branch, { dc, de }] of Object.entries(SPECS)) {
    await seedBranch(branch, dc, de);
  }
  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
