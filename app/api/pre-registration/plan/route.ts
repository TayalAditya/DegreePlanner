import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const semester = Number(searchParams.get("semester"));
  const year = Number(searchParams.get("year"));
  if (!semester || !year) return NextResponse.json({ error: "Missing semester or year" }, { status: 400 });

  const plan = await prisma.preRegistrationPlan.findUnique({
    where: { userId_offeringSemester_offeringYear: { userId: session.user.id, offeringSemester: semester, offeringYear: year } },
    select: { selectedIds: true, updatedAt: true },
  });

  return NextResponse.json({ selectedIds: plan?.selectedIds ?? [], updatedAt: plan?.updatedAt ?? null });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { semester, year, selectedIds } = body as { semester: number; year: number; selectedIds: string[] };

  if (!semester || !year || !Array.isArray(selectedIds)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const plan = await prisma.preRegistrationPlan.upsert({
    where: { userId_offeringSemester_offeringYear: { userId: session.user.id, offeringSemester: semester, offeringYear: year } },
    create: { userId: session.user.id, offeringSemester: semester, offeringYear: year, selectedIds },
    update: { selectedIds },
    select: { updatedAt: true },
  });

  return NextResponse.json({ ok: true, updatedAt: plan.updatedAt });
}
