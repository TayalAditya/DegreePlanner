import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
// import { put } from "@vercel/blob"; // Uncomment when @vercel/blob is installed
import { z } from "zod";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/gif",
];

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

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PDF, DOC, DOCX, JPG, PNG, GIF" },
        { status: 400 }
      );
    }

    // File upload handling
    let fileUrl: string;
    let fileName: string = file.name;
    let fileSize: number = file.size;
    let mimeType: string = file.type;

    // For development: Save to public/uploads/documents/
    // For production: Use Vercel Blob Storage (uncomment below)
    
    if (process.env.NODE_ENV === "production" && process.env.BLOB_READ_WRITE_TOKEN) {
      // Production: Use Vercel Blob Storage
      // Uncomment when @vercel/blob is installed:
      // const { put } = await import("@vercel/blob");
      // const blob = await put(fileName, file, {
      //   access: isPublic ? "public" : "private",
      //   addRandomSuffix: true,
      // });
      // fileUrl = blob.url;
      
      // Fallback if blob not configured
      fileUrl = `/api/documents/files/${Date.now()}-${fileName}`;
    } else {
      // Development: Save to local filesystem
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      // Create unique filename with timestamp
      const timestamp = Date.now();
      const uniqueFileName = `${timestamp}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      // Save to public/uploads/documents/
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
      await mkdir(uploadDir, { recursive: true });
      
      const filePath = path.join(uploadDir, uniqueFileName);
      await writeFile(filePath, buffer);
      
      // URL accessible from browser
      fileUrl = `/uploads/documents/${uniqueFileName}`;
    }

    // Create document record
    const document = await prisma.document.create({
      data: {
        userId: user.id,
        title: validatedData.title,
        description: validatedData.description || null,
        category: validatedData.category,
        fileUrl,
        fileName,
        fileSize,
        mimeType,
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
