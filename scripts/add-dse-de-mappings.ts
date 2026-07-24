/**
 * Adds DE mappings for DSE branch:
 * All CS-xxx courses that are NOT already DC for DSE get mapped as DE.
 * Run: npx tsx scripts/add-dse-de-mappings.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// These are DC for DSE — skip them
const DSE_DC_CODES = new Set([
  "CS-305", "CS-362", "CS-213", "CS-312",
]);

async function main() {
  const courses = await prisma.course.findMany({
    where: { code: { startsWith: "CS-" } },
    select: { id: true, code: true, name: true },
  });

  console.log(`Found ${courses.length} CS-* courses in DB`);

  let added = 0, skipped = 0;

  for (const course of courses) {
    if (DSE_DC_CODES.has(course.code)) {
      console.log(`  skip DC: ${course.code}`);
      skipped++;
      continue;
    }

    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId: course.id, branch: "DSE", batch: "" } },
      update: { courseCategory: "DE" },
      create: { courseId: course.id, branch: "DSE", batch: "", courseCategory: "DE" },
    });
    console.log(`  DE ✓  ${course.code} — ${course.name}`);
    added++;
  }

  console.log(`\n✅ Added/updated: ${added}  |  Skipped (DC): ${skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
