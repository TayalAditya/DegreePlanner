import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Lightweight health/keep-warm endpoint. Runs a trivial `SELECT 1` so a Vercel
// Cron can keep the Neon (free-tier) database from suspending after idle, which
// otherwise adds cold-start wake latency (~500ms+) to the next real request.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
