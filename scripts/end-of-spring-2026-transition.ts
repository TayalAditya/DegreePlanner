// One-shot end-of-Spring transition.
//
// For every user with a known batch year, mark every IN_PROGRESS enrollment with
// semester <= their current Spring semester as COMPLETED. Future-semester
// IN_PROGRESS rows, such as Fall pre-registrations, are left alone.

import { PrismaClient, EnrollmentStatus } from "@prisma/client";

const prisma = new PrismaClient();
const NOW = new Date();
const TRANSITION_YEAR = NOW.getFullYear();

type BreakdownRow = {
  batch_year: number;
  spring_sem: number;
  users: number;
  due_in_progress: number;
};

type CountRow = {
  count: number;
};

const dueEnrollmentsCte = (transitionYear: number) => prisma.$queryRaw<BreakdownRow[]>`
  WITH user_batches AS (
    SELECT id,
           COALESCE(batch, 2000 + substring("enrollmentId" from '^B([0-9]{2})')::int) AS batch_year
    FROM "User"
  ), due AS (
    SELECT ub.batch_year, ub.id AS user_id, ce.id AS enrollment_id
    FROM user_batches ub
    JOIN "CourseEnrollment" ce ON ce."userId" = ub.id
    WHERE ub.batch_year IS NOT NULL
      AND ce.status = ${EnrollmentStatus.IN_PROGRESS}::"EnrollmentStatus"
      AND ce.semester <= LEAST(8, GREATEST(1, (${transitionYear} - ub.batch_year) * 2))
  )
  SELECT batch_year::int,
         LEAST(8, GREATEST(1, (${transitionYear} - batch_year) * 2))::int AS spring_sem,
         COUNT(DISTINCT user_id)::int AS users,
         COUNT(enrollment_id)::int AS due_in_progress
  FROM due
  GROUP BY batch_year
  ORDER BY batch_year
`;

async function countDue(transitionYear: number) {
  const rows = await prisma.$queryRaw<CountRow[]>`
    WITH user_batches AS (
      SELECT id,
             COALESCE(batch, 2000 + substring("enrollmentId" from '^B([0-9]{2})')::int) AS batch_year
      FROM "User"
    ), due AS (
      SELECT ce.id
      FROM user_batches ub
      JOIN "CourseEnrollment" ce ON ce."userId" = ub.id
      WHERE ub.batch_year IS NOT NULL
        AND ce.status = ${EnrollmentStatus.IN_PROGRESS}::"EnrollmentStatus"
        AND ce.semester <= LEAST(8, GREATEST(1, (${transitionYear} - ub.batch_year) * 2))
    )
    SELECT COUNT(*)::int AS count FROM due
  `;

  return rows[0]?.count ?? 0;
}

async function main() {
  console.log(`Processing end-of-Spring transition for ${TRANSITION_YEAR}...`);

  const breakdown = await dueEnrollmentsCte(TRANSITION_YEAR);
  const before = await countDue(TRANSITION_YEAR);

  if (breakdown.length > 0) {
    console.log("\nDue IN_PROGRESS rows before update:");
    for (const row of breakdown) {
      const key = `B${String(row.batch_year).slice(-2)}`;
      const nextSem = Math.min(8, row.spring_sem + 1);
      console.log(
        `  ${key}: ${row.users.toString().padStart(3)} users | sem ${row.spring_sem} -> ${nextSem} (next) | ${row.due_in_progress} enrollments`
      );
    }
  }

  const updated = await prisma.$executeRaw`
    WITH user_batches AS (
      SELECT id,
             COALESCE(batch, 2000 + substring("enrollmentId" from '^B([0-9]{2})')::int) AS batch_year
      FROM "User"
    ), due AS (
      SELECT ce.id
      FROM user_batches ub
      JOIN "CourseEnrollment" ce ON ce."userId" = ub.id
      WHERE ub.batch_year IS NOT NULL
        AND ce.status = ${EnrollmentStatus.IN_PROGRESS}::"EnrollmentStatus"
        AND ce.semester <= LEAST(8, GREATEST(1, (${TRANSITION_YEAR} - ub.batch_year) * 2))
    )
    UPDATE "CourseEnrollment" ce
    SET status = ${EnrollmentStatus.COMPLETED}::"EnrollmentStatus",
        "updatedAt" = now()
    FROM due
    WHERE ce.id = due.id
  `;

  const after = await countDue(TRANSITION_YEAR);

  console.log(`\nTotal due before: ${before}`);
  console.log(`Updated to COMPLETED: ${updated}`);
  console.log(`Remaining due IN_PROGRESS: ${after}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
