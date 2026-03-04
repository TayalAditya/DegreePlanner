import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { creditCalculator } from "@/lib/creditCalculator";
import { syncEnrollmentStatusesForUser } from "@/lib/enrollmentStatusSync";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await syncEnrollmentStatusesForUser(session.user.id, {
      batch: session.user.batch,
      enrollmentId: session.user.enrollmentId,
    });

    const { searchParams } = new URL(request.url);
    const programId = searchParams.get("programId");
    const minorCodesRaw = searchParams.get("minorCodes");
    const minorCountedCodesRaw = searchParams.get("minorCountedCodes");

    const minorCodes =
      minorCodesRaw?.trim()
        ? minorCodesRaw
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean)
        : undefined;

    const minorCountedCourseCodes =
      minorCountedCodesRaw !== null
        ? (minorCountedCodesRaw.trim()
            ? minorCountedCodesRaw
                .split(",")
                .map((c) => c.trim())
                .filter(Boolean)
            : [])
        : undefined;

    if (!programId) {
      return NextResponse.json(
        { error: "programId is required" },
        { status: 400 }
      );
    }

    const progress = await creditCalculator.calculateProgramProgress(session.user.id, programId, {
      minorCodes,
      minorCountedCourseCodes,
    });

    const mtpEligibility = await creditCalculator.checkMTPEligibility(
      session.user.id,
      programId
    );

    const istpEligibility = await creditCalculator.checkISTPEligibility(
      session.user.id,
      programId
    );

    const availableDECourses = await creditCalculator.getAvailableDECourses(
      session.user.id,
      programId
    );

    return NextResponse.json({
      progress,
      mtpEligibility,
      istpEligibility,
      availableDECourses,
    });
  } catch (error) {
    console.error("Error calculating progress:", error);
    return NextResponse.json(
      { error: "Failed to calculate progress" },
      { status: 500 }
    );
  }
}
