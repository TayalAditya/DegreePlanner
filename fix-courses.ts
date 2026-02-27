import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function fixCourses() {
  console.log("🔧 Fixing course credits and adding missing courses...\n");

  // Fix credits for existing courses
  const creditsToFix = [
    { code: "IC-112", correctCredits: 2, name: "Calculus" },
    { code: "IC-113", correctCredits: 2, name: "Complex Variables and Vector Calculus" },
    { code: "IC-140", correctCredits: 4, name: "Engineering Graphics for Design" },
  ];

  for (const { code, correctCredits, name } of creditsToFix) {
    const course = await prisma.course.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } }
    });

    if (course) {
      if (course.credits !== correctCredits) {
        await prisma.course.update({
          where: { id: course.id },
          data: { credits: correctCredits }
        });
        console.log(`✅ Fixed ${code}: ${course.credits} cr → ${correctCredits} cr`);
      } else {
        console.log(`✓ ${code} already has correct credits (${correctCredits} cr)`);
      }
    } else {
      console.log(`❌ ${code} not found in database`);
    }
  }

  // Add missing courses
  const missingCourses = [
    { code: "IC-161P", name: "Applied Electronics Lab", credits: 2, department: "IC", level: 100 },
    { code: "IC-202P", name: "Design Practicum", credits: 3, department: "IC", level: 200 },
    { code: "CS-214", name: "Computer Organization", credits: 4, department: "CS", level: 200 },
    { code: "CS-213", name: "Reverse Engineering", credits: 1, department: "CS", level: 200 },
    { code: "DP-301P", name: "Interdisciplinary Socio-Technical Practicum", credits: 4, department: "DP", level: 300 },
    { code: "DP-498P", name: "Major Technical Project - I", credits: 3, department: "DP", level: 400 },
    { code: "DP-499P", name: "Major Technical Project - II", credits: 5, department: "DP", level: 400 },
  ];

  console.log("\n🆕 Adding missing courses:\n");

  for (const courseData of missingCourses) {
    const existing = await prisma.course.findFirst({
      where: { code: { equals: courseData.code, mode: 'insensitive' } }
    });

    if (existing) {
      console.log(`✓ ${courseData.code} already exists`);
    } else {
      await prisma.course.create({
        data: {
          code: courseData.code,
          name: courseData.name,
          credits: courseData.credits,
          department: courseData.department,
          level: courseData.level,
          offeredInFall: true,
          offeredInSpring: true,
          offeredInSummer: false,
          isActive: true,
        }
      });
      console.log(`✅ Added ${courseData.code} - ${courseData.name} (${courseData.credits} cr)`);
    }
  }

  console.log("\n✅ Done! Verifying changes...\n");

  // Verify all courses now exist with correct credits
  const allCodes = [
    ...creditsToFix.map(c => c.code),
    ...missingCourses.map(c => c.code)
  ];

  for (const code of allCodes) {
    const course = await prisma.course.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } },
      select: { code: true, name: true, credits: true }
    });

    if (course) {
      console.log(`✅ ${course.code.padEnd(12)} ${course.credits} cr - ${course.name}`);
    } else {
      console.log(`❌ ${code} STILL MISSING`);
    }
  }

  await prisma.$disconnect();
}

fixCourses().catch(console.error);
