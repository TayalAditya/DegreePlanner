import prisma from "@/lib/prisma";
import { sendSamarthDigest, type SamarthReportRow, type ReportType } from "@/lib/email";

/** Send a digest immediately when at least this many reports are pending. */
export const SAMARTH_BATCH_THRESHOLD = 5;

/** Report types that get their own independent digest. */
const REPORT_TYPES: ReportType[] = ["SAMARTH", "SOOTRANK"];

/**
 * Flush pending course reports to the digest email — per report type.
 * Each type (Samarth, Sootrank) batches and emails independently, so a Sootrank
 * report never counts toward the Samarth threshold and vice versa.
 *
 * - Inline (after a student POST): sends a type only when ≥ SAMARTH_BATCH_THRESHOLD pending.
 * - Cron / force: sends everything pending (> 0) for every type.
 */
export async function flushSamarthReports(
  { force = false }: { force?: boolean } = {}
): Promise<{ sent: number }> {
  let totalSent = 0;

  for (const reportType of REPORT_TYPES) {
    const pending = await prisma.samarthReport.findMany({
      where: { sentAt: null, reportType },
      orderBy: { createdAt: "asc" },
    });

    if (pending.length === 0) continue;

    const shouldSend = force || pending.length >= SAMARTH_BATCH_THRESHOLD;
    if (!shouldSend) continue;

    const rows: SamarthReportRow[] = pending.map((r) => ({
      rollNumber: r.rollNumber,
      studentName: r.studentName,
      batchYear: r.batchYear,
      branch: r.branch,
      courseCode: r.courseCode,
      courseName: r.courseName,
    }));

    await sendSamarthDigest(rows, { reportType });

    await prisma.samarthReport.updateMany({
      where: { id: { in: pending.map((r) => r.id) } },
      data: { sentAt: new Date() },
    });

    totalSent += pending.length;
  }

  return { sent: totalSent };
}
