import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkUser() {
  console.log("Checking for B23243...\n");
  
  // Check by enrollmentId
  const approvedUser = await prisma.approvedUser.findUnique({
    where: { enrollmentId: "B23243" },
  });
  console.log("ApprovedUser (by enrollmentId):", approvedUser);
  
  // Check by email
  const approvedByEmail = await prisma.approvedUser.findFirst({
    where: { email: { contains: "b23243" } },
  });
  console.log("ApprovedUser (by email):", approvedByEmail);
  
  // Check User table
  const user = await prisma.user.findFirst({
    where: { enrollmentId: "B23243" },
  });
  console.log("User:", user);
}

checkUser()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
