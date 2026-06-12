import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { inferAcademicState, inferBatchYear } from "@/lib/academicCalendar";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const batchYear = inferBatchYear(session.user.batch, session.user.enrollmentId);
  if (!batchYear) {
    return NextResponse.json({ error: "Unknown batch" }, { status: 400 });
  }

  const state = inferAcademicState(batchYear);

  return NextResponse.json(
    {
      phase: state.phase,
      currentSemester: state.currentSemester,
      upcomingSemester: state.upcomingSemester ?? null,
      isInSession: state.isInSession,
    },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=30" } }
  );
}
