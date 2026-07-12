/**
 * Civil Engineering: mark every CE-xxx course that is NOT Discipline Core (DC)
 * as a Discipline Elective (DE) in courseBranchMapping (branch "CE", batch "").
 *
 * Preserved (NOT flipped to DE):
 *   - DC            : genuine discipline core
 *   - IC / MTP      : institute-core internship (CE-010), major technical projects
 *   - Internship &  : CE-396P / CE-399P / CE-587P / CE-690P are P/F Free Electives
 *     PG-project P    (the runtime forces internships to FE regardless of mapping)
 *
 * This complements the runtime rule in creditCalculator.ts which sends any
 * *unmapped* CE-xxx course to DE. Here we fix courses that carry a stale
 * FE/other mapping so the data itself is correct.
 *
 * Run: npx tsx scripts/add-ce-de-mappings.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Categories that must never be downgraded to DE.
const PRESERVE_CATEGORIES = new Set(["DC", "IC", "MTP"]);

// Internship / PG-project practical codes that stay Free Elective.
const PRESERVE_CODES = new Set(["CE-396P", "CE-399P", "CE-587P", "CE-690P"]);

async function main() {
  const courses = await prisma.course.findMany({
    where: { code: { startsWith: "CE-" } },
    select: {
      id: true,
      code: true,
      name: true,
      branchMappings: {
        where: { branch: "CE", batch: "" },
        select: { courseCategory: true },
      },
    },
    orderBy: { code: "asc" },
  });

  console.log(`Found ${courses.length} CE-* courses in DB\n`);

  let changed = 0, keptDC = 0, keptOther = 0, alreadyDE = 0;

  for (const course of courses) {
    const current = course.branchMappings[0]?.courseCategory;

    if (current === "DE") {
      alreadyDE++;
      continue;
    }
    if (current && PRESERVE_CATEGORIES.has(current)) {
      if (current === "DC") keptDC++; else keptOther++;
      console.log(`  keep ${current.padEnd(3)} ${course.code}`);
      continue;
    }
    if (PRESERVE_CODES.has(course.code)) {
      keptOther++;
      console.log(`  keep FE  ${course.code} (internship/PG project)`);
      continue;
    }

    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId: course.id, branch: "CE", batch: "" } },
      update: { courseCategory: "DE" },
      create: { courseId: course.id, branch: "CE", batch: "", courseCategory: "DE" },
    });
    console.log(`  DE ✓  ${course.code}  (was ${current ?? "unmapped"}) — ${course.name}`);
    changed++;
  }

  console.log(
    `\n✅ Set to DE: ${changed}  |  already DE: ${alreadyDE}  |  kept DC: ${keptDC}  |  kept IC/MTP/internship: ${keptOther}`
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
