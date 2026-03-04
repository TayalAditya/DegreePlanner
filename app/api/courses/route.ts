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

const COURSE_OVERRIDES: Record<
  string,
  {
    name?: string;
    offeredInFall?: boolean;
    offeredInSpring?: boolean;
    offeredInSummer?: boolean;
  }
> = {
  // IK-593 is offered in both Fall and Spring (allow odd sem selection).
  // Also override the displayed name in the catalog UI.
  IK593: { name: "Kulhad Economy", offeredInFall: true, offeredInSpring: true },
};

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

    // Helpers for matching and de-duplication.
    const normalize = (code: string) =>
      code.toUpperCase().replace(/[^A-Z0-9]/g, "");

    const toHyphenatedCode = (code: string) => {
      const normalized = normalize(code);
      const match = normalized.match(/^([A-Z]+)(\d{3}[A-Z]?)$/);
      if (match) return `${match[1]}-${match[2]}`;
      return normalized;
    };

    const buildCodeCandidates = (code: string) => {
      const normalized = normalize(code);
      const hyphenated = toHyphenatedCode(code);
      const original = code.trim();
      return Array.from(new Set([normalized, hyphenated, original])).filter(Boolean);
    };

    const courseIdentityKey = (code: string): string => {
      const text = String(code ?? "")
        .replace(/\u00a0/g, " ")
        .trim()
        .toUpperCase();

      // Standard course codes: "IC-102P", "IC 102P", "IC102P"
      // Also allow simple section suffix: "BE-203_1" -> "BE203"
      const standard = text.match(
        /^([A-Z]{2,4})\s*[- ]?\s*(\d{3})\s*([A-Z])?(?:\s*_\s*(\d{1,2}))?$/
      );
      if (standard) {
        const [, prefix, digits, maybeSuffix] = standard;
        return `${prefix}${digits}${maybeSuffix ?? ""}`;
      }

      // Fallback: treat as unique (don't collapse special topics like AR-593_2025_01).
      return text.replace(/[^A-Z0-9]/g, "");
    };

    const keyPattern = /^[A-Z]{2,4}\d{3}[A-Z0-9]*$/;

    const searchTrimmed = search?.trim() || "";
    const codeCandidates = searchTrimmed ? buildCodeCandidates(searchTrimmed) : [];

    const courses = await prisma.course.findMany({
      where: {
        isActive: true,
        ...(searchTrimmed && {
          OR: [
            { code: { contains: searchTrimmed, mode: "insensitive" } },
            { name: { contains: searchTrimmed, mode: "insensitive" } },
            ...codeCandidates.map((candidate) => ({
              code: { equals: candidate, mode: "insensitive" as "insensitive" },
            })),
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
      const key = courseIdentityKey(course.code);
      if (!keyPattern.test(key)) continue;
      const existing = bestByKey.get(key);
      if (!existing || scoreCode(course.code) > scoreCode(existing.code)) {
        bestByKey.set(key, course);
      }
    }

    const filteredCourses = Array.from(bestByKey.values()).sort((a, b) =>
      a.code.localeCompare(b.code)
    );

    const sanitized = filteredCourses.map((c) => {
      const key = courseIdentityKey(c.code);
      const override = COURSE_OVERRIDES[key] ?? {};
      const { name: _ignoredName, ...overrideRest } = override;

      return {
        ...c,
        ...overrideRest,
        name: sanitizeCourseName(override.name ?? c.name),
        description: sanitizeCourseDescription(c.description),
      };
    });

    return NextResponse.json(sanitized);
  } catch (error) {
    console.error("Error fetching courses:", error);
    return NextResponse.json(
      { error: "Failed to fetch courses" },
      { status: 500 }
    );
  }
}
