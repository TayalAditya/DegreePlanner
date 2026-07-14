import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { flushFeedback } from "@/lib/feedbackDigest";

const EMOJI_KEYS = ["useful", "love", "improve", "great_ux"] as const;

const feedbackSchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    emoji: z.enum(EMOJI_KEYS).optional(),
    message: z.string().trim().max(2000).optional(),
  })
  .refine((d) => d.emoji || d.message, {
    message: "Provide a reaction or a message",
  });

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "1";

  if (all && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const feedbacks = await prisma.feedback.findMany({
      where: all ? undefined : { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: all ? 500 : 50,
    });

    return NextResponse.json(feedbacks);
  } catch (error) {
    console.error("Error fetching feedback:", error);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
}

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
        rating: rating ?? 0,
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

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await prisma.feedback.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting feedback:", error);
    return NextResponse.json({ error: "Failed to delete feedback" }, { status: 500 });
  }
}
