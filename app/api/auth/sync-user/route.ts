import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
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
        const program = await prisma.program.findUnique({
          where: { code: session.user.branch },
        });

        if (program) {
          const alreadyEnrolled = await prisma.userProgram.findFirst({
            where: { userId: dbUser.id, programId: program.id },
          });

          if (!alreadyEnrolled) {
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
