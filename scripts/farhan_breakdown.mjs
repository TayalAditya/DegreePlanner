import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const user = await prisma.user.findFirst({
  where: { enrollmentId: 'B23229' },
  select: { id: true, name: true, enrollmentId: true, branch: true, doingMTP: true, doingISTP: true },
});

if (!user) { console.log('User not found'); process.exit(0); }
console.log(`\nUser: ${user.name} (${user.enrollmentId}) | Branch: ${user.branch}\n`);

const enrollments = await prisma.courseEnrollment.findMany({
  where: { userId: user.id, status: { in: ['COMPLETED', 'IN_PROGRESS'] } },
  include: {
    course: {
      include: { branchMappings: { select: { branch: true, courseCategory: true } } },
    },
  },
  orderBy: [{ year: 'asc' }, { semester: 'asc' }],
});

// Show all HS-xxx courses
console.log('HS-xxx courses:');
for (const e of enrollments) {
  if (e.course.code.toUpperCase().startsWith('HS')) {
    const mappings = e.course.branchMappings.map(m => `${m.branch}:${m.courseCategory}`).join(', ') || '(none)';
    console.log(`  ${e.status.padEnd(12)} ${e.course.code.padEnd(10)} ${e.course.credits}cr  ${e.course.name.substring(0,40)}`);
    console.log(`               mappings: ${mappings}`);
  }
}

// Full HSS accumulation
const HSS_CORE_CAP = 12;
let hssAcc = 0;
let hssCore = 0;
let hssFe = 0;

for (const e of enrollments) {
  const code = e.course.code.toUpperCase();
  const mappings = e.course.branchMappings;
  const branchAliases = user.branch === 'CSE' ? ['CSE','CS'] : user.branch === 'CS' ? ['CS','CSE'] : [user.branch];
  const mapping = mappings.find(m => branchAliases.includes(m.branch) || m.branch === 'COMMON');
  const cat = mapping?.courseCategory;

  const isHss = cat === 'HSS' || (!mapping && code.startsWith('HS'));
  if (!isHss) continue;

  const credits = e.course.credits;
  const prev = hssAcc;
  hssAcc += credits;
  const corePart = Math.min(HSS_CORE_CAP, hssAcc) - Math.min(HSS_CORE_CAP, prev);
  const fePart = Math.max(0, hssAcc - Math.max(HSS_CORE_CAP, prev));
  hssCore += corePart;
  hssFe += fePart;
  console.log(`  → ${e.course.code} (${credits}cr): core+${corePart}, fe+${fePart}, total_hss=${hssAcc}`);
}

console.log(`\nHSS total: ${hssAcc}cr → core=${hssCore}cr, fe=${hssFe}cr`);

await prisma.$disconnect();
