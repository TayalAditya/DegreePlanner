import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

const getBase64ByteLength = (base64: string) => {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
};

const attachmentSchema = z
  .object({
    fileName: z.string().trim().min(1).max(200),
    mimeType: z.enum(ALLOWED_IMAGE_TYPES),
    fileSize: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
    dataUrl: z.string().max(Math.ceil((MAX_ATTACHMENT_BYTES * 4) / 3) + 200),
  })
  .superRefine((attachment, ctx) => {
    const prefix = `data:${attachment.mimeType};base64,`;
    if (!attachment.dataUrl.startsWith(prefix)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dataUrl"],
        message: "Invalid image data",
      });
      return;
    }

    const encoded = attachment.dataUrl.slice(prefix.length);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dataUrl"],
        message: "Invalid image encoding",
      });
      return;
    }

    if (getBase64ByteLength(encoded) > MAX_ATTACHMENT_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dataUrl"],
        message: "Image is too large",
      });
    }
  });

const createTicketSchema = z.object({
  type: z.enum(["CONTACT", "SUGGESTION", "ISSUE", "FEEDBACK"]),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(4000),
  pageUrl: z.string().trim().max(500).optional(),
  attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS).optional(),
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
            attachments: { orderBy: { createdAt: "asc" } },
            user: {
              select: {
                name: true,
                email: true,
                enrollmentId: true,
              },
            },
          }
        : { attachments: { orderBy: { createdAt: "asc" } } },
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

    const { type, subject, message, pageUrl, attachments = [] } = parsed.data;

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: session.user.id,
        type,
        subject,
        message,
        pageUrl: pageUrl || null,
        attachments:
          attachments.length > 0
            ? {
                create: attachments.map((attachment) => ({
                  fileName: attachment.fileName,
                  mimeType: attachment.mimeType,
                  fileSize: attachment.fileSize,
                  dataUrl: attachment.dataUrl,
                })),
              }
            : undefined,
      },
      include: { attachments: { orderBy: { createdAt: "asc" } } },
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error("Error creating support ticket:", error);
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
  }
}
