import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
  const user = await prisma.user.findFirst({
    where: { enrollmentId: "B23243" },
    select: { id: true, branch: true },
  });

  if (!user) {
    console.log("User not found");
    process.exit(1);
  }

  const courses = await prisma.course.findMany({
    where: { department: "CSE" },
    take: 3,
    select: { code: true, name: true },
  });

  console.log(`Found ${courses.length} courses:`);
  courses.forEach(c => console.log(`  - ${c.code}`));
  
  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
