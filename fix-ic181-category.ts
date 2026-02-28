import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const course = await prisma.course.findFirst({
    where: {
      OR: [
        { code: "IC181" },
        { code: "IC-181" }
      ]
    },
    select: {
      code: true,
      name: true,
      branchMappings: true,
    }
  });

  console.log('\nIC181/IC-181 Branch Mappings:\n');
  console.log(JSON.stringify(course, null, 2));

  if (course) {
    console.log('\n\nFixing IC181 branch mappings to IKS...\n');
    
    const result = await prisma.courseBranchMapping.updateMany({
      where: {
        courseId: course.branchMappings[0]?.courseId,
        courseCategory: { not: "IKS" }
      },
      data: {
        courseCategory: "IKS"
      }
    });

    console.log(`✅ Updated ${result.count} branch mappings for IC181 to IKS`);
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(console.error);
