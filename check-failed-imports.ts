import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function checkFailedImports() {
  // Get sample course codes that might fail
  const sampleCodes = [
    "MA101", "MA-101", "IC101", "IC-101", "PH101", "PH-101",
    "CH101", "CH-101", "HS101", "HS-101", "EE101", "EE-101"
  ];

  console.log("🔍 Checking course code formats in database...\n");

  for (const code of sampleCodes) {
    const course = await prisma.course.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } },
      select: { id: true, code: true, name: true }
    });
    
    if (course) {
      console.log(`✅ ${code.padEnd(10)} → Found as: ${course.code}`);
    } else {
      console.log(`❌ ${code.padEnd(10)} → Not found`);
    }
  }

  // Check hyphenated vs non-hyphenated counts
  const hyphenated = await prisma.course.count({
    where: { code: { contains: '-' } }
  });
  
  const total = await prisma.course.count();
  
  console.log(`\n📊 Database stats:`);
  console.log(`   Total courses: ${total}`);
  console.log(`   Hyphenated codes: ${hyphenated}`);
  console.log(`   Non-hyphenated: ${total - hyphenated}`);

  // Show some example course codes
  const examples = await prisma.course.findMany({
    select: { code: true, name: true },
    take: 20,
    orderBy: { code: 'asc' }
  });

  console.log(`\n📝 First 20 course codes in DB:`);
  examples.forEach(c => console.log(`   ${c.code.padEnd(12)} - ${c.name.substring(0, 40)}`));
}

checkFailedImports()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
