import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const OFFERING_SEMESTER = 7;
const OFFERING_YEAR = 2026;
const NON_FIRST_YEAR_SEMS = [3, 5, 7];

const EXPECTED_COURSES = [
  { code: "IC-240", name: "Mechanics of Rigid Bodies", credits: 3, offeredInFall: true },
  { code: "IC-241", name: "Materials Science for Engineers", credits: 3 },
] as const;

async function main() {
  const apply = process.argv.includes("--apply");
  const codes = EXPECTED_COURSES.map((course) => course.code);
  const courses = await prisma.course.findMany({ where: { code: { in: codes } } });

  for (const expected of EXPECTED_COURSES) {
    const course = courses.find((candidate) => candidate.code === expected.code);
    if (!course || course.name !== expected.name || course.credits !== expected.credits) {
      throw new Error(`Catalogue data for ${expected.code} does not match the verified IC timetable; refusing to change registration offerings.`);
    }
  }

  const offerings = await prisma.courseOffering.findMany({
    where: {
      courseCode: { in: codes },
      offeringSemester: OFFERING_SEMESTER,
      offeringYear: OFFERING_YEAR,
    },
    orderBy: { courseCode: "asc" },
  });

  if (offerings.length !== EXPECTED_COURSES.length) {
    throw new Error(`Expected exactly ${EXPECTED_COURSES.length} Fall 2026 offerings, found ${offerings.length}; refusing to guess.`);
  }

  const planned = offerings.map((offering) => ({
    code: offering.courseCode,
    before: { name: offering.courseName, branches: offering.branches, eligibleSems: offering.eligibleSems },
    after: {
      name: EXPECTED_COURSES.find((course) => course.code === offering.courseCode)!.name,
      branches: ["ALL"],
      eligibleSems: NON_FIRST_YEAR_SEMS,
    },
  }));
  console.table(planned);

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to update the two verified offerings.");
    return;
  }

  await prisma.$transaction([
    ...EXPECTED_COURSES.map((expected) =>
      prisma.courseOffering.updateMany({
        where: {
          courseCode: expected.code,
          offeringSemester: OFFERING_SEMESTER,
          offeringYear: OFFERING_YEAR,
        },
        data: {
          courseName: expected.name,
          branches: ["ALL"],
          eligibleSems: NON_FIRST_YEAR_SEMS,
          isActive: true,
        },
      })
    ),
    prisma.course.update({ where: { code: "IC-240" }, data: { offeredInFall: true } }),
  ]);

  const verified = await prisma.courseOffering.findMany({
    where: {
      courseCode: { in: codes },
      offeringSemester: OFFERING_SEMESTER,
      offeringYear: OFFERING_YEAR,
    },
    select: { courseCode: true, courseName: true, branches: true, eligibleSems: true, isActive: true },
    orderBy: { courseCode: "asc" },
  });

  for (const offering of verified) {
    if (
      offering.courseName !== EXPECTED_COURSES.find((course) => course.code === offering.courseCode)!.name ||
      offering.branches.length !== 1 || offering.branches[0] !== "ALL" ||
      NON_FIRST_YEAR_SEMS.some((semester, index) => offering.eligibleSems[index] !== semester) ||
      !offering.isActive
    ) {
      throw new Error(`Verification failed for ${offering.courseCode}`);
    }
  }

  console.table(verified);
  console.log("Updated and verified IC-240 and IC-241 Fall 2026 registration offerings.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
