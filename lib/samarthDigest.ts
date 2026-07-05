import prisma from "@/lib/prisma";
import { sendSamarthDigest, type SamarthReportRow } from "@/lib/email";

/** Send a digest when at least this many reports are pending. */
export const SAMARTH_BATCH_THRESHOLD = 10;
/** Or when the oldest pending report is older than this (ms) — flush small volumes. */
export const SAMARTH_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

/**
 * Flush pending Samarth reports to the digest email when the batch threshold is
 * reached, the oldest pending report has aged past SAMARTH_MAX_AGE_MS, or `force`.
 * Marks flushed reports with `sentAt` so they aren't re-sent.
 */
export async function flushSamarthReports(
  { force = false }: { force?: boolean } = {}
): Promise<{ sent: number }> {
  const pending = await prisma.samarthReport.findMany({
    where: { sentAt: null },
    orderBy: { createdAt: "asc" },
  });

  if (pending.length === 0) return { sent: 0 };

  const oldest = pending[0].createdAt.getTime();
  const aged = Date.now() - oldest >= SAMARTH_MAX_AGE_MS;
  const shouldSend = force || pending.length >= SAMARTH_BATCH_THRESHOLD || aged;
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
