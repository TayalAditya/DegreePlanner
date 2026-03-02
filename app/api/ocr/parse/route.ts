import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseTranscriptText } from "@/lib/parseTranscript";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[OCR] Request received");

    const formData = await req.formData();
    const file = formData.get("file");
    console.log("[OCR] File field:", file ? `type=${typeof file}, name=${(file as File)?.name}, size=${(file as File)?.size}` : "null");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const mimeType = (file as File).type;
    console.log("[OCR] MIME type:", mimeType);

    if (mimeType !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported on this endpoint" },
        { status: 400 }
      );
    }

    const arrayBuffer = await (file as File).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log("[OCR] Buffer size:", buffer.length, "bytes");

    // Import the internal lib directly to avoid pdf-parse's test-file bootstrap
    // which tries to read from filesystem and fails in Vercel serverless
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse/lib/pdf-parse.js");
    console.log("[OCR] pdf-parse loaded:", typeof pdfParse);

    const parsed = await pdfParse(buffer);
    console.log("[OCR] PDF parsed, text length:", parsed.text?.length ?? 0, "chars");

    const rawText: string = parsed.text ?? "";
    const courses = parseTranscriptText(rawText);
    console.log("[OCR] Detected courses:", courses.length);

    return NextResponse.json({ rawText, courses });
  } catch (err) {
    console.error("[OCR] Error:", err);
    return NextResponse.json(
      { error: "Failed to parse file", detail: String(err) },
      { status: 500 }
    );
  }
}
