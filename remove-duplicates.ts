import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function removeDuplicates() {
  const duplicateCodesToDelete = [
    "CS208",
    "CS308P",
    "CS310",
    "CS513",
    "CS515",
    "CS571"
  ];

  console.log("🗑️  Removing non-hyphenated duplicates...\n");

  for (const code of duplicateCodesToDelete) {
    const result = await prisma.course.deleteMany({
      where: { code: { equals: code, mode: 'insensitive' } }
    });
    
    if (result.count > 0) {
      console.log(`✅ Deleted ${code} (${result.count} record)`);
    }
  }

  console.log("\n✅ Done! Verifying CSE DC total again:\n");

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
    console.log(`\n✅✅✅ PERFECT! CSE DC is now 100% CORRECT!\n`);
  } else {
    console.log(`\n⚠️  Hmm still ${totalDCCredits - 38} off\n`);
  }

  await prisma.$disconnect();
}

removeDuplicates().catch(console.error);
