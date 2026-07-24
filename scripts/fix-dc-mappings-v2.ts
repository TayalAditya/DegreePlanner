// fix-dc-mappings-v2.ts — follow-up DC mapping corrections
// Run: npx tsx scripts/fix-dc-mappings-v2.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  let created = 0, updated = 0, deleted = 0;

  async function courseId(code: string) {
    const c = await prisma.course.findFirstOrThrow({ where: { code }, select: { id: true } });
    return c.id;
  }

  async function upsertMapping(courseCode: string, branch: string, cat: string, sem: number | null, batch?: string) {
    const cId = await courseId(courseCode);
    const where = { courseId_branch_batch: { courseId: cId, branch, batch: batch ?? '' } };
    const existing = await prisma.courseBranchMapping.findUnique({ where, select: { id: true, courseCategory: true, semester: true } });
    if (existing) {
      if (existing.courseCategory !== cat || existing.semester !== sem) {
        await prisma.courseBranchMapping.update({ where, data: { courseCategory: cat, semester: sem } });
        console.log(`  UPDATED ${courseCode} ${branch}${batch ? ' b' + batch : ''} → ${cat} sem=${sem}`);
        updated++;
      } else {
        console.log(`  OK      ${courseCode} ${branch}${batch ? ' b' + batch : ''} already ${cat} sem=${sem}`);
      }
    } else {
      await prisma.courseBranchMapping.create({ data: { courseId: cId, branch, batch: batch ?? '', courseCategory: cat, semester: sem } });
      console.log(`  CREATED ${courseCode} ${branch}${batch ? ' b' + batch : ''} ${cat} sem=${sem}`);
      created++;
    }
  }

  async function deleteMapping(courseCode: string, branch: string, batch?: string) {
    const cId = await courseId(courseCode);
    const where = { courseId_branch_batch: { courseId: cId, branch, batch: batch ?? '' } };
    const existing = await prisma.courseBranchMapping.findUnique({ where, select: { id: true } });
    if (existing) {
      await prisma.courseBranchMapping.delete({ where });
      console.log(`  DELETED ${courseCode} ${branch}${batch ? ' b' + batch : ''}`);
      deleted++;
    } else {
      console.log(`  SKIP    ${courseCode} ${branch} (already absent)`);
    }
  }

  // ─── Fix 1: ME semester corrections ───
  console.log('\n=== Fix 1: ME sem corrections ===');
  await upsertMapping('IC-241', 'ME', 'DC', 3);    // was sem=4, PDF says sem=3
  await upsertMapping('ME-308', 'ME', 'DC', 4);    // was sem=3, PDF says sem=4
  await upsertMapping('ME-205', 'ME', 'DC', 4);    // was sem=3, PDF says sem=4

  // ─── Fix 2: ME-212 MSE → sem 5 ───
  console.log('\n=== Fix 2: ME-212 MSE → sem 5 ===');
  await upsertMapping('ME-212', 'MSE', 'DC', 5);   // was sem=3, PDF says sem=5

  // ─── Fix 3: ME-213 stays 4cr (LTPC 3-1-0-4 confirms 4cr) ───
  // PDF shows 3cr for GE-OPEN but LTPC says 4cr — trust LTPC, PDF may have typo
  console.log('\n=== Fix 3: ME-213 credits — LTPC confirms 4cr, no change ===');

  // ─── Fix 4: Remove EE-302/EE-302P from GE umbrella ───
  // PDF only lists EE-302 as DC for GE-FIN, not for COMM/OPEN/MECH/ROBO
  console.log('\n=== Fix 4: Remove EE-302/P from GE umbrella ===');
  await deleteMapping('EE-302', 'GE');
  await deleteMapping('EE-302P', 'GE');

  // ─── Fix 5: Remove EE-301 from GE-MECH and GE-ROBO ───
  // EE-301↔EE-302 are equivalents; PDF only lists EE-302 for these branches
  console.log('\n=== Fix 5: Remove EE-301 from GE-MECH/ROBO ===');
  await deleteMapping('EE-301', 'GE-MECH');
  await deleteMapping('EE-301', 'GE-ROBO');

  // ─── Fix 6: DS-404 DSE batch-specific sem for B24 ───
  // PDF: B23=sem4, B24=sem5. DB has sem=4 (generic). Add B24-specific override.
  console.log('\n=== Fix 6: DS-404 DSE B24 → sem 5 ===');
  await upsertMapping('DS-404', 'DSE', 'DC', 5, '2024');

  // ─── Fix 7: EE-314 credits 3→4 (LTPC 3-0-2-4 = 4cr) ───
  console.log('\n=== Fix 7: EE-314 credits 3→4 ===');
  const ee314 = await prisma.course.findFirstOrThrow({ where: { code: 'EE-314' } });
  if (ee314.credits !== 4) {
    await prisma.course.update({ where: { id: ee314.id }, data: { credits: 4 } });
    console.log('  UPDATED EE-314 credits 3→4');
    updated++;
  } else {
    console.log('  OK      EE-314 already 4cr');
  }

  // ─── Fix 7b: EE-305 ↔ EE-314 equivalence ───
  console.log('\n=== Fix 7b: EE-305 ↔ EE-314 equivalence ===');
  const ee305 = await prisma.course.findFirst({ where: { code: 'EE-305' } });
  if (ee305) {
    for (const [aId, bId, aCode, bCode] of [
      [ee314.id, ee305.id, 'EE-314', 'EE-305'],
      [ee305.id, ee314.id, 'EE-305', 'EE-314'],
    ] as const) {
      const exists = await prisma.courseEquivalent.findFirst({ where: { courseId: aId as string, equivalentId: bId as string } });
      if (!exists) {
        await prisma.courseEquivalent.create({ data: { courseId: aId as string, equivalentId: bId as string } });
        console.log(`  CREATED equiv ${aCode} → ${bCode}`);
        created++;
      } else {
        console.log(`  OK      equiv ${aCode} → ${bCode} already exists`);
      }
    }
  }

  // ─── Fix 7c: EE-316 ↔ EE-304 equivalence ───
  console.log('\n=== Fix 7c: EE-316 ↔ EE-304 equivalence ===');
  const ee316 = await prisma.course.findFirst({ where: { code: 'EE-316' } });
  const ee304 = await prisma.course.findFirst({ where: { code: 'EE-304' } });
  if (ee316 && ee304) {
    for (const [aId, bId, aCode, bCode] of [
      [ee316.id, ee304.id, 'EE-316', 'EE-304'],
      [ee304.id, ee316.id, 'EE-304', 'EE-316'],
    ] as const) {
      const exists = await prisma.courseEquivalent.findFirst({ where: { courseId: aId as string, equivalentId: bId as string } });
      if (!exists) {
        await prisma.courseEquivalent.create({ data: { courseId: aId as string, equivalentId: bId as string } });
        console.log(`  CREATED equiv ${aCode} → ${bCode}`);
        created++;
      } else {
        console.log(`  OK      equiv ${aCode} → ${bCode} already exists`);
      }
    }
  }

  console.log(`\n=== DONE: ${created} created, ${updated} updated, ${deleted} deleted ===`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
