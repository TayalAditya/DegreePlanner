/**
 * Synchronise course-category mappings with the authoritative
 * `scripts/_dc_data.json` extraction of `DC IIT Mandi.pdf`.
 *
 * Safety policy:
 * - Every source DC course receives a batch-specific DC mapping.  Catalogue
 *   equivalents are included so an older/newer code still fulfils the same
 *   official core requirement.
 * - A currently-DC course not found in that source is demoted to DE only when
 *   its code belongs to the target programme's parent school.
 * - A non-parent-school course is never auto-classified as DE.  It is reported
 *   for owner confirmation and left untouched.
 *
 * Run without arguments for a dry run.  Add `--apply` to write the changes.
 */
import fs from "fs";
import path from "path";
import { PrismaClient, CourseCategoryType } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const UPSERT_CHUNK_SIZE = 250;

type SourceRow = [string, string, number, ...string[]];
type SourceBranch = { header: string[]; rows: SourceRow[] };
type SourceData = Record<string, SourceBranch>;

const dcSource = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "scripts", "_dc_data.json"), "utf8")
) as SourceData;

const PARENT_SCHOOL: Record<string, string> = {
  CSE: "SCEE", DSE: "SCEE", DSAI: "SCEE", EE: "SCEE", MEVLSI: "SCEE",
  MNC: "SMSS", ME: "SMME", MSE: "SMME",
  "GE-ROBO": "SMME", "GE-MECH": "SMME", "GE-COMM": "SMME",
  "GE-OPEN": "SMME", "GE-FIN": "SMME", GE: "SMME",
  CE: "SCENE", EP: "SPS", BE: "SBE", BSCS: "SCS",
};

function normalise(value: string) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function sourceCodeVariants(rawCode: string) {
  const values = new Set<string>();
  const matches = String(rawCode).toUpperCase().matchAll(
    /([A-Z]{2,4})-((?:\d{3}|X{3}))(\(\+?P?\)|P)?/g
  );
  for (const match of matches) {
    const base = `${match[1]}-${match[2]}`;
    // `XX-123P` names one lab course.  `XX-123(+P)` means the source
    // deliberately groups the theory and lab components together.
    if (match[3] === "P") {
      values.add(normalise(`${base}P`));
    } else {
      values.add(normalise(base));
      if (match[3]?.includes("P")) values.add(normalise(`${base}P`));
    }
  }
  return values;
}

function courseSchool(code: string) {
  const prefix = String(code).toUpperCase().split("-")[0];
  if (["CS", "DS", "EE", "VL"].includes(prefix)) return "SCEE";
  if (prefix === "MA") return "SMSS";
  if (["ME", "MT", "AR"].includes(prefix)) return "SMME";
  if (prefix === "CE") return "SCENE";
  if (["BE", "BY"].includes(prefix)) return "SBE";
  if (["EP", "PH", "QT", "QS"].includes(prefix)) return "SPS";
  if (["CY", "CH"].includes(prefix)) return "SCS";
  return "OTHER";
}

function isSemester(value: unknown) {
  return /^\d+$/.test(String(value).trim());
}

type CourseIndex = {
  id: string;
  code: string;
  name: string;
  equivalentKeys: string[];
};

