import { getSession } from "@/lib/session";
import prisma from "@/lib/prisma";
import { inferAcademicState, inferBatchYear } from "@/lib/academicCalendar";
import { getBranchCandidates, normalizeBranchCode } from "@/lib/branchInfo";
import { pickBranchMapping, resolveBaseCategory } from "@/lib/courseCategory";
import { creditCalculator } from "@/lib/creditCalculator";
import RoadmapClient, { type RoadmapData, type RoadmapCourse } from "./RoadmapClient";

const ROADMAP_SEMESTERS = [5, 6, 7, 8];
const ELECTIVE_CATEGORIES = new Set(["DE", "FE", "HSS", "PE"]);
const REQUIRED_CATEGORIES = new Set(["IC", "DC", "MTP", "ISTP"]);

function asRoadmapCategory(category: string) {
  return category === "IC_BASKET_CANDIDATE" ? "FE" : category;
}

function sortCourses(a: RoadmapCourse, b: RoadmapCourse) {
  if (a.category !== b.category) return a.category.localeCompare(b.category);
  return a.code.localeCompare(b.code);
}

export default async function RoadmapPage() {
  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const [user, primaryProgram] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { branch: true, batch: true, enrollmentId: true },
    }),
    prisma.userProgram.findFirst({
      where: { userId, isPrimary: true },
      select: { programId: true },
    }),
  ]);

  const branch = user?.branch ?? session.user.branch ?? null;
  const batchYear = inferBatchYear(user?.batch ?? session.user.batch, user?.enrollmentId ?? session.user.enrollmentId);

  if (!branch || !batchYear) {
    return <RoadmapClient data={null} />;
  }

  const currentSemester = inferAcademicState(batchYear).upcomingSemester
    ?? inferAcademicState(batchYear).currentSemester;
  const branchCandidates = getBranchCandidates(branch);
  const normalizedCandidates = new Set(branchCandidates.map(normalizeBranchCode));
  const batchValues = ["", String(batchYear)];

  const [mappedCourses, enrollments, offerings, programProgress] = await Promise.all([
    prisma.course.findMany({
      where: {
        isActive: true,
        branchMappings: {
          some: {
            branch: { in: branchCandidates },
            batch: { in: batchValues },
            semester: { in: ROADMAP_SEMESTERS },
          },
        },
      },
      select: {
        id: true,
        code: true,
        name: true,
        credits: true,
        ltpc: true,
        equivalents: {
          select: { equivalent: { select: { code: true, name: true } } },
        },
        equivalentFor: {
          select: { course: { select: { code: true, name: true } } },
        },
        branchMappings: {
          where: {
            branch: { in: branchCandidates },
            batch: { in: batchValues },
            semester: { in: ROADMAP_SEMESTERS },
          },
          select: {
            branch: true,
            batch: true,
            semester: true,
            courseCategory: true,
            isRequired: true,
          },
        },
      },
    }),
    prisma.courseEnrollment.findMany({
      where: { userId },
      select: { courseId: true, semester: true, status: true, grade: true },
    }),
    prisma.courseOffering.findMany({
      where: {
        offeringSemester: { in: ROADMAP_SEMESTERS },
      },
      select: {
        id: true,
        courseCode: true,
        courseName: true,
        credits: true,
        offeringSemester: true,
        offeringYear: true,
        branches: true,
        eligibleSems: true,
        isActive: true,
        categoryOverride: true,
        course: {
          select: {
            id: true,
            branchMappings: {
              select: {
                branch: true,
                batch: true,
                courseCategory: true,
              },
            },
          },
        },
      },
    }),
    primaryProgram
      ? creditCalculator.calculateProgramProgress(userId, primaryProgram.programId)
      : Promise.resolve(null),
  ]);

  // During the pre-registration window, past-semester IN_PROGRESS rows are
  // treated as completed in the same way as the pre-registration screen.
  const completedCourseIds = new Set(
    enrollments
      .filter((enrollment) =>
        enrollment.grade !== "F" &&
        (enrollment.status === "COMPLETED" ||
          (enrollment.status === "IN_PROGRESS" && enrollment.semester < currentSemester))
      )
      .map((enrollment) => enrollment.courseId)
  );

  const semesters: RoadmapData["semesters"] = ROADMAP_SEMESTERS.map((semester) => ({
    semester,
    status: semester < currentSemester ? "past" : semester === currentSemester ? "current" : "future",
    requiredCourses: [],
      mappedElectives: [],
    liveOptions: [],
    historicalOptions: [],
  }));
  const semesterByNumber = new Map(semesters.map((semester) => [semester.semester, semester]));

  for (const course of mappedCourses) {
    const mapping = pickBranchMapping(course.branchMappings, branch, batchYear) as
      | (typeof course.branchMappings)[number]
      | undefined;
    const semester = mapping?.semester ?? null;
    if (!semester || !semesterByNumber.has(semester)) continue;

    const category = asRoadmapCategory(
      resolveBaseCategory(
        { code: course.code, branchMappings: course.branchMappings },
        branch,
        batchYear
      )
    );
    const item: RoadmapCourse = {
      id: course.id,
      code: course.code,
      name: course.name,
      credits: course.credits,
      category,
      completed: completedCourseIds.has(course.id),
      source: "curriculum",
      equivalents: Array.from(
        new Map(
          [
            ...course.equivalents.map((entry) => entry.equivalent),
            ...course.equivalentFor.map((entry) => entry.course),
          ].map((entry) => [entry.code, entry])
        ).values()
      ),
    };

    const target = semesterByNumber.get(semester)!;
    if (REQUIRED_CATEGORIES.has(category) || mapping?.isRequired) {
      target.requiredCourses.push(item);
    } else {
      target.mappedElectives.push(item);
    }
  }

  const isEligibleOffering = (offering: (typeof offerings)[number], targetSemester: number) => {
    const isEligibleForBranch =
      offering.branches.includes("ALL") ||
      offering.branches.some((offeringBranch) =>
        normalizedCandidates.has(normalizeBranchCode(offeringBranch))
      );
    const isEligibleForSemester =
      offering.eligibleSems.length === 0 || offering.eligibleSems.includes(targetSemester);

    return isEligibleForBranch && isEligibleForSemester;
  };

  const toOfferingOption = (
    offering: (typeof offerings)[number],
    source: "live" | "historical",
    targetSemester: number
  ): RoadmapCourse | null => {
    const mappingCategory = offering.course
      ? resolveBaseCategory(
          { code: offering.courseCode, branchMappings: offering.course.branchMappings },
          branch,
          batchYear
        )
      : undefined;
    const category = asRoadmapCategory(
      mappingCategory && mappingCategory !== "FE"
        ? mappingCategory
        : offering.categoryOverride ?? mappingCategory ?? "FE"
    );

    if (!ELECTIVE_CATEGORIES.has(category)) return null;
    if (offering.course && completedCourseIds.has(offering.course.id)) return null;

    return {
      id: source === "live" ? offering.id : `historical-${targetSemester}-${offering.id}`,
      code: offering.courseCode,
      name: offering.courseName,
      credits: offering.credits,
      category,
      completed: false,
      source,
      offeringYear: offering.offeringYear,
      offeringSemester: offering.offeringSemester,
    };
  };

  for (const semester of semesters) {
    const publishedCodes = new Set<string>();
    for (const offering of offerings) {
      if (!offering.isActive || offering.offeringSemester !== semester.semester) continue;
      if (!isEligibleOffering(offering, semester.semester)) continue;
      const option = toOfferingOption(offering, "live", semester.semester);
      if (!option || publishedCodes.has(option.code)) continue;
      publishedCodes.add(option.code);
      semester.liveOptions.push(option);
    }

    // A matching odd/even-term offering is a planning clue, never a promise.
    // As archives grow, this automatically picks the newest matching release.
    const historicalCodes = new Set<string>();
    const historicalCandidates = offerings
      .filter((offering) =>
        offering.offeringSemester % 2 === semester.semester % 2 &&
        (!offering.isActive || offering.offeringSemester !== semester.semester) &&
        isEligibleOffering(offering, semester.semester)
      )
      .sort((a, b) =>
        b.offeringYear - a.offeringYear || b.offeringSemester - a.offeringSemester || a.courseCode.localeCompare(b.courseCode)
      );

    for (const offering of historicalCandidates) {
      const option = toOfferingOption(offering, "historical", semester.semester);
      if (!option || historicalCodes.has(option.code) || publishedCodes.has(option.code)) continue;
      historicalCodes.add(option.code);
      semester.historicalOptions.push(option);
    }
  }

  for (const semester of semesters) {
    semester.requiredCourses.sort(sortCourses);
    semester.mappedElectives.sort(sortCourses);
    semester.liveOptions.sort(sortCourses);
    semester.historicalOptions.sort(sortCourses);
  }

  const data: RoadmapData = {
    branch: normalizeBranchCode(branch),
    batchYear,
    currentSemester,
    semesters,
    creditSummary: programProgress
      ? {
          totalRequired: programProgress.required.total,
          completed: programProgress.completed.total,
          remaining: programProgress.remaining.total,
          byBucket: {
            core: programProgress.remaining.core,
            de: programProgress.remaining.de,
            freeElective: programProgress.remaining.freeElective,
            mtp: programProgress.remaining.mtp,
            istp: programProgress.remaining.istp,
            pe: programProgress.remaining.pe,
          },
        }
      : null,
    storageKey: `degree-roadmap:${userId}:${normalizeBranchCode(branch)}:${batchYear}`,
  };

  return <RoadmapClient data={data} />;
}
