import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DOT_LEADER_RE = /\s*(?:\.(?:\s|\u00a0)*){4,}\d+\s*$/;

function cleanCourseName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  return trimmed.replace(DOT_LEADER_RE, "").trim();
}

const DEPARTMENT_NORMALIZATION: Record<string, string> = {
  ElectricalEngineering: "Electrical Engineering",
  ComputerScience: "Computer Science",
  CivilEngineering: "Civil Engineering",
  MechanicalEngineering: "Mechanical Engineering",
  BioEngineering: "Bioengineering",
  DataScience: "Data Science",

  IC: "Institute Core",
  EP: "Engineering Physics",
  EN: "Humanities",
  IK: "Indian Knowledge Systems",
};

function normalizeDepartment(department: string): string {
  return DEPARTMENT_NORMALIZATION[department] ?? department;
}

function hasArg(flag: string) {
  return process.argv.includes(flag);
}

type CourseRow = {
  id: string;
  code: string;
  name: string;
  credits: number;
  department: string;
  isActive: boolean;
};

type Change = {
  code: string;
  before: Pick<CourseRow, "name" | "department" | "isActive">;
  after: Pick<CourseRow, "name" | "department" | "isActive">;
  reason: string[];
};

async function main() {
  const apply = hasArg("--apply");
  const deactivateHyphenDuplicates = hasArg("--deactivate-hyphen-duplicates");
  const deactivatePlaceholders = hasArg("--deactivate-placeholders");

  const courses = await prisma.course.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      credits: true,
      department: true,
      isActive: true,
    },
  });

  const byCode = new Map<string, CourseRow>();
  for (const c of courses) byCode.set(c.code, c);

  const sampleSeedCodes = new Set([
    "CS101",
    "CS102",
    "CS201",
    "CS301",
    "CS302",
    "CS401",
    "CS402",
    "MATH201",
    "MATH202",
    "MATH301",
  ]);

  const changes: Change[] = [];

  for (const course of courses) {
    const reasons: string[] = [];
    const cleanedName = cleanCourseName(course.name);
    const normalizedDepartment = normalizeDepartment(course.department);

    let nextIsActive = course.isActive;

    if (cleanedName !== course.name) reasons.push("clean-name");
    if (normalizedDepartment !== course.department) reasons.push("normalize-department");

    if (deactivatePlaceholders) {
      if (sampleSeedCodes.has(course.code)) {
        nextIsActive = false;
        reasons.push("deactivate-sample-seed");
      }

      if (course.code.includes("XXX") || course.code === "IS-4991" || course.code === "SP-46") {
        nextIsActive = false;
        reasons.push("deactivate-placeholder");
      }
    }

    if (deactivateHyphenDuplicates && course.code.includes("-")) {
      const canonical = course.code.replace(/-/g, "");
      const canonicalCourse = byCode.get(canonical);
      const canonicalIsPlaceholder =
        sampleSeedCodes.has(canonical) ||
        canonical.includes("XXX") ||
        canonical === "IS-4991" ||
        canonical === "SP-46";

      const canonicalLooksClean =
        !!canonicalCourse && !DOT_LEADER_RE.test(canonicalCourse.name);

      const currentLooksExtracted =
        DOT_LEADER_RE.test(course.name) && course.code.includes("-");

      if (canonicalCourse && canonicalCourse.isActive && canonicalLooksClean && currentLooksExtracted && !canonicalIsPlaceholder) {
        nextIsActive = false;
        reasons.push("deactivate-hyphen-duplicate");
      }
    }

    if (
      cleanedName !== course.name ||
      normalizedDepartment !== course.department ||
      nextIsActive !== course.isActive
    ) {
      changes.push({
        code: course.code,
        before: {
          name: course.name,
          department: course.department,
          isActive: course.isActive,
        },
        after: {
          name: cleanedName,
          department: normalizedDepartment,
          isActive: nextIsActive,
        },
        reason: reasons,
      });
    }
  }

  const summary = {
    totalCourses: courses.length,
    changes: changes.length,
    nameFixes: changes.filter((c) => c.reason.includes("clean-name")).length,
    deptFixes: changes.filter((c) => c.reason.includes("normalize-department")).length,
    deactivations: changes.filter((c) => c.before.isActive && !c.after.isActive).length,
    sampleSeedFound: courses.filter((c) => sampleSeedCodes.has(c.code)).length,
    dotLeaderNamesFound: courses.filter((c) => DOT_LEADER_RE.test(c.name)).length,
  };

  console.log("Course catalog cleanup (dry-run)");
  console.log(JSON.stringify({ summary, flags: { apply, deactivateHyphenDuplicates, deactivatePlaceholders } }, null, 2));

  const exampleChanges = changes.slice(0, 25).map((c) => ({
    code: c.code,
    beforeName: c.before.name,
    afterName: c.after.name,
    beforeDepartment: c.before.department,
    afterDepartment: c.after.department,
    deactivate: c.before.isActive && !c.after.isActive,
    reason: c.reason,
  }));
  console.log("\nExamples:");
  console.log(JSON.stringify(exampleChanges, null, 2));

  if (!apply) return;

  const reportsDir = path.join(process.cwd(), "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(reportsDir, `course-catalog-cleanup-${stamp}.json`);
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        flags: { deactivateHyphenDuplicates, deactivatePlaceholders },
        summary,
        changes,
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log(`\nApplying ${changes.length} updates...`);
  const batchSize = 50;
  for (let i = 0; i < changes.length; i += batchSize) {
    const batch = changes.slice(i, i + batchSize);
    await prisma.$transaction(
      batch.map((c) =>
        prisma.course.update({
          where: { code: c.code },
          data: {
            name: c.after.name,
            department: c.after.department,
            isActive: c.after.isActive,
          },
        })
      )
    );
    console.log(`  ✓ ${Math.min(i + batchSize, changes.length)} / ${changes.length}`);
  }

  console.log(`\n✅ Done. Report saved to: ${reportPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
