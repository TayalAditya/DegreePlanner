import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// All CS-xxx and DS-xxx courses
const courses = await prisma.course.findMany({
  where: {
    OR: [
      { code: { startsWith: 'CS-' } },
      { code: { startsWith: 'DS-' } },
    ],
  },
  include: { branchMappings: { select: { branch: true, courseCategory: true } } },
});

let added = 0;
let skipped = 0;

for (const course of courses) {
  const mappings = course.branchMappings;

  // --- CSE: add CSE:DE unless CS:DC or CSE:DC already exists ---
  const cseExplicitDC = mappings.some(
    (m) => (m.branch === 'CSE' || m.branch === 'CS') && m.courseCategory === 'DC'
  );
  const cseHasDE = mappings.some(
    (m) => (m.branch === 'CSE' || m.branch === 'CS') && m.courseCategory === 'DE'
  );

  if (cseExplicitDC) {
    console.log(`SKIP CSE  ${course.code} — already DC`);
    skipped++;
  } else if (cseHasDE) {
    console.log(`OK   CSE  ${course.code} — already DE`);
  } else {
    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch: { courseId: course.id, branch: 'CSE' } },
      update: { courseCategory: 'DE' },
      create: { courseId: course.id, branch: 'CSE', courseCategory: 'DE' },
    });
    console.log(`ADD  CSE  ${course.code} → DE`);
    added++;
  }

  // --- DSE: add DSE:DE unless DSE:DC already exists ---
  const dseExplicitDC = mappings.some(
    (m) => m.branch === 'DSE' && m.courseCategory === 'DC'
  );
  const dseHasDE = mappings.some(
    (m) => m.branch === 'DSE' && m.courseCategory === 'DE'
  );

  if (dseExplicitDC) {
    console.log(`SKIP DSE  ${course.code} — already DC`);
    skipped++;
  } else if (dseHasDE) {
    console.log(`OK   DSE  ${course.code} — already DE`);
  } else {
    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch: { courseId: course.id, branch: 'DSE' } },
      update: { courseCategory: 'DE' },
      create: { courseId: course.id, branch: 'DSE', courseCategory: 'DE' },
    });
    console.log(`ADD  DSE  ${course.code} → DE`);
    added++;
  }
}

console.log(`\nDone. Added: ${added}, Skipped (explicit DC): ${skipped}`);
await prisma.$disconnect();
