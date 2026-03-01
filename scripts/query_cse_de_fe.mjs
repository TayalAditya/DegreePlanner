import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const enrollments = await prisma.courseEnrollment.findMany({
  where: {
    status: 'COMPLETED',
    user: { branch: 'CSE' },
  },
  include: {
    user: { select: { enrollmentId: true, name: true } },
    course: {
      include: {
        branchMappings: { select: { branch: true, courseCategory: true } },
      },
    },
  },
  orderBy: [{ user: { enrollmentId: 'asc' } }, { course: { code: 'asc' } }],
});

const results = [];
for (const e of enrollments) {
  const mappings = e.course.branchMappings;
  const mapping =
    mappings.find(m => m.branch === 'CS' || m.branch === 'CSE') ||
    mappings.find(m => m.branch === 'COMMON');
  const cat = mapping?.courseCategory;
  if (cat === 'DE' || cat === 'FE' || cat === 'NA' || !mapping) {
    results.push({
      enrollmentId: e.user.enrollmentId,
      code: e.course.code,
      courseName: e.course.name,
      credits: e.course.credits,
      category: cat || '(no mapping)',
      allMappings: mappings.map(m => `${m.branch}:${m.courseCategory}`).join(', ') || '—',
    });
  }
}

console.log('\nCSE students — DE/FE/unmapped completed courses:\n');
const pad = (s, n) => String(s).padEnd(n);
for (const r of results) {
  console.log(`${pad(r.enrollmentId,10)} ${pad(r.code,10)} ${String(r.credits).padStart(2)}cr  [${pad(r.category,14)}]  ${r.courseName.substring(0,45)}`);
  if (r.allMappings !== '—') console.log(`           mappings: ${r.allMappings}`);
}

await prisma.$disconnect();
