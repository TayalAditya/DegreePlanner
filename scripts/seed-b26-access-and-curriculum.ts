/**
 * Seeds the B26-only access list and the published curriculum rows that have
 * an actual course code. The UG26 PDF is a preference form, not a transcript:
 * it is used only to prefill first-semester choices in Import Courses.
 *
 * Run a read-only preview first:
 *   npx tsx scripts/seed-b26-access-and-curriculum.ts
 * Apply after reviewing the preview:
 *   npx tsx scripts/seed-b26-access-and-curriculum.ts --apply
 */
import { CourseCategoryType, ProgramStatus, ProgramType } from "@prisma/client";
import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse";
import prisma from "@/lib/prisma";
import { getBatch26Entries } from "@/lib/batch26";
import { getDefaultCurriculum, type DefaultCourse } from "@/lib/defaultCurriculum";
import { getDepartmentForBranch, getProgramLookupBranchCode } from "@/lib/branchInfo";

const APPLY = process.argv.includes("--apply");
const PREFERENCES_ONLY = process.argv.includes("--preferences-only");
const BATCH = "2026";

const B26_BRANCHES = [
  "AG", "BE", "CHE", "BSCS", "CE", "CSE", "DSAI", "EE", "EP", "GE", "MSE", "MNC", "ME", "MEVLSI", "QS",
] as const;

type ProgramSpec = {
  code: string;
  name: string;
  branch: string;
  totalCreditsRequired: number;
  icCredits: number;
  dcCredits: number;
  deCredits: number;
  feCredits: number;
  mtpIstpCredits: number;
};

// These five degree-credit distributions differ from their historic generic
// records, or represent a programme introduced with B26.
const B26_PROGRAMS: ProgramSpec[] = [
  {
    code: "CSE_B26",
    name: "B.Tech in Computer Science and Engineering (B26)",
    branch: "CSE",
    totalCreditsRequired: 160,
    icCredits: 60,
    dcCredits: 39,
    deCredits: 27,
    feCredits: 22,
    mtpIstpCredits: 12,
  },
  {
    code: "DSAI_B26",
    name: "B.Tech in Data Science and Artificial Intelligence (B26)",
    branch: "DSAI",
    totalCreditsRequired: 160,
    icCredits: 60,
    dcCredits: 33,
    deCredits: 33,
    feCredits: 22,
    mtpIstpCredits: 12,
  },
  {
    code: "AG_B26",
    name: "B.Tech in Agricultural Engineering with Data Analytics (B26)",
    branch: "AG",
    totalCreditsRequired: 160,
    icCredits: 57,
    dcCredits: 49,
    deCredits: 17,
    feCredits: 25,
    mtpIstpCredits: 12,
  },
  {
    code: "CHE_B26",
    name: "B.Tech in Chemical Engineering with Data Analytics (B26)",
    branch: "CHE",
    totalCreditsRequired: 160,
    icCredits: 60,
    dcCredits: 56,
    deCredits: 15,
    feCredits: 21,
    mtpIstpCredits: 8,
  },
  {
    code: "QS_B26",
    name: "B.Tech in Quantum Science and Engineering (B26)",
    branch: "QS",
    totalCreditsRequired: 160,
    icCredits: 60,
    dcCredits: 39,
    deCredits: 27,
    feCredits: 22,
    mtpIstpCredits: 12,
  },
];

const CATEGORY_BY_DEFAULT_CATEGORY: Record<DefaultCourse["category"], CourseCategoryType> = {
  IC: CourseCategoryType.IC,
  ICB: CourseCategoryType.IC_BASKET,
  HSS: CourseCategoryType.HSS,
  IKS: CourseCategoryType.IKS,
  DC: CourseCategoryType.DC,
  DE: CourseCategoryType.DE,
  FE: CourseCategoryType.FE,
  ISTP: CourseCategoryType.ISTP,
  MTP: CourseCategoryType.MTP,
};

const CS541P = {
  code: "CS-541P",
  name: "IoT Systems and Clouds",
  credits: 3,
  department: "School of Computing & Electrical Engineering",
  level: 500,
  description: "Published B26 Agricultural Engineering with Data Analytics curriculum course.",
  ltpc: "1-0-3-3",
};

const DP552P = {
  code: "DP-552P",
  name: "Undergraduate Research Project 2",
  credits: 6,
  department: "Institute Core",
  level: 500,
  description: "Published B26 B.S. Chemical Sciences research-project course.",
  ltpc: "0-0-12-6",
};