async function main() {
  const courses = await prisma.course.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      equivalents: { select: { equivalent: { select: { code: true } } } },
      equivalentFor: { select: { course: { select: { code: true } } } },
    },
  });

  // The catalogue contains some legacy/current aliases as separate Course rows
  // (`CS201` and `CS-201`, for example).  Keep every row for a normalized key
  // so a source DC mapping reaches both representations.
  const byKey = new Map<string, CourseIndex[]>();
  for (const course of courses) {
    const key = normalise(course.code);
    const entries = byKey.get(key) ?? [];
    entries.push({
      id: course.id,
      code: course.code,
      name: course.name,
      equivalentKeys: [
        ...course.equivalents.map((row) => normalise(row.equivalent.code)),
        ...course.equivalentFor.map((row) => normalise(row.course.code)),
      ],
    });
    byKey.set(key, entries);
  }

  const expandEquivalents = (seed: Set<string>) => {
    const result = new Set(seed);
    const queue = [...seed];
    while (queue.length) {
      const key = queue.pop()!;
      for (const course of byKey.get(key) ?? []) {
        for (const equivalent of course.equivalentKeys) {
          if (!result.has(equivalent)) {
            result.add(equivalent);
            queue.push(equivalent);
          }
        }
      }
    }
    return result;
  };

  // The reference records EE-261 as one 5-credit core course.  The catalogue
  // stores its 3+2 theory/lab components separately, so both must score as DC.
  const addKnownComponents = (branch: string, keys: Set<string>) => {
    if (keys.has("EE261")) keys.add("EE261P");
    // These source rows intentionally use generic/legacy identifiers while
    // the catalogue has the current branch-specific offering code.  The
    // identical title and credit value make them safe core aliases.
    if (branch === "BE" && keys.has("BEXXX")) keys.add("BE101P");
    if (branch === "CE" && keys.has("CEXXX")) keys.add("CE356");
    if (branch === "CE" && keys.has("CE305P")) keys.add("CE306P");
    if (branch === "MNC" && keys.has("MA323P")) keys.add("CS207");
    return keys;
  };

  const expected = new Map<string, Map<string, number>>();
  const expectedAny = new Map<string, Set<string>>();
  const missingSourceCourses: string[] = [];

  for (const [branch, source] of Object.entries(dcSource)) {
    const columns = new Map(source.header.map((name, index) => [name, index]));
    for (const year of [2023, 2024, 2025, 2026]) {
      const semesterColumn = `B${String(year).slice(2)} (Sem)`;
      const semesterIndex = columns.get(semesterColumn);
      if (semesterIndex === undefined) continue;

      const branchBatch = `${branch}|${year}`;
      const byCourse = new Map<string, number>();
      for (const row of source.rows) {
        const semesterValue = row[semesterIndex];
        if (!isSemester(semesterValue)) continue;
        const semester = Number(semesterValue);
        const rawKeys = addKnownComponents(branch, sourceCodeVariants(row[0]));
        const keys = expandEquivalents(rawKeys);
        let matchedCatalogueCourse = false;
        for (const key of keys) {
          const matchingCourses = byKey.get(key) ?? [];
          if (!matchingCourses.length) continue;
          matchedCatalogueCourse = true;
          for (const course of matchingCourses) {
            byCourse.set(course.id, semester);
            const allForBranch = expectedAny.get(branch) ?? new Set<string>();
            allForBranch.add(course.id);
            expectedAny.set(branch, allForBranch);
          }
        }
        if (!matchedCatalogueCourse) missingSourceCourses.push(`${branchBatch}: ${row[0]}`);
      }
      expected.set(branchBatch, byCourse);
    }
  }

  const sourceUpsertByKey = new Map<string, { courseId: string; branch: string; batch: string; semester: number }>();
  for (const [branchBatch, courseSemesters] of expected) {
    const [branch, batch] = branchBatch.split("|");
    for (const [courseId, semester] of courseSemesters) {
      sourceUpsertByKey.set(`${courseId}|${branch}|${batch}`, { courseId, branch, batch, semester });
    }
  }
  const sourceUpserts = [...sourceUpsertByKey.values()];

  // The database can drop a long-lived Prisma connection while a large mapping
  // sync is running.  Small transactions plus a reconnect-and-retry keep the
  // operation idempotent and resumable instead of leaving a half-finished run.
  const runWithReconnect = async <T>(work: () => Promise<T>) => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        return await work();
      } catch (error: any) {
        lastError = error;
        if (error?.code !== "P1017" || attempt === 4) throw error;
        await prisma.$disconnect();
        await prisma.$connect();
      }
    }
    throw lastError;
  };

  const sourceBranches = [...new Set(sourceUpserts.map((row) => row.branch))];
  const sourceBatches = [...new Set(sourceUpserts.map((row) => row.batch))];
  const sourceCourseIds = [...new Set(sourceUpserts.map((row) => row.courseId))];
  const existingSourceRows = await runWithReconnect(() => prisma.courseBranchMapping.findMany({
    where: {
      branch: { in: sourceBranches },
      batch: { in: sourceBatches },
      courseId: { in: sourceCourseIds },
    },
    select: { id: true, courseId: true, branch: true, batch: true, courseCategory: true, semester: true },
  }));
  const existingSourceByKey = new Map(existingSourceRows.map((row) => [
    `${row.courseId}|${row.branch}|${row.batch}`, row,
  ]));
  const creates = sourceUpserts.filter((row) =>
    !existingSourceByKey.has(`${row.courseId}|${row.branch}|${row.batch}`)
  );
  const updates = sourceUpserts.filter((row) => {
    const existing = existingSourceByKey.get(`${row.courseId}|${row.branch}|${row.batch}`);
    return !!existing && (existing.courseCategory !== CourseCategoryType.DC || existing.semester !== row.semester);
  });

  if (APPLY) {
    // createMany is one statement per chunk rather than one round trip per
    // mapping.  This is essential for the remote database connection used by
    // this project.  Re-running after interruption is harmless because the
    // rows are unique on courseId/branch/batch.
    for (let start = 0; start < creates.length; start += UPSERT_CHUNK_SIZE) {
      const chunk = creates.slice(start, start + UPSERT_CHUNK_SIZE);
      await runWithReconnect(() => prisma.courseBranchMapping.createMany({
        data: chunk.map(({ courseId, branch, batch, semester }) => ({
          courseId, branch, batch, semester, courseCategory: CourseCategoryType.DC,
        })),
        skipDuplicates: true,
      }));
    }
    for (let start = 0; start < updates.length; start += UPSERT_CHUNK_SIZE) {
      const chunk = updates.slice(start, start + UPSERT_CHUNK_SIZE);
      await runWithReconnect(() => prisma.$transaction(chunk.map(({ courseId, branch, batch, semester }) =>
        prisma.courseBranchMapping.update({
          where: { courseId_branch_batch: { courseId, branch, batch } },
          data: { courseCategory: CourseCategoryType.DC, semester },
        })
      )));
    }
    console.log(`Created ${creates.length} and updated ${updates.length} DC mappings`);
  }

  const directBranches = [...Object.keys(PARENT_SCHOOL)];
  const existingDc = await prisma.courseBranchMapping.findMany({
    where: { branch: { in: directBranches }, courseCategory: CourseCategoryType.DC },
    include: { course: { select: { code: true, name: true, credits: true } } },
  });

  const parentDemotions: typeof existingDc = [];
  const externalPending: typeof existingDc = [];
  for (const mapping of existingDc) {
    const appliesForBatch = mapping.batch
      ? expected.get(`${mapping.branch}|${mapping.batch}`)?.has(mapping.courseId) ?? false
      : expectedAny.get(mapping.branch)?.has(mapping.courseId) ?? false;
    if (appliesForBatch) continue;

    if (courseSchool(mapping.course.code) === PARENT_SCHOOL[mapping.branch]) {
      parentDemotions.push(mapping);
    } else {
      externalPending.push(mapping);
    }
  }

  if (APPLY) {
    await runWithReconnect(() => prisma.$transaction(parentDemotions.map((mapping) =>
      prisma.courseBranchMapping.update({
        where: { id: mapping.id },
        data: { courseCategory: CourseCategoryType.DE, semester: null },
      })
    )));
  }

  console.log(`${APPLY ? "APPLIED" : "DRY RUN"}: ${sourceUpserts.length} source-DC batch mappings`);
  console.log(`Source mapping delta: ${creates.length} creates, ${updates.length} updates, ${sourceUpserts.length - creates.length - updates.length} already correct`);
  console.log(`${APPLY ? "APPLIED" : "WOULD APPLY"}: ${parentDemotions.length} parent-school DC -> DE corrections`);
  console.log(`PENDING OWNER CONFIRMATION: ${externalPending.length} non-parent DC mappings`);
  for (const mapping of externalPending.sort((a, b) =>
    a.branch.localeCompare(b.branch) || a.course.code.localeCompare(b.course.code)
  )) {
    console.log(
      `  ${mapping.branch}\t${mapping.batch || "all"}\t${mapping.course.code}\t${mapping.course.name}\t${mapping.course.credits}cr\t${courseSchool(mapping.course.code)}`
    );
  }
  if (missingSourceCourses.length) {
    console.log(`SOURCE CODES NOT IN CATALOGUE: ${missingSourceCourses.length}`);
    for (const item of [...new Set(missingSourceCourses)].slice(0, 30)) console.log(`  ${item}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
