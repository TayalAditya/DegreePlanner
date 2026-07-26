import { getSession } from "@/lib/session";
import prisma from "@/lib/prisma";
import { inferAcademicState, inferBatchYear } from "@/lib/academicCalendar";
import { getBranchCandidates, normalizeBranchCode } from "@/lib/branchInfo";
import { pickBranchMapping, resolveBaseCategory } from "@/lib/courseCategory";
import RoadmapClient, { type RoadmapData, type RoadmapCourse } from "./RoadmapClient";

const ROADMAP_SEMESTERS = [6, 7, 8];
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { branch: true, batch: true, enrollmentId: true },
  });

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

  const [mappedCourses, enrollments, liveOfferings] = await Promise.all([
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
        isActive: true,
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
    };

    const target = semesterByNumber.get(semester)!;
    if (REQUIRED_CATEGORIES.has(category) || mapping?.isRequired) {
      target.requiredCourses.push(item);
    } else {
      target.mappedElectives.push(item);
    }
  }

  for (const offering of liveOfferings) {
    const isEligibleForBranch =
      offering.branches.includes("ALL") ||
      offering.branches.some((offeringBranch) =>
        normalizedCandidates.has(normalizeBranchCode(offeringBranch))
      );
    const isEligibleForSemester =
      offering.eligibleSems.length === 0 || offering.eligibleSems.includes(offering.offeringSemester);

    if (!isEligibleForBranch || !isEligibleForSemester) continue;

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
    const target = semesterByNumber.get(offering.offeringSemester);

    if (!target || !ELECTIVE_CATEGORIES.has(category)) continue;
    if (offering.course && completedCourseIds.has(offering.course.id)) continue;

    target.liveOptions.push({
      id: offering.id,
      code: offering.courseCode,
      name: offering.courseName,
      credits: offering.credits,
      category,
      completed: false,
      source: "live",
      offeringYear: offering.offeringYear,
    });
  }

  for (const semester of semesters) {
    semester.requiredCourses.sort(sortCourses);
    semester.mappedElectives.sort(sortCourses);
    semester.liveOptions.sort(sortCourses);
  }

  const data: RoadmapData = {
    branch: normalizeBranchCode(branch),
    batchYear,
    currentSemester,
    semesters,
    storageKey: `degree-roadmap:${userId}:${normalizeBranchCode(branch)}:${batchYear}`,
  };

  return <RoadmapClient data={data} />;
}
