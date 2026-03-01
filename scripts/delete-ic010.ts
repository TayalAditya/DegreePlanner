import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🗑️  Deleting IC-010 from database...");

  // Find IC010 courses (including IC-010P variant)
  const ic010Courses = await prisma.course.findMany({
    where: {
      OR: [
        { code: "IC010" },
        { code: "IC-010" },
        { code: "IC-010P" },
        { code: "IC010P" },
      ],
    },
  });

  if (ic010Courses.length === 0) {
    console.log("ℹ️  No IC-010 courses found in database");
    return;
  }

  const courseIds = ic010Courses.map(c => c.id);
  console.log(`Found ${ic010Courses.length} IC-010 course(s): ${ic010Courses.map(c => c.code).join(", ")}`);

  // Delete all enrollments with these course IDs
  const deletedEnrollments = await prisma.courseEnrollment.deleteMany({
    where: {
      courseId: { in: courseIds },
    },
  });
  console.log(`✓ Deleted ${deletedEnrollments.count} IC-010 enrollments`);

  // Delete the course itself
  const deletedCourses = await prisma.course.deleteMany({
    where: {
      OR: [
        { code: "IC010" },
        { code: "IC-010" },
      ],
    },
  });
  console.log(`✓ Deleted ${deletedCourses.count} IC-010 course records`);

  console.log("✅ IC-010 completely removed from database");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
