import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
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

function drawWatermark(
  context: SKRSContext2D,
  width: number,
  height: number,
  viewer: string
) {
  const timestamp = new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
  const text = `${viewer} | PlanMyDegree view only | ${timestamp}`;

  context.save();
  context.fillStyle = "rgba(185, 28, 28, 0.30)";
  context.font = "bold 22px Arial";
  context.translate(width / 2, height / 2);
  context.rotate(-Math.PI / 6);

  for (let y = -height; y < height; y += 145) {
    for (let x = -width; x < width; x += 330) {
      context.fillText(text, x, y);
    }
  }
  context.restore();

  context.save();
  context.fillStyle = "rgba(127, 29, 29, 0.75)";
  context.font = "bold 14px Arial";
  context.fillText(text, 22, Math.max(26, height - 22));
  context.restore();
}

async function renderPdfPage(pdfBytes: Buffer, pageNumber: number, viewer: string) {
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
    drawWatermark(context, canvas.width, canvas.height, viewer);

    return { image: canvas.toBuffer("image/jpeg", 84), pageCount: pdf.numPages };
  } finally {
    await task.destroy();
  }
}

async function renderImagePage(imageBytes: Buffer, viewer: string) {
  const source = await loadImage(imageBytes);
  const scale = Math.min(1, MAX_RENDER_DIMENSION / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.drawImage(source, 0, 0, width, height);
  drawWatermark(context, width, height, viewer);
  return { image: canvas.toBuffer("image/jpeg", 84), pageCount: 1 };
}

// GET /api/pyq/[id]/preview?page=1
// The original file never reaches the browser. Each request is a short-lived,
// personalized raster preview, so neither PDF download controls nor original
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
        { error: "This legacy file type cannot be safely previewed. Please ask an administrator to re-upload it as a PDF, JPG, or PNG." },
        { status: 415 }
      );
    }

    const stored = await getPrivatePyqBlob(paper.fileUrl);
    if (!stored?.stream) {
      return NextResponse.json({ error: "File unavailable" }, { status: 404 });
    }

    const bytes = Buffer.from(await new Response(stored.stream).arrayBuffer());
    const viewer = [session.user.enrollmentId, session.user.email]
      .filter((value): value is string => Boolean(value))
      .join(" | ") || session.user.id;
    const rendered = paper.mimeType === "application/pdf"
      ? await renderPdfPage(bytes, pageNumber, viewer)
      : pageNumber === 1
        ? await renderImagePage(bytes, viewer)
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
