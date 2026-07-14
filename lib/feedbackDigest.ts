import prisma from "@/lib/prisma";
import { sendFeedbackDigest, type FeedbackRow } from "@/lib/email";

export const FEEDBACK_BATCH_THRESHOLD = 10;

export async function flushFeedback(
  { force = false }: { force?: boolean } = {}
): Promise<{ sent: number }> {
  const pending = await prisma.feedback.findMany({
    where: { sentAt: null },
    orderBy: { createdAt: "asc" },
  });

  if (pending.length === 0) return { sent: 0 };

  const shouldSend = force || pending.length >= FEEDBACK_BATCH_THRESHOLD;
  if (!shouldSend) return { sent: 0 };

  const rows: FeedbackRow[] = pending.map((r) => ({
    userName: r.userName,
    rollNumber: r.rollNumber,
    branch: r.branch,
    rating: r.rating,
    emoji: r.emoji,
    message: r.message,
    createdAt: r.createdAt,
  }));

  await sendFeedbackDigest(rows);

  await prisma.feedback.updateMany({
    where: { id: { in: pending.map((r) => r.id) } },
    data: { sentAt: new Date() },
  });

  return { sent: pending.length };
}
