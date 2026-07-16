import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const url = process.env.GOOGLE_SHEET_WEBHOOK_URL || "";
  return NextResponse.json({ hasUrl: url.length > 0, len: url.length, prefix: url.substring(0, 40) });
}
