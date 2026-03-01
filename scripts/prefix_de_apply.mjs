import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PREFIX_TO_BRANCH = {
  EE:  'EE',
  ME:  'ME',
  CE:  'CE',
  BE:  'BE',
  MSE: 'MSE',
  EP:  'EP',
  BS:  'BS',
  CS:  'CS',
};

const courses = await prisma.course.findMany({
  select: {
    id: true, code: true,
    branchMappings: { select: { branch: true, courseCategory: true } }
  }
});

let created = 0, updated = 0;

for (const c of courses) {
  const prefix = c.code.split('-')[0].split(/\d/)[0].toUpperCase();
  const branch = PREFIX_TO_BRANCH[prefix];
  if (!branch) continue;

  const existing = c.branchMappings.find(m => m.branch === branch);
  if (existing && ['DC','IC','IC_BASKET'].includes(existing.courseCategory)) continue;

  if (!existing) {
    await prisma.courseBranchMapping.create({
      data: { courseId: c.id, branch, courseCategory: 'DE' }
    });
    created++;
  } else {
    await prisma.courseBranchMapping.updateMany({
      where: { courseId: c.id, branch },
      data: { courseCategory: 'DE' }
    });
    updated++;
  }
}

console.log(`Done — Created: ${created}, Updated: ${updated}`);
await prisma.$disconnect();
