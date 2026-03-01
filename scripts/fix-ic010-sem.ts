import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const course = await prisma.course.findFirst({
    where: { code: { in: ["IC010", "IC-010"] } },
    select: { id: true, code: true }
  });
  if (!course) { console.log("IC010 course not found in DB"); return; }
  console.log("Found:", course.code, course.id);

  const count = await prisma.courseEnrollment.count({
    where: { courseId: course.id, semester: 5 }
  });
  console.log("IC010 enrollments in sem 5:", count);

  const deleted = await prisma.courseEnrollment.deleteMany({
    where: { courseId: course.id, semester: 5 }
  });
  console.log("Deleted:", deleted.count, "rows");
}

main().catch(console.error).finally(() => prisma.$disconnect());
