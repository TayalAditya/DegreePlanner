import prisma from "@/lib/prisma";
import { EnrollmentStatus, Term } from "@prisma/client";
import { inferAcademicState, inferBatchYear } from "@/lib/academicCalendar";

export type CurrentTimetableContext = {
  semester: number;
  year: number;
  term: Term;
};

const TERM_ORDER: Record<Term, number> = {
  SPRING: 1,
  SUMMER: 2,
  FALL: 3,
};

// Derive the {year, term} for a semester the same way enrollments are stored:
// Fall (odd) opens the academic year, Spring (even) is the next calendar year.
function contextFromSemester(semester: number, batchYear: number): CurrentTimetableContext {
  return {
    semester,
    year: batchYear + Math.floor(semester / 2),
    term: semester % 2 === 1 ? Term.FALL : Term.SPRING,
  };
}

export async function getCurrentTimetableContext(userId: string): Promise<CurrentTimetableContext> {
  const [user, enrollments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { batch: true, enrollmentId: true },
    }),
    prisma.courseEnrollment.findMany({
      where: { userId },
      select: { semester: true, year: true, term: true, status: true },
    }),
  ]);

  // Prefer the academic calendar's current semester — same as the dashboard
  // (app/dashboard/page.tsx). This keeps the timetable in step with the term
  // even when the student has no in-progress courses yet (e.g. between
  // semesters or during pre-registration), instead of getting stuck on the
  // highest completed semester.
  const batchYear = inferBatchYear(user?.batch, user?.enrollmentId);
  if (batchYear) {
    const state = inferAcademicState(batchYear);
    if (state.currentSemester) {
      return contextFromSemester(state.currentSemester, batchYear);
    }
  }

  // Fallback (batch year unknown): derive from the student's own enrollments.
  if (enrollments.length === 0) {
    return {
      semester: 1,
      year: new Date().getFullYear(),
      term: Term.FALL,
    };
  }

  const inProgress = enrollments.filter((e) => e.status === EnrollmentStatus.IN_PROGRESS);
  const pool = inProgress.length > 0 ? inProgress : enrollments;
  const semester = Math.max(1, ...pool.map((e) => e.semester || 0));

  const semesterPool = pool.filter((e) => e.semester === semester);
  const best = semesterPool.reduce((acc, cur) => {
    if (cur.year > acc.year) return cur;
    if (cur.year < acc.year) return acc;
    return TERM_ORDER[cur.term] > TERM_ORDER[acc.term] ? cur : acc;
  }, semesterPool[0]);

  return { semester, year: best.year, term: best.term };
}
