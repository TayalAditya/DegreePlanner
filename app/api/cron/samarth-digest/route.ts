import { NextRequest, NextResponse } from "next/server";
import { flushSamarthReports } from "@/lib/samarthDigest";

// Vercel Cron hits this on a schedule (see vercel.json). It flushes pending
// Samarth reports whose oldest entry has aged past the max-age window, so small
// volumes that never reach the batch threshold still get delivered.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // If CRON_SECRET is configured, require it (Vercel sends it as a Bearer token).
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const { sent } = await flushSamarthReports({ force: true });
    return NextResponse.json({ ok: true, sent }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[samarth-digest] cron flush failed:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
