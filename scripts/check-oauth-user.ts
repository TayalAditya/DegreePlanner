import prisma from "@/lib/prisma";

async function checkUser(email: string) {
  console.log(`\n📋 Checking user: ${email}`);

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      accounts: true,
    },
  });

  if (user) {
    console.log("✅ User exists:");
    console.log(`  - ID: ${user.id}`);
    console.log(`  - Name: ${user.name}`);
    console.log(`  - Approved: ${user.isApproved}`);
    console.log(`  - Accounts linked: ${user.accounts.length}`);
    user.accounts.forEach((acc) => {
      console.log(`    - ${acc.provider}: ${acc.providerAccountId}`);
    });
  } else {
    console.log("❌ User does not exist");
  }

  const approvedUser = await prisma.approvedUser.findUnique({
    where: { email },
  });

  if (approvedUser) {
    console.log("✅ Approved user exists:");
    console.log(`  - Enrollment ID: ${approvedUser.enrollmentId}`);
    console.log(`  - Branch: ${approvedUser.branch}`);
    console.log(`  - Batch: ${approvedUser.batch}`);
  } else {
    console.log("❌ Not in approved list");
  }
}

async function main() {
  const email = process.argv[2] || "b23243@students.iitmandi.ac.in";
  await checkUser(email);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
