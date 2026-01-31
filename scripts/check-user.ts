import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkUser() {
  const email = 'b23243@students.iitmandi.ac.in';
  
  console.log('Checking ApprovedUser table...');
  const approvedUser = await prisma.approvedUser.findUnique({
    where: { email },
  });
  console.log('ApprovedUser:', JSON.stringify(approvedUser, null, 2));
  
  console.log('\nChecking User table...');
  const user = await prisma.user.findUnique({
    where: { email },
  });
  console.log('User:', JSON.stringify(user, null, 2));
}

checkUser()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
