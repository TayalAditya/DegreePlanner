import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getProgramLookupBranchCode } from "@/lib/branchInfo";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const email = session.user.email;
    
    // Sync user data from JWT token to database
    await prisma.user.update({
      where: { email },
      data: {
        isApproved: session.user.isApproved || false,
        role: session.user.role || "STUDENT",
        enrollmentId: session.user.enrollmentId,
        department: session.user.department,
        branch: session.user.branch,
        batch: session.user.batch,
      },
    });

    // Auto-enroll in program if not already enrolled
    if (session.user.branch) {
      const dbUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (dbUser) {
        // Resolve the correct program for this student's branch+batch.
        // Batch-specific lookup first (e.g. BSCS_B24), then fall back to base branch code.
        const correctCode = getProgramLookupBranchCode(session.user.branch, session.user.batch);
        let program = await prisma.program.findUnique({ where: { code: correctCode } });
        if (!program) {
          program = await prisma.program.findUnique({ where: { code: session.user.branch || "" } });
        }

        if (program) {
          const existingPrimary = await prisma.userProgram.findFirst({
            where: { userId: dbUser.id, isPrimary: true, programType: "MAJOR" },
            include: { program: { select: { code: true } } },
          });

          if (!existingPrimary) {
            // No primary program yet — create one.
            await prisma.userProgram.create({
              data: {
                userId: dbUser.id,
                programId: program.id,
                programType: "MAJOR",
                isPrimary: true,
                startSemester: 1,
                status: "ACTIVE",
              },
            });
          } else if (existingPrimary.programId !== program.id) {
            // Wrong program (e.g. B24 student on B23 program) — migrate to correct one.
            await prisma.userProgram.update({
              where: { id: existingPrimary.id },
              data: { programId: program.id },
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
