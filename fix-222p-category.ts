import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fixing IC-222P branch mappings from IC_BASKET to IC...\n');
  
  const result = await prisma.courseBranchMapping.updateMany({
    where: {
      course: {
        code: "IC-222P"
      },
      courseCategory: "IC_BASKET"
    },
    data: {
      courseCategory: "IC"
    }
  });

  console.log(`✅ Updated ${result.count} branch mappings for IC-222P`);
  console.log('\nIC-222P is now correctly categorized as IC (not IC_BASKET)\n');

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(console.error);
