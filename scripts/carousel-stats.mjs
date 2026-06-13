import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const main = async () => {
  const [users, approved, enrollments, courses] = await Promise.all([
    prisma.user.count(),
    prisma.approvedUser.count(),
    prisma.courseEnrollment.count(),
    prisma.course.count(),
  ]);

  let byBatch = [];
  try {
    byBatch = await prisma.approvedUser.groupBy({
      by: ["batch"],
      _count: { _all: true },
    });
  } catch (e) {
    byBatch = [{ error: e.message }];
  }

  let usersByBatch = [];
  try {
    usersByBatch = await prisma.$queryRaw`
      SELECT a.batch, COUNT(DISTINCT u.id)::int AS users
      FROM "User" u
      JOIN "ApprovedUser" a ON LOWER(a.email) = LOWER(u.email)
      GROUP BY a.batch ORDER BY a.batch`;
  } catch (e) {
    usersByBatch = [{ error: e.message }];
  }

  console.log(JSON.stringify({ users, approved, enrollments, courses, byBatch, usersByBatch }, null, 2));
};

main().finally(() => prisma.$disconnect());
