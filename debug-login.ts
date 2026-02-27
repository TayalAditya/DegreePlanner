import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkApproved() {
  console.log("📋 All Approved Users in Database:\n");
  
  const approvedUsers = await prisma.approvedUser.findMany({
    orderBy: { enrollmentId: "asc" },
  });
  
  console.log(`Total approved: ${approvedUsers.length}\n`);
  approvedUsers.forEach((user) => {
    console.log(`${user.enrollmentId} | ${user.email} | Batch: ${user.batch} | ${user.branch}`);
  });
}

checkApproved()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
