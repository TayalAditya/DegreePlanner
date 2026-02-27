import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function checkICCourses() {
  console.log("🔍 Checking IC courses in database:\n");

  // Check specific IC courses
  const icCodes = ["IC112", "IC-112", "IC113", "IC-113", "IC140", "IC-140", 
                   "IC161P", "IC-161P", "IC202P", "IC-202P"];

  for (const code of icCodes) {
    const course = await prisma.course.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } },
      select: { code: true, name: true, credits: true }
    });
    
    if (course) {
      console.log(`✅ ${code.padEnd(12)} → ${course.code.padEnd(12)} ${course.credits} cr - ${course.name}`);
    }
  }

  // Get all IC courses
  console.log("\n\n📋 All IC courses in database:\n");
  const allIC = await prisma.course.findMany({
    where: { 
      code: { startsWith: 'IC', mode: 'insensitive' }
    },
    select: { code: true, name: true, credits: true },
    orderBy: { code: 'asc' }
  });

  console.log(`Total IC courses: ${allIC.length}\n`);
  allIC.forEach(c => {
    console.log(`${c.code.padEnd(12)} ${String(c.credits).padStart(2)} cr - ${c.name.substring(0, 60)}`);
  });

  // Check CS courses
  console.log("\n\n📋 CS courses (214, 213):\n");
  const csCourses = await prisma.course.findMany({
    where: { 
      OR: [
        { code: { contains: 'CS214', mode: 'insensitive' } },
        { code: { contains: 'CS213', mode: 'insensitive' } },
        { code: { contains: 'CS-214', mode: 'insensitive' } },
        { code: { contains: 'CS-213', mode: 'insensitive' } },
      ]
    },
    select: { code: true, name: true, credits: true }
  });

  if (csCourses.length === 0) {
    console.log("❌ CS214 and CS213 NOT FOUND");
  } else {
    csCourses.forEach(c => console.log(`${c.code.padEnd(12)} ${c.credits} cr - ${c.name}`));
  }

  // Check DP courses (ISTP/MTP)
  console.log("\n\n📋 DP courses (ISTP/MTP):\n");
  const dpCourses = await prisma.course.findMany({
    where: { 
      code: { startsWith: 'DP', mode: 'insensitive' }
    },
    select: { code: true, name: true, credits: true },
    orderBy: { code: 'asc' }
  });

  if (dpCourses.length === 0) {
    console.log("❌ DP courses NOT FOUND");
  } else {
    dpCourses.forEach(c => console.log(`${c.code.padEnd(12)} ${c.credits} cr - ${c.name}`));
  }

  await prisma.$disconnect();
}

checkICCourses().catch(console.error);
