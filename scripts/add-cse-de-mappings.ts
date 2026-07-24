/**
 * Adds DE mappings for CSE branch:
 * All CS-xxx and DS-xxx courses that are NOT already DC for CSE get mapped as DE.
 * Run: npx tsx scripts/add-cse-de-mappings.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// These are DC for CSE — skip them (DS-302 is DC/IC, not DE)
const CSE_DC_CODES = new Set([
  "CS-208","CS-214","CS-212","CS-213",
  "CS-304","CS-309","CS-313","CS-312","CS-305",
  "CS-302","CS-303",
  "DS-302",
]);

async function main() {
  // Find all CS-xxx and DS-xxx courses in DB
  const courses = await prisma.course.findMany({
    where: {
      OR: [
        { code: { startsWith: "CS-" } },
        { code: { startsWith: "DS-" } },
      ],
    },
    select: { id: true, code: true, name: true },
  });

  console.log(`Found ${courses.length} CS-*/DS-* courses in DB`);

  let added = 0, skipped = 0;

  for (const course of courses) {
    if (CSE_DC_CODES.has(course.code)) {
      console.log(`  skip DC: ${course.code}`);
      skipped++;
      continue;
    }

    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId: course.id, branch: "CSE", batch: "" } },
      update: { courseCategory: "DE" },
      create: { courseId: course.id, branch: "CSE", batch: "", courseCategory: "DE" },
    });
    console.log(`  DE ✓  ${course.code} — ${course.name}`);
    added++;
  }

  console.log(`\n✅ Added/updated: ${added}  |  Skipped (already DC): ${skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
