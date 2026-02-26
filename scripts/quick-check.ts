import prisma from "../lib/prisma";
async function main() {
  const courses = await prisma.course.count();
  const enrollments = await prisma.courseEnrollment.count();
  const ic112 = await prisma.course.findUnique({ where: { code: "IC112" } });
  const user = await prisma.user.findFirst({ select: { id: true, email: true } });
  console.log("courses:", courses);
  console.log("enrollments:", enrollments);
  console.log("IC112 exists:", !!ic112);
  console.log("user:", user?.email);
}
main().catch(console.error).finally(() => prisma.$disconnect());
