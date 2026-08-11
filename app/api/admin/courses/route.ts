import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizeBranchCode } from "@/lib/branchInfo";

const CATEGORIES = ["IC", "IC_BASKET", "DC", "DE", "FE", "HSS", "IKS", "MTP", "ISTP", "NA"] as const;
const categorySchema = z.enum(CATEGORIES);

const nullableText = (max: number) =>
  z.string().trim().max(max).nullable().optional().transform((value) => value || null);

const courseFieldsSchema = z.object({
  code: z.string().trim().min(2).max(64),
  name: z.string().trim().min(2).max(300),
  credits: z.coerce.number().positive().max(100),
  department: z.string().trim().min(2).max(160),
  catalogSection: nullableText(120),
  level: z.coerce.number().int().min(0).max(20),
  description: nullableText(4000),
  ltpc: nullableText(40),
  offeredInFall: z.coerce.boolean().default(false),
  offeredInSpring: z.coerce.boolean().default(false),
  offeredInSummer: z.coerce.boolean().default(false),
  isPassFailEligible: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
});

const mappingSchema = z.object({
  branch: z.string().trim().min(1).max(40),
  batch: z.string().trim().regex(/^(|20\d{2})$/, "Choose a valid batch year").default(""),
  courseCategory: categorySchema,
  isRequired: z.coerce.boolean().default(false),
  semester: z.coerce.number().int().min(1).max(12).nullable().optional().transform((value) => value ?? null),
});

const offeringSchema = z.object({
  id: z.string().cuid().optional(),
  courseId: z.string().cuid(),
  offeringSemester: z.coerce.number().int().min(1).max(12),
  offeringYear: z.coerce.number().int().min(2020).max(2100),
  branches: z.array(z.string().trim().min(1).max(40)).min(1).max(40),
  eligibleSems: z.array(z.coerce.number().int().min(1).max(12)).min(1).max(12),
  slots: z.string().trim().min(1, "Add a slot (TBD or NS are valid when timings are not fixed)").max(400),
  instructor: nullableText(160),
  instructorEmail: nullableText(254),
  school: nullableText(160),
  categoryOverride: categorySchema.nullable().optional().transform((value) => value ?? null),
  curriculumLink: nullableText(1000),
  compulsorySem: z.coerce.number().int().min(1).max(12).nullable().optional().transform((value) => value ?? null),
  isActive: z.coerce.boolean().default(true),
});

const courseInclude = {
  branchMappings: {
    orderBy: [{ branch: "asc" }, { batch: "asc" }],
  },
  offerings: {
    orderBy: [{ offeringYear: "desc" }, { offeringSemester: "desc" }],
  },
} satisfies Prisma.CourseInclude;

function normalizeCode(code: string) {
  return code.toUpperCase().replace(/\s+/g, "");
}

function normalizeOfferingBranches(branches: string[]) {
  const normalized = branches
    .map((branch) => branch.toUpperCase() === "ALL" ? "ALL" : normalizeBranchCode(branch))
    .filter(Boolean);
  return Array.from(new Set(normalized.length ? normalized : ["ALL"]));
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user?.role === "ADMIN";
}

function validationError(error: z.ZodError) {
  return NextResponse.json(
    { error: error.issues[0]?.message ?? "Invalid course setup data" },
    { status: 400 }
  );
}

// GET /api/admin/courses - compact course list or full configuration for one course.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const courseId = new URL(req.url).searchParams.get("courseId");
    if (courseId) {
      const course = await prisma.course.findUnique({ where: { id: courseId }, include: courseInclude });
      if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
      return NextResponse.json({ course }, { headers: { "Cache-Control": "no-store" } });
    }

    const courses = await prisma.course.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        credits: true,
        department: true,
        catalogSection: true,
        isActive: true,
        _count: { select: { branchMappings: true, offerings: true } },
      },
      orderBy: { code: "asc" },
    });
    return NextResponse.json({ courses }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error loading admin course setup:", error);
    return NextResponse.json({ error: "Failed to load course setup" }, { status: 500 });
  }
}

