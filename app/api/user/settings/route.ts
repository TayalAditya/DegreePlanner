import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

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
        role: true,
        doingMTP: true,
        doingISTP: true,
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
    const { name, enrollmentId, branch, doingMTP, doingISTP } = body;

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

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name && { name }),
        ...(enrollmentId !== undefined && { enrollmentId }),
        ...(branch && { branch }),
        ...(doingMTP !== undefined && { doingMTP }),
        ...(doingISTP !== undefined && { doingISTP }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        enrollmentId: true,
        branch: true,
        role: true,
        doingMTP: true,
        doingISTP: true,
      },
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
