// fix-ee210-b24-override.ts — make EE-210 / EE-210P NOT DC for B24/B25 EE students
// For B24+ the curriculum uses EE-212 + EE-212P instead.
// The generic batch="" mapping marks EE-210 as DC for all EE batches;
// adding batch-specific overrides lets pickBranchMapping return the correct category.
//
// Run: npx tsx scripts/fix-ee210-b24-override.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  let created = 0, updated = 0;

  async function courseId(code: string) {
    const c = await prisma.course.findFirst({ where: { code }, select: { id: true } });
    return c?.id;
  }

  async function upsertMapping(cId: string, courseCode: string, branch: string, cat: string, sem: number | null, batch: string) {
    const where = { courseId_branch_batch: { courseId: cId, branch, batch } };
    const existing = await prisma.courseBranchMapping.findUnique({ where, select: { id: true, courseCategory: true } });
    if (existing) {
      if (existing.courseCategory !== cat) {
        await prisma.courseBranchMapping.update({ where, data: { courseCategory: cat, semester: sem } });
        console.log(`  UPDATED ${courseCode} ${branch} batch=${batch} → ${cat}`);
        updated++;
      } else {
        console.log(`  OK      ${courseCode} ${branch} batch=${batch} already ${cat}`);
      }
    } else {
      await prisma.courseBranchMapping.create({ data: { courseId: cId, branch, batch, courseCategory: cat, semester: sem } });
      console.log(`  CREATED ${courseCode} ${branch} batch=${batch} → ${cat}`);
      created++;
    }
  }

  // EE-210 (Digital System Design theory)
  const ee210Id = await courseId('EE-210');
  if (ee210Id) {
    console.log('\n=== EE-210 batch overrides ===');
    for (const batch of ['2024', '2025', '2026']) {
      // For EE and MEVLSI students in B24+, EE-210 is NOT in their curriculum
      // (replaced by EE-212) — mark as DE so it does not auto-count toward DC.
      await upsertMapping(ee210Id, 'EE-210', 'EE', 'DE', null, batch);
      await upsertMapping(ee210Id, 'EE-210', 'MEVLSI', 'DE', null, batch);
    }
  } else {
    console.log('  SKIP  EE-210 not found in DB');
  }

  // EE-210P (Digital System Design lab)
  const ee210pId = await courseId('EE-210P');
  if (ee210pId) {
    console.log('\n=== EE-210P batch overrides ===');
    for (const batch of ['2024', '2025', '2026']) {
      await upsertMapping(ee210pId, 'EE-210P', 'EE', 'DE', null, batch);
      await upsertMapping(ee210pId, 'EE-210P', 'MEVLSI', 'DE', null, batch);
    }
  } else {
    console.log('  SKIP  EE-210P not found in DB');
  }

  console.log(`\nDone: ${created} created, ${updated} updated`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