// POST /api/admin/courses - create a catalogue course and its initial basket rule.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = z.object({ course: courseFieldsSchema, mapping: mappingSchema.optional() }).safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error);

    const courseData = parsed.data.course;
    const code = normalizeCode(courseData.code);
    const mapping = parsed.data.mapping;
    const branch = mapping ? normalizeBranchCode(mapping.branch) : "";

    const course = await prisma.$transaction(async (tx) => {
      const created = await tx.course.create({
        data: {
          ...courseData,
          code,
          requiredBranches: [],
          isBranchSpecific: Boolean(branch && branch !== "COMMON"),
        },
      });

      // A common FE rule gives every other branch a predictable default. A
      // branch/batch rule below has higher priority and overrides it.
      await tx.courseBranchMapping.create({
        data: { courseId: created.id, branch: "COMMON", batch: "", courseCategory: "FE" },
      });

      if (mapping && branch) {
        await tx.courseBranchMapping.upsert({
          where: { courseId_branch_batch: { courseId: created.id, branch, batch: mapping.batch } },
          update: {
            courseCategory: mapping.courseCategory,
            isRequired: mapping.isRequired,
            semester: mapping.semester,
          },
          create: {
            courseId: created.id,
            branch,
            batch: mapping.batch,
            courseCategory: mapping.courseCategory,
            isRequired: mapping.isRequired,
            semester: mapping.semester,
          },
        });
      }

      return tx.course.findUniqueOrThrow({ where: { id: created.id }, include: courseInclude });
    });

    return NextResponse.json({ course }, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating course setup:", error);
    const message = (error as { code?: string }).code === "P2002" ? "This course code already exists" : "Failed to create course";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// PATCH /api/admin/courses - edit a course, upsert a basket rule or upsert a registration offering.
export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    if (body?.action === "course") {
      const parsed = z.object({ action: z.literal("course"), courseId: z.string().cuid(), course: courseFieldsSchema }).safeParse(body);
      if (!parsed.success) return validationError(parsed.error);

      const data = parsed.data.course;
      const course = await prisma.$transaction(async (tx) => {
        const updated = await tx.course.update({
          where: { id: parsed.data.courseId },
          data: { ...data, code: normalizeCode(data.code) },
        });

        // Offerings intentionally store a snapshot for fast registration
        // queries. Keep that snapshot in sync with editable core details.
        await tx.courseOffering.updateMany({
          where: { courseId: updated.id },
          data: { courseCode: updated.code, courseName: updated.name, credits: updated.credits, ltpc: updated.ltpc },
        });
        return tx.course.findUniqueOrThrow({ where: { id: updated.id }, include: courseInclude });
      });
      return NextResponse.json({ course });
    }

    if (body?.action === "mapping") {
      const parsed = z.object({ action: z.literal("mapping"), courseId: z.string().cuid(), mapping: mappingSchema }).safeParse(body);
      if (!parsed.success) return validationError(parsed.error);
      const mappingData = parsed.data.mapping;
      const branch = normalizeBranchCode(mappingData.branch);
      const mapping = await prisma.courseBranchMapping.upsert({
        where: { courseId_branch_batch: { courseId: parsed.data.courseId, branch, batch: mappingData.batch } },
        update: {
          courseCategory: mappingData.courseCategory,
          isRequired: mappingData.isRequired,
          semester: mappingData.semester,
        },
        create: {
          courseId: parsed.data.courseId,
          branch,
          batch: mappingData.batch,
          courseCategory: mappingData.courseCategory,
          isRequired: mappingData.isRequired,
          semester: mappingData.semester,
        },
      });
      return NextResponse.json({ mapping });
    }

    if (body?.action === "offering") {
      const parsed = z.object({ action: z.literal("offering"), offering: offeringSchema }).safeParse(body);
      if (!parsed.success) return validationError(parsed.error);
      const input = parsed.data.offering;
      const course = await prisma.course.findUnique({ where: { id: input.courseId } });
      if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

      const data = {
        courseId: course.id,
        courseCode: course.code,
        courseName: course.name,
        credits: course.credits,
        ltpc: course.ltpc,
        school: input.school ?? course.department,
        branches: normalizeOfferingBranches(input.branches),
        eligibleSems: Array.from(new Set(input.eligibleSems)).sort((a, b) => a - b),
        slots: input.slots,
        instructor: input.instructor,
        instructorEmail: input.instructorEmail,
        categoryOverride: input.categoryOverride,
        curriculumLink: input.curriculumLink,
        compulsorySem: input.compulsorySem,
        isActive: input.isActive,
        offeringSemester: input.offeringSemester,
        offeringYear: input.offeringYear,
      };

      const offering = input.id
        ? await prisma.courseOffering.update({ where: { id: input.id, courseId: course.id }, data })
        : await prisma.courseOffering.upsert({
            where: {
              courseCode_offeringSemester_offeringYear: {
                courseCode: course.code,
                offeringSemester: input.offeringSemester,
                offeringYear: input.offeringYear,
              },
            },
            update: data,
            create: data,
          });
      return NextResponse.json({ offering });
    }

    return NextResponse.json({ error: "Unknown course setup action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Error saving course setup:", error);
    const message = (error as { code?: string }).code === "P2002"
      ? "That course code already has an offering in this term"
      : "Failed to save course setup";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
