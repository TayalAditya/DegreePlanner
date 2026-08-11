import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
// PDF.js normally lazy-loads this fake worker. Keep it as a static server
// dependency so Vercel traces it into the preview function bundle.
import "pdfjs-dist/legacy/build/pdf.worker.mjs";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isDocumentsAdmin } from "@/lib/permissions";
import {
  getPrivatePyqBlob,
  isPreviewablePyqMimeType,
  isPrivatePyqBlobConfigured,
  isPrivatePyqBlobUrl,
} from "@/lib/pyqProtectedStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RENDER_DIMENSION = 1600;

function noStoreImageResponse(image: Buffer, pageCount: number) {
  return new NextResponse(new Uint8Array(image), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(image.length),
      "Cache-Control": "private, no-store, max-age=0",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Frame-Options": "DENY",
      "X-PYQ-Page-Count": String(pageCount),
    },
  });
}

async function renderPdfPage(pdfBytes: Buffer, pageNumber: number) {
  const task = getDocument({ data: new Uint8Array(pdfBytes) });
  try {
    const pdf = await task.promise;
    if (pageNumber > pdf.numPages) return null;

    const page = await pdf.getPage(pageNumber);
    const originalViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(
      1.75,
      Math.max(1, MAX_RENDER_DIMENSION / Math.max(originalViewport.width, originalViewport.height))
    );
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      canvas: canvas as unknown as HTMLCanvasElement,
      viewport,
    }).promise;
    return { image: canvas.toBuffer("image/jpeg", 84), pageCount: pdf.numPages };
  } finally {
    await task.destroy();
  }
}

async function renderImagePage(imageBytes: Buffer) {
  const source = await loadImage(imageBytes);
  const scale = Math.min(1, MAX_RENDER_DIMENSION / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.drawImage(source, 0, 0, width, height);
  return { image: canvas.toBuffer("image/jpeg", 84), pageCount: 1 };
}

// GET /api/pyq/[id]/preview?page=1
// The original file never reaches the browser. Each request is a short-lived,
// raster preview, so neither PDF download controls nor original
// document bytes are available to the user.
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pageValue = req.nextUrl.searchParams.get("page") ?? "1";
    const pageNumber = Number(pageValue);
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 100) {
      return NextResponse.json({ error: "Invalid page number" }, { status: 400 });
    }

    const { id } = await context.params;
    const paper = await prisma.previousYearPaper.findUnique({ where: { id } });
    if (!paper) {
      return NextResponse.json({ error: "Paper not found" }, { status: 404 });
    }

    const isAdmin = isDocumentsAdmin(session.user);
    const isOwner = paper.uploadedById === session.user.id;
    if (paper.status !== "APPROVED" && !isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!isPrivatePyqBlobConfigured()) {
      return NextResponse.json({ error: "Protected paper storage is not configured" }, { status: 503 });
    }
    if (!paper.blobPathname || !isPrivatePyqBlobUrl(paper.fileUrl)) {
      return NextResponse.json(
        { error: "This paper must be migrated to protected storage before it can be viewed." },
        { status: 409 }
      );
    }
    if (!isPreviewablePyqMimeType(paper.mimeType)) {
      return NextResponse.json(
        { error: "This legacy file type cannot be safely previewed. Please ask an administrator to re-upload it as a PDF, JPG or PNG." },
        { status: 415 }
      );
    }

    const stored = await getPrivatePyqBlob(paper.fileUrl);
    if (!stored?.stream) {
      return NextResponse.json({ error: "File unavailable" }, { status: 404 });
    }

    const bytes = Buffer.from(await new Response(stored.stream).arrayBuffer());
    const rendered = paper.mimeType === "application/pdf"
      ? await renderPdfPage(bytes, pageNumber)
      : pageNumber === 1
        ? await renderImagePage(bytes)
        : null;

    if (!rendered) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }
    return noStoreImageResponse(rendered.image, rendered.pageCount);
  } catch (error) {
    console.error("PYQ preview error:", error);
    return NextResponse.json({ error: "Failed to render protected preview" }, { status: 500 });
  }
}