const IC201P = {
  code: "IC-201P",
  name: "Design Practicum",
  credits: 3,
  department: "Institute Core",
  level: 200,
  description: "Published B26 Quantum Science and Engineering curriculum course.",
  ltpc: "0-0-6-3",
};

const REQUIRED_PUBLISHED_COURSES = [CS541P, DP552P, IC201P];

function normalizeCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// English's two B26 timetable sections share the single HS-108 catalogue and
// curriculum requirement. Keep section information on ApprovedUser only; a
// CourseBranchMapping must still target the base course row.
function curriculumMappingCode(code: string) {
  return /^HS\s*-?\s*108\s*[_-]\s*[12]$/i.test(code) ? "HS-108" : code;
}

type DesiredMapping = {
  branch: string;
  courseCode: string;
  category: CourseCategoryType;
  semester: number;
};

const TABLE_BRANCHES: Array<[needle: string, branch: string]> = [
  ["Agricultural Engineering with Data Analytics", "AG"],
  ["Bioengineering", "BE"],
  ["Chemical Engineering", "CHE"],
  ["Chemical Sciences", "BSCS"],
  ["Civil Engineering", "CE"],
  ["Computer Science and Engineering", "CSE"],
  ["Data Science and Artificial Intelligence", "DSAI"],
  ["Electrical Engineering", "EE"],
  ["Engineering Physics", "EP"],
  ["Materials Science and Engineering", "MSE"],
  ["Mathematics and Computing", "MNC"],
  ["Mechanical Engineering", "ME"],
  ["Microelectronics and VLSI", "MEVLSI"],
  ["Quantum Science and Engineering", "QS"],
];

const ICB_CODES = new Set(["IC131", "IC136", "IC230", "IC121", "IC240", "IC241", "IC253"]);

function categoryForPublishedCode(code: string): CourseCategoryType {
  const normalized = normalizeCode(code);
  if (ICB_CODES.has(normalized)) return CourseCategoryType.IC_BASKET;
  if (normalized.startsWith("IC")) return CourseCategoryType.IC;
  if (normalized.startsWith("HS")) return CourseCategoryType.HSS;
  if (normalized.startsWith("IK")) return CourseCategoryType.IKS;
  if (normalized === "DP301P") return CourseCategoryType.ISTP;
  if (/(498P|499P|551P|552P)$/.test(normalized)) return CourseCategoryType.MTP;
  return CourseCategoryType.DC;
}

function branchForTable(title: string): string | null {
  // The roster says only "General Engineering", while the PDF has five
  // specialisations. We do not guess one for any B26 GE student.
  if (title.includes("General Engineering")) return null;
  return TABLE_BRANCHES.find(([needle]) => title.includes(needle))?.[1] ?? null;
}

