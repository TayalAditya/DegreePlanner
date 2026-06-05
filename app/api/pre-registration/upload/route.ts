import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CourseCategoryType } from "@prisma/client";

// Column indices (0-based) — fixed format
const COL = {
  CODE: 0,
  INSTRUCTOR: 1,
  SCHOOL: 2,
  BRANCHES: 3,
  ELIGIBLE_SEMS: 4,
  SLOTS: 5,
  LTPC: 6,
  CREDITS: 7,
  CURRICULUM_LINK: 8,
  CATEGORY_OVERRIDE: 9,  // optional, for standalone courses
} as const;

const VALID_CATEGORIES = new Set<string>([
  "IC","IC_BASKET","DC","DE","FE","HSS","IKS","MTP","ISTP","INTERNSHIP","BACKLOG","NA",
]);

function parseRow(row: any[]): {
  courseCode: string; instructor: string | null; school: string | null;
  branches: string[]; eligibleSems: number[]; slots: string | null;
  ltpc: string | null; credits: number; curriculumLink: string | null;
  categoryOverride: CourseCategoryType | null;
} | null {
  const courseCode = String(row[COL.CODE] ?? "").trim().toUpperCase();
  if (!courseCode) return null;

  const instructor = String(row[COL.INSTRUCTOR] ?? "").trim() || null;
  const school = String(row[COL.SCHOOL] ?? "").trim() || null;

  const branchRaw = String(row[COL.BRANCHES] ?? "").trim().toUpperCase();
  const branches = branchRaw === "ALL" ? ["ALL"] : branchRaw.split(",").map((b) => b.trim()).filter(Boolean);

  const semRaw = String(row[COL.ELIGIBLE_SEMS] ?? "").trim();
  const eligibleSems = semRaw
    .split("/")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);

  const slots = String(row[COL.SLOTS] ?? "").trim() || null;
  const ltpc = String(row[COL.LTPC] ?? "").trim() || null;

  // Credits: try from col 7, else parse last number from LTPC
  let credits = parseFloat(String(row[COL.CREDITS] ?? ""));
  if (isNaN(credits) && ltpc) {
    const parts = ltpc.split("-");
    const last = parseFloat(parts[parts.length - 1]);
    if (!isNaN(last)) credits = last;
  }
  if (isNaN(credits) || credits <= 0) credits = 3; // safe default

  const curriculumLink = String(row[COL.CURRICULUM_LINK] ?? "").trim() || null;

  const catRaw = String(row[COL.CATEGORY_OVERRIDE] ?? "").trim().toUpperCase();
  const categoryOverride = VALID_CATEGORIES.has(catRaw) ? (catRaw as CourseCategoryType) : null;

  return { courseCode, instructor, school, branches, eligibleSems, slots, ltpc, credits, curriculumLink, categoryOverride };
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const semester = parseInt(String(formData.get("semester") ?? ""), 10);
  const year = parseInt(String(formData.get("year") ?? ""), 10);
  const replace = formData.get("replace") === "true";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (isNaN(semester) || isNaN(year)) return NextResponse.json({ error: "Invalid semester/year" }, { status: 400 });

  // Parse Excel/CSV
  const XLSX = await import("xlsx");
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as any[][];

  // Skip header row
  const dataRows = rows.slice(1).filter((r) => String(r[COL.CODE] ?? "").trim());

  // Parse rows + match to catalog
  const parsed = dataRows.map((r) => parseRow(r)).filter(Boolean) as ReturnType<typeof parseRow>[];

  if (parsed.length === 0) return NextResponse.json({ error: "No valid rows found" }, { status: 400 });

  // Bulk lookup course codes
  const codes = [...new Set(parsed.map((p) => p!.courseCode))];
  const existingCourses = await prisma.course.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true, name: true, credits: true },
  });
  const courseByCode = new Map(existingCourses.map((c) => [c.code.toUpperCase(), c]));

  // Build offering upsert data
  const offeringsData = parsed.map((p) => {
    const catalog = courseByCode.get(p!.courseCode);
    return {
      courseCode: p!.courseCode,
      courseName: catalog?.name ?? p!.courseCode,
      instructor: p!.instructor,
      school: p!.school,
      branches: p!.branches,
      eligibleSems: p!.eligibleSems,
      slots: p!.slots,
      ltpc: p!.ltpc,
      credits: catalog?.credits ?? p!.credits,
      categoryOverride: p!.categoryOverride,
      curriculumLink: p!.curriculumLink,
      offeringSemester: semester,
      offeringYear: year,
      courseId: catalog?.id ?? null,
      isActive: true,
    };
  });

  // Replace existing offerings if requested
  if (replace) {
    await prisma.courseOffering.deleteMany({ where: { offeringSemester: semester, offeringYear: year } });
  }

  // Upsert all offerings
  let inserted = 0, updated = 0;
  for (const data of offeringsData) {
    const result = await prisma.courseOffering.upsert({
      where: { courseCode_offeringSemester_offeringYear: { courseCode: data.courseCode, offeringSemester: semester, offeringYear: year } },
      update: { ...data },
      create: { ...data },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) inserted++;
    else updated++;
  }

  const matched = offeringsData.filter((o) => o.courseId !== null).length;
  const unmatched = offeringsData.filter((o) => o.courseId === null).length;

  return NextResponse.json({ success: true, total: offeringsData.length, matched, unmatched, inserted, updated });
}

// GET — fetch existing offerings for admin preview
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const semester = parseInt(searchParams.get("semester") ?? "", 10);
  const year = parseInt(searchParams.get("year") ?? "", 10);

  if (isNaN(semester) || isNaN(year)) return NextResponse.json({ offerings: [] });

  const offerings = await prisma.courseOffering.findMany({
    where: { offeringSemester: semester, offeringYear: year },
    orderBy: { courseCode: "asc" },
  });

  return NextResponse.json({ offerings });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const semester = parseInt(searchParams.get("semester") ?? "", 10);
  const year = parseInt(searchParams.get("year") ?? "", 10);

  if (isNaN(semester) || isNaN(year)) return NextResponse.json({ error: "Invalid params" }, { status: 400 });

  const { count } = await prisma.courseOffering.deleteMany({ where: { offeringSemester: semester, offeringYear: year } });
  return NextResponse.json({ success: true, deleted: count });
}
