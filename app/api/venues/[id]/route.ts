import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const venueUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().optional(),
  building: z.string().optional(),
  floor: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  type: z.enum([
    "CLASSROOM",
    "LAB",
    "LECTURE_HALL",
    "TUTORIAL_ROOM",
    "SEMINAR_ROOM",
    "LIBRARY",
    "AUDITORIUM",
    "ONLINE",
    "OTHER",
  ]).optional(),
  facilities: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/venues/[id] - Get single venue
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const venue = await prisma.venue.findUnique({
      where: { id: params.id },
    });

    if (!venue) {
      return NextResponse.json(
        { error: "Venue not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(venue);
  } catch (error) {
    console.error("Error fetching venue:", error);
    return NextResponse.json(
      { error: "Failed to fetch venue" },
      { status: 500 }
    );
  }
}

// PATCH /api/venues/[id] - Update venue
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const venue = await prisma.venue.findUnique({
      where: { id: params.id },
    });

    if (!venue) {
      return NextResponse.json(
        { error: "Venue not found" },
        { status: 404 }
      );
    }

    // Check permissions: Admin or venue creator
    if (user.role !== "ADMIN" && venue.createdBy !== user.id) {
      return NextResponse.json(
        { error: "Forbidden - You can only edit your own custom venues" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = venueUpdateSchema.parse(body);

    // Check code uniqueness if changing
    if (validatedData.code && validatedData.code !== venue.code) {
      const existing = await prisma.venue.findUnique({
        where: { code: validatedData.code },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Venue code already exists" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.venue.update({
      where: { id: params.id },
      data: validatedData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating venue:", error);
    return NextResponse.json(
      { error: "Failed to update venue" },
      { status: 500 }
    );
  }
}

// DELETE /api/venues/[id] - Delete venue
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const venue = await prisma.venue.findUnique({
      where: { id: params.id },
    });

    if (!venue) {
      return NextResponse.json(
        { error: "Venue not found" },
        { status: 404 }
      );
    }

    // Check permissions: Admin or venue creator
    if (user.role !== "ADMIN" && venue.createdBy !== user.id) {
      return NextResponse.json(
        { error: "Forbidden - You can only delete your own custom venues" },
        { status: 403 }
      );
    }

    // Prevent deletion of non-custom venues by non-admins
    if (!venue.isCustom && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Cannot delete system venues" },
        { status: 403 }
      );
    }

    await prisma.venue.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting venue:", error);
    return NextResponse.json(
      { error: "Failed to delete venue" },
      { status: 500 }
    );
  }
}
