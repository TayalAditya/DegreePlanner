import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import prisma from "@/lib/prisma";
import { inferBatchYear } from "@/lib/academicCalendar";

// ---------------------------------------------------------------------------
// SPRING off-by-one year fix — unified migration for every table that stores
// {semester, year, term}: CourseEnrollment, TimetableEntry, CourseSuggestion.
//
// Old buggy year:  batchYear + floor((semester - 1) / 2)
// Correct year:    batchYear + floor(semester / 2)
//
// These agree for FALL (odd) semesters and differ by exactly +1 for SPRING
// (even) semesters. So the fix for every affected row is simply year += 1.
//
// We ONLY touch a SPRING row whose stored year equals the buggy value for that
// row's batch (CourseEnrollment/CourseSuggestion: owning user; TimetableEntry:
// createdBy). Rows with any other year are reported as anomalies and left alone.
//
// CourseEnrollment is the only table with a unique constraint
// (userId_courseId_semester_year_term); we abort if incrementing would collide.
//
// Usage:  tsx scripts/fix-spring-years.ts            (dry-run)
//         tsx scripts/fix-spring-years.ts --apply    (write + backup)
// ---------------------------------------------------------------------------

const APPLY = process.argv.includes("--apply");

type Victim = { table: string; id: string; semester: number; term: string; oldYear: number; newYear: number };
type Anomaly = { table: string; id: string; semester: number; term: string; year: number; expected: number };

async function main() {
  const batchCache = new Map<string, number | null>();
  const batchYearFor = async (userId: string | null | undefined) => {
    if (!userId) return null;
    if (batchCache.has(userId)) return batchCache.get(userId)!;
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { batch: true, enrollmentId: true },
    });
    const by = u ? inferBatchYear(u.batch, u.enrollmentId) : null;
    batchCache.set(userId, by);
    return by;
  };

  const victims: Victim[] = [];
  const anomalies: Anomaly[] = [];
  const noBatch: string[] = [];

  // Classify one row. ownerId = whose batch determines the academic year.
  const classify = (
    table: string,
    id: string,
    semester: number,
    year: number,
    term: string,
    batchYear: number
  ) => {
    const expected = batchYear + Math.floor(semester / 2);
    const buggy = batchYear + Math.floor((semester - 1) / 2);
    if (year === expected) return; // already correct
    if (term === "SPRING" && semester % 2 === 0 && year === buggy) {
      victims.push({ table, id, semester, term, oldYear: year, newYear: expected });
    } else {
      anomalies.push({ table, id, semester, term, year, expected });
    }
  };

  // ---- CourseEnrollment ----
  const enrollments = await prisma.courseEnrollment.findMany({
    select: { id: true, userId: true, courseId: true, semester: true, year: true, term: true },
  });
  // For collision detection: existing (userId|courseId|semester|year|term) keys.
  const enrollKeys = new Set(
    enrollments.map((e) => `${e.userId}|${e.courseId}|${e.semester}|${e.year}|${e.term}`)
  );
  for (const e of enrollments) {
    const by = await batchYearFor(e.userId);
    if (by == null) { noBatch.push(`enrollment ${e.id}`); continue; }
    classify("CourseEnrollment", e.id, e.semester, e.year, e.term, by);
  }

  // Collision check for the enrollment victims only (only table with a unique key).
  const collisions: string[] = [];
  const enrollById = new Map(enrollments.map((e) => [e.id, e]));
  for (const v of victims.filter((v) => v.table === "CourseEnrollment")) {
    const e = enrollById.get(v.id)!;
    const targetKey = `${e.userId}|${e.courseId}|${e.semester}|${v.newYear}|${e.term}`;
    if (enrollKeys.has(targetKey)) collisions.push(`${e.id} -> ${targetKey}`);
  }

  // ---- TimetableEntry (keyed by creator's batch) ----
  const tEntries = await prisma.timetableEntry.findMany({
    select: { id: true, semester: true, year: true, term: true, createdById: true },
  });
  for (const e of tEntries) {
    if (e.term !== "SPRING") continue;
    const by = await batchYearFor(e.createdById);
    if (by == null) { noBatch.push(`timetable ${e.id}`); continue; }
    classify("TimetableEntry", e.id, e.semester, e.year, e.term, by);
  }

  // ---- CourseSuggestion (keyed by owning user's batch) ----
  const suggestions = await prisma.courseSuggestion.findMany({
    select: { id: true, userId: true, semester: true, year: true, term: true },
  });
  for (const s of suggestions) {
    if (s.semester == null || s.year == null || s.term == null) continue;
    if (s.term !== "SPRING") continue;
    const by = await batchYearFor(s.userId);
    if (by == null) { noBatch.push(`suggestion ${s.id}`); continue; }
    classify("CourseSuggestion", s.id, s.semester, s.year, s.term, by);
  }

  // ---- Report ----
  const byTable = (t: string) => victims.filter((v) => v.table === t).length;
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`Victims to fix (year += 1):`);
  console.log(`  CourseEnrollment: ${byTable("CourseEnrollment")}`);
  console.log(`  TimetableEntry:   ${byTable("TimetableEntry")}`);
  console.log(`  CourseSuggestion: ${byTable("CourseSuggestion")}`);
  console.log(`  TOTAL:            ${victims.length}`);
  console.log(`Anomalies (untouched): ${anomalies.length}`);
  console.log(`Rows skipped (no batch year): ${noBatch.length}`);
  console.log(`Enrollment unique-constraint collisions: ${collisions.length}`);

  if (anomalies.length) {
    console.log("\nANOMALIES (manual review):");
    console.log(anomalies.slice(0, 40).map((a) => `  ${a.table} ${a.id} sem ${a.semester} ${a.term} ${a.year} (expected ${a.expected})`).join("\n"));
    if (anomalies.length > 40) console.log(`  ...and ${anomalies.length - 40} more`);
  }
  if (collisions.length) {
    console.log("\nCOLLISIONS (would violate unique constraint):");
    console.log(collisions.join("\n"));
  }

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply to write changes.");
    return;
  }

  if (collisions.length) {
    console.log("\nABORTING apply: collisions detected. Resolve them before applying.");
    return;
  }

  // ---- Backup ----
  const backupDir = join(process.cwd(), "scripts", "backups");
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(backupDir, `spring-year-fix-${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify({ generatedAt: stamp, victims, anomalies }, null, 2));
  console.log(`\nBackup written: ${backupPath}`);

  // ---- Apply (year += 1 per victim, chunked per table) ----
  const chunk = <T,>(arr: T[], n: number) => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };

  const applyTable = async (
    table: string,
    update: (ids: string[]) => Promise<{ count: number }>
  ) => {
    const ids = victims.filter((v) => v.table === table).map((v) => v.id);
    let done = 0;
    for (const c of chunk(ids, 200)) {
      const { count } = await update(c);
      done += count;
    }
    console.log(`  ${table}: updated ${done}`);
  };

  console.log("\nApplying (year += 1):");
  await applyTable("CourseEnrollment", (ids) =>
    prisma.courseEnrollment.updateMany({ where: { id: { in: ids } }, data: { year: { increment: 1 } } })
  );
  await applyTable("TimetableEntry", (ids) =>
    prisma.timetableEntry.updateMany({ where: { id: { in: ids } }, data: { year: { increment: 1 } } })
  );
  await applyTable("CourseSuggestion", (ids) =>
    prisma.courseSuggestion.updateMany({ where: { id: { in: ids } }, data: { year: { increment: 1 } } })
  );
  console.log("Done.");
}

main()
  .catch((e) => console.error(e))
  .finally(() => process.exit(0));
