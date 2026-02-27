import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function findDuplicates() {
  // Find all CS courses and check for duplicates
  const allCourses = await prisma.course.findMany({
    where: {
      code: { startsWith: 'CS', mode: 'insensitive' }
    },
    select: { id: true, code: true, name: true, credits: true }
  });

  const normalized = new Map<string, any[]>();
  
  allCourses.forEach(c => {
    const norm = c.code.replace(/[-]/g, '').toUpperCase();
    if (!normalized.has(norm)) {
      normalized.set(norm, []);
    }
    normalized.get(norm)!.push(c);
  });

  console.log("🔍 Checking for duplicate CS course codes:\n");
  
  const duplicates: { code: string; courses: any[] }[] = [];
  
  normalized.forEach((courses, code) => {
    if (courses.length > 1) {
      console.log(`⚠️  DUPLICATE: ${code}`);
      courses.forEach(c => {
        console.log(`   ${c.code.padEnd(12)} ${c.credits} cr - ${c.name.substring(0, 50)}`);
      });
      duplicates.push({ code, courses });
    }
  });

  if (duplicates.length === 0) {
    console.log("✅ No duplicates found!");
  } else {
    console.log(`\n\n📊 Found ${duplicates.length} duplicate code groups`);
    console.log("\nThese should be merged - keeping the hyphenated version and deleting the non-hyphenated");
  }

  await prisma.$disconnect();
}

findDuplicates().catch(console.error);
