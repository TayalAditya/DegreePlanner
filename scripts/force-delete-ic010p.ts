import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🗑️  Force deleting IC-010P from database...");

  // Find IC-010P course
  const ic010p = await prisma.course.findFirst({
    where: { code: "IC-010P" },
  });

  if (!ic010p) {
    console.log("ℹ️  No IC-010P found");
    return;
  }

  console.log(`Found IC-010P: ${ic010p.id}`);

  // Delete enrollments first
  const deletedEnrollments = await prisma.courseEnrollment.deleteMany({
    where: { courseId: ic010p.id },
  });
  console.log(`✓ Deleted ${deletedEnrollments.count} IC-010P enrollments`);

  // Now delete the course
  await prisma.course.delete({
    where: { id: ic010p.id },
  });
  console.log(`✓ Deleted IC-010P course`);

  console.log("✅ IC-010P completely removed!");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
