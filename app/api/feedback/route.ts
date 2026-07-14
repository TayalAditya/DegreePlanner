import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { flushFeedback } from "@/lib/feedbackDigest";

const EMOJI_KEYS = ["useful", "love", "improve", "great_ux"] as const;

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  emoji: z.enum(EMOJI_KEYS).optional(),
  message: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { rating, emoji, message } = parsed.data;
    const user = session.user;

    await prisma.feedback.create({
      data: {
        userId: user.id,
        rating,
        emoji: emoji || null,
        message: message || null,
        userName: user.name || "Unknown",
        rollNumber: user.enrollmentId || "N/A",
        branch: user.branch || "N/A",
      },
    });

    // Attempt to flush if threshold is met (fire-and-forget)
    flushFeedback().catch(() => {});

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Error creating feedback:", error);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
