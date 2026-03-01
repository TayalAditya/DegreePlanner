import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// ─── helpers ──────────────────────────────────────────────────────────────────
async function courseId(code) {
  const c = await prisma.course.findFirst({ where: { code }, select: { id: true } });
  return c?.id ?? null;
}

async function upsertMapping(courseCode, branch, category) {
  const id = await courseId(courseCode);
  if (!id) { console.warn(`  SKIP (not in DB): ${courseCode}`); return; }
  const existing = await prisma.courseBranchMapping.findFirst({
    where: { courseId: id, branch },
    select: { id: true, courseCategory: true }
  });
  if (existing) {
    if (['DC','IC','IC_BASKET'].includes(existing.courseCategory)) return; // never downgrade
    if (existing.courseCategory === category) return; // no change
    await prisma.courseBranchMapping.update({ where: { id: existing.id }, data: { courseCategory: category } });
  } else {
    await prisma.courseBranchMapping.create({ data: { courseId: id, branch, courseCategory: category } });
  }
}

// ─── 1. Create AR-519 ─────────────────────────────────────────────────────────
console.log('\n=== Creating AR-519 ===');
const ar519 = await prisma.course.upsert({
  where: { code: 'AR-519' },
  create: { code: 'AR-519', name: 'Robot Manipulators', credits: 3, department: 'Robotics & Design', level: 500, offeredInFall: true, offeredInSpring: true },
  update: {},
  select: { code: true, name: true }
});
console.log('AR-519:', ar519);

// ─── 2. EP DE mappings ────────────────────────────────────────────────────────
console.log('\n=== EP DE mappings ===');
const EP_DE = [
  'PH-503','PH-504','PH-507','PH-508','PH-601','PH-603','PH-612','PH-613',
  'PH-605','PH-606','PH-604','PH-528','PH-607','PH-521','PH-608','PH-609',
  'PH-701','PH-706','PH-621',
  'MA-513','MA-522','MA-511','MA-521','MA-512','MA-560','MA-516',
  'EE-614','EE-611','EE-307','EE-621','EE-551','EE-203','EE-211',
  'EE-511','EE-519P','EE-524','EE-534','EE-593',
  'CS-241','CS-208','CS-202','CS-403','CS-309','CS-671','CS-672','CS-511','CS-304',
  'ME-307','ME-615','ME-210','ME-509','ME-510','ME-603','ME-503',
  'EP-502','DS-201','DS-404','DS-301','DS-403','DS-401','EN-502',
];
for (const code of EP_DE) await upsertMapping(code, 'EP', 'DE');
console.log(`EP DE: processed ${EP_DE.length} courses`);

// ─── 3. GE Without Specialization DC ─────────────────────────────────────────
console.log('\n=== GE DC (without specialization) ===');
const GE_DC = ['ME-100','EE-261','EE-231','ME-213','EE-201','EE-211','ME-212','IC-241','IC-253','DS-201','ME-305'];
for (const code of GE_DC) await upsertMapping(code, 'GE', 'DC');

// ─── 4. GE-MECH DC + DE ───────────────────────────────────────────────────────
console.log('\n=== GE-MECH DC ===');
const GE_MECH_DC = ['EE-261','EE-260','EE-201','EE-211','ME-305','AR-520','ME-206','ME-309','EE-326','EE-203','EE-301'];
for (const code of GE_MECH_DC) await upsertMapping(code, 'GE-MECH', 'DC');

console.log('=== GE-MECH DE ===');
const GE_MECH_DE = [
  'ME-210','EE-231','ME-452','CS-313','EE-536','EE-314','CS-305','EE-529',
  'ME-212','IC-241','ME-213','AR-502','AR-505','ME-510','AR-510','AR-511',
  'EE-311','AR-522','DS-201','ME-100','AR-519','AR-521','EE-201P','DS-313',
];
for (const code of GE_MECH_DE) await upsertMapping(code, 'GE-MECH', 'DE');

// ─── 5. GE-COMM DC + DE ───────────────────────────────────────────────────────
console.log('\n=== GE-COMM DC ===');
const GE_COMM_DC = ['ME-100','EE-261','EE-231','EE-316','EE-201','DS-404','EE-203','IC-253','EE-260','CS-313','EE-314','EE-202'];
for (const code of GE_COMM_DC) await upsertMapping(code, 'GE-COMM', 'DC');

console.log('=== GE-COMM DE ===');
const GE_COMM_DE = [
  'EE-608','EE-641','EE-536','DS-313','EE-517','EE-553','EE-503','CS-549',
  'EE-518','DS-201','EE-541','EE-211','EE-533','EE-530','EE-607','IC-241',
  'ME-212','EE-201P',
];
for (const code of GE_COMM_DE) await upsertMapping(code, 'GE-COMM', 'DE');

// ─── 6. GE-ROBO DC + DE ───────────────────────────────────────────────────────
console.log('\n=== GE-ROBO DC ===');
const GE_ROBO_DC = ['EE-201','EE-261','ME-206','IC-253','DS-201','EE-301','ME-309','AR-519','AR-520','AR-521','ME-305','ME-100'];
for (const code of GE_ROBO_DC) await upsertMapping(code, 'GE-ROBO', 'DC');

console.log('=== GE-ROBO DE ===');
const GE_ROBO_DE = [
  'EE-604','AR-526','EE-529','CE-251','AR-505','CS-514','ME-510','CS-212',
  'AR-508','EE-260','AR-502','AR-510','AR-511','EE-211','ME-212','AR-522',
  'ME-100','AR-513','ME-213','ME-210','AR-514','IC-241','EE-203','DS-313',
  'AR-524','AR-525',
];
for (const code of GE_ROBO_DE) await upsertMapping(code, 'GE-ROBO', 'DE');

console.log('\nAll done!');
await prisma.$disconnect();
