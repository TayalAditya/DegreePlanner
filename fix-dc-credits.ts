import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function fixDCCredits() {
  console.log("🔧 Fixing DC course credits...\n");

  const creditsToFix = [
    { code: "CS-212", correctCredits: 4, name: "Design of Algorithms" },
    { code: "CS-309", correctCredits: 4, name: "Information Systems and Databases" },
    { code: "CS-313", correctCredits: 4, name: "Computer Networks" },
    { code: "CS-312", correctCredits: 4, name: "Operating Systems" },
    { code: "CS-302", correctCredits: 4, name: "Paradigms of Programming" },
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
      console.log(`❌ ${code} not found!`);
    }
  }

  console.log("\n\n✅ Done! Verifying CSE DC total:\n");

  const dcCourses = await prisma.course.findMany({
    where: {
      code: { startsWith: 'CS', mode: 'insensitive' }
    },
    select: { code: true, credits: true }
  });

  // Only count the curriculum DC courses
  const cseCompulsoryCodes = new Set([
    'CS208', 'CS214', 'CS212', 'CS213',  // Sem 3
    'CS304', 'CS309',                     // Sem 4
    'CS313', 'CS312', 'CS305',           // Sem 5
    'CS302', 'CS303'                     // Sem 6
  ]);

  let totalDCCredits = 0;
  console.log("📋 CSE Compulsory DC Courses:\n");
  
  dcCourses.forEach(c => {
    const normalized = c.code.replace(/[-]/g, '').toUpperCase();
    if (cseCompulsoryCodes.has(normalized)) {
      console.log(`${c.code.padEnd(12)} ${c.credits} cr`);
      totalDCCredits += c.credits;
    }
  });

  console.log(`\n📊 Total CSE DC credits: ${totalDCCredits}`);
  console.log(`Expected: 38 credits`);
  
  if (totalDCCredits === 38) {
    console.log(`\n✅ PERFECT! CSE DC is now correct!\n`);
  } else {
    console.log(`\n⚠️  Still ${totalDCCredits - 38} off\n`);
  }

  await prisma.$disconnect();
}

fixDCCredits().catch(console.error);
