import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getProgramLookupBranchCode } from "@/lib/branchInfo";
import { isAcadSec } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAcadSec(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { batch, branch } = await request.json();

  if (!batch || !branch) {
    return NextResponse.json({ error: "batch and branch required" }, { status: 400 });
  }

  const userId = session.user.id;

  // 1. Wipe all previous session data
  await prisma.courseEnrollment.deleteMany({ where: { userId } });
  await prisma.userProgram.deleteMany({ where: { userId } });

  // 2. Set branch/batch on User — fake enrollmentId so batch inference works
  const batchSuffix = String(batch).slice(-2); // e.g. 2024 → "24"
  const fakeEnrollmentId = `B${batchSuffix}ACADSEC`;

  await prisma.user.update({
    where: { id: userId },
    data: {
      branch,
      batch,
      enrollmentId: fakeEnrollmentId,
    },
  });

  // 3. Also update ApprovedUser so branch/batch are reflected in session refresh
  await prisma.approvedUser.update({
    where: { email: session.user.email! },
    data: { branch, batch },
  }).catch(() => {}); // non-fatal if not found

  // 4. Find the correct Program for this branch
  //    BSCS is the only BS branch; all others are BTech.
  //    GE sub-branches (GE-ROBO/GE-MECH/GE-COMM/GE-FIN) all use the single "GE" program;
  //    sub-branch is captured in User.branch for curriculum lookup.
  //    DSAI shares the DSE program record (getProgramLookupBranchCode maps it).
  const programCode = branch.startsWith("GE-") ? "GE" : getProgramLookupBranchCode(branch, batch);
  const program = await prisma.program.findFirst({
    where: { code: programCode },
  });

  if (!program) {
    return NextResponse.json(
      { error: `No program found for branch ${branch}` },
      { status: 404 }
    );
  }

  // 5. Create UserProgram (MAJOR, isPrimary)
  await prisma.userProgram.create({
    data: {
      userId,
      programId: program.id,
      programType: "MAJOR",
      isPrimary: true,
      startSemester: 1,
    },
  });

  return NextResponse.json({ ok: true, branch, batch, program: program.name });
}
