import { NextRequest, NextResponse } from "next/server";
import { flushFeedback } from "@/lib/feedbackDigest";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const { sent } = await flushFeedback({ force: true });
    return NextResponse.json({ ok: true, sent }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[feedback-digest] cron flush failed:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
