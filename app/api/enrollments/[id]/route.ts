import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { id },
      include: {
        course: true,
      },
    });

    if (!enrollment || enrollment.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(enrollment);
  } catch (error) {
    console.error("Error fetching enrollment:", error);
    return NextResponse.json(
      { error: "Failed to fetch enrollment" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { grade, status, courseType } = body;

    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { id },
    });

    if (!enrollment || enrollment.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.courseEnrollment.update({
      where: { id },
      data: {
        ...(grade !== undefined && { grade }),
        ...(status !== undefined && { status }),
        ...(courseType !== undefined && { courseType }),
      },
      include: {
        course: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating enrollment:", error);
    return NextResponse.json(
      { error: "Failed to update enrollment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        isPassFail: true,
        passFailCredits: true,
      },
    });

    if (!enrollment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isAdmin = session.user.role === "ADMIN";
    const isOwner = enrollment.userId === session.user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.courseEnrollment.delete({ where: { id } });

      if (enrollment.isPassFail && enrollment.passFailCredits > 0) {
        const user = await tx.user.findUnique({
          where: { id: enrollment.userId },
          select: { totalPassFailCredits: true },
        });

        if (user) {
          await tx.user.update({
            where: { id: enrollment.userId },
            data: {
              totalPassFailCredits: Math.max(
                0,
                user.totalPassFailCredits - enrollment.passFailCredits
              ),
            },
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting enrollment:", error);
    return NextResponse.json(
      { error: "Failed to delete enrollment" },
      { status: 500 }
    );
  }
}
