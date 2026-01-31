import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const programs = await prisma.userProgram.findMany({
      where: {
        userId: session.user.id,
        status: "ACTIVE",
      },
      include: {
        program: true,
      },
    });

    return NextResponse.json(programs);
  } catch (error) {
    console.error("Error fetching programs:", error);
    return NextResponse.json(
      { error: "Failed to fetch programs" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { programId, programType, isPrimary, startSemester } = body;

    const userProgram = await prisma.userProgram.create({
      data: {
        userId: session.user.id,
        programId,
        programType,
        isPrimary: isPrimary || false,
        startSemester: startSemester || 1,
      },
      include: {
        program: true,
      },
    });

    return NextResponse.json(userProgram, { status: 201 });
  } catch (error) {
    console.error("Error creating user program:", error);
    return NextResponse.json(
      { error: "Failed to create user program" },
      { status: 500 }
    );
  }
}
