import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const shareSelect = {
  isProfileShared: true,
  shareToken: true,
} as const;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: shareSelect,
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Share settings fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch share settings" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const action = body?.action;

    if (action !== "toggle" && action !== "regenerate") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const current = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: shareSelect,
    });

    if (!current) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const data =
      action === "toggle"
        ? {
            isProfileShared: !current.isProfileShared,
            ...(!current.isProfileShared && !current.shareToken
              ? { shareToken: randomUUID() }
              : {}),
          }
        : {
            shareToken: randomUUID(),
          };

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: shareSelect,
    });

    return NextResponse.json(updated, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Share settings update error:", error);
    return NextResponse.json(
      { error: "Failed to update share settings" },
      { status: 500 }
    );
  }
}
