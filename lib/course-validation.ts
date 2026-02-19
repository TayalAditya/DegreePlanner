import prisma from "@/lib/prisma";

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
  const newTotal = user.totalPassFailCredits + credits;
  if (newTotal > PASS_FAIL_LIMITS.TOTAL_CREDITS) {
    return {
      allowed: false,
      reason: `Cannot exceed ${PASS_FAIL_LIMITS.TOTAL_CREDITS} total P/F credits. Currently at ${user.totalPassFailCredits}, requesting ${credits} more.`,
    };
  }

  // Check per-semester P/F credits
  const semesterEnrollments = await prisma.courseEnrollment.findMany({
    where: {
      userId,
      semester,
      isPassFail: true,
    },
    select: {
      course: { select: { credits: true } },
    },
  });

  const currentSemesterPF = semesterEnrollments.reduce(
    (sum, e) => sum + e.course.credits,
    0
  );
  const newSemesterTotal = currentSemesterPF + credits;

  if (newSemesterTotal > PASS_FAIL_LIMITS.PER_SEMESTER_CREDITS) {
    return {
      allowed: false,
      reason: `Cannot exceed ${PASS_FAIL_LIMITS.PER_SEMESTER_CREDITS} P/F credits per semester. Currently at ${currentSemesterPF} in semester ${semester}, requesting ${credits} more.`,
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

  // If MTP-2 is skipped: +5 to DE
  if (!doingMTP2) {
    deCredits += 5;
  }

  return { deCredits, feCredits };
}