async function buildDesiredMappings(): Promise<DesiredMapping[]> {
  const rows = new Map<string, DesiredMapping>();
  const tableCountByBranch = new Map<string, number>();
  const catalogCodes = await prisma.course.findMany({ select: { code: true } });
  const knownCodes = new Set(catalogCodes.map((course) => normalizeCode(course.code)));
  REQUIRED_PUBLISHED_COURSES.forEach((course) => knownCodes.add(normalizeCode(course.code)));

  const curriculumPdf = path.join(process.cwd(), "docs", "curricula", "DC_Curriculum_Compiled_NoDEList.pdf");
  const source = await pdfParse(await fs.readFile(curriculumPdf));
  const text = String(source.text ?? "");
  const tableHeaders = Array.from(
    text.matchAll(/Table\s+\d+:\s+B\.\s*(?:Tech|S\.)\s+(.+?)\s+(?:\u2014|-)\s+B26 Semester\s+([1-8])/g)
  );
  if (tableHeaders.length === 0) {
    throw new Error("Could not find B26 semester tables in the published curriculum PDF.");
  }

  for (let index = 0; index < tableHeaders.length; index += 1) {
    const header = tableHeaders[index];
    const branch = branchForTable(header[1]);
    if (!branch) continue;
    tableCountByBranch.set(branch, (tableCountByBranch.get(branch) ?? 0) + 1);
    const semester = Number(header[2]);
    const start = (header.index ?? 0) + header[0].length;
    const end = index + 1 < tableHeaders.length ? (tableHeaders[index + 1].index ?? text.length) : text.length;
    const rawTable = text.slice(start, end);
    // Semester 8 is followed by the next programme's credit-distribution and
    // DC-list tables. Stop at the standard semester-table note so no later
    // programme's catalogue codes are attributed to this branch.
    const noteStart = rawTable.indexOf("Aim for 20");
    const table = noteStart >= 0 ? rawTable.slice(0, noteStart) : rawTable;
    // pdf-parse often joins the serial number/category to the code (for
    // example `1ICIC-112Calculus`), so word boundaries are not reliable.
    const publishedCodes = Array.from(table.matchAll(/([A-Z]{2,3}-\d{3}P?)/g)).map((match) => {
      const raw = match[1];
      const nextCharacter = table[(match.index ?? 0) + raw.length] ?? "";
      const hasAttachedNameInitial = raw.endsWith("P") && /[a-z]/.test(nextCharacter);
      if (knownCodes.has(normalizeCode(raw))) return raw;

      // In the compact PDF text, a following course name such as
      // "Probability" can attach its leading P to an otherwise complete code.
      const withoutAttachedNameInitial = hasAttachedNameInitial ? raw.slice(0, -1) : raw;
      if (knownCodes.has(normalizeCode(withoutAttachedNameInitial))) {
        return withoutAttachedNameInitial;
      }

      // A category label can be glued to the code by pdf-parse, for example
      // `DCCE-203` becomes `CCE-203` or `MTPDP-498P` becomes `PDP-498P`.
      // A genuine three-letter catalogue prefix (such as CED) is retained
      // when it already exists in the catalog; otherwise the glued character
      // is removed.
      const [prefix, suffix] = raw.split("-");
      const withoutCategoryPrefix = prefix.length === 3 ? `${prefix.slice(1)}-${suffix}` : raw;
      if (knownCodes.has(normalizeCode(withoutCategoryPrefix))) return withoutCategoryPrefix;
      const withoutAttachedNameAfterPrefix = hasAttachedNameInitial && withoutCategoryPrefix.endsWith("P")
        ? withoutCategoryPrefix.slice(0, -1)
        : withoutCategoryPrefix;
      return knownCodes.has(normalizeCode(withoutAttachedNameAfterPrefix))
        ? withoutAttachedNameAfterPrefix
        : withoutCategoryPrefix;
    });

    for (const courseCode of publishedCodes) {
      const key = `${branch}:${normalizeCode(courseCode)}`;
      const next: DesiredMapping = {
        branch,
        courseCode,
        category: categoryForPublishedCode(courseCode),
        semester,
      };
      const existing = rows.get(key);
      if (!existing || next.semester < existing.semester) rows.set(key, next);
    }
  }

  for (const branch of B26_BRANCHES.filter((branch) => branch !== "GE")) {
    if (tableCountByBranch.get(branch) !== 8) {
      throw new Error(`Expected eight published B26 semester tables for ${branch}, found ${tableCountByBranch.get(branch) ?? 0}.`);
    }
  }

  // The source roster gives plain GE, not one of the five B26 specialisations.
  // Its shared first year is safe; later specialisation-specific rows remain
  // deliberately unassigned until a roster names the track.
  for (const semester of [1, 2]) {
    for (const course of getDefaultCurriculum("GE", semester, 2026)) {
      const courseCode = curriculumMappingCode(course.code);
      const key = `GE:${normalizeCode(courseCode)}`;
      rows.set(key, {
        branch: "GE",
        courseCode,
        category: CATEGORY_BY_DEFAULT_CATEGORY[course.category],
        semester,
      });
    }
  }

  return Array.from(rows.values());
}

async function upsertPrograms() {
  for (const spec of B26_PROGRAMS) {
    const department = getDepartmentForBranch(spec.branch);
    if (!department) throw new Error(`No department configured for ${spec.branch}`);

    await prisma.program.upsert({
      where: { code: spec.code },
      update: {
        name: spec.name,
        type: ProgramType.MAJOR,
        department,
        totalCreditsRequired: spec.totalCreditsRequired,
        icCredits: spec.icCredits,
        dcCredits: spec.dcCredits,
        deCredits: spec.deCredits,
        feCredits: spec.feCredits,
        mtpIstpCredits: spec.mtpIstpCredits,
        minCreditsForMtp: 90,
        minSemesterForMtp: 7,
      },
      create: {
        code: spec.code,
        name: spec.name,
        type: ProgramType.MAJOR,
        department,
        totalCreditsRequired: spec.totalCreditsRequired,
        icCredits: spec.icCredits,
        dcCredits: spec.dcCredits,
        deCredits: spec.deCredits,
        feCredits: spec.feCredits,
        mtpIstpCredits: spec.mtpIstpCredits,
        minCreditsForMtp: 90,
        minSemesterForMtp: 7,
      },
    });
  }
}

