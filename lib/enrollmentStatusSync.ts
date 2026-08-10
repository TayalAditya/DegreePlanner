import { EnrollmentStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { inferAcademicState, inferBatchYear } from "@/lib/academicCalendar";

export type UserSemesterMeta = {
  batch?: number | null;
  enrollmentId?: string | null;
};

export const getCurrentSemesterForUser = (
  meta: UserSemesterMeta,
  now: Date = new Date()
) => {
  const batchYear = inferBatchYear(meta.batch, meta.enrollmentId);
  if (!batchYear) return null;

  const state = inferAcademicState(batchYear, now);
  return state.isPastProgram ? null : state.currentSemester;
};

export const isCurrentOrFutureSemesterForUser = (
  semester: number,
  meta: UserSemesterMeta,
  now: Date = new Date()
) => {
  const currentSemester = getCurrentSemesterForUser(meta, now);
  return currentSemester !== null && semester >= currentSemester;
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

  // A graduated batch has no active term. Use a boundary after Sem 8 so any
  // stale enrollment is reconciled as historical, without reopening Sem 8.
  const completionBoundary = state.isPastProgram ? 9 : state.currentSemester;

  // Read-first guard: on the common case nothing needs flipping, so avoid
  // opening a write transaction on every read. This is purely an optimization —
  // the atomic $transaction below still runs whenever there IS work to do, so
  // no update is ever skipped.
  const pendingCount = await prisma.courseEnrollment.count({
    where: {
      userId,
      status: EnrollmentStatus.IN_PROGRESS,
      semester: { lt: completionBoundary },
    },
  });

  if (pendingCount === 0) {
    return {
      didSync: false as const,
      phase: state.phase,
      currentSemester: state.currentSemester,
      updatedCount: 0,
    };
  }

  const pastSemMarkedCompleted = await prisma.courseEnrollment.updateMany({
    where: {
      userId,
      status: EnrollmentStatus.IN_PROGRESS,
      semester: { lt: completionBoundary },
    },
    data: { status: EnrollmentStatus.COMPLETED },
  });

  const updatedCount = pastSemMarkedCompleted.count;

  return {
    didSync: updatedCount > 0,
    phase: state.phase,
    currentSemester: state.currentSemester,
    updatedCount,
  };
};
