import { getSession } from "@/lib/session";
import prisma from "@/lib/prisma";
import { inferAcademicState, inferBatchYear } from "@/lib/academicCalendar";
import { getBranchCandidates, normalizeBranchCode } from "@/lib/branchInfo";
import { pickBranchMapping, resolveBaseCategory } from "@/lib/courseCategory";
import { creditCalculator } from "@/lib/creditCalculator";
import { yifComponentForCourse, YIF_STARTUP_PRACTICUMS } from "@/lib/yif";
import RoadmapClient, { type RoadmapData, type RoadmapCourse } from "./RoadmapClient";

const ROADMAP_SEMESTERS = [5, 6, 7, 8];
const PLANNING_OPTION_CATEGORIES = new Set(["DC", "DE", "FE", "HSS", "IKS"]);

function normalizeCourseCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * CourseEquivalent rows represent renamed versions of the same academic
 * requirement. Build connected components so aliases are deduplicated and a
 * completion under any code satisfies the whole component.
 */
function buildCourseEquivalenceKeys(
  courses: Array<{
    code: string;
    equivalents: Array<{ equivalent: { code: string } }>;
    equivalentFor: Array<{ course: { code: string } }>;
  }>
) {
  const parent = new Map<string, string>();

  const find = (rawCode: string): string => {
    const code = normalizeCourseCode(rawCode);
    if (!parent.has(code)) parent.set(code, code);
    const current = parent.get(code)!;
    if (current === code) return code;
    const root = find(current);
    parent.set(code, root);
    return root;
  };

  const union = (left: string, right: string) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    // Stable root makes the result independent of Prisma row order.
    if (leftRoot < rightRoot) parent.set(rightRoot, leftRoot);
    else parent.set(leftRoot, rightRoot);
  };

  for (const course of courses) {
    find(course.code);
    for (const entry of course.equivalents) union(course.code, entry.equivalent.code);
    for (const entry of course.equivalentFor) union(course.code, entry.course.code);
  }

  const keys = new Map<string, string>();
  for (const code of parent.keys()) keys.set(code, find(code));
  return keys;
}
const REQUIRED_CATEGORIES = new Set(["IC", "DC", "MTP", "ISTP", "YIF"]);

function asRoadmapCategory(category: string) {
  return category === "IC_BASKET_CANDIDATE" ? "FE" : category;
}

function sortCourses(a: RoadmapCourse, b: RoadmapCourse) {
  if (a.category !== b.category) return a.category.localeCompare(b.category);
  return a.code.localeCompare(b.code);
}

