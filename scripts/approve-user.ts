import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function approveUser() {
  const enrollmentId = "B23243";
  const fallbackEmail = "b23243@students.iitmandi.ac.in";
  
  const approvedUser =
    (await prisma.approvedUser.findUnique({ where: { enrollmentId } })) ||
    (await prisma.approvedUser.findUnique({ where: { email: fallbackEmail } }));

  if (!approvedUser) {
    console.log('❌ User not found in ApprovedUser table');
    return;
  }

  const email = approvedUser.email || fallbackEmail;

  const updated = await prisma.user.upsert({
    where: { email },
    update: {
      isApproved: true,
      role: "ADMIN",
      enrollmentId: approvedUser.enrollmentId,
      department: approvedUser.department,
      branch: approvedUser.branch,
      batch: approvedUser.batch,
    },
    create: {
      email,
      name: approvedUser.name,
      isApproved: true,
      role: "ADMIN",
      enrollmentId: approvedUser.enrollmentId,
      department: approvedUser.department,
      branch: approvedUser.branch,
      batch: approvedUser.batch,
    },
  });

  console.log('✅ User approved!');
  console.log("✅ Role set to ADMIN");
  console.log(JSON.stringify(updated, null, 2));
}

approveUser()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
