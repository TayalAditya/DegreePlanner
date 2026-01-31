import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

// Validation schema for venue creation
const venueSchema = z.object({
  name: z.string().min(1, "Venue name is required").max(100),
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
  ]).default("CLASSROOM"),
  facilities: z.array(z.string()).default([]),
  isPublic: z.boolean().default(true),
});

// GET /api/venues - List all venues
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const building = searchParams.get("building");
    const isActive = searchParams.get("isActive");
    const includeCustom = searchParams.get("includeCustom") === "true";

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const where: any = {};
    
    if (type) where.type = type;
    if (building) where.building = building;
    if (isActive !== null) where.isActive = isActive === "true";
    
    // Filter: public venues OR user's custom venues
    if (includeCustom) {
      where.OR = [
        { isPublic: true },
        { createdBy: user.id },
      ];
    } else {
      where.isPublic = true;
    }

    const venues = await prisma.venue.findMany({
      where,
      orderBy: [
        { building: "asc" },
        { name: "asc" },
      ],
    });

    return NextResponse.json(venues);
  } catch (error) {
    console.error("Error fetching venues:", error);
    return NextResponse.json(
      { error: "Failed to fetch venues" },
      { status: 500 }
    );
  }
}

// POST /api/venues - Create new venue
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const validatedData = venueSchema.parse(body);

    // Check if code already exists (if provided)
    if (validatedData.code) {
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

    // Create venue
    const venue = await prisma.venue.create({
      data: {
        ...validatedData,
        isCustom: true,
        createdBy: user.id,
      },
    });

    return NextResponse.json(venue, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating venue:", error);
    return NextResponse.json(
      { error: "Failed to create venue" },
      { status: 500 }
    );
  }
}
