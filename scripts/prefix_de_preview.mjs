import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// prefix → branch mapping
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

let toCreate = [], toSkip = [];

for (const c of courses) {
  const prefix = c.code.split('-')[0].split(/\d/)[0].toUpperCase();
  const branch = PREFIX_TO_BRANCH[prefix];
  if (!branch) continue;

  const existing = c.branchMappings.find(m => m.branch === branch);
  if (existing && ['DC','IC','IC_BASKET'].includes(existing.courseCategory)) {
    toSkip.push(`${c.code} → ${branch} [already ${existing.courseCategory}]`);
  } else if (!existing) {
    toCreate.push(`${c.code} → ${branch} DE [no mapping]`);
  } else {
    toCreate.push(`${c.code} → ${branch} DE [was ${existing.courseCategory}]`);
  }
}

console.log('\n=== TO CREATE/UPDATE ===');
toCreate.forEach(x => console.log(' ', x));
console.log('\n=== SKIP (already DC/IC) ===');
toSkip.forEach(x => console.log(' ', x));
console.log(`\nSummary: ${toCreate.length} changes, ${toSkip.length} skipped`);

await prisma.$disconnect();
