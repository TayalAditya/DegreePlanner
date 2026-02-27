import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function checkCSEMappings() {
  // Get all unique branches in mappings
  const branches = await prisma.courseBranchMapping.findMany({
    distinct: ['branch'],
    select: { branch: true }
  });

  console.log("📋 All branches in CourseBranchMapping table:\n");
  const uniqueBranches = Array.from(new Set(branches.map(b => b.branch))).sort();
  uniqueBranches.forEach(b => console.log(`  ${b}`));

  console.log("\n\n🔍 Checking IC course mappings for CSE:\n");
  const icMappings = await prisma.courseBranchMapping.findMany({
    where: {
      course: { code: { startsWith: 'IC', mode: 'insensitive' } },
      branch: 'CSE'
    },
    include: {
      course: { select: { code: true, name: true } }
    },
    take: 10
  });

  if (icMappings.length === 0) {
    console.log("❌ No IC courses have mappings for CSE!");
    console.log("That's the problem - courses are using COMMON branch.");
  } else {
    icMappings.forEach(m => {
      console.log(`${m.course.code.padEnd(12)} → CSE = ${m.courseCategory}`);
    });
  }

  console.log("\n\n📊 Checking COMMON branch mappings for IC courses:\n");
  const commonMappings = await prisma.courseBranchMapping.findMany({
    where: {
      course: { code: { startsWith: 'IC', mode: 'insensitive' } },
      branch: 'COMMON'
    },
    include: {
      course: { select: { code: true, name: true } }
    },
    take: 10
  });

  if (commonMappings.length > 0) {
    console.log("Using COMMON branch instead:\n");
    commonMappings.forEach(m => {
      console.log(`${m.course.code.padEnd(12)} → COMMON = ${m.courseCategory}`);
    });
  }

  await prisma.$disconnect();
}

checkCSEMappings().catch(console.error);
