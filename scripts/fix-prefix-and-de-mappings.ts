/**
 * Fixes course category mappings in bulk:
 *
 * 1. IK-xxx → IKS for all branches (currently some are wrongly FE)
 * 2. HS-xxx → HSS for all branches (currently some are wrongly IC)
 * 3. CS-xxx (except CSE DC codes) → DE for CSE
 * 4. DS-xxx (except CSE non-DE) → DE for CSE  [DS-302 excluded]
 * 5. CS-xxx (except DSAI DC codes) → DE for DSAI
 * 6. DS-xxx (except DSAI DC codes) → DE for DSAI
 * 7. CS-xxx (except DSE DC codes) → DE for DSE
 * 8. DS-xxx (except DSE DC codes) → DE for DSE
 *
 * Run: npx tsx scripts/fix-prefix-and-de-mappings.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── DC / skip sets per branch ──────────────────────────────────────────────

// CSE: existing DC codes (from DB) — these stay DC, not overwritten to DE
const CSE_DC = new Set([
  "CS-208","CS-214","CS-212","CS-213",
  "CS-304","CS-309","CS-313","CS-312","CS-305",
  "CS-302","CS-303",
  // DS-302 is NOT DE for CSE
  "DS-302",
]);

// DSAI DC codes (from DB)
const DSAI_DC = new Set([
  "DS-313","DS-417","DS-418","DS-412","CS-305","CS-213",
]);

// DSE DC codes (from DB)
const DSE_DC = new Set([
  "DS-413","DS-404","DS-411","CS-213","DS-313","DS-201",
  "DS-412","DS-301","DS-302","CS-305",
]);

// ── helpers ────────────────────────────────────────────────────────────────

async function upsertMapping(courseId: string, branch: string, category: string) {
  await prisma.courseBranchMapping.upsert({
    where: { courseId_branch_batch: { courseId, branch, batch: "" } },
    update: { courseCategory: category },
    create: { courseId, branch, batch: "", courseCategory: category },
  });
}

async function fixPrefixCourses(prefix: string, category: string, label: string) {
  const courses = await prisma.course.findMany({
    where: { code: { startsWith: prefix } },
    select: { id: true, code: true },
  });

  console.log(`\n[${label}] Found ${courses.length} ${prefix}* courses`);
  let updated = 0;

  for (const c of courses) {
    // Get all existing mappings for this course
    const existing = await prisma.courseBranchMapping.findMany({
      where: { courseId: c.id },
      select: { branch: true, courseCategory: true, batch: true },
    });

    // Update every branch mapping that has the wrong category
    for (const m of existing) {
      if (m.courseCategory !== category) {
        await prisma.courseBranchMapping.update({
          where: { courseId_branch_batch: { courseId: c.id, branch: m.branch, batch: m.batch ?? "" } },
          data: { courseCategory: category },
        });
        console.log(`  fixed ${c.code} (${m.branch} ${m.batch||"*"}): ${m.courseCategory} → ${category}`);
        updated++;
      }
    }

    // Also ensure a COMMON mapping exists
    const hasCommon = existing.some(m => m.branch === "COMMON" && (m.batch ?? "") === "");
    if (!hasCommon) {
      await upsertMapping(c.id, "COMMON", category);
      console.log(`  added ${c.code} COMMON → ${category}`);
      updated++;
    }
  }

  console.log(`  → ${updated} entries updated/added`);
}

async function fixDeForBranch(
  prefixes: string[],
  branch: string,
  skipCodes: Set<string>,
  label: string,
) {
  const orClauses = prefixes.map(p => ({ code: { startsWith: p } }));
  const courses = await prisma.course.findMany({
    where: { OR: orClauses },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });

  console.log(`\n[${label}] Found ${courses.length} courses`);
  let added = 0, skipped = 0;

  for (const c of courses) {
    if (skipCodes.has(c.code)) {
      console.log(`  skip DC: ${c.code}`);
      skipped++;
      continue;
    }
    await upsertMapping(c.id, branch, "DE");
    console.log(`  DE ✓  ${c.code} — ${c.name}`);
    added++;
  }

  console.log(`  → added/updated: ${added} | skipped (DC): ${skipped}`);
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Step 1: Fix IK-xxx → IKS everywhere ===");
  await fixPrefixCourses("IK-", "IKS", "IK→IKS");

  console.log("\n=== Step 2: Fix HS-xxx → HSS everywhere ===");
  await fixPrefixCourses("HS-", "HSS", "HS→HSS");

  console.log("\n=== Step 3: CS-xxx + DS-xxx → DE for CSE (skip CSE DC) ===");
  await fixDeForBranch(["CS-", "DS-"], "CSE", CSE_DC, "CSE DE");

  console.log("\n=== Step 4: CS-xxx + DS-xxx → DE for DSAI (skip DSAI DC) ===");
  await fixDeForBranch(["CS-", "DS-"], "DSAI", DSAI_DC, "DSAI DE");

  console.log("\n=== Step 5: CS-xxx + DS-xxx → DE for DSE (skip DSE DC) ===");
  await fixDeForBranch(["CS-", "DS-"], "DSE", DSE_DC, "DSE DE");

  console.log("\n\n✅ All done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
