import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function check() {
  const count = await prisma.course.count();
  console.log(`\n📊 Total courses: ${count}\n`);
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