async function ensurePublishedCourses() {
  for (const course of REQUIRED_PUBLISHED_COURSES) {
    await prisma.course.upsert({
      where: { code: course.code },
      update: {
        name: course.name,
        credits: course.credits,
        department: course.department,
        level: course.level,
        description: course.description,
        ltpc: course.ltpc,
        isActive: true,
      },
      create: {
        ...course,
        offeredInFall: false,
        offeredInSpring: false,
        offeredInSummer: false,
        isActive: true,
      },
    });
  }
}

async function findMissingCurriculumCodes(desiredMappings: DesiredMapping[]) {
  const courseCodes = await prisma.course.findMany({ select: { code: true } });
  const available = new Set(courseCodes.map((course) => normalizeCode(course.code)));
  // These exact, published catalogue rows are deliberately created by this
  // seed when applying because they are absent from the current catalog.
  REQUIRED_PUBLISHED_COURSES.forEach((course) => available.add(normalizeCode(course.code)));
  return Array.from(
    new Set(
      desiredMappings
        .filter((mapping) => !available.has(normalizeCode(mapping.courseCode)))
        .map((mapping) => mapping.courseCode)
    )
  ).sort();
}

async function upsertMappings(desiredMappings: DesiredMapping[]) {
  const allCourses = await prisma.course.findMany({ select: { id: true, code: true } });
  const courseIdsByCode = new Map<string, string[]>();
  for (const course of allCourses) {
    const key = normalizeCode(course.code);
    const ids = courseIdsByCode.get(key) ?? [];
    ids.push(course.id);
    courseIdsByCode.set(key, ids);
  }

  const missingCodes = new Set<string>();
  let writes = 0;
  for (const mapping of desiredMappings) {
    const courseIds = courseIdsByCode.get(normalizeCode(mapping.courseCode));
    if (!courseIds?.length) {
      missingCodes.add(mapping.courseCode);
      continue;
    }

    for (const courseId of courseIds) {
      await prisma.courseBranchMapping.upsert({
        where: { courseId_branch_batch: { courseId, branch: mapping.branch, batch: BATCH } },
        update: {
          courseCategory: mapping.category,
          semester: mapping.semester,
          isRequired: false,
        },
        create: {
          courseId,
          branch: mapping.branch,
          batch: BATCH,
          courseCategory: mapping.category,
          semester: mapping.semester,
          isRequired: false,
        },
      });
      writes += 1;
    }
  }

  if (missingCodes.size) {
    throw new Error(
      `Refusing to leave published curriculum rows unmapped; missing catalog courses: ${Array.from(missingCodes).sort().join(", ")}`
    );
  }
  return writes;
}

async function upsertStudents() {
  const students = await getBatch26Entries();
  const enrollmentIds = students.map((student) => student.enrollmentId);
  const programCodeByBranch = new Map(
    B26_BRANCHES.map((branch) => [branch, getProgramLookupBranchCode(branch, 2026)])
  );

  const existingApproved = await prisma.approvedUser.findMany({
    where: { enrollmentId: { in: enrollmentIds } },
    select: { enrollmentId: true },
  });
  const existingApprovedIds = new Set(existingApproved.map((student) => student.enrollmentId).filter(Boolean));

  // Keep the full roster refresh practical over a remote database while not
  // opening hundreds of concurrent connections at once.
  for (let start = 0; start < students.length; start += 25) {
    await Promise.all(students.slice(start, start + 25).map(async (student) => {
      const allowedProgram = programCodeByBranch.get(student.branch);
      if (!allowedProgram) throw new Error(`No B26 program for ${student.branch}`);
      const email = `${student.enrollmentId.toLowerCase()}@students.iitmandi.ac.in`;

      await prisma.approvedUser.upsert({
        where: { enrollmentId: student.enrollmentId },
        update: {
          name: student.name,
          department: student.department,
          branch: student.branch,
          batch: 2026,
          allowedPrograms: [allowedProgram],
          coursePreferenceCodes: student.selectedCourseCodes,
        },
        create: {
          email,
          enrollmentId: student.enrollmentId,
          name: student.name,
          department: student.department,
          branch: student.branch,
          batch: 2026,
          allowedPrograms: [allowedProgram],
          coursePreferenceCodes: student.selectedCourseCodes,
        },
      });
    }));
  }

  // Reconcile already-created accounts without fabricating User records for
  // students who have not signed in yet.
  const programs = await prisma.program.findMany({
    where: { code: { in: Array.from(new Set(programCodeByBranch.values())) } },
    select: { id: true, code: true },
  });
  const programIdByCode = new Map(programs.map((program) => [program.code, program.id]));
  const users = await prisma.user.findMany({
    where: { enrollmentId: { in: enrollmentIds } },
    select: { id: true, enrollmentId: true },
  });
  const studentById = new Map(students.map((student) => [student.enrollmentId, student]));

  for (const user of users) {
    const student = user.enrollmentId ? studentById.get(user.enrollmentId) : undefined;
    if (!student) continue;
    const programCode = programCodeByBranch.get(student.branch);
    const programId = programCode ? programIdByCode.get(programCode) : undefined;
    if (!programId) throw new Error(`Program missing after seed: ${programCode}`);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isApproved: true,
        name: student.name,
        department: student.department,
        branch: student.branch,
        batch: 2026,
      },
    });
    await prisma.userProgram.updateMany({
      where: { userId: user.id, isPrimary: true },
      data: { isPrimary: false },
    });
    await prisma.userProgram.upsert({
      where: { userId_programId: { userId: user.id, programId } },
      update: {
        programType: ProgramType.MAJOR,
        isPrimary: true,
        startSemester: 1,
        status: ProgramStatus.ACTIVE,
      },
      create: {
        userId: user.id,
        programId,
        programType: ProgramType.MAJOR,
        isPrimary: true,
        startSemester: 1,
        status: ProgramStatus.ACTIVE,
      },
    });
  }

  return {
    roster: students.length,
    approvedCreated: students.length - existingApprovedIds.size,
    approvedUpdated: existingApprovedIds.size,
    usersReconciled: users.length,
  };
}

