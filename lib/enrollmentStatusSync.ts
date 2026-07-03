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

  // Read-first guard: on the common case nothing needs flipping, so avoid
  // opening a write transaction on every read. This is purely an optimization —
  // the atomic $transaction below still runs whenever there IS work to do, so
  // no update is ever skipped.
  const pendingCount = await prisma.courseEnrollment.count({
    where: {
      userId,
      status: EnrollmentStatus.IN_PROGRESS,
      OR: [
        { grade: { not: null } },
        { grade: null, semester: { lt: currentSemester } },
      ],
    },
  });

  if (pendingCount === 0) {
    return {
      didSync: false as const,
      phase: state.phase,
      currentSemester,
      updatedCount: 0,
    };
  }

  const [gradeMarkedCompleted, pastSemMarkedCompleted] = await prisma.$transaction([
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
  ]);

  const updatedCount =
    gradeMarkedCompleted.count + pastSemMarkedCompleted.count;

  return {
    didSync: updatedCount > 0,
    phase: state.phase,
    currentSemester,
    updatedCount,
  };
};
