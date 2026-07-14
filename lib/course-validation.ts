import prisma from "@/lib/prisma";
import { MTP_COMPONENT_CREDITS } from "@/lib/mtpConfig";
import { addCredits, formatCredits, sumCredits } from "@/lib/utils";
import { EnrollmentStatus } from "@prisma/client";

/**
 * Pass/Fail course constraints:
 * - Total: max 9 credits (count towards Free Electives)
 * - Per semester: max 6 credits
 */

export const PASS_FAIL_LIMITS = {
  TOTAL_CREDITS: 9,
  PER_SEMESTER_CREDITS: 6,
};

export const INTERNSHIP_CREDITS = {
  REMOTE: 6,      // Semester-long remote internship
  ONSITE: 9,      // Onsite P/F FE internship
  BS_SHORT: 0,    // BS students: no credits for 6-week internships
};

export function normalizeCourseCode(code: string): string {
  return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isOnsiteSemesterInternshipCourse(code: string): boolean {
  return normalizeCourseCode(code).endsWith("399P");
}

export function isSemesterInternshipCourse(code: string): boolean {
  const normalized = normalizeCourseCode(code);
  return normalized.endsWith("396P") || normalized.endsWith("399P");
}

/**
 * A 399P onsite internship is the one exception to the 6-credit per-semester
 * P/F limit. It is exactly 9 P/F credits and consumes the full programme P/F
 * allowance, so it cannot coexist with any other active P/F enrollment.
 */
export async function validateOnsiteInternshipPassFailBudget(
  userId: string,
  credits: number,
  excludeEnrollmentId?: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (Number(credits) !== INTERNSHIP_CREDITS.ONSITE) {
    return {
      allowed: false,
      reason: `A 399P onsite internship must carry exactly ${INTERNSHIP_CREDITS.ONSITE} P/F credits.`,
    };
  }

  const existingPassFail = await prisma.courseEnrollment.findMany({
    where: {
      userId,
      isPassFail: true,
      status: { notIn: [EnrollmentStatus.DROPPED, EnrollmentStatus.FAILED] },
      ...(excludeEnrollmentId ? { id: { not: excludeEnrollmentId } } : {}),
    },
    select: { course: { select: { code: true } } },
  });

  if (existingPassFail.length > 0) {
    return {
      allowed: false,
      reason: "399P uses all 9 P/F credits, so remove existing P/F courses before adding it.",
    };
  }

  return { allowed: true };
}

/**
 * 399P is a semester-long onsite internship: no other active enrollment may
 * share that semester. This is used by every enrollment entry point.
 */
export async function validateOnsiteInternshipExclusivity(
  userId: string,
  semester: number,
  courseCode: string,
  excludeEnrollmentId?: string
): Promise<{ allowed: boolean; reason?: string }> {
  const semesterEnrollments = await prisma.courseEnrollment.findMany({
    where: {
      userId,
      semester,
      status: { notIn: [EnrollmentStatus.DROPPED, EnrollmentStatus.FAILED] },
      ...(excludeEnrollmentId ? { id: { not: excludeEnrollmentId } } : {}),
    },
    select: { course: { select: { code: true } } },
  });

  const is399P = isOnsiteSemesterInternshipCourse(courseCode);
  const semesterHas399P = semesterEnrollments.some((enrollment) =>
    isOnsiteSemesterInternshipCourse(enrollment.course.code)
  );

  if (is399P && semesterEnrollments.length > 0) {
    return {
      allowed: false,
      reason: `399P is a full-semester onsite internship. Remove all other Semester ${semester} courses first.`,
    };
  }

  if (!is399P && semesterHas399P) {
    return {
      allowed: false,
      reason: `Cannot add another Semester ${semester} course while 399P is enrolled.`,
    };
  }

  return { allowed: true };
}

/**
 * Check if student can take a P/F course
 */
export async function canTakePassFailCourse(
  userId: string,
  credits: number,
  semester: number
): Promise<{ allowed: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      totalPassFailCredits: true,
      id: true,
    },
  });

  if (!user) {
    return { allowed: false, reason: "User not found" };
  }

  // Check total P/F credits
  const newTotal = addCredits(user.totalPassFailCredits, credits);
  if (newTotal > PASS_FAIL_LIMITS.TOTAL_CREDITS) {
    return {
      allowed: false,
      reason: `Cannot exceed ${formatCredits(PASS_FAIL_LIMITS.TOTAL_CREDITS)} total P/F credits. Currently at ${formatCredits(user.totalPassFailCredits)}, requesting ${formatCredits(credits)} more.`,
    };
  }

  // Check per-semester P/F credits
  const semesterEnrollments = await prisma.courseEnrollment.findMany({
    where: {
      userId,
      semester,
      isPassFail: true,
      status: { notIn: [EnrollmentStatus.DROPPED, EnrollmentStatus.FAILED] },
    },
    select: {
      course: { select: { credits: true } },
    },
  });

  const currentSemesterPF = sumCredits(semesterEnrollments.map((e) => e.course.credits));
  const newSemesterTotal = addCredits(currentSemesterPF, credits);

  if (newSemesterTotal > PASS_FAIL_LIMITS.PER_SEMESTER_CREDITS) {
    return {
      allowed: false,
      reason: `Cannot exceed ${formatCredits(PASS_FAIL_LIMITS.PER_SEMESTER_CREDITS)} P/F credits per semester. Currently at ${formatCredits(currentSemesterPF)} in semester ${semester}, requesting ${formatCredits(credits)} more.`,
    };
  }

  return { allowed: true };
}

