import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function checkMappings() {
  const totalMappings = await prisma.courseBranchMapping.count();
  console.log(`Total course-branch mappings: ${totalMappings}`);

  if (totalMappings === 0) {
    console.log("\n❌ NO BRANCH MAPPINGS FOUND!");
    console.log("This means courses don't have category info assigned to branches.");
    console.log("That's why everything shows as CORE/DC instead of IC/DE/etc.\n");
  } else {
    console.log("\n✅ Branch mappings exist\n");
    const samples = await prisma.courseBranchMapping.findMany({
      include: {
        course: { select: { code: true, name: true } },
      },
      take: 10
    });
    
    samples.forEach(m => {
      console.log(`${m.course.code.padEnd(12)} → ${m.branch.padEnd(6)} = ${m.courseCategory}`);
    });
  }

  await prisma.$disconnect();
}

checkMappings().catch(console.error);
