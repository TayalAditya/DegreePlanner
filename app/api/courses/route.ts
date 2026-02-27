import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const DOT_LEADER_RE = /\s*(?:\.(?:\s|\u00a0)*){4,}\d+\s*$/;

function sanitizeCourseDescription(description: string | null): string | null {
  if (!description) return null;
  const trimmed = description.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;

  // Remove extracted metadata / instructor dumps (these are noisy + inconsistent).
  if (/^instructors?:/i.test(trimmed)) return null;
  if (/^extracted from excel/i.test(trimmed)) return null;
  if (/^credits:\s*/i.test(trimmed)) return null;

  const cleaned = trimmed.replace(DOT_LEADER_RE, "").trim();
  return cleaned || null;
}

function sanitizeCourseName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  return trimmed.replace(DOT_LEADER_RE, "").trim();
}

// GET /api/courses - Get all courses
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const department = searchParams.get("department");

    const courses = await prisma.course.findMany({
      where: {
        isActive: true,
        ...(search && {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }),
        ...(department && { department }),
      },
      select: {
        id: true,
        code: true,
        name: true,
        credits: true,
        department: true,
        level: true,
        description: true,
        offeredInFall: true,
        offeredInSpring: true,
        offeredInSummer: true,
        isPassFailEligible: true,
      },
      orderBy: {
        code: 'asc',
      },
    });

    // Filter out obviously invalid codes and de-duplicate variants like "IC112" vs "IC-112"
    const normalize = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const normalizedPattern = /^[A-Z]{2}\d{3}[A-Z]?(?:\d)?$/;

    const scoreCode = (code: string) => {
      const c = code.trim();
      const upper = c.toUpperCase();
      const hasUnderscore = c.includes("_");
      const hasSpace = /\s/.test(c);
      const hyphenated = /^[A-Z]{2}-\d{3}/.test(upper);
      if (hasUnderscore || hasSpace) return 0;
      if (hyphenated) return 2;
      return 1;
    };

    const bestByKey = new Map<string, (typeof courses)[number]>();
    for (const course of courses) {
      const key = normalize(course.code);
      if (!normalizedPattern.test(key)) continue;
      const existing = bestByKey.get(key);
      if (!existing || scoreCode(course.code) > scoreCode(existing.code)) {
        bestByKey.set(key, course);
      }
    }

    const filteredCourses = Array.from(bestByKey.values()).sort((a, b) =>
      a.code.localeCompare(b.code)
    );

    const sanitized = filteredCourses.map((c) => ({
      ...c,
      name: sanitizeCourseName(c.name),
      description: sanitizeCourseDescription(c.description),
    }));

    return NextResponse.json(sanitized);
  } catch (error) {
    console.error("Error fetching courses:", error);
    return NextResponse.json(
      { error: "Failed to fetch courses" },
      { status: 500 }
    );
  }
}
