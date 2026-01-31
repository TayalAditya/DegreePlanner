import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function approveUser() {
  const email = 'b23243@students.iitmandi.ac.in';
  
  const approvedUser = await prisma.approvedUser.findUnique({
    where: { email },
  });

  if (!approvedUser) {
    console.log('❌ User not found in ApprovedUser table');
    return;
  }

  const updated = await prisma.user.update({
    where: { email },
    data: {
      isApproved: true,
      enrollmentId: approvedUser.enrollmentId,
      department: approvedUser.department,
      branch: approvedUser.branch,
      batch: approvedUser.batch,
    },
  });

  console.log('✅ User approved!');
  console.log(JSON.stringify(updated, null, 2));
}

approveUser()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