function isSemesterExchangeCourse(course: { department: string | null; description: string | null }) {
  const source = `${course.department ?? ""} ${course.description ?? ""}`.toLowerCase();
  return source.includes("semester exchange");
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
      select: { branch: true, batch: true, enrollmentId: true, totalPassFailCredits: true, doingYIF: true },
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

  const [mappedCourses, enrollments, offerings, registeredEnrollments, programProgress, yifCourses] = await Promise.all([
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
        department: true,
        description: true,
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
      select: {
        courseId: true,
        semester: true,
        status: true,
        grade: true,
        isPassFail: true,
        passFailCredits: true,
        isInternship: true,
        internshipType: true,
        course: {
          select: {
            credits: true,
            code: true,
            name: true,
            department: true,
            description: true,
          },
        },
      },
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
    // Actual registration records are a stronger planning signal than a
    // generic odd/even assumption. These rows tell us what a prior cohort in
    // the same branch really registered for in the matching semester cycle.
    prisma.courseEnrollment.findMany({
      where: {
        // Do not cap this at the student's current semester. A student entering
        // Sem 5 still needs the older cohort's Sem 5/7 registrations when
        // planning Sem 7, otherwise only their own cohort's Sem 3 core rows
        // survive and the DE/FE opening evidence disappears.
        semester: { gte: 3, lte: Math.max(...ROADMAP_SEMESTERS) },
        status: { not: "DROPPED" },
        user: {
          branch: { in: branchCandidates },
          batch: { not: null },
        },
      },
      select: {
        userId: true,
        semester: true,
        year: true,
        term: true,
        user: { select: { batch: true } },
        course: {
          select: {
            id: true,
            code: true,
            name: true,
            credits: true,
            department: true,
            description: true,
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
    user?.doingYIF
      ? prisma.course.findMany({
          where: { code: { in: YIF_STARTUP_PRACTICUMS.map((component) => component.code) }, isActive: true },
          select: { id: true, code: true, name: true, credits: true },
        })
      : Promise.resolve([]),
  ]);

  // During the pre-registration window, past-semester IN_PROGRESS rows are
  // treated as completed in the same way as the pre-registration screen.
  const completedEnrollments = enrollments.filter((enrollment) =>
    enrollment.grade !== "F" &&
    (enrollment.status === "COMPLETED" ||
      (enrollment.status === "IN_PROGRESS" && enrollment.semester < currentSemester))
  );
  const completedCourseIds = new Set(completedEnrollments.map((enrollment) => enrollment.courseId));

  const equivalenceKeyByCode = buildCourseEquivalenceKeys(mappedCourses);
  const canonicalCourseKey = (code: string) => {
    const normalized = normalizeCourseCode(code);
    return equivalenceKeyByCode.get(normalized) ?? normalized;
  };
  const completedCanonicalCourseKeys = new Set(
    completedEnrollments.map((enrollment) => canonicalCourseKey(enrollment.course.code))
  );
  const isCourseCompleted = (courseId: string | null | undefined, courseCode: string) =>
    Boolean(courseId && completedCourseIds.has(courseId)) ||
    completedCanonicalCourseKeys.has(canonicalCourseKey(courseCode));
  const passFailBySemester: Record<string, number> = {};
  for (const enrollment of enrollments) {
    if (!enrollment.isPassFail || enrollment.status === "DROPPED" || enrollment.status === "FAILED") continue;
    const credits = enrollment.passFailCredits || enrollment.course.credits;
    const key = String(enrollment.semester);
    passFailBySemester[key] = (passFailBySemester[key] ?? 0) + credits;
  }
  const recordedExperienceBySemester = new Map<number, RoadmapData["recordedExperience"][number]>();
  const recordExperience = (semester: number) => {
    const existing = recordedExperienceBySemester.get(semester);
    if (existing) return existing;
    const record: RoadmapData["recordedExperience"][number] = {
      semester,
      internships: [],
      exchangeCourses: [],
    };
    recordedExperienceBySemester.set(semester, record);
    return record;
  };

  // A registered course at a partner university is the clearest available
  // record that the student actually went on SemEx. Keep this history separate
  // from the forward-looking simulator, rather than guessing a future path.
  for (const enrollment of enrollments) {
    if (enrollment.status === "DROPPED" || !ROADMAP_SEMESTERS.includes(enrollment.semester)) continue;
    const courseCode = enrollment.course.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const source = `${enrollment.course.department} ${enrollment.course.description ?? ""}`.toLowerCase();
    const record = recordExperience(enrollment.semester);
    const internshipType = enrollment.internshipType === "ONSITE" || courseCode.endsWith("399P")
      ? "onsite"
      : enrollment.internshipType === "REMOTE" || courseCode.endsWith("396P")
      ? "remote"
      : null;

    if (internshipType && !record.internships.some((item) => item.code === enrollment.course.code)) {
      record.internships.push({
        code: enrollment.course.code,
        name: enrollment.course.name,
        type: internshipType,
        status: enrollment.status,
      });
    }

    if (source.includes("semester exchange") && !record.exchangeCourses.some((item) => item.code === enrollment.course.code)) {
      record.exchangeCourses.push({
        code: enrollment.course.code,
        name: enrollment.course.name,
        status: enrollment.status,
      });
    }
  }
  const recordedExperience = Array.from(recordedExperienceBySemester.values())
    .filter((record) => record.internships.length > 0 || record.exchangeCourses.length > 0)
    .sort((a, b) => a.semester - b.semester);

  // The degree roadmap is a forward plan. Past semesters remain in the
  // transcript/progress calculation, but they must not offer selectable
  // courses or clutter the completion path.
  const planningSemesterNumbers = ROADMAP_SEMESTERS.filter(
    (semester) => semester >= Math.max(5, currentSemester)
  );
  const semesters: RoadmapData["semesters"] = planningSemesterNumbers.map((semester) => ({
    semester,
    status: semester === currentSemester ? "current" : "future",
    requiredCourses: [],
    mappedElectives: [],
    liveOptions: [],
    registeredOptions: [],
    historicalOptions: [],
  }));
  const semesterByNumber = new Map(semesters.map((semester) => [semester.semester, semester]));

  type CurriculumCandidate = {
    item: RoadmapCourse;
    semester: number;
    required: boolean;
    mappingScore: number;
  };
  const curriculumCandidates = new Map<string, CurriculumCandidate>();
  const branchOrder = new Map(
    branchCandidates.map((candidate, index) => [normalizeBranchCode(candidate), index])
  );

  for (const course of mappedCourses) {
    // Partner-university rows are transfer options for a SemEx plan, not
    // duplicate home-curriculum commitments. They stay available through
    // recorded equivalences, but must never inflate the normal roadmap.
    if (isSemesterExchangeCourse(course)) continue;

    const mapping = pickBranchMapping(course.branchMappings, branch, batchYear) as
      | (typeof course.branchMappings)[number]
      | undefined;
    const semester = mapping?.semester ?? null;
    if (!semester || !semesterByNumber.has(semester)) continue;

    let category = asRoadmapCategory(
      resolveBaseCategory(
        { code: course.code, branchMappings: course.branchMappings },
        branch,
        batchYear
      )
    );
    if (user?.doingYIF && yifComponentForCourse(course.code, batchYear, course.credits) !== "vacation") {
      category = "YIF";
    }
    if (user?.doingYIF && (category === "MTP" || category === "ISTP")) continue;
    const item: RoadmapCourse = {
      id: course.id,
      code: course.code,
      name: course.name,
      credits: course.credits,
      category,
      completed: isCourseCompleted(course.id, course.code),
      source: "curriculum",
      equivalents: Array.from(
        new Map(
          [
            ...course.equivalents.map((entry) => entry.equivalent),
            ...course.equivalentFor.map((entry) => entry.course),
          ].map((entry) => [normalizeCourseCode(entry.code), entry])
        ).values()
      ),
    };

    const required = REQUIRED_CATEGORIES.has(category) || Boolean(mapping?.isRequired);
    const mappingBranchIndex = mapping
      ? branchOrder.get(normalizeBranchCode(mapping.branch)) ?? branchCandidates.length
      : branchCandidates.length;
    const mappingScore =
      (mapping?.batch === String(batchYear) ? 10_000 : 0) +
      Math.max(0, branchCandidates.length - mappingBranchIndex) * 100 +
      (required ? 10 : 0);
    const canonicalKey = canonicalCourseKey(course.code);
    const current = curriculumCandidates.get(canonicalKey);

    // Prefer the batch-specific curriculum code. The lexical tie-break keeps
    // renamed aliases deterministic (for example EE-302 over EE-301) when the
    // database contains equally specific legacy mappings.
    if (
      !current ||
      mappingScore > current.mappingScore ||
      (mappingScore === current.mappingScore && item.code.localeCompare(current.item.code) > 0)
    ) {
      curriculumCandidates.set(canonicalKey, { item, semester, required, mappingScore });
    }
  }

  for (const candidate of curriculumCandidates.values()) {
    const target = semesterByNumber.get(candidate.semester);
    if (!target) continue;
    if (candidate.required) target.requiredCourses.push(candidate.item);
    else target.mappedElectives.push(candidate.item);
  }

  if (user?.doingYIF) {
    const b23Sp1EquivalentDone = batchYear === 2023 && completedEnrollments.some(
      (enrollment) => normalizeCourseCode(enrollment.course.code) === "DP301P",
    );
    for (const [index, component] of YIF_STARTUP_PRACTICUMS.entries()) {
      const course = yifCourses.find((item) => normalizeCourseCode(item.code) === component.normalizedCode);
      const target = semesterByNumber.get(6 + index);
      if (!course || !target || (index === 0 && b23Sp1EquivalentDone)) continue;
      if (target.requiredCourses.some((item) => normalizeCourseCode(item.code) === normalizeCourseCode(course.code))) continue;
      target.requiredCourses.push({
        id: course.id,
        code: course.code,
        name: index === 0 && batchYear === 2023 ? `${course.name} (DP-301P equivalent accepted)` : course.name,
        credits: course.credits,
        category: "YIF",
        completed: isCourseCompleted(course.id, course.code),
        source: "curriculum",
      });
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

    if (!PLANNING_OPTION_CATEGORIES.has(category)) return null;
    if (isCourseCompleted(offering.course?.id, offering.courseCode)) return null;

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

  type RegisteredCourseSignal = {
    course: (typeof registeredEnrollments)[number]["course"];
    category: string;
    semester: number;
    year: number;
    term: "FALL" | "SPRING" | "SUMMER";
    batchYear: number;
    studentIds: Set<string>;
  };
  const registrationSignals = new Map<string, RegisteredCourseSignal>();
  for (const enrollment of registeredEnrollments) {
    if (isSemesterExchangeCourse(enrollment.course)) continue;
    const batch = enrollment.user.batch;
    if (!batch) continue;

    const category = asRoadmapCategory(
      resolveBaseCategory(
        { code: enrollment.course.code, branchMappings: enrollment.course.branchMappings },
        branch,
        batchYear
      )
    );
    if (!PLANNING_OPTION_CATEGORIES.has(category)) continue;

    const key = `${enrollment.course.id}:${enrollment.semester}:${enrollment.year}:${enrollment.term}:${batch}`;
    const signal = registrationSignals.get(key) ?? {
      course: enrollment.course,
      category,
      semester: enrollment.semester,
      year: enrollment.year,
      term: enrollment.term,
      batchYear: batch,
      studentIds: new Set<string>(),
    };
    signal.studentIds.add(enrollment.userId);
    registrationSignals.set(key, signal);
  }

  const isNewerRegistrationSignal = (candidate: RegisteredCourseSignal, current: RegisteredCourseSignal) =>
    candidate.year > current.year ||
    (candidate.year === current.year && candidate.semester > current.semester) ||
    (candidate.year === current.year && candidate.semester === current.semester && candidate.studentIds.size > current.studentIds.size);

  const latestRegisteredBySemester = new Map<number, Map<string, RegisteredCourseSignal>>();
  for (const targetSemester of planningSemesterNumbers) {
    const latestForTarget = new Map<string, RegisteredCourseSignal>();
    for (const signal of registrationSignals.values()) {
      if (signal.semester % 2 !== targetSemester % 2) continue;
      // A higher-semester registration is not eligibility evidence for a
      // lower-semester plan (for example, Sem 7 must not populate Sem 5).
      if (signal.semester > targetSemester) continue;
      const signalKey = canonicalCourseKey(signal.course.code);
      const current = latestForTarget.get(signalKey);
      if (!current || isNewerRegistrationSignal(signal, current)) {
        latestForTarget.set(signalKey, signal);
      }
    }
    latestRegisteredBySemester.set(targetSemester, latestForTarget);
  }

  for (const semester of semesters) {
    const publishedCodes = new Set<string>();
    // An official list belongs only to the student's next registration term.
    // For later future semesters, use the recorded cohort evidence below so a
    // stale active offering never looks like a promised future opening.
    if (semester.semester === currentSemester) {
      for (const offering of offerings) {
        if (!offering.isActive || offering.offeringSemester !== semester.semester) continue;
        if (!isEligibleOffering(offering, semester.semester)) continue;
        const option = toOfferingOption(offering, "live", semester.semester);
        const optionKey = option ? canonicalCourseKey(option.code) : "";
        if (!option || publishedCodes.has(optionKey)) continue;
        publishedCodes.add(optionKey);
        semester.liveOptions.push(option);
      }
    }

    const registeredCodes = new Set<string>();
    for (const signal of latestRegisteredBySemester.get(semester.semester)?.values() ?? []) {
      const signalKey = canonicalCourseKey(signal.course.code);
      if (isCourseCompleted(signal.course.id, signal.course.code) || registeredCodes.has(signalKey)) continue;
      registeredCodes.add(signalKey);
      semester.registeredOptions.push({
        id: signal.course.id,
        code: signal.course.code,
        name: signal.course.name,
        credits: signal.course.credits,
        category: signal.category,
        completed: false,
        source: "registered",
        lastRegistered: {
          semester: signal.semester,
          year: signal.year,
          term: signal.term,
          batchYear: signal.batchYear,
          registrations: signal.studentIds.size,
        },
      });
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
      const optionKey = option ? canonicalCourseKey(option.code) : "";
      if (!option || historicalCodes.has(optionKey) || publishedCodes.has(optionKey) || registeredCodes.has(optionKey)) continue;
      historicalCodes.add(optionKey);
      semester.historicalOptions.push(option);
    }
  }

  for (const semester of semesters) {
    semester.requiredCourses.sort(sortCourses);
    semester.mappedElectives.sort(sortCourses);
    semester.liveOptions.sort(sortCourses);
    semester.registeredOptions.sort(sortCourses);
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
            yif: programProgress.remaining.yif,
            pe: programProgress.remaining.pe,
          },
        }
      : null,
    passFail: {
      used: user?.totalPassFailCredits ?? 0,
      remaining: Math.max(0, 9 - (user?.totalPassFailCredits ?? 0)),
      bySemester: passFailBySemester,
    },
    recordedExperience,
    storageKey: `degree-roadmap:${userId}:${normalizeBranchCode(branch)}:${batchYear}`,
  };

  return <RoadmapClient data={data} />;
}
