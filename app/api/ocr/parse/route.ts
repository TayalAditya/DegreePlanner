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
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const mimeType = (file as File).type;
    if (mimeType !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported on this endpoint" },
        { status: 400 }
      );
    }

    const arrayBuffer = await (file as File).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // pdf-parse is CommonJS — require() avoids ESM/CJS interop issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const parsed = await pdfParse(buffer);

    const rawText: string = parsed.text ?? "";
    const courses = parseTranscriptText(rawText);

    return NextResponse.json({ rawText, courses });
  } catch (err) {
    console.error("OCR parse error:", err);
    return NextResponse.json(
      { error: "Failed to parse file" },
      { status: 500 }
    );
  }
}
