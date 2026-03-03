import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CourseType, EnrollmentStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        enrollmentId: true,
        branch: true,
        batch: true,
        role: true,
        doingMTP: true,
        doingMTP2: true,
        doingISTP: true,
        totalPassFailCredits: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("User fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, enrollmentId, branch, doingMTP, doingMTP2, doingISTP } = body;

    // Check if user already has a branch set
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { branch: true, doingMTP: true, doingMTP2: true, doingISTP: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent branch changes if branch is already set
    if (branch && currentUser.branch && currentUser.branch !== branch) {
      return NextResponse.json(
        { error: "Cannot change branch after it has been set" },
        { status: 403 }
      );
    }

    // Validate branch if provided
    if (branch) {
      const validBranches = [
        "CSE", "DSE", "EE", "ME", "CE", "BE",
        "EP", "MNC", "MSE", "GE", "MEVLSI", "BSCS"
      ];
      if (!validBranches.includes(branch)) {
        return NextResponse.json(
          { error: "Invalid branch code" },
          { status: 400 }
        );
      }
    }

    let nextDoingMTP = doingMTP !== undefined ? Boolean(doingMTP) : currentUser.doingMTP;
    let nextDoingMTP2 = doingMTP2 !== undefined
      ? Boolean(doingMTP2)
      : (currentUser.doingMTP2 ?? currentUser.doingMTP);
    let nextDoingISTP = doingISTP !== undefined ? Boolean(doingISTP) : currentUser.doingISTP;

    // Enforce dependency: MTP-2 implies MTP-1
    if (nextDoingMTP2) nextDoingMTP = true;
    if (!nextDoingMTP) nextDoingMTP2 = false;

    const skippingMTPAll = currentUser.doingMTP && !nextDoingMTP;
    const skippingMTP2Only = !skippingMTPAll && (currentUser.doingMTP2 ?? currentUser.doingMTP) && !nextDoingMTP2;
    const skippingISTP = currentUser.doingISTP && !nextDoingISTP;

    const user = await prisma.$transaction(async (tx) => {
      // Auto-deregister enrolled courses for skipped components (only IN_PROGRESS)
      if (skippingMTPAll) {
        await tx.courseEnrollment.deleteMany({
          where: {
            userId: session.user.id,
            status: EnrollmentStatus.IN_PROGRESS,
            OR: [
              { courseType: CourseType.MTP },
              { course: { code: { endsWith: "498P" } } },
              { course: { code: { endsWith: "499P" } } },
              { course: { code: { contains: "MTP" } } },
            ],
          },
        });
      } else if (skippingMTP2Only) {
        await tx.courseEnrollment.deleteMany({
          where: {
            userId: session.user.id,
            status: EnrollmentStatus.IN_PROGRESS,
            course: { code: { endsWith: "499P" } },
          },
        });
      }

      if (skippingISTP) {
        await tx.courseEnrollment.deleteMany({
          where: {
            userId: session.user.id,
            status: EnrollmentStatus.IN_PROGRESS,
            OR: [
              { courseType: CourseType.ISTP },
              { course: { code: { endsWith: "301P" } } },
              { course: { code: { contains: "ISTP" } } },
            ],
          },
        });
      }

      return tx.user.update({
        where: { id: session.user.id },
        data: {
          ...(name && { name }),
          ...(enrollmentId !== undefined && { enrollmentId }),
          ...(branch && { branch }),
          ...(doingMTP !== undefined || doingMTP2 !== undefined ? { doingMTP: nextDoingMTP, doingMTP2: nextDoingMTP2 } : {}),
          ...(doingISTP !== undefined && { doingISTP: nextDoingISTP }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          enrollmentId: true,
          branch: true,
          batch: true,
          role: true,
          doingMTP: true,
          doingMTP2: true,
          doingISTP: true,
          totalPassFailCredits: true,
        },
      });
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("User update error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}
