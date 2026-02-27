import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function checkSpecificCourses() {
  const coursesToCheck = [
    "IC161P", "IC-161P",
    "IC202P", "IC-202P",
    "CS214", "CS-214",
    "CS213", "CS-213",
    "DP301P", "DP-301P", "DP 301P",
  ];

  console.log("🔍 Checking if these courses exist in database:\n");

  for (const code of coursesToCheck) {
    const course = await prisma.course.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } },
      select: { id: true, code: true, name: true, credits: true }
    });
    
    if (course) {
      console.log(`✅ ${code.padEnd(15)} → Found: ${course.code} - ${course.name} (${course.credits} cr)`);
    } else {
      console.log(`❌ ${code.padEnd(15)} → NOT FOUND`);
    }
  }

  // Search for any courses with similar patterns
  console.log("\n\n🔍 Searching for similar course codes:\n");
  
  const patterns = ["IC161", "IC202", "CS214", "CS213", "DP301"];
  for (const pattern of patterns) {
    const courses = await prisma.course.findMany({
      where: { code: { contains: pattern, mode: 'insensitive' } },
      select: { code: true, name: true, credits: true },
      take: 5
    });
    
    if (courses.length > 0) {
      console.log(`Pattern "${pattern}":`);
      courses.forEach(c => console.log(`  ${c.code.padEnd(12)} - ${c.name.substring(0, 50)}`));
    } else {
      console.log(`Pattern "${pattern}": No matches`);
    }
  }

  await prisma.$disconnect();
}

checkSpecificCourses().catch(console.error);
