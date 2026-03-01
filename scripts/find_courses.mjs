import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Get all IC courses with COMMON or CSE mapping as IC/DC
const allIC = await prisma.course.findMany({
  where: { code: { startsWith: 'IC-' } },
  include: { branchMappings: { select: { branch: true, courseCategory: true } } },
  orderBy: { code: 'asc' },
});

// Get Farhan's enrolled course IDs
const user = await prisma.user.findFirst({ where: { enrollmentId: 'B23155' }, select: { id: true } });
const enrolled = await prisma.courseEnrollment.findMany({
  where: { userId: user.id },
  select: { courseId: true, status: true, course: { select: { code: true } } },
});
const enrolledIds = new Set(enrolled.map(e => e.courseId));

console.log('\nIC courses Farhan has NOT enrolled in:');
for (const c of allIC) {
  if (!enrolledIds.has(c.id)) {
    const catForCSE = c.branchMappings.find(m => ['CSE','CS','COMMON'].includes(m.branch))?.courseCategory;
    if (catForCSE && ['IC','IC_BASKET','DC'].includes(catForCSE)) {
      console.log(`${c.code} | ${c.name} | ${c.credits}cr | ${catForCSE}`);
    }
  }
}

console.log('\nAll IC enrollments for Farhan:');
for (const e of enrolled) {
  if (e.course.code.startsWith('IC')) console.log(`${e.course.code} | ${e.status}`);
}

await prisma.$disconnect();
