// fix-dc-v3.ts — fix GE umbrella leaks + missing mappings
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function courseId(code: string) {
  return (await p.course.findFirstOrThrow({ where: { code }, select: { id: true } })).id;
}

async function upsert(courseCode: string, branch: string, cat: string, sem: number | null, batch?: string) {
  const cId = await courseId(courseCode);
  const where = { courseId_branch_batch: { courseId: cId, branch, batch: batch ?? '' } };
  const ex = await p.courseBranchMapping.findUnique({ where, select: { id: true, courseCategory: true, semester: true } });
  if (ex) {
    if (ex.courseCategory !== cat || ex.semester !== sem) {
      await p.courseBranchMapping.update({ where, data: { courseCategory: cat, semester: sem } });
      console.log(`UPDATED ${courseCode} ${branch} → ${cat} sem=${sem}`);
    } else {
      console.log(`OK      ${courseCode} ${branch} already ${cat} sem=${sem}`);
    }
  } else {
    await p.courseBranchMapping.create({ data: { courseId: cId, branch, batch: batch ?? '', courseCategory: cat, semester: sem } });
    console.log(`CREATED ${courseCode} ${branch} ${cat} sem=${sem}`);
  }
}

async function main() {
  // 1. ME-305 GE umbrella DC→DE (stops leaking to GE-COMM, GE-FIN)
  await upsert('ME-305', 'GE', 'DE', null);

  // 2. ME-309 GE umbrella DC→DE (stops leaking to GE-COMM, GE-OPEN, GE-FIN)
  await upsert('ME-309', 'GE', 'DE', null);

  // 3. EE-302 + EE-302P for GE-ROBO and GE-MECH (PDF shows sem=5)
  await upsert('EE-302', 'GE-ROBO', 'DC', 5);
  await upsert('EE-302P', 'GE-ROBO', 'DC', 5);
  await upsert('EE-302', 'GE-MECH', 'DC', 5);
  await upsert('EE-302P', 'GE-MECH', 'DC', 5);

  // 4. CE-202 for CE (PDF shows sem=3 for B24/B25, sem=2 for older but use sem=3)
  await upsert('CE-202', 'CE', 'DC', 3);

  await p.$disconnect();
  console.log('DONE');
}

main().catch(e => { console.error(e); process.exit(1); });