async function main() {
  const students = await getBatch26Entries();
  if (PREFERENCES_ONLY) {
    console.log(`B26 roster: ${students.length} students across ${B26_BRANCHES.length} branches.`);
    console.log(`UG26 source contains no IM26 rows; only B26 enrollment IDs are eligible here.`);
    if (!APPLY) {
      console.log("Dry run only. Re-run with --apply --preferences-only to refresh B26 preference records.");
      return;
    }
    const studentSummary = await upsertStudents();
    console.log(
      `ApprovedUser preferences refreshed: ${studentSummary.approvedCreated} created, ` +
      `${studentSummary.approvedUpdated} updated; ${studentSummary.usersReconciled} signed-in accounts reconciled.`
    );
    return;
  }
  const desiredMappings = await buildDesiredMappings();
  const existingApprovedCount = await prisma.approvedUser.count({
    where: { enrollmentId: { in: students.map((student) => student.enrollmentId) } },
  });
  const existingUsersCount = await prisma.user.count({
    where: { enrollmentId: { in: students.map((student) => student.enrollmentId) } },
  });
  const missingCurriculumCodes = await findMissingCurriculumCodes(desiredMappings);

  console.log(`B26 roster: ${students.length} students across ${B26_BRANCHES.length} branches.`);
  console.log(`UG26 source contains no IM26 rows; only B26 enrollment IDs are eligible here.`);
  console.log(`Curriculum mappings: ${desiredMappings.length} distinct branch/course rows with published codes.`);
  console.log(
    `Mapping counts: ${B26_BRANCHES.map((branch) =>
      `${branch}=${desiredMappings.filter((mapping) => mapping.branch === branch).length}`
    ).join(", ")}.`
  );
  console.log(`ApprovedUser: ${existingApprovedCount} existing, ${students.length - existingApprovedCount} to create.`);
  console.log(`Existing signed-in User accounts to reconcile: ${existingUsersCount}.`);
  console.log(`Programs to upsert: ${B26_PROGRAMS.map((program) => program.code).join(", ")}.`);
  if (missingCurriculumCodes.length) {
    throw new Error(`Published curriculum references absent catalog codes: ${missingCurriculumCodes.join(", ")}`);
  }

  if (!APPLY) {
    console.log("Dry run only. Re-run with --apply to write the B26 access list and curriculum mappings.");
    return;
  }

  await upsertPrograms();
  await ensurePublishedCourses();
  const mappingWrites = await upsertMappings(desiredMappings);
  const studentSummary = await upsertStudents();
  console.log(`Applied ${mappingWrites} CourseBranchMapping upserts.`);
  console.log(
    `ApprovedUser: ${studentSummary.approvedCreated} created, ${studentSummary.approvedUpdated} updated; ` +
    `${studentSummary.usersReconciled} signed-in accounts reconciled.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
