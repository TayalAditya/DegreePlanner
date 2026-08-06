/**
 * Resolves support ticket B24299:
 * - EP uses EE-311 (not the MEVLSI recode VL-201) as its Sem-5 DC.
 * - Adds the student's verified Summer 2025 ME-591 FE completion to Sem 4.
 *
 * Default is a dry run. Re-run with --apply to write and verify the change.
 */
import {
  CourseType,
  EnrollmentStatus,
  PrismaClient,
  Term,
} from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const ENROLLMENT_ID = "B24299";
const EP_BATCH = 2024;
const OFFERING_YEAR = 2026;
const OFFERING_SEMESTER = 5;
const ME591 = {
  code: "ME-591",
  name: "Revisiting Tensor Analysis: Acoustics",
  credits: 1,
  department: "Mechanical Engineering",
  level: 500,
  description: "Summer 2025 special course recorded as a Free Elective.",
};

function withoutRegistrationType(value: unknown, id: string): Record<string, string> {
  const types = value && typeof value === "object" ? { ...(value as Record<string, string>) } : {};
  delete types[id];
  return types;
}

async function main() {
  const [student, ee311, vl201, me591] = await Promise.all([
    prisma.user.findUnique({
      where: { enrollmentId: ENROLLMENT_ID },
      select: {
        id: true,
        name: true,
        branch: true,
        batch: true,
        programs: {
          where: { isPrimary: true },
          select: { programId: true, program: { select: { code: true } } },
        },
      },
    }),
    prisma.course.findUnique({ where: { code: "EE-311" }, select: { id: true, code: true } }),
    prisma.course.findUnique({ where: { code: "VL-201" }, select: { id: true, code: true } }),
    prisma.course.findUnique({ where: { code: ME591.code }, select: { id: true, name: true, credits: true } }),
  ]);

  if (!student || student.branch !== "EP" || student.batch !== EP_BATCH) {
    throw new Error(`${ENROLLMENT_ID} is not the expected B24 EP student`);
  }
  if (!ee311 || !vl201) throw new Error("EE-311 or VL-201 catalog course is missing");

  const [vlOfferings, ee311EpMappings, vlEpMappings, epPlans, existingMe591Enrollment] = await Promise.all([
    prisma.courseOffering.findMany({
      // Current registration uses eligibleSems, not the imported offeringSemester
      // metadata. Target every active Fall-2026 VL-201 row accordingly.
      where: { courseCode: "VL-201", offeringYear: OFFERING_YEAR, isActive: true },
      select: { id: true, branches: true },
    }),
    prisma.courseBranchMapping.findMany({
      where: { courseId: ee311.id, branch: "EP" },
      select: { batch: true, courseCategory: true, semester: true },
    }),
    prisma.courseBranchMapping.findMany({
      where: { courseId: vl201.id, branch: "EP" },
      select: { id: true, batch: true, courseCategory: true, semester: true },
    }),
    prisma.preRegistrationPlan.findMany({
      where: {
        offeringSemester: OFFERING_SEMESTER,
        offeringYear: OFFERING_YEAR,
        user: { branch: "EP", batch: EP_BATCH },
      },
      select: { id: true, selectedIds: true, registrationTypes: true, user: { select: { enrollmentId: true } } },
    }),
    me591
      ? prisma.courseEnrollment.findUnique({
          where: {
            userId_courseId_semester_year_term: {
              userId: student.id,
              courseId: me591.id,
              semester: 4,
              year: 2025,
              term: Term.SUMMER,
            },
          },
          select: { id: true, status: true, courseType: true, isPassFail: true, passFailCredits: true },
        })
      : Promise.resolve(null),
  ]);

  if (vlOfferings.length === 0) throw new Error("Active 2026 VL-201 offering is missing");
  const vlOfferingIds = new Set(vlOfferings.map((offering) => offering.id));
  const plansWithInvalidVl201 = epPlans.filter((plan) => plan.selectedIds.some((id) => vlOfferingIds.has(id)));

  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`Student: ${student.name ?? ENROLLMENT_ID} (${student.branch}, B${student.batch})`);
  console.log(`EE-311 EP mappings: ${JSON.stringify(ee311EpMappings)}`);
  console.log(`Invalid VL-201 EP mappings to remove: ${vlEpMappings.length}`);
  console.log(`VL-201 active offerings that list EP: ${vlOfferings.filter((offering) => offering.branches.includes("EP")).length}`);
  console.log(`EP B24 plans with invalid VL-201: ${plansWithInvalidVl201.map((plan) => plan.user.enrollmentId).join(", ") || "none"}`);
  console.log(`ME-591 catalog exists: ${Boolean(me591)}; Sem-4 Summer-2025 enrollment exists: ${Boolean(existingMe591Enrollment)}`);

  if (!APPLY) {
    console.log("Dry run complete. Re-run with --apply to write.");
    return;
  }

  const primaryProgramId = student.programs[0]?.programId ?? null;
  await prisma.$transaction(async (tx) => {
    // VL-201 is the MEVLSI recode. It must never be an EP core/FE choice.
    await tx.courseBranchMapping.deleteMany({
      where: { courseId: vl201.id, branch: "EP" },
    });
    for (const offering of vlOfferings) {
      await tx.courseOffering.update({
        where: { id: offering.id },
        data: { branches: offering.branches.filter((branch) => branch !== "EP") },
      });
    }

    for (const plan of plansWithInvalidVl201) {
      await tx.preRegistrationPlan.update({
        where: { id: plan.id },
        data: {
          selectedIds: plan.selectedIds.filter((id) => !vlOfferingIds.has(id)),
          registrationTypes: Array.from(vlOfferingIds).reduce(
            (types, offeringId) => withoutRegistrationType(types, offeringId),
            plan.registrationTypes,
          ),
        },
      });
    }

    const course = await tx.course.upsert({
      where: { code: ME591.code },
      create: {
        ...ME591,
        offeredInSummer: true,
        isActive: true,
      },
      update: {
        name: ME591.name,
        credits: ME591.credits,
        department: ME591.department,
        level: ME591.level,
        description: ME591.description,
        offeredInSummer: true,
        isActive: true,
      },
      select: { id: true },
    });

    await tx.courseEnrollment.upsert({
      where: {
        userId_courseId_semester_year_term: {
          userId: student.id,
          courseId: course.id,
          semester: 4,
          year: 2025,
          term: Term.SUMMER,
        },
      },
      create: {
        userId: student.id,
        courseId: course.id,
        semester: 4,
        year: 2025,
        term: Term.SUMMER,
        courseType: CourseType.FREE_ELECTIVE,
        programId: primaryProgramId,
        status: EnrollmentStatus.COMPLETED,
        isPassFail: false,
        passFailCredits: 0,
      },
      update: {
        courseType: CourseType.FREE_ELECTIVE,
        programId: primaryProgramId,
        status: EnrollmentStatus.COMPLETED,
        isPassFail: false,
        passFailCredits: 0,
      },
    });
  });

  const [remainingVlEpMappings, verifiedOfferings, remainingPlans, verifiedCourse, verifiedEnrollment] = await Promise.all([
    prisma.courseBranchMapping.count({ where: { courseId: vl201.id, branch: "EP" } }),
    prisma.courseOffering.findMany({ where: { id: { in: Array.from(vlOfferingIds) } }, select: { id: true, branches: true } }),
    prisma.preRegistrationPlan.findMany({
      where: {
        offeringSemester: OFFERING_SEMESTER,
        offeringYear: OFFERING_YEAR,
        user: { branch: "EP", batch: EP_BATCH },
      },
      select: { selectedIds: true },
    }),
    prisma.course.findUnique({ where: { code: ME591.code }, select: { id: true, name: true, credits: true, offeredInSummer: true, isActive: true } }),
    prisma.courseEnrollment.findFirst({
      where: { userId: student.id, semester: 4, year: 2025, term: Term.SUMMER, course: { code: ME591.code } },
      select: { courseType: true, status: true, isPassFail: true, passFailCredits: true },
    }),
  ]);

  const remainingPlansWithVl201 = remainingPlans.filter((plan) => plan.selectedIds.some((id) => vlOfferingIds.has(id))).length;
  if (remainingVlEpMappings !== 0 || verifiedOfferings.some((offering) => offering.branches.includes("EP")) || remainingPlansWithVl201 !== 0) {
    throw new Error("EP VL-201 cleanup verification failed");
  }
  if (
    verifiedCourse?.name !== ME591.name ||
    Number(verifiedCourse.credits) !== ME591.credits ||
    !verifiedCourse.offeredInSummer ||
    !verifiedCourse.isActive ||
    verifiedEnrollment?.courseType !== CourseType.FREE_ELECTIVE ||
    verifiedEnrollment.status !== EnrollmentStatus.COMPLETED ||
    verifiedEnrollment.isPassFail ||
    verifiedEnrollment.passFailCredits !== 0
  ) {
    throw new Error("ME-591 completion verification failed");
  }

  console.log("Verified: EP sees EE-311 only; invalid VL-201 plan selections removed; ME-591 is a 1-credit completed Sem-4 Summer-2025 FE.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