/**
 * Get internship credits based on type and student program
 */
export async function getInternshipCredits(
  userId: string,
  internshipType: "REMOTE" | "ONSITE",
  internshipDays?: number
): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      programs: {
        where: { isPrimary: true },
        select: { program: { select: { code: true } } },
      },
    },
  });

  if (!user) return 0;

  const isBSStudent = user.programs[0]?.program?.code === "BSCS";

  // BS students: no credits for 6-week internships
  if (isBSStudent && internshipDays && internshipDays <= 42) {
    return INTERNSHIP_CREDITS.BS_SHORT;
  }

  // Regular B.Tech students
  return internshipType === "REMOTE"
    ? INTERNSHIP_CREDITS.REMOTE
    : INTERNSHIP_CREDITS.ONSITE;
}

/**
 * Validate branch-specific course enrollment
 */
export async function validateBranchSpecificCourse(
  userId: string,
  courseCode: string,
  semester: number
): Promise<{ valid: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { branch: true },
  });

  if (!user?.branch) {
    return { valid: false, reason: "User branch not assigned" };
  }

  const course = await prisma.course.findUnique({
    where: { code: courseCode },
    select: {
      isBranchSpecific: true,
      requiredBranches: true,
      requiredSemester: true,
    },
  });

  if (!course) {
    return { valid: false, reason: "Course not found" };
  }

  // Check if it's branch-specific
  if (course.isBranchSpecific) {
    if (!course.requiredBranches.includes(user.branch)) {
      return {
        valid: false,
        reason: `This course is only for branches: ${course.requiredBranches.join(", ")}`,
      };
    }

    if (course.requiredSemester && semester !== course.requiredSemester) {
      return {
        valid: false,
        reason: `This course must be taken in semester ${course.requiredSemester}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Calculate adjusted DE and FE credits based on ISTP selection
 */
export function calculateAdjustedElectives(
  doingISTP: boolean,
  doingMTP2: boolean,
  branchConfig: {
    deCredits: number;
    feCredits: number;
  }
): {
  deCredits: number;
  feCredits: number;
} {
  let deCredits = branchConfig.deCredits;
  let feCredits = branchConfig.feCredits;

  // If ISTP is skipped: +4 to FE
  if (!doingISTP) {
    feCredits += 4;
  }

  // If MTP-2 is skipped, replace its project credits with DE.
  if (!doingMTP2) {
    deCredits += MTP_COMPONENT_CREDITS;
  }

  return { deCredits, feCredits };
}
