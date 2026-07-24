// fix-dc-mappings-july2026.ts — idempotent DC mapping corrections
// Run: npx tsx scripts/fix-dc-mappings-july2026.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  let created = 0, updated = 0, deleted = 0;

  // Helper: find course id by code (throws if missing)
  async function courseId(code: string) {
    const c = await prisma.course.findFirstOrThrow({ where: { code }, select: { id: true } });
    return c.id;
  }

  // Helper: upsert a branch mapping
  async function upsertMapping(courseCode: string, branch: string, cat: string, sem: number | null, batch?: string) {
    const cId = await courseId(courseCode);
    const where = { courseId_branch_batch: { courseId: cId, branch, batch: batch ?? '' } };
    const existing = await prisma.courseBranchMapping.findUnique({ where, select: { id: true, courseCategory: true, semester: true } });
    if (existing) {
      if (existing.courseCategory !== cat || existing.semester !== sem) {
        await prisma.courseBranchMapping.update({ where, data: { courseCategory: cat, semester: sem } });
        console.log(`  UPDATED ${courseCode} ${branch} → ${cat} sem=${sem}`);
        updated++;
      } else {
        console.log(`  OK      ${courseCode} ${branch} already ${cat} sem=${sem}`);
      }
    } else {
      await prisma.courseBranchMapping.create({ data: { courseId: cId, branch, batch: batch ?? '', courseCategory: cat, semester: sem } });
      console.log(`  CREATED ${courseCode} ${branch} ${cat} sem=${sem}`);
      created++;
    }
  }

  // Helper: delete a mapping if it exists
  async function deleteMapping(courseCode: string, branch: string, batch?: string) {
    const cId = await courseId(courseCode);
    const where = { courseId_branch_batch: { courseId: cId, branch, batch: batch ?? '' } };
    const existing = await prisma.courseBranchMapping.findUnique({ where, select: { id: true } });
    if (existing) {
      await prisma.courseBranchMapping.delete({ where });
      console.log(`  DELETED ${courseCode} ${branch}`);
      deleted++;
    } else {
      console.log(`  SKIP    ${courseCode} ${branch} (already absent)`);
    }
  }

  // ───────────────────────────────────────────────
  // PART A: CourseBranchMapping fixes
  // ───────────────────────────────────────────────

  console.log('\n=== Sem corrections ===');
  await deleteMapping('DS-301', 'DSAI');                        // #1 DS-301 not DSAI DC
  // #2 IC-241 ME stays sem=4 — no change
  await upsertMapping('ME-310', 'ME', 'DC', 5);                // #3
  await upsertMapping('ME-206', 'MSE', 'DC', 3);               // #4
  await upsertMapping('ME-309', 'ME', 'DC', 5);                // #5
  await upsertMapping('ME-212', 'MSE', 'DC', 5);               // #6

  console.log('\n=== GE-ROBO ===');
  await upsertMapping('AR-521', 'GE-ROBO', 'DC', 5);           // #7 DE→DC
  await upsertMapping('AR-523', 'GE-ROBO', 'DC', 5);           // #8 DE→DC
  await upsertMapping('ME-305', 'GE-ROBO', 'DC', 5);           // #9
  await upsertMapping('ME-309', 'GE-ROBO', 'DC', 5);           // #10
  await upsertMapping('EE-201', 'GE-ROBO', 'DC', 4);           // #11
  await upsertMapping('IC-253', 'GE-ROBO', 'DC', 4);           // #12
  await upsertMapping('ME-100', 'GE-ROBO', 'DC', 4);           // #13 was DE

  console.log('\n=== GE-MECH ===');
  await upsertMapping('ME-305', 'GE-MECH', 'DC', 5);           // #14
  await upsertMapping('ME-309', 'GE-MECH', 'DC', 5);           // #15
  await upsertMapping('EE-231', 'GE-MECH', 'DC', 5);           // #16 DE→DC
  await upsertMapping('EE-201', 'GE-MECH', 'DC', 4);           // #17
  await upsertMapping('EE-211', 'GE-MECH', 'DC', 4);           // #18
  await upsertMapping('ME-100', 'GE-MECH', 'DC', 4);           // #19 was DE

  console.log('\n=== GE-COMM ===');
  await upsertMapping('DS-404', 'GE-COMM', 'DC', 4);           // #20
  await upsertMapping('EE-201', 'GE-COMM', 'DC', 4);           // #21
  await upsertMapping('EE-202', 'GE-COMM', 'DC', 4);           // #22
  await upsertMapping('EE-316', 'GE-COMM', 'DC', 4);           // #23
  await upsertMapping('IC-253', 'GE-COMM', 'DC', 4);           // #24
  await upsertMapping('ME-100', 'GE-COMM', 'DC', 4);           // #25 already DC, set sem
  await upsertMapping('EE-231', 'GE-COMM', 'DC', 5);           // #26
  await upsertMapping('EE-314', 'GE-COMM', 'DC', 5);           // #27

  console.log('\n=== GE-OPEN ===');
  await upsertMapping('DS-201', 'GE-OPEN', 'DC', 5);           // #28 DE→DC
  await upsertMapping('ME-305', 'GE-OPEN', 'DC', 5);           // #29
  await upsertMapping('EE-231', 'GE-OPEN', 'DC', 5);           // #30
  await upsertMapping('EE-201', 'GE-OPEN', 'DC', 4);           // #31 new
  await upsertMapping('EE-211', 'GE-OPEN', 'DC', 4);           // #32 was DE
  await upsertMapping('IC-253', 'GE-OPEN', 'DC', 4);           // #33 new
  await upsertMapping('HS-307', 'GE-OPEN', 'DC', 4);           // #34 new
  await upsertMapping('ME-100', 'GE-OPEN', 'DC', 4);           // #35 new
  await upsertMapping('HS-541', 'GE-OPEN', 'DC', 6);           // #36 new

  console.log('\n=== GE-FIN ===');
  await upsertMapping('DS-201', 'GE-FIN', 'DC', 3);            // #37 DE→DC
  await upsertMapping('EE-261', 'GE-FIN', 'DC', 3);            // #38
  await upsertMapping('ME-206', 'GE-FIN', 'DC', 3);            // #39
  await upsertMapping('IC-253', 'GE-FIN', 'DC', 4);            // #40
  await upsertMapping('DS-313', 'GE-FIN', 'DC', 4);            // #41
  await upsertMapping('DS-412', 'GE-FIN', 'DC', 4);            // #42
  await upsertMapping('CS-671', 'GE-FIN', 'DC', 4);            // #43
  await deleteMapping('MA-653P', 'GE-FIN');                     // #44 not in PDF
  await deleteMapping('ME-212', 'GE-FIN');                      // #45 not in PDF
  await deleteMapping('EE-203', 'GE-FIN');                      // #46 not in PDF
  await upsertMapping('MA-546', 'GE-FIN', 'DC', 4);            // #47 new
  await upsertMapping('EE-302', 'GE-FIN', 'DC', 5);            // #48 new

  console.log('\n=== MEVLSI ===');
  await deleteMapping('EE-301', 'MEVLSI');                      // #49 use EE-302 instead

  // ───────────────────────────────────────────────
  // PART B: Theory/Lab split — EE-302 & EE-212
  // ───────────────────────────────────────────────

  console.log('\n=== EE-302 / EE-302P split ===');

  // EE-302: 4cr → 3cr (theory only)
  const ee302 = await prisma.course.findFirstOrThrow({ where: { code: 'EE-302' } });
  if (ee302.credits !== 3) {
    await prisma.course.update({ where: { id: ee302.id }, data: { credits: 3 } });
    console.log('  UPDATED EE-302 credits 4→3');
    updated++;
  } else {
    console.log('  OK      EE-302 already 3cr');
  }

  // Create EE-302P if it doesn't exist
  let ee302p = await prisma.course.findFirst({ where: { code: 'EE-302P' } });
  if (!ee302p) {
    ee302p = await prisma.course.create({
      data: { code: 'EE-302P', name: 'Control Systems Lab', credits: 1, department: 'SCEE', level: 300, ltpc: '0-0-2-1' },
    });
    console.log('  CREATED course EE-302P 1cr');
    created++;
  } else {
    console.log('  OK      EE-302P already exists');
  }

  // CourseEquivalent EE-302P ↔ EE-301P (bidirectional)
  const ee301p = await prisma.course.findFirst({ where: { code: 'EE-301P' } });
  if (ee301p) {
    for (const [aId, bId] of [[ee302p.id, ee301p.id], [ee301p.id, ee302p.id]]) {
      const exists = await prisma.courseEquivalent.findFirst({ where: { courseId: aId, equivalentId: bId } });
      if (!exists) {
        await prisma.courseEquivalent.create({ data: { courseId: aId, equivalentId: bId } });
        console.log(`  CREATED equiv ${aId === ee302p.id ? 'EE-302P' : 'EE-301P'} → ${bId === ee302p.id ? 'EE-302P' : 'EE-301P'}`);
        created++;
      }
    }
  }

  // Branch mappings for EE-302P — mirror EE-302's DC mappings
  // EE DC sem=5, MEVLSI DC sem=3, GE DC sem=5, GE-FIN DC sem=5
  const ee302pMappings: Array<[string, number]> = [
    ['EE', 5], ['MEVLSI', 3], ['GE', 5], ['GE-FIN', 5],
  ];
  for (const [br, sem] of ee302pMappings) {
    await upsertMapping('EE-302P', br, 'DC', sem);
  }
  // FE for other branches (same as EE-302)
  for (const br of ['BE', 'BSCS', 'CE', 'CSE', 'DSAI', 'DSE', 'EP', 'ME', 'MNC', 'MSE']) {
    await upsertMapping('EE-302P', br, 'FE', null);
  }

  // CourseOffering for EE-302P in 2026
  const ee302Off = await prisma.courseOffering.findFirst({ where: { offeringYear: 2026, courseCode: 'EE-302' } });
  if (ee302Off) {
    const ee302pOff = await prisma.courseOffering.findFirst({ where: { offeringYear: 2026, courseCode: 'EE-302P' } });
    if (!ee302pOff) {
      await prisma.courseOffering.create({
        data: {
          courseCode: 'EE-302P',
          courseName: 'Control Systems Lab (EE-302P / EE-301P)',
          courseId: ee302p.id,
          offeringYear: 2026,
          offeringSemester: ee302Off.offeringSemester,
          branches: ee302Off.branches,
          eligibleSems: ee302Off.eligibleSems,
          credits: 1,
          school: ee302Off.school,
          isActive: true,
        },
      });
      console.log('  CREATED offering EE-302P 2026');
      created++;
    } else {
      console.log('  OK      EE-302P offering already exists');
    }
    // Update EE-302 offering name and credits
    await prisma.courseOffering.update({ where: { id: ee302Off.id }, data: { courseName: 'Control Systems (EE-302 / EE-301)', credits: 3 } });
    console.log('  UPDATED EE-302 offering name + credits→3');
  }

  console.log('\n=== EE-212 / EE-212P split ===');

  // EE-212: 4cr → 3cr (theory only)
  const ee212 = await prisma.course.findFirstOrThrow({ where: { code: 'EE-212' } });
  if (ee212.credits !== 3) {
    await prisma.course.update({ where: { id: ee212.id }, data: { credits: 3 } });
    console.log('  UPDATED EE-212 credits 4→3');
    updated++;
  } else {
    console.log('  OK      EE-212 already 3cr');
  }

  // Create EE-212P if it doesn't exist
  let ee212p = await prisma.course.findFirst({ where: { code: 'EE-212P' } });
  if (!ee212p) {
    ee212p = await prisma.course.create({
      data: { code: 'EE-212P', name: 'Digital System Design Lab', credits: 1, department: 'SCEE', level: 300, ltpc: '0-0-2-1' },
    });
    console.log('  CREATED course EE-212P 1cr');
    created++;
  } else {
    console.log('  OK      EE-212P already exists');
  }

  // CourseEquivalent EE-212P ↔ EE-210P (bidirectional)
  const ee210p = await prisma.course.findFirst({ where: { code: 'EE-210P' } });
  if (ee210p) {
    for (const [aId, bId] of [[ee212p.id, ee210p.id], [ee210p.id, ee212p.id]]) {
      const exists = await prisma.courseEquivalent.findFirst({ where: { courseId: aId, equivalentId: bId } });
      if (!exists) {
        await prisma.courseEquivalent.create({ data: { courseId: aId, equivalentId: bId } });
        console.log(`  CREATED equiv ${aId === ee212p.id ? 'EE-212P' : 'EE-210P'} → ${bId === ee212p.id ? 'EE-212P' : 'EE-210P'}`);
        created++;
      }
    }
  }

  // Branch mappings for EE-212P — same as EE-212's DC branches
  // EE-212 is DC for EE and MEVLSI; for all others it's broader
  const ee212mappings = await prisma.courseBranchMapping.findMany({
    where: { courseId: ee212.id },
    select: { branch: true, batch: true, courseCategory: true, semester: true },
  });
  for (const m of ee212mappings) {
    await upsertMapping('EE-212P', m.branch, m.courseCategory, m.semester, m.batch || undefined);
  }

  // CourseOffering for EE-212P in 2026
  const ee212Off = await prisma.courseOffering.findFirst({ where: { offeringYear: 2026, courseCode: 'EE-212' } });
  if (ee212Off) {
    const ee212pOff = await prisma.courseOffering.findFirst({ where: { offeringYear: 2026, courseCode: 'EE-212P' } });
    if (!ee212pOff) {
      await prisma.courseOffering.create({
        data: {
          courseCode: 'EE-212P',
          courseName: 'Digital System Design Lab (EE-212P / EE-210P)',
          courseId: ee212p.id,
          offeringYear: 2026,
          offeringSemester: ee212Off.offeringSemester,
          branches: ee212Off.branches,
          eligibleSems: ee212Off.eligibleSems,
          credits: 1,
          school: ee212Off.school,
          isActive: true,
        },
      });
      console.log('  CREATED offering EE-212P 2026');
      created++;
    } else {
      console.log('  OK      EE-212P offering already exists');
    }
    // Update EE-212 offering name and credits
    await prisma.courseOffering.update({ where: { id: ee212Off.id }, data: { courseName: 'Digital System Design (EE-212 / EE-210)', credits: 3 } });
    console.log('  UPDATED EE-212 offering name + credits→3');
  }

  console.log(`\n=== DONE: ${created} created, ${updated} updated, ${deleted} deleted ===`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
