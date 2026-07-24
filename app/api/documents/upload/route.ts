import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { isDocumentsAdmin } from "@/lib/permissions";
import {
  uploadToBlob,
  validateUploadFile,
  isBlobConfigured,
} from "@/lib/blobStorage";

const documentSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  category: z.enum([
    "FORMS",
    "PROCEDURES",
    "GUIDES",
    "CERTIFICATES",
    "TRANSCRIPTS",
    "OTHER",
  ]),
  isPublic: z.boolean().default(false),
});

// POST /api/documents/upload - Upload document with file
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!isDocumentsAdmin(session.user)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const category = formData.get("category") as string;
    const isPublic = formData.get("isPublic") === "true";

    // Validate input
    const validatedData = documentSchema.parse({
      title,
      description,
      category,
      isPublic,
    });

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const fileError = validateUploadFile(file);
    if (fileError) {
      return NextResponse.json({ error: fileError }, { status: 400 });
    }

    if (!isBlobConfigured()) {
      return NextResponse.json(
        { error: "File storage is not configured. Please contact an administrator." },
        { status: 503 }
      );
    }

    // Store the file in Vercel Blob (durable; the raw URL is never exposed to
    // clients — access goes through /api/documents/[id]/view).
    const stored = await uploadToBlob(file, { prefix: "documents" });

    // Create document record
    const document = await prisma.document.create({
      data: {
        userId: user.id,
        title: validatedData.title,
        description: validatedData.description || null,
        category: validatedData.category,
        fileUrl: stored.url,
        blobPathname: stored.pathname,
        fileName: stored.fileName,
        fileSize: stored.fileSize,
        mimeType: stored.mimeType,
        isPublic: validatedData.isPublic,
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error uploading document:", error);
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
  }
}
