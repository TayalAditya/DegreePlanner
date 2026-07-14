import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CourseType, EnrollmentStatus } from "@prisma/client";
import { getBatch24Icb1Course } from "@/lib/batch24";
import { isAcadSec } from "@/lib/permissions";
import { resetAcadSecScratchData } from "@/lib/acadSecReset";

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

    const enrollmentId = (user.enrollmentId || "").toUpperCase();
    const isBatch24 = user.batch === 2024 || /^B24\d+$/i.test(enrollmentId);
    const batch24Icb1Course =
      isBatch24 && enrollmentId ? await getBatch24Icb1Course(enrollmentId) : null;

    return NextResponse.json({ ...user, batch24Icb1Course }, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=30" },
    });
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

    // GE students may switch freely between GE-family specialisations (Open ↔ named tracks);
    // every other branch stays locked once set.
    const isGeFamily = (b?: string | null) =>
      b === "GE" || (typeof b === "string" && b.startsWith("GE-"));

    // Acad-sec accounts are previewers — they may switch branch freely to inspect any
    // program's pre-reg view; their scratch data is wiped on change (below).
    const acadSec = isAcadSec(session.user.email);

    // Prevent branch changes if branch is already set (except GE-family ↔ GE-family, or acad-sec).
    if (
      branch &&
      currentUser.branch &&
      currentUser.branch !== branch &&
      !acadSec &&
      !(isGeFamily(currentUser.branch) && isGeFamily(branch))
    ) {
      return NextResponse.json(
        { error: "Cannot change branch after it has been set" },
        { status: 403 }
      );
    }

    const branchChanged = !!branch && currentUser.branch !== branch;

    // Validate branch if provided
    if (branch) {
      const validBranches = [
        "CSE", "DSE", "DSAI", "EE", "ME", "CE", "BE",
        "EP", "MNC", "MSE", "GE", "MEVLSI", "BSCS",
        "GE-ROBO", "GE-MECH", "GE-COMM", "GE-FIN",
      ];
      if (!validBranches.includes(branch)) {
        return NextResponse.json(
          { error: "Invalid branch code" },
          { status: 400 }
        );
      }
    }

    const updatingMTPPrefs = doingMTP !== undefined || doingMTP2 !== undefined;
    const updatingISTPPref = doingISTP !== undefined;

    let nextDoingMTP = currentUser.doingMTP;
    let nextDoingMTP2 = currentUser.doingMTP2 ?? true;
    let nextDoingISTP = currentUser.doingISTP;

    if (doingMTP !== undefined) nextDoingMTP = Boolean(doingMTP);
    if (doingMTP2 !== undefined) nextDoingMTP2 = Boolean(doingMTP2);
    if (doingISTP !== undefined) nextDoingISTP = Boolean(doingISTP);

    const currentDoingMTP2 = currentUser.doingMTP2 ?? true;

    const skippingMTP1 = updatingMTPPrefs && currentUser.doingMTP && !nextDoingMTP;
    const skippingMTP2 = updatingMTPPrefs && currentDoingMTP2 && !nextDoingMTP2;
    const skippingISTP = updatingISTPPref && currentUser.doingISTP && !nextDoingISTP;

    const user = await prisma.$transaction(async (tx) => {
      // Auto-deregister enrolled courses for skipped components (only IN_PROGRESS)
      if (skippingMTP1) {
        await tx.courseEnrollment.deleteMany({
          where: {
            userId: session.user.id,
            status: EnrollmentStatus.IN_PROGRESS,
            course: { code: { endsWith: "498P" } },
          },
        });
      }

      if (skippingMTP2) {
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

    // Acad-sec previewers: switching branch means the old plan/enrollments are stale —
    // wipe scratch data so the new branch's pre-reg view starts clean.
    if (acadSec && branchChanged) {
      await resetAcadSecScratchData(session.user.id);
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("User update error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}
