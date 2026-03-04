import { EnrollmentStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { inferAcademicState, inferBatchYear } from "@/lib/academicCalendar";

type UserSemesterMeta = {
  batch?: number | null;
  enrollmentId?: string | null;
};

export const syncEnrollmentStatusesForUser = async (
  userId: string,
  meta: UserSemesterMeta,
  now: Date = new Date()
) => {
  const batchYear = inferBatchYear(meta.batch, meta.enrollmentId);
  if (!batchYear) {
    return { didSync: false as const, reason: "unknown_batch" as const };
  }

  const state = inferAcademicState(batchYear, now);

  // Only auto-sync statuses when a semester is actively running.
  // This avoids surprising flips during the Jun–Jul break window.
  if (!state.isInSession) {
    return {
      didSync: false as const,
      reason: "break" as const,
      phase: state.phase,
      currentSemester: state.currentSemester,
    };
  }

  const currentSemester = state.currentSemester;

  const [gradeMarkedCompleted, pastSemMarkedCompleted, currentSemReopened] = await prisma.$transaction([
    prisma.courseEnrollment.updateMany({
      where: {
        userId,
        status: EnrollmentStatus.IN_PROGRESS,
        grade: { not: null },
      },
      data: { status: EnrollmentStatus.COMPLETED },
    }),
    prisma.courseEnrollment.updateMany({
      where: {
        userId,
        status: EnrollmentStatus.IN_PROGRESS,
        grade: null,
        semester: { lt: currentSemester },
      },
      data: { status: EnrollmentStatus.COMPLETED },
    }),
    prisma.courseEnrollment.updateMany({
      where: {
        userId,
        status: EnrollmentStatus.COMPLETED,
        grade: null,
        semester: currentSemester,
      },
      data: { status: EnrollmentStatus.IN_PROGRESS },
    }),
  ]);

  const updatedCount =
    gradeMarkedCompleted.count + pastSemMarkedCompleted.count + currentSemReopened.count;

  return {
    didSync: updatedCount > 0,
    phase: state.phase,
    currentSemester,
    updatedCount,
  };
};

