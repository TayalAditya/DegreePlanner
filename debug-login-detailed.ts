import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function debugLogin(email: string) {
  console.log(`\n🔍 DEBUGGING LOGIN FOR: ${email}\n`);
  console.log("=" .repeat(60));

  // Step 1: Check if email exists in approvedUser
  console.log("\n📋 Step 1: Check ApprovedUser table");
  const approvedUser = await prisma.approvedUser.findUnique({
    where: { email },
  });
  console.log("Result:", approvedUser ? "✅ FOUND" : "❌ NOT FOUND");
  if (approvedUser) {
    console.log(`  - EnrollmentId: ${approvedUser.enrollmentId}`);
    console.log(`  - Batch: ${approvedUser.batch}`);
    console.log(`  - Branch: ${approvedUser.branch}`);
  }

  // Step 2: Extract roll number and fallback check
  console.log("\n🔑 Step 2: Fallback - Extract from email prefix");
  const emailPrefix = email.split("@")[0].toUpperCase();
  console.log(`  Email prefix: ${emailPrefix}`);
  const matches = emailPrefix.match(/^B23\d+$/i);
  console.log(`  Matches B23XXX pattern: ${matches ? "✅ YES" : "❌ NO"}`);

  if (matches) {
    const approvedById = await prisma.approvedUser.findUnique({
      where: { enrollmentId: emailPrefix },
    });
    console.log(`  Found by EnrollmentId ${emailPrefix}: ${approvedById ? "✅ YES" : "❌ NO"}`);
    if (approvedById) {
      console.log(`    - Email: ${approvedById.email}`);
      console.log(`    - Batch: ${approvedById.batch}`);
    }
  }

  // Step 3: Check User table
  console.log("\n👤 Step 3: Check User table");
  const user = await prisma.user.findUnique({
    where: { email },
  });
  console.log("Result:", user ? "✅ EXISTS" : "❌ NOT FOUND");
  if (user) {
    console.log(`  - IsApproved: ${user.isApproved}`);
    console.log(`  - EnrollmentId: ${user.enrollmentId}`);
    console.log(`  - Branch: ${user.branch}`);
  }

  // Step 4: Check UserProgram
  if (user) {
    console.log("\n📚 Step 4: Check UserProgram enrollment");
    const program = await prisma.userProgram.findMany({
      where: { userId: user.id },
      include: { program: true },
    });
    console.log(`Programs enrolled: ${program.length}`);
    program.forEach((p) => {
      console.log(`  - ${p.program.code} (${p.program.name})`);
    });
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n🎯 LOGIN WILL:");
  if (!approvedUser && (!matches || !approvedUser)) {
    console.log("❌ FAIL - User not in approvedUser table");
    console.log("   Error: batch_not_supported");
  } else if (approvedUser && approvedUser.batch !== 2023) {
    console.log("❌ FAIL - Not Batch 2023");
    console.log("   Error: batch_not_supported");
  } else {
    console.log("✅ SUCCEED - User should login");
  }
  console.log("\n");
}

const email = process.argv[2] || "b23243@students.iitmandi.ac.in";
debugLogin(email)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
