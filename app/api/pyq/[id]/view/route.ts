import { NextResponse } from "next/server";

// This route used to stream the original file, which made browser download and
// print controls unavoidable. It remains as an explicit failure for any old
// bookmarks; the protected /preview route returns only watermarked page images.
export async function GET() {
  return NextResponse.json(
    { error: "Direct question-paper downloads are disabled. Open the protected viewer from Previous Year Papers." },
    { status: 410 }
  );
}
