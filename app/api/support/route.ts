import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const createTicketSchema = z.object({
  type: z.enum(["CONTACT", "SUGGESTION", "ISSUE", "FEEDBACK"]),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(4000),
  pageUrl: z.string().trim().max(500).optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "1";

    if (all && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tickets = await prisma.supportTicket.findMany({
      where: all ? undefined : { userId: session.user.id },
      include: all
        ? {
            user: {
              select: {
                name: true,
                email: true,
                enrollmentId: true,
              },
            },
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: all ? 300 : 100,
    });

    return NextResponse.json(tickets);
  } catch (error) {
    console.error("Error fetching support tickets:", error);
    return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { type, subject, message, pageUrl } = parsed.data;

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: session.user.id,
        type,
        subject,
        message,
        pageUrl: pageUrl || null,
      },
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error("Error creating support ticket:", error);
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
  }
}

