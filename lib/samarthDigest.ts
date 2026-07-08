import prisma from "@/lib/prisma";
import { sendSamarthDigest, type SamarthReportRow } from "@/lib/email";

/** Send a digest immediately when at least this many reports are pending. */
export const SAMARTH_BATCH_THRESHOLD = 10;

/**
 * Flush pending Samarth reports to the digest email.
 *
 * - Inline (after a student POST): sends only when ≥ SAMARTH_BATCH_THRESHOLD pending.
 * - Cron / force: sends everything pending (> 0).
 */
export async function flushSamarthReports(
  { force = false }: { force?: boolean } = {}
): Promise<{ sent: number }> {
  const pending = await prisma.samarthReport.findMany({
    where: { sentAt: null },
    orderBy: { createdAt: "asc" },
  });

  if (pending.length === 0) return { sent: 0 };

  const shouldSend = force || pending.length >= SAMARTH_BATCH_THRESHOLD;
  if (!shouldSend) return { sent: 0 };

  const rows: SamarthReportRow[] = pending.map((r) => ({
    rollNumber: r.rollNumber,
    studentName: r.studentName,
    batchYear: r.batchYear,
    branch: r.branch,
    courseCode: r.courseCode,
    courseName: r.courseName,
  }));

  await sendSamarthDigest(rows);

  await prisma.samarthReport.updateMany({
    where: { id: { in: pending.map((r) => r.id) } },
    data: { sentAt: new Date() },
  });

  return { sent: pending.length };
}
