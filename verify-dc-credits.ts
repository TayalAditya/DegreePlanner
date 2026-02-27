import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function verifyDCCredits() {
  console.log("🔍 Checking DC course credits...\n");

  // Get all DC courses from database
  const dcCourses = await prisma.course.findMany({
    where: {
      code: { startsWith: 'CS', mode: 'insensitive' }
    },
    select: { code: true, name: true, credits: true },
    orderBy: { code: 'asc' }
  });

  console.log(`Found ${dcCourses.length} CS courses\n`);
  console.log("📋 CS Courses (DC for CSE):\n");

  let totalDCCredits = 0;
  dcCourses.forEach(c => {
    console.log(`${c.code.padEnd(12)} ${c.credits} cr - ${c.name}`);
    totalDCCredits += c.credits;
  });

  console.log(`\n📊 Total DC credits: ${totalDCCredits}`);

  // Expected DC credits for CSE is 38
  console.log(`\n⚠️  Expected for CSE: 38 credits`);
  console.log(`📈 Actual total: ${totalDCCredits} credits`);
  
  if (totalDCCredits !== 38) {
    console.log(`\n❌ MISMATCH! Off by ${totalDCCredits - 38} credits\n`);
  } else {
    console.log(`\n✅ CORRECT!\n`);
  }

  // Check DC courses from other branches too
  console.log("\n\n🔍 Checking other branch DC courses:\n");
  
  const branches = ['EE', 'ME', 'CE', 'BE', 'EP', 'DSE', 'MNC'];
  
  for (const branch of branches) {
    const deptCode = branch === 'ME' ? 'ME' : branch === 'CE' ? 'CE' : branch === 'BE' ? 'BE' : branch === 'EE' ? 'EE' : branch === 'EP' ? 'EP' : branch === 'DSE' ? 'DS' : branch === 'MNC' ? 'MA' : '';
    
    if (!deptCode) continue;

    const courses = await prisma.course.findMany({
      where: {
        code: { startsWith: deptCode, mode: 'insensitive' }
      },
      select: { code: true, credits: true }
    });

    const total = courses.reduce((sum, c) => sum + c.credits, 0);
    console.log(`${branch.padEnd(8)} ${courses.length} courses, ${total} credits`);
  }

  await prisma.$disconnect();
}

verifyDCCredits().catch(console.error);
