import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const course = await prisma.course.findUnique({
    where: { code: "IC-222P" },
    select: {
      code: true,
      name: true,
      credits: true,
    }
  });

  const code = course?.code?.toUpperCase() || "";
  const normalizedCode = code.replace(/[^A-Z0-9]/g, "");
  
  console.log('\nIC-222P Analysis:');
  console.log('Original code:', course?.code);
  console.log('Normalized code:', normalizedCode);
  
  const ICB1_CODES = new Set(["IC131", "IC136", "IC230"]);
  const ICB2_CODES = new Set(["IC121", "IC240", "IC241", "IC253"]);
  
  console.log('Is in ICB1?', ICB1_CODES.has(normalizedCode));
  console.log('Is in ICB2?', ICB2_CODES.has(normalizedCode));
  
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(console.error);
