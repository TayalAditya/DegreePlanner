import prisma from "@/lib/prisma";

/**
 * Acad-sec accounts (sae@, adcourses@, etc.) are shared logins that also carry a
 * placeholder branch/batch so they can preview the student pre-reg view. Because
 * many people use them, stray test data (submitted pre-reg plans, mock enrollments)
 * accumulates and pollutes the view — e.g. CS/DS courses showing up for a ME login.
 *
 * This wipes that scratch data so the account always starts fresh. Called on every
 * login (sync-user) and whenever the branch is changed. Safe to call for non-acad-sec
 * users too — callers should gate on isAcadSec() first, but this only ever deletes
 * the given user's own rows.
 */
export async function resetAcadSecScratchData(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.preRegistrationPlan.deleteMany({ where: { userId } }),
    prisma.courseEnrollment.deleteMany({ where: { userId } }),
  ]);
}
